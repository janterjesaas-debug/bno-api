import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/mews/enriched-lite
 *
 * - Henter availability for dato-range
 * - Henter space/resource categories (best-effort)
 * - Tidsavbrudd på eksterne kall + watchdog (20s) slik at Vercel ikke henger
 *
 * Viktig: Mews krever at FirstTimeUnitStartUtc/LastTimeUnitStartUtc treffer
 * starten på TimeUnit for servicen (lokal 00:00 konvertert til UTC).
 * Dette styres her via MEWS_TIMEUNIT_OFFSET_MINUTES (f.eks. 120 for CEST, 60 for CET).
 */

type CommonBody = {
  ClientToken: string;
  AccessToken: string;
  Client: string;
};

function envRequired(name: string): string {
  const v = (process.env[name] ?? '').trim();
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function envNumber(name: string, fallback: number): number {
  const raw = (process.env[name] ?? '').trim();
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Lag "TimeUnit start" i UTC ved å flytte lokal midnatt til UTC med gitt offset (minutter). */
function toTimeUnitUtc(dateYmd: string, offsetMinutes: number): string {
  // dateYmd er YYYY-MM-DD (lokal kalenderdato). "Lokal 00:00" MINUS offset => UTC-tid.
  // Eks: offset=120 (CEST) -> YYYY-MM-DDT00:00:00-02:00 == (UTC) YYYY-MM-(DD-1)T22:00:00Z
  // Vi regner det ut eksplisitt:
  const d = new Date(`${dateYmd}T00:00:00Z`); // start med 00:00Z
  // flytt PLUSS offset *negativt* for å komme til UTC-starten:
  d.setUTCMinutes(d.getUTCMinutes() - offsetMinutes);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z'); // trim millisek
}

async function postJsonWithTimeout(
  url: string,
  body: unknown,
  timeoutMs: number
): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  if (!res.ok) {
    // Sørg for god feildiagnose:
    throw new Error(`${url} -> ${res.status} ${res.statusText}: ${text.slice(0, 600)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON from ${url}: ${text.slice(0, 300)}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Lynsjekk
  if (req.query.debug === '1') {
    res.status(200).json({ ok: true, route: '/api/mews/enriched-lite', now: new Date().toISOString() });
    return;
  }

  // Watchdog: svar alltid innen 20 sekunder
  const watchdog = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({ ok: false, error: 'Overall timeout (20s) – upstream too slow' });
    }
  }, 20_000);

  try {
    const BASE = envRequired('MEWS_BASE_URL').replace(/\/+$/, '');
    const CLIENT_TOKEN = envRequired('MEWS_CLIENT_TOKEN');
    const ACCESS_TOKEN = envRequired('MEWS_ACCESS_TOKEN');
    const SERVICE_ID = envRequired('MEWS_SERVICE_ID');
    const ENTERPRISE_ID = (process.env.MEWS_ENTERPRISE_ID ?? '').trim();
    const CLIENT_NAME = (process.env.MEWS_CLIENT_NAME ?? 'BNO Travel Booking 1.0.0').trim();

    // Viktig: bruk miljøvariabel for å treffe TimeUnit-start i UTC
    const OFFSET_MIN = envNumber('MEWS_TIMEUNIT_OFFSET_MINUTES', 120); // 120=CEST, 60=CET

    const start = String(req.query.start ?? '').trim(); // YYYY-MM-DD (lokal kalenderdato)
    const end = String(req.query.end ?? '').trim();
    const adults = Number(String(req.query.adults ?? '2')) || 2;

    if (!start || !end) {
      res.status(400).json({ ok: false, error: 'Missing start/end (YYYY-MM-DD)' });
      return;
    }

    const startUtc = toTimeUnitUtc(start, OFFSET_MIN);
    const endUtc   = toTimeUnitUtc(end, OFFSET_MIN);

    const common: CommonBody = {
      ClientToken: CLIENT_TOKEN,
      AccessToken: ACCESS_TOKEN,
      Client: CLIENT_NAME,
    };

    // 1) Availability (9s)
    const availabilityP = postJsonWithTimeout(
      `${BASE}/services/getAvailability`,
      {
        ...common,
        ServiceId: SERVICE_ID,
        FirstTimeUnitStartUtc: startUtc,
        LastTimeUnitStartUtc: endUtc,
      },
      9_000
    );

    // 2) Categories (best-effort, 12s). Prøv både space- og resource-varianter.
    const categoriesP = ENTERPRISE_ID
      ? Promise.race([
          postJsonWithTimeout(
            `${BASE}/spaceCategories/getAll`,
            { ...common, EnterpriseId: ENTERPRISE_ID, ActiveOnly: true },
            12_000
          ),
          postJsonWithTimeout(
            `${BASE}/resourceCategories/getAll`,
            { ...common, EnterpriseId: ENTERPRISE_ID, ActiveOnly: true },
            12_000
          ),
        ]).catch(() => ({ SpaceCategories: [], ResourceCategories: [] }))
      : Promise.resolve({ SpaceCategories: [], ResourceCategories: [] });

    let availability: any;
    let categoriesRaw: any;

    try {
      [availability, categoriesRaw] = await Promise.all([availabilityP, categoriesP]);
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (!res.headersSent) {
        res.status(502).json({ ok: false, error: `Availability failed: ${msg}`, hint: { startUtc, endUtc, OFFSET_MIN } });
      }
      return;
    }

    const DatesUtc: string[] = availability?.DatesUtc ?? availability?.TimeUnitStartsUtc ?? [];
    const CatAvail: Array<{ CategoryId: string; Availabilities: number[] }> =
      availability?.CategoryAvailabilities ?? [];

    const catList: Array<{ Id: string; Name?: string; Capacity?: number; Description?: string }> =
      categoriesRaw?.SpaceCategories ??
      categoriesRaw?.ResourceCategories ??
      categoriesRaw?.Categories ??
      [];

    const catMap = new Map<string, { Name?: string; Capacity?: number; Description?: string }>();
    for (const c of catList) {
      if (c && c.Id) catMap.set(c.Id, c);
    }

    const categories = CatAvail.map((row) => {
      const meta = catMap.get(row.CategoryId) || {};
      return {
        categoryId: row.CategoryId,
        name: meta.Name ?? null,
        capacity: meta.Capacity ?? null,
        description: meta.Description ?? null,
        imageUrls: [] as string[], // (kan fylles på senere)
        availabilities: Array.isArray(row.Availabilities) ? row.Availabilities : [],
      };
    });

    if (!res.headersSent) {
      res.status(200).json({
        ok: true,
        start,
        end,
        adults,
        datesUtc: DatesUtc,
        categories,
        debug: { startUtc, endUtc, OFFSET_MIN },
      });
    }
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: msg });
    }
  } finally {
    clearTimeout(watchdog);
  }
}

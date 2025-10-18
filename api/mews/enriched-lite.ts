import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/mews/enriched-lite?start=YYYY-MM-DD&end=YYYY-MM-DD&adults=2
 * Miljøvariabler (i Vercel -> Project Settings -> Environment Variables):
 *  - MEWS_BASE_URL
 *  - MEWS_CLIENT_TOKEN
 *  - MEWS_ACCESS_TOKEN
 *  - MEWS_SERVICE_ID
 *  - (valgfritt) MEWS_ENTERPRISE_ID
 *  - (valgfritt) MEWS_CLIENT_NAME
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

async function postJsonWithTimeout(url: string, body: unknown, timeoutMs: number): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${url} -> ${response.status} ${response.statusText}: ${text.slice(0, 600)}`);
    try { return JSON.parse(text); } catch { throw new Error(`Non-JSON from ${url}: ${text.slice(0, 300)}`); }
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Rask sanity-sjekk
  if (req.query.debug === '1') {
    res.status(200).json({ ok: true, debug: 'enriched-lite route is alive' });
    return;
  }

  // Hard watchdog: svar uansett innen ~20s
  const watchdog = setTimeout(() => {
    if (!res.headersSent) res.status(504).json({ ok: false, error: 'Overall timeout (20s)' });
  }, 20_000);

  try {
    const BASE = envRequired('MEWS_BASE_URL').replace(/\/+$/, '');
    const CLIENT_TOKEN = envRequired('MEWS_CLIENT_TOKEN');
    const ACCESS_TOKEN = envRequired('MEWS_ACCESS_TOKEN');
    const SERVICE_ID = envRequired('MEWS_SERVICE_ID');
    const ENTERPRISE_ID = (process.env.MEWS_ENTERPRISE_ID ?? '').trim();
    const CLIENT_NAME = (process.env.MEWS_CLIENT_NAME ?? 'BNO Travel Booking 1.0.0').trim();

    const start = String(req.query.start ?? '').trim();
    const end = String(req.query.end ?? '').trim();
    const adults = Number(String(req.query.adults ?? '2')) || 2;

    if (!start || !end) {
      res.status(400).json({ ok: false, error: 'Missing start/end (YYYY-MM-DD)' });
      return;
    }

    const startUtc = `${start}T00:00:00Z`;
    const endUtc = `${end}T00:00:00Z`;

    const common: CommonBody = {
      ClientToken: CLIENT_TOKEN,
      AccessToken: ACCESS_TOKEN,
      Client: CLIENT_NAME,
    };

    // Kjør MEWS-kall parallelt med har(d)e per-kall-timeouts
    const availabilityP = postJsonWithTimeout(
      `${BASE}/services/getAvailability`,
      { ...common, ServiceId: SERVICE_ID, FirstTimeUnitStartUtc: startUtc, LastTimeUnitStartUtc: endUtc },
      9_000
    );

    const categoriesP = ENTERPRISE_ID
      ? Promise.race([
          postJsonWithTimeout(`${BASE}/resourceCategories/getAll`, { ...common, EnterpriseId: ENTERPRISE_ID, ActiveOnly: true }, 12_000),
          postJsonWithTimeout(`${BASE}/spaceCategories/getAll`,    { ...common, EnterpriseId: ENTERPRISE_ID, ActiveOnly: true }, 12_000),
        ]).catch(() => ({ ResourceCategories: [] }))
      : Promise.resolve({ ResourceCategories: [] });

    let availability: any;
    let categories: any;

    try {
      [availability, categories] = await Promise.all([availabilityP, categoriesP]);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (!res.headersSent) res.status(502).json({ ok: false, error: `Availability failed: ${msg}` });
      return;
    }

    const DatesUtc: string[] = availability?.DatesUtc ?? availability?.TimeUnitStartsUtc ?? [];
    const CatAvail: Array<{ CategoryId: string; Availabilities: number[] }> =
      availability?.CategoryAvailabilities ?? [];

    const catList: Array<{ Id: string; Name?: string; Capacity?: number; Description?: string }> =
      categories?.ResourceCategories ?? categories?.SpaceCategories ?? categories?.Categories ?? [];

    const catMap = new Map<string, { Name?: string; Capacity?: number; Description?: string }>();
    for (const c of catList) if (c?.Id) catMap.set(c.Id, c);

    const enriched = CatAvail.map((row) => {
      const meta = catMap.get(row.CategoryId) || {};
      return {
        categoryId: row.CategoryId,
        name: meta.Name ?? null,
        capacity: meta.Capacity ?? null,
        description: meta.Description ?? null,
        imageUrls: null,
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
        categories: enriched,
      });
    }
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ ok: false, error: err?.message || String(err) });
  } finally {
    clearTimeout(watchdog);
  }
}

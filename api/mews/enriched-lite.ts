// api/mews/enriched-lite.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

type CommonBody = { ClientToken: string; AccessToken: string; Client: string };

export const config = {
  // sørger for Node-runtime (ikke Edge). Hvis du også har vercel.json med runtime, er det ok.
  runtime: 'nodejs',
};

function envRequired(name: string): string {
  const v = (process.env[name] ?? '').trim();
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function postJsonWithTimeout(url: string, body: unknown, timeoutMs: number): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}: ${text.slice(0, 600)}`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Non-JSON from ${url}: ${text.slice(0, 300)}`);
    }
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Debug quick check: /api/mews/enriched-lite?debug=1
  if (req.query.debug === '1') {
    res.status(200).json({ ok: true, debug: 'route alive (vercel node)' });
    return;
  }

  // Hard watchdog – vi SENDER svar senest etter 20 sek uansett
  const watchdog = setTimeout(() => {
    if (!res.headersSent) res.status(504).json({ ok: false, error: 'Overall timeout (20s)' });
  }, 20_000);

  try {
    const BASE = envRequired('MEWS_BASE_URL').replace(/\/+$/, ''); // f.eks. https://api.mews-demo.com/api/connector/v1
    const CLIENT_TOKEN = envRequired('MEWS_CLIENT_TOKEN');
    const ACCESS_TOKEN = envRequired('MEWS_ACCESS_TOKEN');
    const SERVICE_ID = envRequired('MEWS_SERVICE_ID');
    const ENTERPRISE_ID = (process.env.MEWS_ENTERPRISE_ID ?? '').trim();
    const CLIENT_NAME = (process.env.MEWS_CLIENT_NAME ?? 'BNO Travel Booking 1.0.0').trim();

    const start = String(req.query.start ?? '').trim(); // YYYY-MM-DD
    const end = String(req.query.end ?? '').trim();
    const adults = Number(String(req.query.adults ?? '2'));

    if (!start || !end) {
      res.status(400).json({ ok: false, error: 'Missing start/end (YYYY-MM-DD)' });
      return;
    }

    const startUtc = `${start}T00:00:00Z`;
    const endUtc = `${end}T00:00:00Z`;

    const common: CommonBody = { ClientToken: CLIENT_TOKEN, AccessToken: ACCESS_TOKEN, Client: CLIENT_NAME };

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

    // 2) Categories (best effort, 12s) – prøv begge varianter
    const categoriesP = ENTERPRISE_ID
      ? Promise.race([
          postJsonWithTimeout(`${BASE}/resourceCategories/getAll`, { ...common, EnterpriseId: ENTERPRISE_ID, ActiveOnly: true }, 12_000),
          postJsonWithTimeout(`${BASE}/spaceCategories/getAll`,    { ...common, EnterpriseId: ENTERPRISE_ID, ActiveOnly: true }, 12_000),
        ]).catch(() => ({ ResourceCategories: [] }))
      : Promise.resolve({ ResourceCategories: [] });

    // 3) Løp parallelt
    let availability: any, categories: any;
    try {
      [availability, categories] = await Promise.all([availabilityP, categoriesP]);
    } catch (e: any) {
      if (!res.headersSent) res.status(502).json({ ok: false, error: `Availability failed: ${e?.message || e}` });
      return;
    }

    const DatesUtc: string[] = availability?.DatesUtc ?? availability?.TimeUnitStartsUtc ?? [];
    const CatAvail: Array<{ CategoryId: string; Availabilities: number[] }> =
      availability?.CategoryAvailabilities ?? [];

    const catList: Array<{ Id: string; Name?: string; Capacity?: number; Description?: string }> =
      categories?.ResourceCategories ?? categories?.SpaceCategories ?? categories?.Categories ?? [];

    const catMap = new Map<string, (typeof catList)[number]>();
    for (const c of catList) if (c?.Id) catMap.set(c.Id, c);

    const out = CatAvail.map((row) => {
      const meta = catMap.get(row.CategoryId);
      return {
        categoryId: row.CategoryId,
        name: meta?.Name ?? null,
        capacity: meta?.Capacity ?? null,
        description: meta?.Description ?? null,
        imageUrls: null, // TODO: files/getAll i neste steg
        availabilities: Array.isArray(row.Availabilities) ? row.Availabilities : [],
      };
    });

    if (!res.headersSent) {
      res.status(200).json({
        ok: true,
        start, end, adults,
        datesUtc: DatesUtc,
        categories: out,
      });
    }
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ ok: false, error: String(err?.message || err) });
  } finally {
    clearTimeout(watchdog);
  }
}

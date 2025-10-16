// api/mews/enriched-lite.ts
export const config = { runtime: 'nodejs' };

/**
 * Raskt endepunkt:
 *  - services/getAvailability  (krav: ServiceId)
 *  - spaceCategories/getAll    (krav: EnterpriseId)
 *  - Tidsavbrudd per MEWS-kall (AbortController)
 *  - Returnerer: dates + [{id,name,capacity,availabilities}]
 *
 * Miljøvariabler som må være satt i Vercel:
 *  MEWS_BASE_URL          f.eks. https://app.mews-demo.com/api/connector/v1
 *  MEWS_CLIENT_TOKEN
 *  MEWS_ACCESS_TOKEN
 *  MEWS_CLIENT_NAME       (valgfri)
 *  MEWS_SERVICE_ID
 *  MEWS_ENTERPRISE_ID
 */

type Common = {
  ClientToken: string;
  AccessToken: string;
  Client: string;
};

type AvailabilityBody = Common & {
  ServiceId: string;
  FirstTimeUnitStartUtc: string;
  LastTimeUnitStartUtc: string;
};

function req(name: string) {
  const v = (process.env[name] ?? '').trim();
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function postJson(url: string, body: unknown, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`${url} -> ${res.status} ${res.statusText}: ${text.slice(0, 400)}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Non-JSON from ${url}: ${text.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(req: Request) {
  try {
    const BASE = req.url ? req(name => name) : '';
    const BASE_URL = req('MEWS_BASE_URL').replace(/\/+$/, '');
    const CLIENT_TOKEN = req('MEWS_CLIENT_TOKEN');
    const ACCESS_TOKEN = req('MEWS_ACCESS_TOKEN');
    const CLIENT = (process.env.MEWS_CLIENT_NAME ?? 'BNO Travel Booking 1.0.0').trim();
    const SERVICE_ID = req('MEWS_SERVICE_ID');
    const ENTERPRISE_ID = req('MEWS_ENTERPRISE_ID');

    const u = new URL(req.url, 'https://dummy');
    const start = (u.searchParams.get('start') ?? '').trim(); // YYYY-MM-DD
    const end = (u.searchParams.get('end') ?? '').trim();     // YYYY-MM-DD
    const adults = Number(u.searchParams.get('adults') ?? '2');

    if (!start || !end) {
      return new Response(JSON.stringify({ error: 'Missing start/end (YYYY-MM-DD)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // MEWS forventer UTC start-of-day. For demo bruker vi 00:00Z på dato.
    const startUtc = `${start}T00:00:00Z`;
    const endUtc = `${end}T00:00:00Z`;

    const common: Common = {
      ClientToken: CLIENT_TOKEN,
      AccessToken: ACCESS_TOKEN,
      Client: CLIENT,
    };

    // kall i parallell, hvert med 20s timeout
    const [availability, cats] = await Promise.all([
      postJson(`${BASE_URL}/services/getAvailability`, {
        ...common,
        ServiceId: SERVICE_ID,
        FirstTimeUnitStartUtc: startUtc,
        LastTimeUnitStartUtc: endUtc,
      } as AvailabilityBody),
      postJson(`${BASE_URL}/spaceCategories/getAll`, {
        ...common,
        EnterpriseId: ENTERPRISE_ID,
        ActiveOnly: true,
      }),
    ]);

    const dates: string[] = availability?.DatesUtc ?? availability?.TimeUnitStartsUtc ?? [];
    const catAvail: Array<{ CategoryId: string; Availabilities: number[] }> =
      availability?.CategoryAvailabilities ?? [];

    const list: Array<{ Id: string; Name?: string; Capacity?: number }> =
      cats?.SpaceCategories ?? cats?.Categories ?? [];

    const map = new Map<string, { name?: string; capacity?: number }>();
    for (const c of list) map.set(c.Id, { name: c.Name, capacity: c.Capacity });

    const items = catAvail.map((row) => {
      const meta = map.get(row.CategoryId) || {};
      return {
        id: row.CategoryId,
        name: meta.name ?? row.CategoryId,
        capacity: meta.capacity ?? null,
        availabilities: Array.isArray(row.Availabilities) ? row.Availabilities : [],
      };
    });

    return new Response(
      JSON.stringify({ start, end, adults, dates, items }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

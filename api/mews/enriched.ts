// api/mews/enriched.ts
export const config = { runtime: 'nodejs' };

type MewsAvail = {
  DatesUtc: string[];
  CategoryAvailabilities: { CategoryId: string; Availabilities: number[] }[];
};

type MewsCategory = { Id: string; Name: string; Capacity?: number };

function reqEnv(name: string): string {
  const v = (process.env[name] ?? '').trim();
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}: ${text.slice(0, 800)}`);
  return JSON.parse(text);
}

export default async function handler(req: Request) {
  try {
    const BASE = reqEnv('MEWS_BASE_URL').replace(/\/+$/, '');
    const CLIENT_TOKEN = reqEnv('MEWS_CLIENT_TOKEN');
    const ACCESS_TOKEN = reqEnv('MEWS_ACCESS_TOKEN');
    const CLIENT = (process.env.MEWS_CLIENT_NAME ?? 'BNO Travel Booking 1.0.0').trim();
    const SERVICE_ID = reqEnv('MEWS_SERVICE_ID');
    const ENTERPRISE_ID = reqEnv('MEWS_ENTERPRISE_ID');

    const url = new URL(req.url);
    const start = url.searchParams.get('start'); // YYYY-MM-DD
    const end = url.searchParams.get('end');     // YYYY-MM-DD
    const adults = Number(url.searchParams.get('adults') ?? '2');

    if (!start || !end) {
      return new Response(JSON.stringify({ error: 'Missing start/end (YYYY-MM-DD)' }), { status: 400 });
    }

    // Bygger ISO 8601 UTC (start på dag)
    const startUtc = `${start}T22:00:00Z`;
    const endUtc = `${end}T22:00:00Z`;

    // 1) Tilgjengelighet per kategori
    const availability: MewsAvail = await postJson(`${BASE}/services/getAvailability`, {
      ClientToken: CLIENT_TOKEN,
      AccessToken: ACCESS_TOKEN,
      Client: CLIENT,
      ServiceId: SERVICE_ID,
      FirstTimeUnitStartUtc: startUtc,
      LastTimeUnitStartUtc: endUtc,
    });

    // 2) Kategorinavn/kapasitet
    const categoryRes = await postJson(`${BASE}/spaceCategories/getAll`, {
      ClientToken: CLIENT_TOKEN,
      AccessToken: ACCESS_TOKEN,
      Client: CLIENT,
      EnterpriseId: ENTERPRISE_ID,
      ActiveOnly: true,
    });

    const categories: MewsCategory[] =
      categoryRes?.SpaceCategories ?? categoryRes?.Categories ?? [];

    const catMap = new Map<string, MewsCategory>();
    categories.forEach(c => catMap.set(c.Id, c));

    // 3) Slå sammen
    const items = availability.CategoryAvailabilities.map(a => {
      const meta = catMap.get(a.CategoryId);
      return {
        id: a.CategoryId,
        name: meta?.Name ?? a.CategoryId,
        capacity: meta?.Capacity ?? null,
        availabilities: a.Availabilities,
      };
    });

    return new Response(
      JSON.stringify({
        start,
        end,
        adults,
        dates: availability.DatesUtc,
        items,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500 });
  }
}

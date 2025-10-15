// api/lib/mews.ts
type AvailabilityRequest = {
  startUtc: string; // ISO 8601 UTC (start of day)
  endUtc: string;   // ISO 8601 UTC (end of day)
  adults: number;
};

export function required(name: string): string {
  const v = (process.env[name] ?? '').trim();
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function buildDistributorUrl(startIso: string, endIso: string, adults: number) {
  const base = required('MEWS_DISTRIBUTOR_BASE').replace(/\/+$/, '');
  const cfg = required('MEWS_CONFIGURATION_ID');
  const start = startIso.slice(0, 10);
  const end = endIso.slice(0, 10);
  return `${base}/${cfg}?mewsStartDate=${start}&mewsEndDate=${end}&mewsAdultCount=${adults}`;
}

async function postJsonExpect200(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}: ${text.slice(0, 800)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON from ${url}: ${text.slice(0, 800)}`);
  }
}

type Attempt = { url: string; status?: number; statusText?: string; excerpt?: string };
type Ok = { ok: true; mews: any; usedUrl: string; attempts: Attempt[] };
type Err = { ok: false; message: string; attempts: Attempt[] };

export async function tryMewsAvailability(req: AvailabilityRequest): Promise<Ok | Err> {
  const BASE = required('MEWS_BASE_URL').replace(/\/+$/, '');
  const CLIENT_TOKEN = required('MEWS_CLIENT_TOKEN');
  const ACCESS_TOKEN = required('MEWS_ACCESS_TOKEN');
  const CLIENT_NAME = (process.env.MEWS_CLIENT_NAME ?? 'BNO Travel Booking 1.0.0').trim();
  const SERVICE_ID = required('MEWS_SERVICE_ID');

  // NB: riktig payload for getAvailability
  const body = {
    ClientToken: CLIENT_TOKEN,
    AccessToken: ACCESS_TOKEN,
    Client: CLIENT_NAME,
    ServiceId: SERVICE_ID,
    FirstTimeUnitStartUtc: req.startUtc,
    LastTimeUnitStartUtc: req.endUtc,
  };

  const candidates = [`${BASE}/services/getAvailability`];

  const attempts: Attempt[] = [];
  for (const url of candidates) {
    try {
      const mews = await postJsonExpect200(url, body);
      return { ok: true, mews, usedUrl: url, attempts };
    } catch (e: any) {
      const msg = String(e?.message || e || '');
      const m = msg.match(/->\s*(\d+)\s*([A-Za-z ]+):\s*([\s\S]*)$/);
      attempts.push({
        url,
        status: m ? Number(m[1]) : undefined,
        statusText: m ? m[2]?.trim() : undefined,
        excerpt: m ? m[3]?.slice(0, 200) : msg.slice(0, 200),
      });
    }
  }
  return { ok: false, message: 'No availability endpoint responded 200', attempts };
}

export function mapMewsToItems(mewsJson: any, distributorUrlFactory: () => string) {
  const list =
    mewsJson?.RoomCategories ??
    mewsJson?.SpaceCategories ??
    mewsJson?.Categories ??
    mewsJson?.Rooms ??
    mewsJson?.Results ??
    [];

  const url = distributorUrlFactory();

  return list.map((x: any) => {
    const id =
      x.Id ?? x.RoomCategoryId ?? x.SpaceCategoryId ?? x.CategoryId ?? x.Code ?? x.Id;
    const name =
      x.Name ?? x.RoomCategoryName ?? x.SpaceCategoryName ?? x.CategoryName ?? 'Uten navn';
    const capacity = x.Capacity ?? x.MaximumOccupancy ?? x.MaxPersons ?? x.Occupancy;
    const price =
      x.Price?.Amount ??
      x.MinPrice?.Amount ??
      x.FromPrice?.Amount ??
      x.Rate?.Total ??
      x.TotalPrice;
    const currency =
      x.Price?.Currency ?? x.MinPrice?.Currency ?? x.FromPrice?.Currency ?? x.Currency ?? 'NOK';
    const refundable = x.IsRefundable ?? x.Refundable ?? x.Rate?.Refundable;

    return { id, name, capacity, refundable, currency, price, url };
  });
}

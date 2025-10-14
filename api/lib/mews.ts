// api/lib/mews.ts
type AvailabilityRequest = {
  startUtc: string; // ISO
  endUtc: string;   // ISO
  adults: number;
};

export function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function buildDistributorUrl(
  startIso: string,
  endIso: string,
  adults: number
) {
  const base = required('MEWS_DISTRIBUTOR_BASE').replace(/\/+$/, '');
  const cfg = required('MEWS_CONFIGURATION_ID');
  const start = startIso.slice(0, 10);
  const end = endIso.slice(0, 10);
  return `${base}/${cfg}?mewsStartDate=${start}&mewsEndDate=${end}&mewsAdultCount=${adults}`;
}

/**
 * Kaller Mews Connector API → Availability for accommodation service.
 */
export async function fetchMewsAvailability(req: AvailabilityRequest) {
  const BASE = required('MEWS_BASE_URL').replace(/\/+$/, '');
  const CLIENT_TOKEN = required('MEWS_CLIENT_TOKEN');
  const ACCESS_TOKEN = required('MEWS_ACCESS_TOKEN');
  const CLIENT_NAME = process.env.MEWS_CLIENT_NAME ?? 'BNO Travel Booking 1.0.0';
  const ENTERPRISE_ID = required('MEWS_ENTERPRISE_ID');
  const SERVICE_ID = required('MEWS_SERVICE_ID');

  const body = {
    ClientToken: CLIENT_TOKEN,
    AccessToken: ACCESS_TOKEN,
    Client: CLIENT_NAME,
    EnterpriseId: ENTERPRISE_ID,
    ServiceIds: [SERVICE_ID],
    StartUtc: req.startUtc,
    EndUtc: req.endUtc,
    RequestedOccupancies: [{ Adults: req.adults }],
  };

  const url = `${BASE}/availability`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Mews ${res.status} ${res.statusText}: ${text.slice(0, 800)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Mews returned non-JSON response: ${text.slice(0, 800)}`);
  }
}

/**
 * Mapper et «typisk» Mews Availability-svar → appens listeformat.
 */
export function mapMewsToItems(
  mewsJson: any,
  distributorUrlFactory: () => string
) {
  const list =
    mewsJson?.RoomCategories ??
    mewsJson?.SpaceCategories ??
    mewsJson?.Categories ??
    mewsJson?.Rooms ??
    [];

  const url = distributorUrlFactory();

  return list.map((x: any) => {
    const id =
      x.Id ?? x.RoomCategoryId ?? x.SpaceCategoryId ?? x.CategoryId ?? x.Code ?? x.Id;
    const name =
      x.Name ?? x.RoomCategoryName ?? x.SpaceCategoryName ?? x.CategoryName ?? 'Uten navn';
    const capacity =
      x.Capacity ?? x.MaximumOccupancy ?? x.MaxPersons ?? x.Occupancy ?? undefined;

    const price =
      x.Price?.Amount ??
      x.MinPrice?.Amount ??
      x.FromPrice?.Amount ??
      x.Rate?.Total ??
      x.TotalPrice ??
      undefined;

    const currency =
      x.Price?.Currency ??
      x.MinPrice?.Currency ??
      x.FromPrice?.Currency ??
      x.Currency ??
      'NOK';

    const refundable = x.IsRefundable ?? x.Refundable ?? x.Rate?.Refundable ?? undefined;

    return { id, name, capacity, refundable, currency, price, url };
  });
}

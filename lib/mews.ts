// bno-api/lib/mews.ts
import axios, { AxiosRequestConfig } from 'axios';

// ---------- env ----------
const baseUrl = (process.env.MEWS_BASE_URL || '').trim();
if (!baseUrl) throw new Error('Missing MEWS_BASE_URL');

const clientToken = (process.env.MEWS_CLIENT_TOKEN || '').trim();
if (!clientToken) throw new Error('Missing MEWS_CLIENT_TOKEN');

const accessToken = (process.env.MEWS_ACCESS_TOKEN || '').trim();
if (!accessToken) throw new Error('Missing MEWS_ACCESS_TOKEN');

const clientName = (process.env.MEWS_CLIENT_NAME || 'bno-api').replace(/^"|"$/g, '').trim();
const hotelTimeZone = (process.env.HOTEL_TIMEZONE || 'Europe/Oslo').trim();

// ===== Axios retry helper (handles 429 + Retry-After and transient network errors) ====
async function axiosWithRetry<T = any>(
  config: AxiosRequestConfig,
  maxRetries = 3,
  initialDelayMs = 500,
  respectRetryAfter = true
): Promise<T> {
  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    try {
      const resp = await axios(config);
      return resp.data as T;
    } catch (err: any) {
      attempt++;
      const status = err?.response?.status;
      const headers = err?.response?.headers || {};
      const retryAfterRaw = headers['retry-after'];
      const code = err?.code || null;

      // 429 handling
      if (status === 429 && attempt <= maxRetries) {
        let waitMs = delay;

        if (respectRetryAfter && retryAfterRaw) {
          const asNum = Number(retryAfterRaw);
          if (!Number.isNaN(asNum)) {
            waitMs = asNum * 1000;
          } else {
            const parsed = Date.parse(retryAfterRaw);
            if (!Number.isNaN(parsed)) {
              const now = Date.now();
              const until = parsed - now;
              waitMs = until > 0 ? until : delay;
            }
          }
        }

        const maxCap = 10 * 60 * 1000;
        if (waitMs > maxCap) waitMs = maxCap;

        console.warn(`axiosWithRetry: 429 received, attempt ${attempt}, waiting ${waitMs}ms (retry-after=${retryAfterRaw})`);
        await new Promise((r) => setTimeout(r, waitMs));
        delay *= 2;
        continue;
      }

      // transient network errors
      const transientCodes = ['ECONNRESET', 'ECONNABORTED', 'ENOTFOUND', 'EAI_AGAIN'];
      if (transientCodes.includes(code) && attempt <= maxRetries) {
        console.warn(`axiosWithRetry: transient error ${code}, attempt ${attempt}, retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }

      // give up - attach useful info and rethrow
      const info = {
        message: err?.message,
        status,
        code,
        headers,
        data: err?.response?.data || null,
      };
      console.error('axiosWithRetry: giving up', info);
      const e = new Error(err?.message || 'Request failed');
      (e as any).response = err?.response || null;
      (e as any).mewsResponse = info;
      throw e;
    }
  }
}

// ---------- helpers ----------
function tzOffsetMinutesAt(utcInstant: Date, tz: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, timeZoneName: 'shortOffset',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(utcInstant);
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+00:00';
    const m = tzName.match(/([+-])(\d{1,2})(?::?(\d{2}))?$/);
    if (!m) return 0;
    const sign = m[1] === '-' ? -1 : 1;
    const hh = parseInt(m[2], 10);
    const mm = m[3] ? parseInt(m[3], 10) : 0;
    return sign * (hh * 60 + mm);
  } catch { return 0; }
}

/** Konverter lokal dato (YYYY-MM-DD eller Date) til "time unit UTC" (midnatt lokal tid i UTC) */
export function toTimeUnitUtc(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const utcMidnight = new Date(Date.UTC(y, m, day, 0, 0, 0, 0));
  let off = tzOffsetMinutesAt(utcMidnight, hotelTimeZone);
  let candidate = new Date(utcMidnight.getTime() - off * 60_000);
  const off2 = tzOffsetMinutesAt(candidate, hotelTimeZone);
  if (off2 !== off) candidate = new Date(utcMidnight.getTime() - off2 * 60_000);
  return candidate.toISOString();
}

/** Fjern undefined rekursivt – nyttig før POST */
function removeUndefinedRecursive(obj: any): any {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    const a = obj.map(v => removeUndefinedRecursive(v)).filter(v => v !== undefined);
    return a;
  }
  if (typeof obj === 'object') {
    const out: any = {};
    for (const k of Object.keys(obj)) {
      const rv = removeUndefinedRecursive((obj as any)[k]);
      if (rv !== undefined) out[k] = rv;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return obj;
}

/** Navnesanitering (ASCII, minst 2 bokstaver) */
function sanitizeName(v: string | undefined): string {
  if (!v) return 'Guest';
  let s = String(v).trim();
  try { s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''); } catch {}
  s = s.replace(/[^A-Za-z\s\-']/g, '').replace(/\s+/g, ' ').trim();
  if (s.replace(/[^A-Za-z]/g, '').length < 2) s = 'Guest';
  return s.substring(0, 64);
}

/** Enkel ISO8601 duration-parser (PnDTnHnMnS -> ms) */
export function parseIsoDurationToMs(dur: string | undefined): number | null {
  if (!dur) return null;
  const m = dur.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/);
  if (!m) return null;
  const days = Number(m[1] || 0);
  const hours = Number(m[2] || 0);
  const mins = Number(m[3] || 0);
  const secs = Number(m[4] || 0);
  return ((days * 24 + hours) * 60 + mins) * 60_000 + secs * 1000;
}

// ---- liten wrapper for axios post med tidouts og detaljert error
async function postJson(path: string, body: any, timeout = 15000) {
  try {
    const cleaned = removeUndefinedRecursive(body);
    const data = await axiosWithRetry({
      method: 'post',
      url: path,
      data: cleaned,
      timeout,
      headers: { 'Content-Type': 'application/json' },
    }, 3, 500, true);
    return { data };
  } catch (err: any) {
    const e = new Error(err?.message || 'Request failed');
    (e as any).response = err?.response || null;
    (e as any).mewsResponse = err?.mewsResponse || (err?.response ? { status: err.response?.status, headers: err.response?.headers, data: err.response?.data } : null);
    throw e;
  }
}

// ---------- Connector API ----------
export async function fetchAvailability(serviceId: string, first: string | Date, last: string | Date) {
  const url = `${baseUrl}/api/connector/v1/services/getAvailability`;
  const body = {
    ClientToken: clientToken, AccessToken: accessToken, Client: clientName,
    ServiceId: serviceId,
    FirstTimeUnitStartUtc: toTimeUnitUtc(first),
    LastTimeUnitStartUtc:  toTimeUnitUtc(last),
  };
  const resp = await postJson(url, body);
  return resp.data;
}

export async function fetchCategoriesRaw(serviceId: string) {
  const url = `${baseUrl}/api/connector/v1/resourceCategories/getAll`;
  const resp = await postJson(url, {
    ClientToken: clientToken, AccessToken: accessToken, Client: clientName,
    ServiceIds: [serviceId], Limitation: { Count: 1000 },
  });
  return resp.data?.ResourceCategories || [];
}

export async function fetchImageUrls(imageIds: string[]) {
  if (!imageIds?.length) return {};
  const url = `${baseUrl}/api/connector/v1/images/getUrls`;
  const payload = {
    ClientToken: clientToken, AccessToken: accessToken, Client: clientName,
    Images: imageIds.map(id => ({ ImageId: id, ResizeMode: 'Fit', Width: 1200, Height: 800 })),
  };
  const resp = await postJson(url, payload);
  const out: Record<string, string> = {};
  (resp.data?.ImageUrls || []).forEach((it: any) => { if (it?.ImageId && it?.Url) out[it.ImageId] = it.Url; });
  return out;
}

export async function fetchProducts(serviceId: string) {
  const url = `${baseUrl}/api/connector/v1/products/getAll`;
  const resp = await postJson(url, {
    ClientToken: clientToken, AccessToken: accessToken, Client: clientName,
    ServiceIds: [serviceId], Limitation: { Count: 1000 },
  });
  return resp.data?.Products || [];
}

export async function fetchService(serviceId: string) {
  const url = `${baseUrl}/api/connector/v1/services/getAll`;
  const resp = await postJson(url, {
    ClientToken: clientToken, AccessToken: accessToken, Client: clientName,
    ServiceIds: [serviceId], Limitation: { Count: 10 },
  });
  const arr = resp.data?.Services || [];
  return arr.length ? arr[0] : null;
}

/** Availability med navn + bilder */
export async function fetchAvailabilityNamed(serviceId: string, first: string | Date, last: string | Date) {
  const availability = await fetchAvailability(serviceId, first, last);
  const timeUnits: string[] = availability?.TimeUnitStartsUtc ?? availability?.DatesUtc ?? [];

  let rcAvail: any[] = availability?.ResourceCategoryAvailabilities;
  if (!Array.isArray(rcAvail) || !rcAvail.length) {
    const cat = Array.isArray(availability?.CategoryAvailabilities) ? availability.CategoryAvailabilities : [];
    rcAvail = cat.map((c: any) => ({
      ResourceCategoryId: c?.CategoryId,
      TotalAvailableUnitsCount: c?.TotalAvailableUnitsCount,
      Availabilities: c?.Availabilities,
      Adjustments: c?.Adjustments,
    }));
  }

  const categories: any[] = await fetchCategoriesRaw(serviceId);
  const catMap: Record<string, any> = {};
  categories.forEach(c => { catMap[c.Id] = c; });

  const categoryIds: string[] = rcAvail.map((r: any) => r.ResourceCategoryId).filter(Boolean);
  const catImageIds: Record<string, string[]> = {};
  if (categoryIds.length) {
    const url = `${baseUrl}/api/connector/v1/resourceCategoryImageAssignments/getAll`;
    try {
      const resp = await postJson(url, {
        ClientToken: clientToken, AccessToken: accessToken, Client: clientName,
        ResourceCategoryIds: categoryIds, Limitation: { Count: 1000 },
      });
      const assigns: any[] = resp.data?.ResourceCategoryImageAssignments || [];
      assigns.forEach(a => {
        if (a?.IsActive && a?.CategoryId && a?.ImageId) {
          if (!catImageIds[a.CategoryId]) catImageIds[a.CategoryId] = [];
          if (!catImageIds[a.CategoryId].includes(a.ImageId)) catImageIds[a.CategoryId].push(a.ImageId);
        }
      });
    } catch (err: any) {
      // ignore, non-fatal
      console.warn('fetchAvailabilityNamed: resourceCategoryImageAssignments failed', err?.message || err);
    }
  }

  const uniqueImageIds = Array.from(new Set(Object.values(catImageIds).flat()));
  const imageUrlMap = await fetchImageUrls(uniqueImageIds);

  const enriched = rcAvail.map((r: any) => {
    const cat = catMap[r.ResourceCategoryId];
    let name: string | null = null;
    let description: string | null = null;
    let capacity = 0;
    if (cat) {
      if (cat.Names && Object.keys(cat.Names).length) {
        name = cat.Names[Object.keys(cat.Names)[0]];
      } else if (cat.ShortNames && Object.keys(cat.ShortNames).length) {
        name = cat.ShortNames[Object.keys(cat.ShortNames)[0]];
      } else if (cat.ExternalIdentifier) {
        name = cat.ExternalIdentifier;
      }
      if (cat.Descriptions && Object.keys(cat.Descriptions).length) {
        description = cat.Descriptions[Object.keys(cat.Descriptions)[0]];
      }
      capacity = cat.Capacity || 0;
    }
    const imgIds = catImageIds[r.ResourceCategoryId] || [];
    const images = imgIds.map(id => imageUrlMap[id]).filter(Boolean);
    return {
      ...r,
      Name: name,
      Description: description,
      Capacity: capacity,
      Image: images[0] || null,
      Images: images,
    };
  });

  return { TimeUnitStartsUtc: timeUnits, ResourceCategoryAvailabilities: enriched };
}

// ---------- Customers ----------
export async function findOrCreateCustomer(customer: any) {
  if (!customer) throw new Error('Missing customer');

  const email = String(customer.email || customer.Email || '').trim().toLowerCase();
  if (!email) throw new Error('Customer email missing');

  let first = sanitizeName(customer.firstName || customer.FirstName || 'Guest');
  let last  = sanitizeName(customer.lastName  || customer.LastName  || 'Guest');
  const nat  = String(customer.nationality || customer.Nationality || '').trim().toUpperCase();
  const cor  = String(customer.countryOfResidence || customer.CountryOfResidence || '').trim().toUpperCase();
  const phone = String(customer.phone || customer.Phone || '').trim() || undefined;

  try {
    const urlGetAll = `${baseUrl}/api/connector/v1/customers/getAll`;
    const resp = await postJson(urlGetAll, {
      ClientToken: clientToken, AccessToken: accessToken, Client: clientName,
      Emails: [email], Extent: { Customers: true }, Limitation: { Count: 10 },
    }, 15000);
    const found = Array.isArray(resp?.data?.Customers)
      ? resp.data.Customers.find((c: any) => String(c?.Email || '').toLowerCase() === email)
      : null;
    if (found?.Id) return found.Id;
  } catch (err: any) {}

  async function tryAdd(firstName: string, lastName: string): Promise<string> {
    const urlAdd = `${baseUrl}/api/connector/v1/customers/add`;
    const addBody: any = {
      ClientToken: clientToken, AccessToken: accessToken, Client: clientName,
      OverwriteExisting: true,
      Customers: [{
        FirstName: firstName || 'Guest',
        LastName:  lastName  || 'Guest',
        Email: email,
        Phone: phone,
        NationalityCode: nat || undefined,
        Address: cor ? { CountryCode: cor } : undefined,
      }],
    };
    const resp = await postJson(urlAdd, addBody, 15_000);
    const id =
      (Array.isArray(resp?.data?.CustomerIds) && resp.data.CustomerIds[0]) ||
      (Array.isArray(resp?.data?.Customers) && resp.data.Customers[0]?.Id) ||
      resp?.data?.CustomerId || resp?.data?.Id || resp?.data?.Customer?.Id;
    if (id) return id;
    throw new Error(`Unexpected response from customers/add: ${JSON.stringify(resp?.data)}`);
  }

  try {
    return await tryAdd(first, last);
  } catch (eA: any) {
    const msgA = String(eA?.response?.data?.Message || eA?.message || eA).toLowerCase();
    if (!msgA.includes('invalid last')) throw new Error(`findOrCreateCustomer failed: ${eA?.response?.data || eA?.message || eA}`);
    try {
      return await tryAdd('Guest', 'Guest');
    } catch (eB: any) {
      const msgB = String(eB?.response?.data?.Message || eB?.message || eB).toLowerCase();
      if (msgB.includes('invalid last')) {
        try {
          return await tryAdd('Guest', `Guest-${Date.now()}`);
        } catch (eC: any) {
          throw new Error(`findOrCreateCustomer failed after retry: ${eC?.response?.data?.Message || eC?.message || eC}`);
        }
      }
      throw new Error(`findOrCreateCustomer failed after retry: ${eB?.response?.data || eB?.message || eB}`);
    }
  }
}

// ---------- Reservations ----------
export async function createReservation(p: any) {
  if (!p) throw new Error('createReservation: missing payload');
  try {
    const rooms = Array.isArray(p.Rooms) && p.Rooms.length ? p.Rooms : [];
    const firstRoom = rooms[0] || {};
    const qty = Math.max(1, Number(firstRoom.Quantity || 1)); // << støtte for flere enheter

    const personCounts = (firstRoom.Occupancy || []).map((o: any) => ({
      AgeCategoryId: o.AgeCategoryId, Count: Number(o.PersonCount || 0),
    }));

    const baseReservation: any = {
      Identifier: p.ClientReference || `bno-${Date.now()}`,
      State: p.State || 'Optional', // var «Confirmed», endres til Optional for å være mer permissiv
      StartUtc: firstRoom.StartUtc,
      EndUtc: firstRoom.EndUtc,
      CheckRateApplicability: false,
      ReleasedUtc: null,
      CustomerId: p.CustomerId || p.CustomerIdFromFind || undefined,
      RequestedCategoryId: firstRoom.RoomCategoryId || firstRoom.ResourceCategoryId || undefined,
      RateId: firstRoom.RateId || undefined,
      TravelAgencyId: null,
      TimeUnitAmount: null,
      PersonCounts: personCounts,
      TimeUnitPrices: [],
    };

    // Opprett N reservasjoner hvis qty > 1
    const reservations = Array.from({ length: qty }).map((_, i) => ({
      ...baseReservation,
      Identifier: `${baseReservation.Identifier}-${i + 1}`,
    }));

    const body = {
      ClientToken: clientToken, AccessToken: accessToken, Client: clientName,
      ServiceId: p.ServiceId || undefined,
      SendConfirmationEmail: p.SendConfirmationEmail === true,
      CheckRateApplicability: false,
      Reservations: reservations,
    };

    const url = `${baseUrl.replace(/\/$/, '')}/api/connector/v1/reservations/add`;
    const cleaned = removeUndefinedRecursive(body);
    const resp = await postJson(url, cleaned, 20_000);
    if (resp?.data) return resp.data;
    throw new Error('Empty response from reservations/add');
  } catch (err: any) {
    const body = err?.mewsResponse || err?.response || err?.message || String(err);
    const e = new Error('createReservation failed');
    (e as any).mewsResponse = body;
    throw e;
  }
}

/** Create product service orders (attach ordered products to reservation) */
export async function createProductServiceOrders(serviceId: string, reservationId: string, orders: any[]) {
  if (!serviceId) throw new Error('Missing serviceId');
  if (!reservationId) throw new Error('Missing reservationId');
  if (!Array.isArray(orders) || orders.length === 0) return null;

  const url = `${baseUrl}/api/connector/v1/productServiceOrders/add`;
  const payload = {
    ClientToken: clientToken, AccessToken: accessToken, Client: clientName,
    ServiceId: serviceId,
    ProductServiceOrders: orders.map(o => {
      const out: any = {
        ProductId: o.ProductId || o.productId,
        ReservationId: reservationId,
        Quantity: Number(o.Quantity || o.quantity || o.Count || 0),
      };
      if (o.Price != null) {
        out.Price = { Amount: Number(o.Price), Currency: o.Currency || undefined };
      }
      return out;
    }),
  };

  try {
    const resp = await postJson(url, payload, 20000);
    return resp.data;
  } catch (err: any) {
    const e = new Error('createProductServiceOrders failed');
    (e as any).mewsResponse = err?.mewsResponse || err?.response || err?.message || err;
    throw e;
  }
}

export default {
  toTimeUnitUtc, parseIsoDurationToMs,
  fetchAvailability, fetchAvailabilityNamed, fetchCategoriesRaw,
  fetchProducts, fetchImageUrls, fetchService,
  findOrCreateCustomer, createReservation, createProductServiceOrders,
};

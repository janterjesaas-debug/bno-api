// bno-api/lib/mews.ts
import axios, { AxiosRequestConfig } from 'axios';

// ---------- env helpers ----------
const envTrim = (k: string) => (process.env[k] || '').trim();
const normalizeBase = (u: string) => u.replace(/\/$/, '');

function parseIdList(v: string): string[] {
  return (v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------- DEFAULT creds (LAZY) ----------
// Viktig: Ikke throw på import. Vi validerer først når vi faktisk bruker Mews.
const baseUrlDefault = normalizeBase(envTrim('MEWS_BASE_URL') || '');
const clientTokenDefault = envTrim('MEWS_CLIENT_TOKEN') || '';
const accessTokenDefault = envTrim('MEWS_ACCESS_TOKEN') || '';
const enterpriseIdDefault = envTrim('MEWS_ENTERPRISE_ID') || undefined;

const clientName = (envTrim('MEWS_CLIENT_NAME') || 'bno-api').replace(/^"|"$/g, '').trim();
const hotelTimeZone = (envTrim('HOTEL_TIMEZONE') || 'Europe/Oslo').trim();

// ---------- STRANDA creds (optional) ----------
const strandaAccessToken = envTrim('MEWS_STRANDA_ACCESS_TOKEN'); // required if you want STRANDA enabled
const strandaEnterpriseId = envTrim('MEWS_STRANDA_ENTERPRISE_ID') || envTrim('MEWS_STRANDA_ENTERPRISE') || undefined;

const strandaBaseUrl = normalizeBase(envTrim('MEWS_STRANDA_BASE_URL') || baseUrlDefault);
const strandaClientToken = envTrim('MEWS_STRANDA_CLIENT_TOKEN') || clientTokenDefault;

// serviceId mapping (IMPORTANT)
const strandaServiceIds = parseIdList(envTrim('MEWS_STRANDA_SERVICE_IDS') || envTrim('MEWS_STRANDA_SERVICE_ID'));

type CredsKey = 'DEFAULT' | 'STRANDA';
type MewsCreds = {
  key: CredsKey;
  baseUrl: string;
  clientToken: string;
  accessToken: string;
  enterpriseId?: string;
  clientName: string;
};

function assertDefaultCreds() {
  if (!baseUrlDefault) throw new Error('Missing MEWS_BASE_URL');
  if (!clientTokenDefault) throw new Error('Missing MEWS_CLIENT_TOKEN');
  if (!accessTokenDefault) throw new Error('Missing MEWS_ACCESS_TOKEN');
}

function isStrandaService(serviceId?: string): boolean {
  if (!serviceId) return false;
  const sid = String(serviceId).trim().toLowerCase();
  return strandaServiceIds.some((x) => x.trim().toLowerCase() === sid);
}

function getCredsForService(serviceId?: string): MewsCreds {
  if (isStrandaService(serviceId)) {
    // Stranda: base/clientToken kan arves fra default, men access-token må finnes
    if (!strandaAccessToken) {
      throw new Error(`ServiceId ${serviceId} is mapped to STRANDA, but MEWS_STRANDA_ACCESS_TOKEN is missing.`);
    }
    if (!strandaBaseUrl) throw new Error('Missing MEWS_STRANDA_BASE_URL (or MEWS_BASE_URL as fallback)');
    if (!strandaClientToken) throw new Error('Missing MEWS_STRANDA_CLIENT_TOKEN (or MEWS_CLIENT_TOKEN as fallback)');

    return {
      key: 'STRANDA',
      baseUrl: strandaBaseUrl,
      clientToken: strandaClientToken,
      accessToken: strandaAccessToken,
      enterpriseId: strandaEnterpriseId,
      clientName,
    };
  }

  // Default
  assertDefaultCreds();
  return {
    key: 'DEFAULT',
    baseUrl: baseUrlDefault,
    clientToken: clientTokenDefault,
    accessToken: accessTokenDefault,
    enterpriseId: enterpriseIdDefault,
    clientName,
  };
}

// ===== Axios retry helper (handles 429 + Retry-After and transient network errors) ====
async function axiosWithRetry<T = any>(
  config: AxiosRequestConfig,
  maxRetries = 3,
  initialDelayMs = 500,
  respectRetryAfter = true,
): Promise<T> {
  let attempt = 0;
  let delay = initialDelayMs;

  // eslint-disable-next-line no-constant-condition
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

        console.warn(
          `axiosWithRetry: 429 received, attempt ${attempt}, waiting ${waitMs}ms (retry-after=${retryAfterRaw})`,
        );
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
        url: config?.url,
        method: config?.method,
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
      timeZone: tz,
      timeZoneName: 'shortOffset',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(utcInstant);
    const tzName = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+00:00';
    const m = tzName.match(/([+-])(\d{1,2})(?::?(\d{2}))?$/);
    if (!m) return 0;
    const sign = m[1] === '-' ? -1 : 1;
    const hh = parseInt(m[2], 10);
    const mm = m[3] ? parseInt(m[3], 10) : 0;
    return sign * (hh * 60 + mm);
  } catch {
    return 0;
  }
}

function toLocalYmd(input: string | Date): string {
  if (typeof input === 'string') {
    const s = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: hotelTimeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return fmt.format(d);
    }
    return s.slice(0, 10);
  }

  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: hotelTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(input);
}

function addDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map((x) => Number(x));
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Konverter lokal dato (YYYY-MM-DD eller Date) til "time unit UTC" (midnatt lokal tid i UTC) */
export function toTimeUnitUtc(date: string | Date): string {
  const ymd = toLocalYmd(date);
  const [yy, mm, dd] = ymd.split('-').map((x) => Number(x));
  const utcMidnight = new Date(Date.UTC(yy, (mm || 1) - 1, dd || 1, 0, 0, 0, 0));

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
    const a = obj.map((v) => removeUndefinedRecursive(v)).filter((v) => v !== undefined);
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
  try {
    s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  } catch {}
  s = s.replace(/[^A-Za-z\s\-']/g, ' ').replace(/\s+/g, ' ').trim();
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

// ---- wrapper for axios post med timeout og detaljert error + creds logging
async function postJson(serviceIdForCreds: string | undefined, url: string, body: any, timeout = 15000) {
  const creds = getCredsForService(serviceIdForCreds);

  try {
    const cleaned = removeUndefinedRecursive(body);

    // Create a safe masked copy for logging (don't leak tokens)
    try {
      const safe = { ...(cleaned || {}) };
      if ('ClientToken' in safe) (safe as any).ClientToken = '[MASKED]';
      if ('AccessToken' in safe) (safe as any).AccessToken = '[MASKED]';
      if ('Images' in safe) (safe as any).Images = '[omitted]';
      console.log(
        'MEWS CALL',
        `[${creds.key}]`,
        url,
        Object.keys(safe || {}).length ? JSON.stringify(safe).slice(0, 1000) : '{}',
      );
    } catch {}

    const data = await axiosWithRetry(
      {
        method: 'post',
        url,
        data: cleaned,
        timeout,
        headers: { 'Content-Type': 'application/json' },
      },
      3,
      500,
      true,
    );
    return { data };
  } catch (err: any) {
    const e = new Error(err?.message || 'Request failed');
    (e as any).response = err?.response || null;
    (e as any).mewsResponse =
      err?.mewsResponse ||
      (err?.response
        ? {
            url,
            status: err.response?.status,
            headers: err.response?.headers,
            data: err.response?.data,
          }
        : null);
    throw e;
  }
}

// ---------- Connector API ----------
export async function fetchAvailability(serviceId: string, first: string | Date, last: string | Date) {
  const creds = getCredsForService(serviceId);
  const url = `${creds.baseUrl}/api/connector/v1/services/getAvailability`;
  const body = {
    ClientToken: creds.clientToken,
    AccessToken: creds.accessToken,
    Client: creds.clientName,
    ServiceId: serviceId,
    FirstTimeUnitStartUtc: toTimeUnitUtc(first),
    LastTimeUnitStartUtc: toTimeUnitUtc(last),
  };
  const resp = await postJson(serviceId, url, body);
  return resp.data;
}

export async function fetchCategoriesRaw(serviceId: string) {
  const creds = getCredsForService(serviceId);
  const url = `${creds.baseUrl}/api/connector/v1/resourceCategories/getAll`;
  const resp = await postJson(serviceId, url, {
    ClientToken: creds.clientToken,
    AccessToken: creds.accessToken,
    Client: creds.clientName,
    ServiceIds: [serviceId],
    Limitation: { Count: 1000 },
  });
  return resp.data?.ResourceCategories || [];
}

export async function fetchImageUrls(imageIds: string[], serviceIdForCreds?: string) {
  if (!imageIds?.length) return {};
  const creds = getCredsForService(serviceIdForCreds);
  const url = `${creds.baseUrl}/api/connector/v1/images/getUrls`;
  const payload = {
    ClientToken: creds.clientToken,
    AccessToken: creds.accessToken,
    Client: creds.clientName,
    Images: imageIds.map((id) => ({
      ImageId: id,
      ResizeMode: 'Fit',
      Width: 1200,
      Height: 800,
    })),
  };
  const resp = await postJson(serviceIdForCreds, url, payload);
  const out: Record<string, string> = {};
  (resp.data?.ImageUrls || []).forEach((it: any) => {
    if (it?.ImageId && it?.Url) out[it.ImageId] = it.Url;
  });
  return out;
}

export async function fetchProducts(serviceId: string) {
  const creds = getCredsForService(serviceId);
  const url = `${creds.baseUrl}/api/connector/v1/products/getAll`;
  const resp = await postJson(serviceId, url, {
    ClientToken: creds.clientToken,
    AccessToken: creds.accessToken,
    Client: creds.clientName,
    ServiceIds: [serviceId],
    Limitation: { Count: 1000 },
  });
  return resp.data?.Products || [];
}

export async function fetchService(serviceId: string) {
  const creds = getCredsForService(serviceId);
  const url = `${creds.baseUrl}/api/connector/v1/services/getAll`;
  const resp = await postJson(serviceId, url, {
    ClientToken: creds.clientToken,
    AccessToken: creds.accessToken,
    Client: creds.clientName,
    ServiceIds: [serviceId],
    Limitation: { Count: 10 },
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
  categories.forEach((c) => {
    catMap[c.Id] = c;
  });

  const categoryIds: string[] = rcAvail.map((r: any) => r.ResourceCategoryId).filter(Boolean);
  const catImageIds: Record<string, string[]> = {};
  if (categoryIds.length) {
    const creds = getCredsForService(serviceId);
    const url = `${creds.baseUrl}/api/connector/v1/resourceCategoryImageAssignments/getAll`;
    try {
      const resp = await postJson(serviceId, url, {
        ClientToken: creds.clientToken,
        AccessToken: creds.accessToken,
        Client: creds.clientName,
        ResourceCategoryIds: categoryIds,
        Limitation: { Count: 1000 },
      });
      const assigns: any[] = resp.data?.ResourceCategoryImageAssignments || [];
      assigns.forEach((a) => {
        if (a?.IsActive && a?.CategoryId && a?.ImageId) {
          if (!catImageIds[a.CategoryId]) catImageIds[a.CategoryId] = [];
          if (!catImageIds[a.CategoryId].includes(a.ImageId)) catImageIds[a.CategoryId].push(a.ImageId);
        }
      });
    } catch (err: any) {
      console.warn('fetchAvailabilityNamed: resourceCategoryImageAssignments failed', err?.message || err);
    }
  }

  const uniqueImageIds = Array.from(new Set(Object.values(catImageIds).flat()));
  const imageUrlMap = await fetchImageUrls(uniqueImageIds, serviceId);

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
    const images = imgIds.map((id) => imageUrlMap[id]).filter(Boolean);
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
export async function findOrCreateCustomer(customer: any, serviceIdForCreds?: string) {
  if (!customer) throw new Error('Missing customer');

  // try to infer creds from payload if not provided
  const inferredServiceId =
    serviceIdForCreds ||
    customer?.serviceId ||
    customer?.ServiceId ||
    customer?.serviceID ||
    customer?.ServiceID ||
    undefined;

  const creds = getCredsForService(inferredServiceId);

  const email = String(customer.email || customer.Email || '').trim().toLowerCase();
  if (!email) throw new Error('Customer email missing');

  let first = sanitizeName(customer.firstName || customer.FirstName || 'Guest');
  let last = sanitizeName(customer.lastName || customer.LastName || 'Guest');
  const nat = String(customer.nationality || customer.Nationality || '').trim().toUpperCase();
  const cor = String(customer.countryOfResidence || customer.CountryOfResidence || '').trim().toUpperCase();
  const phone = String(customer.phone || customer.Phone || '').trim() || undefined;

  try {
    const urlGetAll = `${creds.baseUrl}/api/connector/v1/customers/getAll`;
    const resp = await postJson(
      inferredServiceId,
      urlGetAll,
      {
        ClientToken: creds.clientToken,
        AccessToken: creds.accessToken,
        Client: creds.clientName,
        Emails: [email],
        Extent: { Customers: true },
        Limitation: { Count: 10 },
      },
      15000,
    );
    const found = Array.isArray(resp?.data?.Customers)
      ? resp.data.Customers.find((c: any) => String(c?.Email || '').toLowerCase() === email)
      : null;
    if (found?.Id) return found.Id;
  } catch (err: any) {}

  async function tryAdd(firstName: string, lastName: string): Promise<string> {
    const urlAdd = `${creds.baseUrl}/api/connector/v1/customers/add`;
    const addBody: any = {
      ClientToken: creds.clientToken,
      AccessToken: creds.accessToken,
      Client: creds.clientName,
      OverwriteExisting: true,
      Customers: [
        {
          FirstName: firstName || 'Guest',
          LastName: lastName || 'Guest',
          Email: email,
          Phone: phone,
          NationalityCode: nat || undefined,
          Address: cor ? { CountryCode: cor } : undefined,
        },
      ],
    };
    const resp = await postJson(inferredServiceId, urlAdd, addBody, 15_000);
    const id =
      (Array.isArray(resp?.data?.CustomerIds) && resp.data.CustomerIds[0]) ||
      (Array.isArray(resp?.data?.Customers) && resp.data.Customers[0]?.Id) ||
      resp?.data?.CustomerId ||
      resp?.data?.Id ||
      resp?.data?.Customer?.Id;
    if (id) return id;
    throw new Error(`Unexpected response from customers/add: ${JSON.stringify(resp?.data)}`);
  }

  try {
    return await tryAdd(first, last);
  } catch (eA: any) {
    const msgA = String(eA?.response?.data?.Message || eA?.message || eA).toLowerCase();
    if (!msgA.includes('invalid last'))
      throw new Error(`findOrCreateCustomer failed: ${eA?.response?.data || eA?.message || eA}`);
    try {
      return await tryAdd('Guest', 'Guest');
    } catch (eB: any) {
      const msgB = String(eB?.response?.data?.Message || eB?.message || eB).toLowerCase();
      if (msgB.includes('invalid last')) {
        try {
          return await tryAdd('Guest', `Guest-${Date.now()}`);
        } catch (eC: any) {
          throw new Error(
            `findOrCreateCustomer failed after retry: ${eC?.response?.data?.Message || eC?.message || eC}`,
          );
        }
      }
      throw new Error(`findOrCreateCustomer failed after retry: ${eB?.response?.data || eB?.message || eB}`);
    }
  }
}

// ---------- Reservations ----------
export async function createReservation(p: any) {
  if (!p) throw new Error('createReservation: missing payload');

  const serviceId: string | undefined = p.ServiceId || p.serviceId || undefined;
  const creds = getCredsForService(serviceId);

  try {
    const rooms = Array.isArray(p.Rooms) && p.Rooms.length ? p.Rooms : [];
    const firstRoom = rooms[0] || {};
    const qty = Math.max(1, Number(firstRoom.Quantity || 1)); // støtte for flere enheter

    const personCounts = (firstRoom.Occupancy || []).map((o: any) => ({
      AgeCategoryId: o.AgeCategoryId,
      Count: Number(o.PersonCount || 0),
    }));

    const baseReservation: any = {
      Identifier: p.ClientReference || `bno-${Date.now()}`,
      State: p.State || 'Optional',
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
      ClientToken: creds.clientToken,
      AccessToken: creds.accessToken,
      Client: creds.clientName,
      ServiceId: serviceId || undefined,
      SendConfirmationEmail: p.SendConfirmationEmail === true,
      CheckRateApplicability: false,
      Reservations: reservations,
    };

    const url = `${creds.baseUrl}/api/connector/v1/reservations/add`;
    const cleaned = removeUndefinedRecursive(body);
    const resp = await postJson(serviceId, url, cleaned, 20_000);
    if (resp?.data) return resp.data;
    throw new Error('Empty response from reservations/add');
  } catch (err: any) {
    const body = err?.mewsResponse || err?.response || err?.message || String(err);
    const e = new Error('createReservation failed');
    (e as any).mewsResponse = body;
    throw e;
  }
}

/**
 * Hent reservasjoner for et intervall (for API /mews/reservations).
 * Merk: vi bruker ScheduledStartUtc-filteret (vanlig for liste over ankomster i periode).
 */
export async function fetchReservations(serviceId: string, from: string | Date, to: string | Date) {
  if (!serviceId) throw new Error('fetchReservations: missing serviceId');

  const creds = getCredsForService(serviceId);

  const startTU = toTimeUnitUtc(from);
  // gjør "to" inklusiv ved å gå til neste dag (lokal) som eksklusiv end
  const toYmd = toLocalYmd(to);
  const endExclusiveTU = toTimeUnitUtc(addDaysYmd(toYmd, 1));

  const url = `${creds.baseUrl}/api/connector/v1/reservations/getAll/2023-06-06`;

  const body: any = {
    ClientToken: creds.clientToken,
    AccessToken: creds.accessToken,
    Client: creds.clientName,
    EnterpriseId: creds.enterpriseId,
    ServiceIds: [serviceId],
    States: ['Confirmed', 'Started', 'Processed', 'Optional'],
    ScheduledStartUtc: {
      StartUtc: startTU,
      EndUtc: endExclusiveTU,
    },
    Extent: {
      Reservations: true,
      Customers: true,
      Resources: true,
      ServiceOrders: true,
      Orders: true,
      OrderItems: true,
      Items: true,
    },
    Limitation: { Count: 1000 },
  };

  // fjern undefined (EnterpriseId kan være undefined)
  const resp = await postJson(serviceId, url, removeUndefinedRecursive(body), 20_000);
  return resp.data || {};
}

/** Create product service orders (attach ordered products to reservation) */
export async function createProductServiceOrders(serviceId: string, reservationId: string, orders: any[]) {
  if (!serviceId) throw new Error('Missing serviceId');
  if (!reservationId) throw new Error('Missing reservationId');
  if (!Array.isArray(orders) || orders.length === 0) return null;

  const creds = getCredsForService(serviceId);
  const url = `${creds.baseUrl}/api/connector/v1/productServiceOrders/add`;
  const payload = {
    ClientToken: creds.clientToken,
    AccessToken: creds.accessToken,
    Client: creds.clientName,
    ServiceId: serviceId,
    ProductServiceOrders: orders.map((o) => {
      const out: any = {
        ProductId: o.ProductId || o.productId,
        ReservationId: reservationId,
        Quantity: Number(o.Quantity || o.quantity || o.Count || 0),
      };
      if (o.Price != null) {
        out.Price = {
          Amount: Number(o.Price),
          Currency: o.Currency || undefined,
        };
      }
      return out;
    }),
  };

  try {
    const resp = await postJson(serviceId, url, payload, 20000);
    return resp.data;
  } catch (err: any) {
    const e = new Error('createProductServiceOrders failed');
    (e as any).mewsResponse = err?.mewsResponse || err?.response || err?.message || err;
    throw e;
  }
}

// ---------- NYTT: resources + reservasjoner for vask / sengetøy ----------
/** Hent alle resources (rom/enheter) for ett eller flere serviceId */
export async function fetchResources(serviceId: string | string[]) {
  const serviceIds = Array.isArray(serviceId)
    ? serviceId.map((s) => String(s).trim()).filter(Boolean)
    : [String(serviceId).trim()].filter(Boolean);

  if (!serviceIds.length) return [];

  // alle må være samme credsKey (ellers må man splitte i flere kall)
  const keys = new Set(serviceIds.map((sid) => (isStrandaService(sid) ? 'STRANDA' : 'DEFAULT')));
  if (keys.size > 1) {
    throw new Error(`fetchResources: serviceIds span multiple credential sets (DEFAULT/STRANDA). Split the call per tenant.`);
  }

  const creds = getCredsForService(serviceIds[0]);
  const url = `${creds.baseUrl}/api/connector/v1/resources/getAll`;
  const resp = await postJson(serviceIds[0], url, {
    ClientToken: creds.clientToken,
    AccessToken: creds.accessToken,
    Client: creds.clientName,
    ServiceIds: serviceIds,
    Limitation: { Count: 1000 },
  });
  return resp.data?.Resources || [];
}

export { fetchResources as fetchSpaces };

/**
 * Hent alle order items (produkter) for en eller flere services og periode.
 *
 * Strategi:
 *  - Hent per lokal-dag (hotelTimeZone) med Count=1000.
 *  - Hvis Limitation-feil, subdivider intervallet 2x, 4x ... inntil maxParts (24).
 */
export async function fetchOrderItemsForCleaningRange(
  serviceId: string | string[],
  startDate: string | Date,
  endDate: string | Date,
) {
  const serviceIds = Array.isArray(serviceId)
    ? serviceId.map((s) => String(s).trim()).filter(Boolean)
    : [String(serviceId).trim()].filter(Boolean);

  if (!serviceIds.length) throw new Error('fetchOrderItemsForCleaningRange: missing serviceId(s)');

  const keys = new Set(serviceIds.map((sid) => (isStrandaService(sid) ? 'STRANDA' : 'DEFAULT')));
  if (keys.size > 1) {
    throw new Error(`fetchOrderItemsForCleaningRange: serviceIds span multiple credential sets (DEFAULT/STRANDA). Split per tenant.`);
  }

  const creds = getCredsForService(serviceIds[0]);
  const url = `${creds.baseUrl}/api/connector/v1/orderItems/getAll`;

  const startYmd = toLocalYmd(startDate);
  const endYmd = toLocalYmd(endDate);

  const items: any[] = [];
  const seen = new Set<string>();

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function fetchIntervalParts(intervalStartMs: number, intervalEndMs: number, parts = 1, maxParts = 24) {
    const totalMs = intervalEndMs - intervalStartMs;
    if (totalMs <= 0) return;

    const partMs = Math.floor(totalMs / parts);

    for (let p = 0; p < parts; p++) {
      const subStartMs = intervalStartMs + p * partMs;
      const subEndMs = p === parts - 1 ? intervalEndMs : intervalStartMs + (p + 1) * partMs;

      const subStart = new Date(subStartMs);
      const subEnd = new Date(subEndMs);

      const body = {
        ClientToken: creds.clientToken,
        AccessToken: creds.accessToken,
        Client: creds.clientName,
        EnterpriseId: creds.enterpriseId,
        ServiceIds: serviceIds,
        ConsumedUtc: {
          StartUtc: subStart.toISOString(),
          EndUtc: subEnd.toISOString(),
        },
        Limitation: { Count: 1000 },
      };

      try {
        await sleep(150);
        const resp = await postJson(serviceIds[0], url, removeUndefinedRecursive(body), 20_000);
        const data = resp.data || {};
        const pageItems: any[] = Array.isArray(data.OrderItems)
          ? data.OrderItems
          : Array.isArray(data.Items)
          ? data.Items
          : [];

        if (pageItems.length) {
          for (const it of pageItems) {
            const id = it?.Id ? String(it.Id) : null;
            if (id && seen.has(id)) continue;
            if (id) seen.add(id);
            items.push(it);
          }
        }
      } catch (err: any) {
        const msg = String(err?.mewsResponse?.data?.Message || err?.message || '').toLowerCase();
        const isLimitationError =
          msg.includes('limitation') ||
          msg.includes('limitation count') ||
          msg.includes('must be in range') ||
          msg.includes('out of range');

        if (isLimitationError && parts * 2 <= maxParts) {
          console.warn(
            `fetchOrderItemsForCleaningRange: Limitation error for chunk ${subStart.toISOString()} -> ${subEnd.toISOString()}. Subdividing (${parts * 2} parts).`,
          );
          await fetchIntervalParts(subStartMs, subEndMs, 2, maxParts);
        } else if (isLimitationError && parts * 2 > maxParts) {
          console.error(
            `fetchOrderItemsForCleaningRange: Limitation error and cannot subdivide further for interval ${subStart.toISOString()} -> ${subEnd.toISOString()}`,
          );
        } else {
          console.error(`fetchOrderItemsForCleaningRange: Error fetching items for ${subStart.toISOString()} -> ${subEnd.toISOString()}`);
          console.error(err?.mewsResponse || err?.response?.data || err?.message || err);
        }
      }
    }
  }

  let cursorYmd = startYmd;
  const safetyMax = 4000;
  let safety = 0;

  while (cursorYmd <= endYmd) {
    safety++;
    if (safety > safetyMax) throw new Error('fetchOrderItemsForCleaningRange: safety stop (too many days)');

    const nextYmd = addDaysYmd(cursorYmd, 1);

    const startTU = toTimeUnitUtc(cursorYmd);
    const endTU = toTimeUnitUtc(nextYmd);

    const startMs = Date.parse(startTU);
    const endMs = Date.parse(endTU);

    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
      await fetchIntervalParts(startMs, endMs, 1, 24);
    }

    cursorYmd = nextYmd;
  }

  console.log(`DEBUG: aggregated orderItems count = ${items.length} for serviceIds=${serviceIds.join(',')}`);
  return items;
}

// ---------- Internals for date chunking (reservations interval limit) ----------
function parseDateOnlyUtc(d: string | Date): Date {
  const ymd = toLocalYmd(d);
  const [y, m, day] = ymd.split('-').map((x) => Number(x));
  return new Date(Date.UTC(y, (m || 1) - 1, day || 1, 0, 0, 0, 0));
}
function addDaysUtc(d: Date, days: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}
function daysInUtcMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}
function addMonthsUtc(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const targetMonth = m + months;
  const tmp = new Date(Date.UTC(y, targetMonth, 1, 0, 0, 0, 0));
  const dim = daysInUtcMonth(tmp.getUTCFullYear(), tmp.getUTCMonth());
  tmp.setUTCDate(Math.min(d, dim));
  return tmp;
}
function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

/**
 * Hent reservasjoner i ett chunk og koble på OrderItems/Items (produkt-linjer).
 * (Chunkes av wrapperen pga 3M1D-limit i ScheduledEndUtc-filteret.)
 */
async function fetchReservationsForCleaningRangeSingle(serviceId: string, startTU: string, endExclusiveTU: string) {
  const creds = getCredsForService(serviceId);
  const url = `${creds.baseUrl}/api/connector/v1/reservations/getAll/2023-06-06`;

  const body = {
    ClientToken: creds.clientToken,
    AccessToken: creds.accessToken,
    Client: creds.clientName,
    EnterpriseId: creds.enterpriseId,
    ServiceIds: [serviceId],
    States: ['Confirmed', 'Started', 'Processed'],

    ScheduledEndUtc: {
      StartUtc: startTU,
      EndUtc: endExclusiveTU,
    },

    Extent: {
      Reservations: true,
      ServiceOrders: true,
      Orders: true,
      OrderItems: true,
      Items: true,
    },
    Limitation: { Count: 1000 },
  };

  const resp = await postJson(serviceId, url, removeUndefinedRecursive(body), 20_000);
  const data = resp.data || {};

  const rawReservations: any[] = Array.isArray(data.Reservations) ? data.Reservations : [];

  const startMs = Date.parse(startTU);
  const endMs = Date.parse(endExclusiveTU);

  const reservations: any[] = rawReservations.filter((r: any) => {
    const scheduledEnd = r?.ScheduledEndUtc || r?.EndUtc || r?.End?.Utc || null;
    const t = scheduledEnd ? Date.parse(String(scheduledEnd)) : NaN;
    return Number.isFinite(t) && t >= startMs && t < endMs;
  });

  const serviceOrders: any[] = Array.isArray(data.ServiceOrders)
    ? data.ServiceOrders
    : Array.isArray(data.Orders)
    ? data.Orders
    : [];

  const ordersArr: any[] = Array.isArray(data.Orders) ? data.Orders : [];

  const orderItems: any[] = Array.isArray(data.OrderItems)
    ? data.OrderItems
    : Array.isArray(data.Items)
    ? data.Items
    : [];

  function getReservationKey(r: any): string | null {
    const rid =
      r.Id ||
      r.ReservationId ||
      r.ExternalIdentifier ||
      r.Identifier ||
      r.Number ||
      (r.Reservation && (r.Reservation.Id || r.Reservation.ReservationId || r.Reservation.ExternalIdentifier));
    return rid ? String(rid) : null;
  }

  const reservationLookup = new Map<string, string>();
  for (const r of reservations) {
    const rid = getReservationKey(r);
    if (!rid) continue;

    const addKey = (k: any) => {
      if (!k && k !== 0) return;
      const s = String(k).trim().toLowerCase();
      if (!s) return;
      if (!reservationLookup.has(s)) reservationLookup.set(s, String(rid));
    };

    addKey(rid);
    addKey(r.Id);
    addKey(r.ReservationId);
    addKey(r.ExternalIdentifier);
    addKey(r.Identifier);
    addKey(r.Number);
    addKey(r.OrderId);
    addKey(r.ServiceOrderId);
    addKey(r.Order?.Id);
    addKey(r.Reservation?.Id);
    addKey(r.Reservation?.ReservationId);
    addKey(r.Reservation?.ExternalIdentifier);
    addKey(r.AssignedResourceId);
    if (r.Reservation && typeof r.Reservation === 'object') {
      addKey(r.Reservation.Identifier || r.Reservation.ExternalIdentifier || r.Reservation.Number);
    }
  }

  const orderIdToReservationId = new Map<string, string>();

  for (const r of reservations) {
    const rid = getReservationKey(r);
    if (!rid) continue;

    const candidateOrderIds = [r.OrderId, r.ServiceOrderId, r.Order?.Id, r.Order?.OrderId];
    for (const oidRaw of candidateOrderIds) {
      if (!oidRaw) continue;
      const oid = String(oidRaw);
      if (!orderIdToReservationId.has(oid)) {
        orderIdToReservationId.set(oid, String(rid));
      }
    }
  }

  for (const so of serviceOrders) {
    const rid =
      so.ReservationId || so.Reservation?.Id || so.Reservation?.ReservationId || so.Reservation?.ExternalIdentifier;
    const soId = so.Id || so.ServiceOrderId || so.OrderId || so.Order?.Id || so.Order?.OrderId;

    if (!rid || !soId) continue;

    const keySo = String(soId);
    const keyRes = String(rid);
    if (!orderIdToReservationId.has(keySo)) {
      orderIdToReservationId.set(keySo, keyRes);
    }
  }

  for (const o of ordersArr) {
    const rid = o.ReservationId || o.Reservation?.Id || o.Reservation?.ReservationId || o.Reservation?.ExternalIdentifier;
    const oid = o.Id || o.OrderId || o.ServiceOrderId || o.Order?.Id || o.Order?.OrderId;
    if (!rid || !oid) continue;

    const keyO = String(oid);
    const keyRes = String(rid);
    if (!orderIdToReservationId.has(keyO)) {
      orderIdToReservationId.set(keyO, keyRes);
    }
  }

  const itemsByReservationId = new Map<string, any[]>();
  const unmatchedItems: any[] = [];

  const norm = (v: any): string | null => (v === null || v === undefined ? null : String(v).trim().toLowerCase());

  function tryLookupReservationFromItem(it: any): string | null {
    const candDirect = [
      it.ReservationId,
      it.Reservation?.Id,
      it.Reservation?.ReservationId,
      it.Reservation?.ExternalIdentifier,
    ];
    for (const c of candDirect) {
      if (c) {
        const cN = norm(c);
        if (cN !== null && reservationLookup.has(cN)) {
          return reservationLookup.get(cN)!;
        }
      }
    }

    const orderCandidates = [it.ServiceOrderId, it.OrderId, it.Order?.Id, it.Order?.OrderId, it.Order?.ServiceOrderId];
    for (const oc of orderCandidates) {
      if (!oc) continue;
      const mapped = orderIdToReservationId.get(String(oc));
      if (mapped) return mapped;
    }

    const nested = [
      it.Order?.ReservationId,
      it.Order?.Reservation?.Id,
      it.Order?.Reservation?.ReservationId,
      it.Order?.Reservation?.ExternalIdentifier,
    ];
    for (const n of nested) {
      if (!n) continue;
      const nN = norm(n);
      if (nN !== null && reservationLookup.has(nN)) return reservationLookup.get(nN)!;
    }

    if (it.ExternalIdentifier) {
      const e = norm(it.ExternalIdentifier);
      if (e !== null && reservationLookup.has(e)) return reservationLookup.get(e)!;
    }

    const dataCandidates = [
      it.Data?.ReservationId,
      it.Data?.Reservation?.Id,
      it.Options?.ReservationId,
      it.Options?.Reservation?.Id,
    ];
    for (const d of dataCandidates) {
      if (!d) continue;
      const dN = norm(d);
      if (dN !== null && reservationLookup.has(dN)) return reservationLookup.get(dN)!;
    }

    if (it.AssignedResourceId) {
      const ar = norm(it.AssignedResourceId);
      if (ar !== null) {
        for (const r of reservations) {
          const rr = norm(r.AssignedResourceId);
          if (rr === ar) {
            const maybe = getReservationKey(r);
            if (maybe) return maybe;
          }
        }
      }
    }

    return null;
  }

  for (const it of orderItems) {
    const foundRid = tryLookupReservationFromItem(it);

    if (foundRid) {
      if (!itemsByReservationId.has(foundRid)) itemsByReservationId.set(foundRid, []);
      itemsByReservationId.get(foundRid)!.push(it);
    } else {
      unmatchedItems.push(it);
    }
  }

  if (unmatchedItems.length) {
    console.warn(
      `fetchReservationsForCleaningRange: ${unmatchedItems.length} orderItems could not be linked to reservations for service ${serviceId}. Examples:`,
    );
    for (let i = 0; i < Math.min(5, unmatchedItems.length); i++) {
      const it = unmatchedItems[i];
      console.warn({
        Id: it.Id,
        ProductId: it.ProductId,
        ReservationId: it.ReservationId,
        OrderId: it.OrderId,
        ServiceOrderId: it.ServiceOrderId,
        ExternalIdentifier: it.ExternalIdentifier,
        Data: it.Data,
        Options: it.Options,
      });
    }
  }

  for (const r of reservations) {
    const rid = getReservationKey(r);

    const existingItems: any[] = Array.isArray((r as any).Items)
      ? (r as any).Items
      : Array.isArray((r as any).OrderItems)
      ? (r as any).OrderItems
      : [];

    const mappedItems: any[] = rid && itemsByReservationId.has(rid) ? itemsByReservationId.get(rid)! : [];

    let merged: any[] = [];
    if (existingItems.length && mappedItems.length) {
      merged = [...existingItems, ...mappedItems];
    } else if (mappedItems.length) {
      merged = mappedItems;
    } else {
      merged = existingItems;
    }

    if (merged.length) {
      (r as any).Items = merged;
      (r as any).OrderItems = merged;
    }
  }

  return reservations;
}

export async function fetchReservationsForCleaningRange(serviceId: string, startDate: string | Date, endDate: string | Date) {
  const start = parseDateOnlyUtc(startDate);
  const endInclusive = parseDateOnlyUtc(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(endInclusive.getTime())) {
    throw new Error('fetchReservationsForCleaningRange: invalid start/end dates');
  }
  if (start.getTime() > endInclusive.getTime()) {
    throw new Error('fetchReservationsForCleaningRange: startDate is after endDate');
  }

  const endExclusive = addDaysUtc(endInclusive, 1);

  const byId = new Map<string, any>();

  let cursor = start;
  let safety = 0;

  while (cursor.getTime() < endExclusive.getTime()) {
    safety++;
    if (safety > 60) throw new Error('fetchReservationsForCleaningRange: safety stop (too many chunks)');

    const chunkEndExclusive = minDate(addMonthsUtc(cursor, 3), endExclusive);

    const startTU = toTimeUnitUtc(cursor);
    const endExclusiveTU = toTimeUnitUtc(chunkEndExclusive);

    const rows = await fetchReservationsForCleaningRangeSingle(serviceId, startTU, endExclusiveTU);

    for (const r of rows || []) {
      const id = r?.Id ? String(r.Id) : null;
      if (!id) continue;

      if (!byId.has(id)) {
        byId.set(id, r);
      } else {
        const existing = byId.get(id);
        const a = Array.isArray(existing?.Items)
          ? existing.Items
          : Array.isArray(existing?.OrderItems)
          ? existing.OrderItems
          : [];
        const b = Array.isArray(r?.Items) ? r.Items : Array.isArray(r?.OrderItems) ? r.OrderItems : [];
        if (b.length) {
          existing.Items = [...a, ...b];
          existing.OrderItems = existing.Items;
        }
      }
    }

    cursor = chunkEndExclusive;
  }

  return Array.from(byId.values());
}

// ---------- Linen aggregator (eksportert) ----------
export function buildLinenCountMapFromOrderItems(
  items: any[],
  linenProducts: Record<string, { personsPerUnit: number; name: string }>,
  soToRes?: Record<string, string> | Map<string, string>,
): Record<string, number> {
  const result: Record<string, number> = {};

  const linenByName = Object.values(linenProducts).map((lp) => ({
    name: (lp.name || '').toLowerCase(),
    personsPerUnit: lp.personsPerUnit,
  }));

  const soLookup = (() => {
    if (!soToRes) return null;
    if (soToRes instanceof Map) return soToRes;
    const m = new Map<string, string>();
    for (const [k, v] of Object.entries(soToRes)) m.set(String(k), String(v));
    return m;
  })();

  const getProductIdFromItem = (it: any): string | null => {
    if (!it) return null;

    if (it.ProductId) return String(it.ProductId);
    if (it.Product?.Id) return String(it.Product.Id);
    if (it.Product?.ProductId) return String(it.Product.ProductId);

    if (it.Data?.Product?.ProductId) return String(it.Data.Product.ProductId);
    if (it.Data?.Product?.Id) return String(it.Data.Product.Id);

    if (it.Data?.ProductId) return String(it.Data.ProductId);
    if (it.Data?.Value?.ProductId) return String(it.Data.Value.ProductId);
    if (it.Data?.Value?.Product?.Id) return String(it.Data.Value.Product.Id);
    if (it.Data?.Value?.Product?.ProductId) return String(it.Data.Value.Product.ProductId);

    const data = it.Data || it.data || it.ItemData || it.itemData;
    if (!data) return null;

    const value = data.Value || data.value || data;
    if (value?.ProductId) return String(value.ProductId);
    if (value?.Product?.Id) return String(value.Product.Id);
    if (value?.Product?.ProductId) return String(value.Product.ProductId);
    if (data.ProductId) return String(data.ProductId);
    if (data.Product?.ProductId) return String(data.Product.ProductId);
    if (data.Product?.Id) return String(data.Product.Id);

    return null;
  };

  const resolveReservationId = (it: any): string | null => {
    const direct =
      it.ReservationId ||
      it.Reservation?.Id ||
      it.Reservation?.ReservationId ||
      it.Reservation?.ExternalIdentifier;

    if (direct) return String(direct);

    const soId =
      it.ServiceOrderId ||
      it.ServiceOrder?.Id ||
      it.ServiceOrder?.ServiceOrderId ||
      it.Order?.ServiceOrderId ||
      it.Order?.ServiceOrder?.Id;

    if (soId && soLookup) {
      const mapped = soLookup.get(String(soId));
      if (mapped) return String(mapped);
    }

    if (soId) return String(soId);

    const oid = it.OrderId || it.Order?.Id || it.Order?.OrderId;
    return oid ? String(oid) : null;
  };

  for (const it of items || []) {
    const rid = resolveReservationId(it);
    if (!rid) continue;

    const productIdRaw = getProductIdFromItem(it);
    let lp =
      productIdRaw && linenProducts[productIdRaw.toLowerCase()]
        ? linenProducts[productIdRaw.toLowerCase()]
        : undefined;

    const nameRaw =
      (it.Name ||
        it.ProductName ||
        it.Product?.Name ||
        it.Data?.Name ||
        it.Data?.Product?.Name ||
        it.Data?.Value?.Name ||
        it.Data?.Value?.Product?.Name) ||
      '';
    const nameLower = String(nameRaw || '').toLowerCase();

    if (!lp && nameLower) {
      for (const p of linenByName) {
        if (p.name && nameLower.includes(p.name)) {
          lp = { personsPerUnit: p.personsPerUnit, name: nameRaw };
          break;
        }
      }
    }

    if (!lp && nameLower && /(sengetøy|sengetoy|håndkl|handkl|bed linen|linen)/i.test(nameLower)) {
      let personsPerUnit = 1;
      const m = nameLower.match(/(\d+)\s*(pers|personer|person|p\b)/);
      if (m) {
        const parsed = Number(m[1]);
        if (!Number.isNaN(parsed) && parsed > 0) personsPerUnit = parsed;
      }
      lp = { personsPerUnit, name: nameRaw || 'Linen' };
    }

    if (!lp) continue;

    const quantity =
      Number(
        it.UnitCount ??
          it.Quantity ??
          it.Count ??
          it.UnitAmount?.Count ??
          it.Data?.UnitCount ??
          it.Data?.Quantity ??
          it.Data?.Count ??
          1,
      ) || 1;

    const add = quantity * (lp.personsPerUnit || 1);
    result[rid] = (result[rid] || 0) + add;
  }

  return result;
}

// ---------- default export ----------
export default {
  toTimeUnitUtc,
  parseIsoDurationToMs,
  fetchAvailability,
  fetchAvailabilityNamed,
  fetchCategoriesRaw,
  fetchProducts,
  fetchImageUrls,
  fetchService,
  findOrCreateCustomer,
  createReservation,
  fetchReservations,
  createProductServiceOrders,
  fetchResources,
  fetchSpaces: fetchResources,
  fetchOrderItemsForCleaningRange,
  fetchReservationsForCleaningRange,
  buildLinenCountMapFromOrderItems,
};
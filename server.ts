/* dotenv må konfigureres FØR vi importerer moduler som leser process.env */
import * as dotenv from 'dotenv';

// Sørg for at .env overstyrer evt. eksisterende Windows-env
dotenv.config({ override: true });

import express from 'express';
import cors from 'cors';
import axios, { AxiosRequestConfig } from 'axios';
import bodyParser from 'body-parser';

import mews from './lib/mews';
import { fetchPrices as fetchConnectorPrices } from './lib/prices';
import { mewsWebhookHandler } from './mews-webhook'; // Webhook for Mews
import { fetchSiteMinderAvailability } from './lib/siteminder'; // SiteMinder
import { getMewsConfigForArea } from './lib/mews-config'; // Områdeconfig
import registerHousekeepingRoutes from './lib/housekeepingRoutes'; // Renholds-/eier-API

// 🆕 Bilde-mapping (Supabase)
import { getImagesForResourceCategory } from './lib/imageMap';

// 🆕 Språkvalg for Mews-tekster (Names/Descriptions)
import { pickLocalizedText } from './lib/mewsLocalization';

// =============================================================
// BOOT DIAGNOSTIKK
// =============================================================
const BOOT_TAG = 'BNO-API-BOOT-2026-01-08T00:00Z';
console.log(`[BOOT] ${BOOT_TAG} server.ts loaded`, {
  cwd: process.cwd(),
  node: process.version,
  portEnv: process.env.PORT,
});

// ==== DEBUG: vis hvilken MEWS-konfig Node faktisk bruker ====
console.log('DEBUG MEWS CONFIG:');
console.log('  MEWS_BASE_URL        =', (process.env.MEWS_BASE_URL || '').trim());
console.log(
  '  MEWS_CLIENT_TOKEN    =',
  (process.env.MEWS_CLIENT_TOKEN || '').trim().slice(0, 6),
  '...',
  (process.env.MEWS_CLIENT_TOKEN || '').trim().slice(-4)
);
console.log(
  '  MEWS_ACCESS_TOKEN    =',
  (process.env.MEWS_ACCESS_TOKEN || '').trim().slice(0, 6),
  '...',
  (process.env.MEWS_ACCESS_TOKEN || '').trim().slice(-4)
);
console.log('  MEWS_ENTERPRISE_ID   =', (process.env.MEWS_ENTERPRISE_ID || '').trim());

// ===== ENV =====
const PORT = Number(process.env.PORT || 4000);
const HOST = String(process.env.HOST || '0.0.0.0');
const HOTEL_TZ = String(process.env.HOTEL_TIMEZONE || 'Europe/Oslo');

const MEWS_BASE = (process.env.MEWS_BASE_URL || '').trim();
const MEWS_CLIENT_TOKEN = (process.env.MEWS_CLIENT_TOKEN || '').trim();
const MEWS_ACCESS_TOKEN = (process.env.MEWS_ACCESS_TOKEN || '').trim();
const MEWS_CLIENT_NAME = (process.env.MEWS_CLIENT_NAME || 'bno-api').trim();

// "globale" defaults – brukes som fallback hvis områdeconfig mangler noe
const MEWS_SERVICE_ID = (process.env.MEWS_SERVICE_ID || '').trim();
const MEWS_CONFIGURATION_ID =
  (process.env.MEWS_DISTRIBUTION_CONFIGURATION_ID ||
    process.env.MEWS_CONFIGURATION_ID ||
    '').trim();

const MEWS_DISTRIBUTOR_BASE = (process.env.MEWS_DISTRIBUTOR_BASE || 'https://app.mews-demo.com/distributor').replace(
  /\/$/,
  ''
);

const LOCALE = (process.env.MEWS_LOCALE || 'nb-NO').trim();
const DEF_CURRENCY = (process.env.MEWS_CURRENCY || 'NOK').trim();
const MEWS_ENTERPRISE_ID = (process.env.MEWS_ENTERPRISE_ID || '').trim();
const MEWS_ADULT_AGE_CATEGORY_ID = (process.env.MEWS_ADULT_AGE_CATEGORY_ID || '').trim();

// NB: beholdt for bakoverkomp, men vi bruker IKKE lenger global MEWS_RATE_ID som fallback i pricing/create
const MEWS_RATE_ID = (process.env.MEWS_RATE_ID || '').trim();

/** område-spesifikke serviceId-er */
const MEWS_SERVICE_ID_TRYSIL_TURISTSENTER = (process.env.MEWS_SERVICE_ID_TRYSIL_TURISTSENTER || '').trim();
const MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER = (process.env.MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER || '').trim();
const MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE = (process.env.MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE || '').trim();
const MEWS_SERVICE_ID_TANDADALEN_SALEN = (process.env.MEWS_SERVICE_ID_TANDADALEN_SALEN || '').trim();
const MEWS_SERVICE_ID_HOGFJALLET_SALEN = (process.env.MEWS_SERVICE_ID_HOGFJALLET_SALEN || '').trim();
const MEWS_SERVICE_ID_LINDVALLEN_SALEN = (process.env.MEWS_SERVICE_ID_LINDVALLEN_SALEN || '').trim();

/** 🆕 Trysil Sentrum */
const MEWS_SERVICE_ID_TRYSIL_SENTRUM = (process.env.MEWS_SERVICE_ID_TRYSIL_SENTRUM || '').trim();

/** område-spesifikke ageCategory (fra .env) */
const MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_TURISTSENTER = (
  process.env.MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_TURISTSENTER || ''
).trim();
const MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_HOYFJELLSSENTER = (
  process.env.MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_HOYFJELLSSENTER || ''
).trim();
const MEWS_ADULT_AGE_CATEGORY_ID_TRYSILFJELL_HYTTEOMRADE = (
  process.env.MEWS_ADULT_AGE_CATEGORY_ID_TRYSILFJELL_HYTTEOMRADE || ''
).trim();
const MEWS_ADULT_AGE_CATEGORY_ID_TANDADALEN_SALEN = (
  process.env.MEWS_ADULT_AGE_CATEGORY_ID_TANDADALEN_SALEN || ''
).trim();
const MEWS_ADULT_AGE_CATEGORY_ID_HOGFJALLET_SALEN = (
  process.env.MEWS_ADULT_AGE_CATEGORY_ID_HOGFJALLET_SALEN || ''
).trim();
const MEWS_ADULT_AGE_CATEGORY_ID_LINDVALLEN_SALEN = (
  process.env.MEWS_ADULT_AGE_CATEGORY_ID_LINDVALLEN_SALEN || ''
).trim();

/** 🆕 Trysil Sentrum */
const MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_SENTRUM = (
  process.env.MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_SENTRUM || ''
).trim();

/** rateId (beholdt fra .env for Sälen etc) */
const MEWS_RATE_ID_TRYSIL_TURISTSENTER = (process.env.MEWS_RATE_ID_TRYSIL_TURISTSENTER || '').trim();
const MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER = (process.env.MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER || '').trim();
const MEWS_RATE_ID_TRYSILFJELL_HYTTEOMRADE = (process.env.MEWS_RATE_ID_TRYSILFJELL_HYTTEOMRADE || '').trim();
const MEWS_RATE_ID_TANDADALEN_SALEN = (process.env.MEWS_RATE_ID_TANDADALEN_SALEN || '').trim();
const MEWS_RATE_ID_HOGFJALLET_SALEN = (process.env.MEWS_RATE_ID_HOGFJALLET_SALEN || '').trim();
const MEWS_RATE_ID_LINDVALLEN_SALEN = (process.env.MEWS_RATE_ID_LINDVALLEN_SALEN || '').trim();

/** 🆕 Trysil Sentrum */
const MEWS_RATE_ID_TRYSIL_SENTRUM = (process.env.MEWS_RATE_ID_TRYSIL_SENTRUM || '').trim();

type ServiceConfig = {
  id: string;
  name: string;
  rateId?: string | null; // service-default (for tjenester der rate er “fast”)
  adultAgeCategoryId?: string | null;
};

/** Liste over alle områder vi vil bruke i "generelt søk" */
const MEWS_SERVICES_ALL: ServiceConfig[] = [
  {
    id: MEWS_SERVICE_ID_TRYSIL_TURISTSENTER,
    name: 'Trysil Turistsenter',
    // IKKE global fallback – og for Trysil plukkes riktig rate basert på netter (se mapping under)
    rateId: MEWS_RATE_ID_TRYSIL_TURISTSENTER || null,
    adultAgeCategoryId:
      MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_TURISTSENTER || MEWS_ADULT_AGE_CATEGORY_ID || null,
  },
  {
    id: MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER,
    name: 'Trysil Høyfjellssenter',
    rateId: MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER || null,
    adultAgeCategoryId:
      MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_HOYFJELLSSENTER || MEWS_ADULT_AGE_CATEGORY_ID || null,
  },
  {
    id: MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE,
    name: 'Trysilfjell Hytteområde',
    rateId: MEWS_RATE_ID_TRYSILFJELL_HYTTEOMRADE || null,
    adultAgeCategoryId:
      MEWS_ADULT_AGE_CATEGORY_ID_TRYSILFJELL_HYTTEOMRADE || MEWS_ADULT_AGE_CATEGORY_ID || null,
  },
  {
    id: MEWS_SERVICE_ID_TRYSIL_SENTRUM,
    name: 'Trysil Sentrum',
    rateId: MEWS_RATE_ID_TRYSIL_SENTRUM || null,
    adultAgeCategoryId: MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_SENTRUM || MEWS_ADULT_AGE_CATEGORY_ID || null,
  },
  {
    id: MEWS_SERVICE_ID_TANDADALEN_SALEN,
    name: 'Tandådalen Sälen',
    rateId: MEWS_RATE_ID_TANDADALEN_SALEN || null,
    adultAgeCategoryId: MEWS_ADULT_AGE_CATEGORY_ID_TANDADALEN_SALEN || MEWS_ADULT_AGE_CATEGORY_ID || null,
  },
  {
    id: MEWS_SERVICE_ID_HOGFJALLET_SALEN,
    name: 'Högfjället Sälen',
    rateId: MEWS_RATE_ID_HOGFJALLET_SALEN || null,
    adultAgeCategoryId: MEWS_ADULT_AGE_CATEGORY_ID_HOGFJALLET_SALEN || MEWS_ADULT_AGE_CATEGORY_ID || null,
  },
  {
    id: MEWS_SERVICE_ID_LINDVALLEN_SALEN,
    name: 'Lindvallen Sälen',
    rateId: MEWS_RATE_ID_LINDVALLEN_SALEN || null,
    adultAgeCategoryId: MEWS_ADULT_AGE_CATEGORY_ID_LINDVALLEN_SALEN || MEWS_ADULT_AGE_CATEGORY_ID || null,
  },
].filter((s) => !!s.id);

console.log('MEWS_SERVICES_ALL =', MEWS_SERVICES_ALL);

// ===== RATE-ID per serviceId og antall netter (Trysil) =====
type NightsRateMap = Record<number, string>;
const RATE_ID_BY_SERVICE_AND_NIGHTS: Record<string, NightsRateMap> = {};

function addRateMap(serviceId: string, map: NightsRateMap) {
  if (!serviceId) return;
  RATE_ID_BY_SERVICE_AND_NIGHTS[serviceId] = map;
}

addRateMap(MEWS_SERVICE_ID_TRYSIL_TURISTSENTER, {
  2: 'fee3be3d-a89c-430d-bc71-b38e00c5db4c',
  3: '201ba0b7-8940-4327-994c-b38e00c5b319',
  4: '5cf8335f-00cf-4ca2-af78-b38e00c50a6c',
  5: 'addcea3a-f871-4d10-bec3-b38e00ba3a3d',
  7: '84f0dfbb-9edc-4aea-b0ae-b38e00c59ab0',
});
addRateMap(MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE, {
  2: 'e2e15380-3ec8-4e87-83eb-b3cb006da885',
  3: 'db93a87b-b3ad-4461-8cd5-b3cb006ddeb0',
  4: '316d9c6e-585e-4e6d-a8bf-b3cb006e6df3',
  5: '2e375ed0-4d21-4e46-a39c-b3cb006e8fbd',
  7: '00d25428-efac-4359-97d5-b3cb006eceeb',
});
addRateMap(MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER, {
  2: '0cc07e2e-04d0-4277-94a8-b32500908292',
  3: '47e3dbb8-6dff-4a17-8652-b3250090b8bc',
  4: '27a36ff4-7ff3-4676-8be8-b32500910cbd',
  5: 'f66e9952-5587-4c7d-8ed9-b32500913ff8',
  7: '2da4c186-b1bd-423d-831b-b31b00f250c4',
});
addRateMap(MEWS_SERVICE_ID_TRYSIL_SENTRUM, {
  2: '6c35f20e-8fd0-4dee-aaa1-b3cb01471385',
  3: 'f3226cd1-ebac-463d-90ec-b3cb01477dbf',
  4: '9764630b-b5f1-4132-a9f3-b3cb0147a42a',
  5: '1bbaf079-d19b-4ebb-8709-b3cb0147cfd4',
  7: 'b7b98387-97ba-42fb-bb62-b3cb01481ed8',
});

function pickRateIdForServiceAndNights(serviceId: string, nights: number): string | null {
  const m = RATE_ID_BY_SERVICE_AND_NIGHTS[serviceId];
  if (!m) return null;
  return m[nights] || null;
}

/** Helper: map area-slug -> services + "areaKey" til params.area */
function resolveServicesForArea(
  areaSlugRaw: string | undefined | null
): { services: ServiceConfig[]; areaKey: string | null } {
  const slug = (areaSlugRaw || '').toLowerCase().trim();

  // Ingen area => alle områder
  if (!slug) {
    return { services: MEWS_SERVICES_ALL, areaKey: null };
  }

  if (slug === 'trysil-sentrum' || slug === 'trysil_sentrum') {
    return {
      services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_TRYSIL_SENTRUM),
      areaKey: 'TRYSIL_SENTRUM',
    };
  }

  if (slug === 'trysil-turistsenter' || slug === 'trysil_turistsenter') {
    return {
      services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_TRYSIL_TURISTSENTER),
      areaKey: 'TRYSIL_TURISTSENTER',
    };
  }

  if (slug === 'trysil-hoyfjellssenter' || slug === 'trysil-høyfjellssenter' || slug === 'trysil_hoyfjellssenter') {
    return {
      services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER),
      areaKey: 'TRYSIL_HOYFJELLSSENTER',
    };
  }

  if (slug === 'trysilfjell-hytteomrade' || slug === 'trysilfjell-hytteområde' || slug === 'trysilfjell_hytteomrade') {
    return {
      services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE),
      areaKey: 'TRYSILFJELL_HYTTEOMRADE',
    };
  }

  if (slug === 'tandadalen-salen' || slug === 'tandådalen-sälen' || slug === 'tandadalen_salen') {
    return {
      services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_TANDADALEN_SALEN),
      areaKey: 'TANDADALEN_SALEN',
    };
  }

  if (slug === 'hogfjallet-salen' || slug === 'högfjället-sälen' || slug === 'hogfjallet_salen') {
    return {
      services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_HOGFJALLET_SALEN),
      areaKey: 'HOGFJALLET_SALEN',
    };
  }

  if (slug === 'lindvallen-salen' || slug === 'lindvallen-sälen' || slug === 'lindvallen_salen') {
    return {
      services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_LINDVALLEN_SALEN),
      areaKey: 'LINDVALLEN_SALEN',
    };
  }

  const normalizedKey = slug.replace(/[\s-]+/g, '_').toUpperCase();
  return { services: MEWS_SERVICES_ALL, areaKey: normalizedKey };
}

/** slå av/på server-side reservasjon + produktordre */
const ENABLE_SERVER_RESERVATION = String(process.env.ENABLE_SERVER_RESERVATION || '0') === '1';

// ===== Simple in-memory cache (TTL) =====
const cache: Record<string, { expires: number; data: any }> = {};

function setCache(key: string, data: any, ttlSec = 120) {
  cache[key] = { expires: Date.now() + ttlSec * 1000, data };
}

function getCache(key: string) {
  const v = cache[key];
  if (!v) return null;
  if (Date.now() > v.expires) {
    delete cache[key];
    return null;
  }
  return v.data;
}

// ===== Search cache (per query) =====
function cacheSearchKey(from: string, to: string, adults: number) {
  return `search:${from}:${to}:a${adults}`;
}
function getSearchCache(key: string) {
  return getCache(key);
}
function setSearchCache(key: string, data: any, ttlSec = 30) {
  setCache(key, data, ttlSec);
}

// ===== Axios wrapper med retry/backoff som respekterer Retry-After =====
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
          `axiosWithRetry: 429 received, attempt ${attempt}, waiting ${waitMs}ms (retry-after=${retryAfterRaw})`
        );
        await new Promise((r) => setTimeout(r, waitMs));
        delay *= 2;
        continue;
      }

      const transientCodes = ['ECONNRESET', 'ECONNABORTED', 'ENOTFOUND', 'EAI_AGAIN'];
      if (transientCodes.includes(code) && attempt <= maxRetries) {
        console.warn(`axiosWithRetry: transient error ${code}, attempt ${attempt}, retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }

      console.error('axiosWithRetry: giving up', {
        url: config.url,
        method: config.method,
        status,
        code,
        data: err?.response?.data || err?.message,
        headers,
      });
      throw err;
    }
  }
}

// ===== HELPERS =====
function daysBetween(ymdFrom: string, ymdTo: string) {
  const a = new Date(`${ymdFrom}T00:00:00Z`);
  const b = new Date(`${ymdTo}T00:00:00Z`);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Brukt til å mappe lokal dato-range (YYYY-MM-DD) til
 * FirstTimeUnitStartUtc / LastTimeUnitStartUtc på MEWS-sin måte.
 */
function buildTimeUnitRange(fromYmd: string, toYmd: string): { firstUtc: string; lastUtc: string } {
  const firstUtc = mews.toTimeUnitUtc(fromYmd);
  const lastDayYmd = addDaysYmd(toYmd, -1);
  const lastUtc = mews.toTimeUnitUtc(lastDayYmd);
  return { firstUtc, lastUtc };
}

function firstLang(obj: any, locale: string) {
  if (!obj) return '';
  if (obj[locale]) return obj[locale];
  const keys = Object.keys(obj || {});
  return keys.length ? obj[keys[0]] ?? '' : '';
}

function safeNum(v: any): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function sumNumbersSafe(list: Array<number | null | undefined>): number {
  let acc = 0;
  for (const v of list || []) acc += Number(v || 0);
  return acc;
}

function extractPriceValueCurrency(priceObj: any): { value: number | null; currency: string | null } {
  if (priceObj == null) return { value: null, currency: null };
  if (typeof priceObj === 'number') return { value: safeNum(priceObj), currency: null };

  if (priceObj.TotalAmount && typeof priceObj.TotalAmount === 'object') {
    const keys = Object.keys(priceObj.TotalAmount || {});
    if (keys.length > 0) {
      const k = keys[0];
      const v =
        priceObj.TotalAmount[k]?.GrossValue ??
        priceObj.TotalAmount[k]?.Value ??
        priceObj.TotalAmount[k]?.Total ??
        null;
      return { value: safeNum(v), currency: k };
    }
  }

  const val = priceObj.GrossValue ?? priceObj.Value ?? priceObj.Total ?? priceObj.Amount ?? null;
  const cur = priceObj.Currency ?? priceObj.CurrencyCode ?? null;
  return { value: safeNum(val), currency: cur ? String(cur) : null };
}

type AvItem =
  | number
  | {
      TotalAvailableUnitsCount?: unknown;
      AvailableRoomCount?: unknown;
      AvailableUnitsCount?: unknown;
      AvailableUnitCount?: unknown;
      Count?: unknown;
    }
  | null
  | undefined;

function toNumMaybe(v: any): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function avToCount(x: AvItem): number {
  if (x == null) return 0;
  if (typeof x === 'number') return Number.isFinite(x) ? x : 0;

  const candidates = [
    (x as any).TotalAvailableUnitsCount,
    (x as any).AvailableRoomCount,
    (x as any).AvailableUnitsCount,
    (x as any).AvailableUnitCount,
    (x as any).Count,
  ];

  for (const c of candidates) {
    const n = toNumMaybe(c);
    if (n != null) return n;
  }
  return 0;
}

/**
 * Viktig: For å unngå “falsk ledighet”, må vi bruke MIN over alle netter (inkl. 0).
 * Tidligere logikk som ignorerte 0 kan føre til at rom vises ledig selv om én natt er utsolgt.
 */
function computeAvailableUnits(item: any): number {
  if (Array.isArray(item?.Availabilities) && item.Availabilities.length > 0) {
    const vals = (item.Availabilities as AvItem[]).map(avToCount).filter((v: number) => Number.isFinite(v));
    if (vals.length > 0) {
      return Math.min(...vals); // inkluderer 0 -> korrekt “ikke ledig”
    }
  }

  const ar = toNumMaybe(item?.AvailableRoomCount);
  if (ar != null && ar >= 0) return ar;

  const tu = toNumMaybe(item?.TotalAvailableUnitsCount);
  if (tu != null && tu >= 0) return tu;

  return 0;
}

function computePricesFromAvailabilities(item: any): { nightly: (number | null)[]; total: number | null; currency: string | null } {
  if (!Array.isArray(item.Availabilities) || item.Availabilities.length === 0) {
    if (Array.isArray(item.PriceNightly) && item.PriceNightly.length > 0) {
      const nightly = (item.PriceNightly as any[]).map((vv: any) => safeNum(vv));
      const total = sumNumbersSafe(nightly);
      return { nightly, total: nightly.length ? total : null, currency: item.PriceCurrency || null };
    }
    if (item.PriceTotal != null) return { nightly: [], total: safeNum(item.PriceTotal), currency: item.PriceCurrency ?? null };
    if (item.Price) {
      const ex = extractPriceValueCurrency(item.Price);
      return { nightly: [], total: ex.value, currency: ex.currency };
    }
    return { nightly: [], total: null, currency: null };
  }

  const nightly: (number | null)[] = [];
  let detectedCurrency: string | null = null;

  for (const aRaw of item.Availabilities as any[]) {
    if (!aRaw) {
      nightly.push(null);
      continue;
    }

    const candidates = [aRaw.Price, aRaw.PricePerUnit, aRaw.PriceTotal, aRaw.TimeUnitPrice, aRaw.TimeUnitPrices, aRaw.PriceAmount, aRaw.PriceInfo];
    let foundVal: number | null = null;
    let foundCur: string | null = null;

    for (const c of candidates) {
      if (!c) continue;
      if (Array.isArray(c) && c.length) {
        const ex = extractPriceValueCurrency(c[0]);
        if (ex.value != null) {
          foundVal = ex.value;
          foundCur = ex.currency;
          break;
        }
      } else {
        const ex = extractPriceValueCurrency(c);
        if (ex.value != null) {
          foundVal = ex.value;
          foundCur = ex.currency;
          break;
        }
      }
    }

    if (foundVal == null && aRaw.Price && typeof aRaw.Price === 'object') {
      const ex = extractPriceValueCurrency(aRaw.Price);
      foundVal = ex.value;
      foundCur = ex.currency;
    }
    if (foundVal == null && aRaw.TimeUnitPrice) {
      const ex = extractPriceValueCurrency(aRaw.TimeUnitPrice);
      foundVal = ex.value;
      foundCur = ex.currency;
    }

    nightly.push(foundVal ?? null);
    if (!detectedCurrency && foundCur) detectedCurrency = foundCur;
  }

  const anyPrice = nightly.some((v) => v != null);
  const total = anyPrice ? sumNumbersSafe(nightly) : null;
  return { nightly, total, currency: detectedCurrency };
}

function pricesFromCategoryPricing(
  catPrices: any[],
  categoryId: string | undefined | null,
  fallbackCurrency: string | null
): { nightly: (number | null)[]; total: number | null; currency: string | null } {
  if (!categoryId) return { nightly: [], total: null, currency: fallbackCurrency || null };

  const found = (catPrices || []).find(
    (cp: any) =>
      cp?.CategoryId === categoryId ||
      cp?.ResourceCategoryId === categoryId ||
      cp?.RoomCategoryId === categoryId ||
      cp?.Id === categoryId
  );
  if (!found) return { nightly: [], total: null, currency: fallbackCurrency || null };

  let nightly: (number | null)[] = [];
  if (Array.isArray(found.TimeUnitPrices) && found.TimeUnitPrices.length) {
    nightly = found.TimeUnitPrices.map((p: any) => extractPriceValueCurrency(p).value);
  } else if (Array.isArray(found.Prices) && found.Prices.length) {
    nightly = found.Prices.map((p: any) => extractPriceValueCurrency(p).value);
  }

  let currency: string | null = fallbackCurrency || null;
  const curProbe = extractPriceValueCurrency(
    (Array.isArray(found.TimeUnitPrices) && found.TimeUnitPrices[0]) ||
      (Array.isArray(found.Prices) && found.Prices[0]) ||
      found.TotalPrice ||
      found.PriceTotal
  );
  if (curProbe.currency) currency = curProbe.currency;

  const total = nightly.length
    ? sumNumbersSafe(nightly)
    : extractPriceValueCurrency(found.TotalPrice || found.PriceTotal || found.BaseAmountPrice).value;

  return { nightly, total, currency };
}

/**
 * Hent totalpris for EN reservasjon (1 enhet) via reservations/price.
 * NB: vi sender KUN RateId hvis vi faktisk har en (for å unngå Invalid RateId).
 */
async function priceReservationOnce(opts: {
  startYmd: string;
  endYmd: string;
  categoryId: string;
  rateId?: string | null;
  adults: number;
  serviceId: string;
  adultAgeCategoryId: string;
}): Promise<{ total: number | null; currency: string | null }> {
  if (!MEWS_BASE || !MEWS_CLIENT_TOKEN || !MEWS_ACCESS_TOKEN) {
    return { total: null, currency: null };
  }
  if (!opts.serviceId || !opts.adultAgeCategoryId) {
    return { total: null, currency: null };
  }

  const url = `${MEWS_BASE}/api/connector/v1/reservations/price`;

  const reservation: any = {
    Identifier: 'preview-1',
    StartUtc: mews.toTimeUnitUtc(opts.startYmd),
    EndUtc: mews.toTimeUnitUtc(opts.endYmd),
    RequestedCategoryId: opts.categoryId,
    AdultCount: Math.max(1, Number(opts.adults || 1)),
    PersonCounts: [
      {
        AgeCategoryId: opts.adultAgeCategoryId,
        Count: Math.max(1, Number(opts.adults || 1)),
      },
    ],
  };

  // Kun sett RateId når den er oppgitt (og dermed “valgt med vilje”)
  if (opts.rateId && String(opts.rateId).trim().length > 0) {
    reservation.RateId = String(opts.rateId).trim();
  }

  const payload = {
    ClientToken: MEWS_CLIENT_TOKEN,
    AccessToken: MEWS_ACCESS_TOKEN,
    Client: MEWS_CLIENT_NAME,
    ServiceId: opts.serviceId,
    Reservations: [reservation],
  };

  try {
    const respData = await axiosWithRetry<any>({
      method: 'post',
      url,
      data: payload,
      timeout: 15000,
    });
    const item = respData?.ReservationPrices?.[0] || respData?.ReservationPrice || null;
    if (!item) return { total: null, currency: null };

    const amountObj = item.TotalAmount || item.Total || item.TotalPrice || item.Price || null;
    const ex = extractPriceValueCurrency(amountObj);
    return { total: ex.value, currency: ex.currency || DEF_CURRENCY };
  } catch (e: any) {
    console.error('priceReservationOnce_error', {
      url,
      message: e?.message,
      code: e?.code || null,
      status: e?.response?.status || null,
      data: e?.response?.data || null,
      headers: e?.response?.headers || null,
    });
    throw e;
  }
}

// =======================
// Express app + middleware
// =======================
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

// Registrer renholds-/eier-API-rutene
registerHousekeepingRoutes(app);

// =============================================================
// ROUTE DUMP: endpoint /api/routes
// =============================================================
function listRegisteredRoutes() {
  const stack = ((app as any)?._router?.stack || []) as any[];
  const routes: Array<{ method: string; path: string }> = [];
  for (const layer of stack) {
    if (layer?.route?.path && layer?.route?.methods) {
      const methods = Object.keys(layer.route.methods)
        .filter((k) => layer.route.methods[k])
        .map((m) => m.toUpperCase());
      for (const m of methods) {
        routes.push({ method: m, path: String(layer.route.path) });
      }
    }
  }
  return routes;
}

app.get('/api/routes', (_req, res) => {
  const routes = listRegisteredRoutes();
  res.json({
    ok: true,
    bootTag: BOOT_TAG,
    count: routes.length,
    hasMewsReservations: routes.some((r) => r.path === '/mews/reservations'),
    routes,
  });
});

// ===== PING / HEALTH =====
app.get('/api/ping', (_req, res) => res.json({ ok: true, where: 'api', at: Date.now(), tz: HOTEL_TZ }));
app.get('/ping', (_req, res) => res.json({ ok: true, where: 'root', at: Date.now(), tz: HOTEL_TZ }));
app.get('/api/health', (_req, res) =>
  res.json({
    ok: true,
    serviceId: MEWS_SERVICE_ID || null,
    enterpriseId: MEWS_ENTERPRISE_ID || null,
    tz: HOTEL_TZ,
    hasTokens: !!(MEWS_BASE && MEWS_CLIENT_TOKEN && MEWS_ACCESS_TOKEN),
  })
);

// =============================================================
// INLINE ROUTES: mewsReservations / mewsServices / mewsSpaces
// =============================================================
async function mewsConnectorPost<T = any>(path: string, data: any, timeoutMs = 20000): Promise<T> {
  if (!MEWS_BASE || !MEWS_CLIENT_TOKEN || !MEWS_ACCESS_TOKEN) {
    throw new Error('mews_credentials_missing');
  }
  const url = `${MEWS_BASE}/api/connector/v1/${path.replace(/^\//, '')}`;
  return axiosWithRetry<T>({
    method: 'post',
    url,
    data: {
      ClientToken: MEWS_CLIENT_TOKEN,
      AccessToken: MEWS_ACCESS_TOKEN,
      Client: MEWS_CLIENT_NAME,
      ...data,
    },
    timeout: timeoutMs,
  });
}

// /mews/services (+ alias /api/mews/services)
app.get(['/mews/services', '/api/mews/services'], async (_req, res) => {
  try {
    const cacheKey = 'mews_services_getAll_v1';
    const cached = getCache(cacheKey);
    if (cached) return res.json({ ok: true, data: cached });

    const rData = await mewsConnectorPost<any>(
      'services/getAll',
      { Limitation: { Count: 1000 } },
      20000
    );

    const services: any[] = rData?.Services || [];
    const out = services.map((svc: any) => ({
      Id: svc?.Id,
      Name: firstLang(svc?.Name, LOCALE) || svc?.Name || svc?.ExternalIdentifier,
      Type: svc?.Type || null,
      EnterpriseId: svc?.EnterpriseId || null,
    }));

    setCache(cacheKey, out, 120);
    return res.json({ ok: true, data: out });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: 'mews_services_failed', detail: e?.message || String(e) });
  }
});

// /mews/spaces (+ alias /api/mews/spaces)
app.get(['/mews/spaces', '/api/mews/spaces'], async (req, res) => {
  try {
    const serviceId = String(req.query.serviceId || '').trim();
    const serviceIds = serviceId ? [serviceId] : MEWS_SERVICES_ALL.map((s) => s.id).filter(Boolean);

    const cacheKey = `mews_spaces_getAll_v1:${serviceIds.sort().join(',')}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json({ ok: true, data: cached });

    const payload: any = {
      ServiceIds: serviceIds,
      ActivityStates: ['Active'],
      Limitation: { Count: 1000 },
    };
    if (MEWS_ENTERPRISE_ID) payload.EnterpriseIds = [MEWS_ENTERPRISE_ID];

    const rData = await mewsConnectorPost<any>('spaces/getAll', payload, 25000);
    const spaces: any[] = rData?.Spaces || rData?.SpaceGroups || [];

    const out = spaces.map((sp: any) => ({
      Id: sp?.Id,
      Name: firstLang(sp?.Name, LOCALE) || sp?.Name || sp?.ExternalIdentifier || null,
      ServiceId: sp?.ServiceId || null,
      Type: sp?.Type || null,
      IsActive: sp?.IsActive ?? null,
    }));

    setCache(cacheKey, out, 120);
    return res.json({ ok: true, data: out, meta: { serviceIds } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: 'mews_spaces_failed', detail: e?.message || String(e) });
  }
});

// /mews/reservations (+ alias /api/mews/reservations)
app.get(['/mews/reservations', '/api/mews/reservations'], async (req, res) => {
  try {
    const from = String(req.query.from || '').slice(0, 10);
    const to = String(req.query.to || '').slice(0, 10);

    const serviceId = String(req.query.serviceId || '').trim();
    const serviceIds = serviceId ? [serviceId] : MEWS_SERVICES_ALL.map((s) => s.id).filter(Boolean);

    const statesRaw = String(req.query.states || '').trim();
    const states = statesRaw ? statesRaw.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

    if (!from || !to) {
      return res.json({
        ok: true,
        data: [],
        warn: 'missing_from_to',
        params: { from, to, serviceIds, states },
      });
    }

    const payload: any = {
      ServiceIds: serviceIds,
      Limitation: { Count: 1000 },
      StartUtc: mews.toTimeUnitUtc(from),
      EndUtc: mews.toTimeUnitUtc(to),
    };

    if (states && states.length) payload.ReservationStates = states;

    const rData = await mewsConnectorPost<any>('reservations/getAll', payload, 30000);
    const reservations: any[] = rData?.Reservations || [];

    return res.json({
      ok: true,
      data: reservations,
      meta: { count: reservations.length, from, to, serviceIds, states: states || null },
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: 'mews_reservations_failed', detail: e?.message || String(e) });
  }
});

// ===== SERVICES (diagnostic) =====
app.get('/api/services', async (_req, res) => {
  try {
    if (!MEWS_BASE || !MEWS_CLIENT_TOKEN || !MEWS_ACCESS_TOKEN) {
      return res.json({ ok: false, error: 'credentials_missing' });
    }

    const cacheKey = 'services_v1';
    const cached = getCache(cacheKey);
    if (cached) return res.json({ ok: true, data: cached });

    const url = `${MEWS_BASE}/api/connector/v1/services/getAll`;
    const payload = {
      ClientToken: MEWS_CLIENT_TOKEN,
      AccessToken: MEWS_ACCESS_TOKEN,
      Client: MEWS_CLIENT_NAME,
      Limitation: { Count: 1000 },
    };

    try {
      const rData = await axiosWithRetry<any>({ method: 'post', url, data: payload, timeout: 15000 });

      const services: any[] = rData?.Services || [];
      const out = services.map((svc: any) => ({
        Id: svc?.Id,
        Name: firstLang(svc?.Name, LOCALE) || svc?.Name || svc?.ExternalIdentifier,
        Type: svc?.Type || null,
        EnterpriseId: svc?.EnterpriseId || null,
      }));

      setCache(cacheKey, out, 120);
      return res.json({ ok: true, data: out });
    } catch (e: any) {
      const status = e?.response?.status || null;
      const headers = e?.response?.headers || {};
      const retryRaw = headers['retry-after'];

      console.error('services_error', { message: e?.message, status, data: e?.response?.data || null, headers });

      if (status === 429 && retryRaw) {
        let ttl = 60;
        const asNum = Number(retryRaw);
        if (!Number.isNaN(asNum)) ttl = Math.max(1, Math.ceil(asNum));
        else {
          const parsed = Date.parse(retryRaw);
          if (!Number.isNaN(parsed)) ttl = Math.max(1, Math.ceil((parsed - Date.now()) / 1000));
        }
        ttl = Math.min(60 * 10, ttl + 5);
        setCache(cacheKey, [], ttl);
        console.warn(`services: cached empty services for ${ttl}s due to 429 (retry-after=${retryRaw})`);
      }

      return res.json({ ok: false, error: 'services_failed', detail: e?.message || String(e) });
    }
  } catch (e: any) {
    console.error('services_unexpected_error', e?.message || e);
    return res.json({ ok: false, error: 'services_failed', detail: e?.message || String(e) });
  }
});

/**
 * ===== GENERELL MEWS-AVAILABILITY =====
 * GET /api/mews/availability?from=YYYY-MM-DD&to=YYYY-MM-DD[&serviceId=...][&adults=2][&lang=en-GB]
 */
app.get('/api/mews/availability', async (req, res) => {
  try {
    const from = String(req.query.from || '').slice(0, 10);
    const to = String(req.query.to || '').slice(0, 10);
    const adults = Number(req.query.adults || 1);
    const serviceIdParam = req.query.serviceId ? String(req.query.serviceId).trim() : '';

    const langParamRaw = req.query.lang ? String(req.query.lang) : '';
    const requestedLang = (langParamRaw || LOCALE).trim();

    if (!from || !to) {
      return res.status(400).json({ ok: false, error: 'missing_params', detail: 'from og to (YYYY-MM-DD) er påkrevd' });
    }
    if (!MEWS_BASE || !MEWS_CLIENT_TOKEN || !MEWS_ACCESS_TOKEN) {
      return res.status(500).json({ ok: false, error: 'mews_credentials_missing' });
    }

    const nights = daysBetween(from, to);

    // For pris – prøv å hente globale CategoryPrices én gang per kall
    let catPrices: any[] = [];
    let pricingCurrency: string | null = DEF_CURRENCY;
    try {
      const pricing = await fetchConnectorPrices(from, to);
      catPrices = Array.isArray(pricing?.CategoryPrices) ? pricing.CategoryPrices : [];
      pricingCurrency = pricing?.Currency || DEF_CURRENCY;
    } catch (e: any) {
      console.warn('mews_availability: rates/getPricing failed, fortsetter uten forhåndspriser', e?.message || e);
    }

    // Hvilke services skal vi spørre mot?
    let servicesToQuery: ServiceConfig[] = [];
    if (serviceIdParam) {
      const found = MEWS_SERVICES_ALL.find((s) => s.id === serviceIdParam);
      servicesToQuery = found
        ? [found]
        : [{ id: serviceIdParam, name: 'Ukjent område (fra serviceId)' }];
    } else {
      servicesToQuery = MEWS_SERVICES_ALL;
    }

    const allRooms: any[] = [];

    for (const svc of servicesToQuery) {
      if (!svc.id) continue;

      try {
        const { firstUtc, lastUtc } = buildTimeUnitRange(from, to);

        const availPayload = {
          ClientToken: MEWS_CLIENT_TOKEN,
          AccessToken: MEWS_ACCESS_TOKEN,
          Client: MEWS_CLIENT_NAME,
          ServiceId: svc.id,
          FirstTimeUnitStartUtc: firstUtc,
          LastTimeUnitStartUtc: lastUtc,
        };

        const availData = await axiosWithRetry<any>({
          method: 'post',
          url: `${MEWS_BASE}/api/connector/v1/services/getAvailability`,
          data: availPayload,
          timeout: 20000,
        });

        const cats: any[] = availData?.CategoryAvailabilities || [];
        if (!cats.length) {
          console.warn('mews_availability_no_categories', { serviceId: svc.id, name: svc.name });
          continue;
        }

        const rcPayload: any = {
          ClientToken: MEWS_CLIENT_TOKEN,
          AccessToken: MEWS_ACCESS_TOKEN,
          Client: MEWS_CLIENT_NAME,
          ServiceIds: [svc.id],
          ActivityStates: ['Active'],
          Limitation: { Count: 1000 },
        };
        if (MEWS_ENTERPRISE_ID) rcPayload.EnterpriseIds = [MEWS_ENTERPRISE_ID];

        const rcData = await axiosWithRetry<any>({
          method: 'post',
          url: `${MEWS_BASE}/api/connector/v1/resourceCategories/getAll`,
          data: rcPayload,
          timeout: 20000,
        });

        const categoryLookup: Record<
          string,
          { name: string; capacity: number | null; description: string | null; image: string | null; images: string[] | null; raw: any }
        > = {};

        for (const rc of rcData?.ResourceCategories || []) {
          if (!rc?.Id) continue;
          const rcId = String(rc.Id);

          const localizedName =
            pickLocalizedText(rc.Names, requestedLang, [LOCALE]) ||
            rc.Name ||
            rc.ExternalIdentifier ||
            'Rom';

          const cap = typeof rc.Capacity === 'number' ? (rc.Capacity as number) : null;

          const description =
            pickLocalizedText(rc.Descriptions, requestedLang, [LOCALE]) ||
            rc.Description ||
            null;

          const mappedImages = getImagesForResourceCategory(rcId);
          const primaryMappedImage = mappedImages[0] ?? null;

          const fallbackImageFromMews =
            Array.isArray(rc.ImageIds) && rc.ImageIds.length
              ? `https://cdn.mews-demo.com/Media/Image/${rc.ImageIds[0]}?Mode=Fit&Height=400&Width=600`
              : (rc.Image as string | null) || null;

          const image = primaryMappedImage || fallbackImageFromMews;

          const images: string[] | null =
            mappedImages.length > 0
              ? mappedImages
              : Array.isArray(rc.ImageIds)
              ? rc.ImageIds.map((id: string) => `https://cdn.mews-demo.com/Media/Image/${id}?Mode=Fit&Height=400&Width=600`)
              : null;

          categoryLookup[rcId] = { name: localizedName, capacity: cap, description, image, images, raw: rc };
        }

        for (const ca of cats) {
          const catId = String(ca.CategoryId || '');
          if (!catId) continue;

          const info =
            categoryLookup[catId] || { name: 'Ukjent kategori', capacity: null, description: null, image: null, images: null, raw: null };

          const availableUnits = computeAvailableUnits(ca);

          let priceNightly: (number | null)[] = [];
          let priceTotal: number | null = null;
          let priceCurrency: string | null = pricingCurrency;

          if (catPrices.length > 0) {
            const pr = pricesFromCategoryPricing(catPrices, catId, pricingCurrency);
            priceNightly = pr.nightly;
            priceTotal = pr.total;
            priceCurrency = pr.currency || pricingCurrency;
          }

          if (priceTotal == null) {
            const est = computePricesFromAvailabilities(ca);
            if (est.total != null || est.nightly.length) {
              priceNightly = est.nightly;
              priceTotal = est.total;
              priceCurrency = est.currency || priceCurrency;
            }
          }

          // Ekstra fallback: reservations/price hvis vi fortsatt mangler total
          if (priceTotal == null && svc.adultAgeCategoryId) {
            try {
              const chosenRateId =
                pickRateIdForServiceAndNights(svc.id, nights) ||
                (svc.rateId && svc.rateId.trim().length ? svc.rateId : null);

              const rp = await priceReservationOnce({
                startYmd: from,
                endYmd: to,
                categoryId: catId,
                rateId: chosenRateId || undefined,
                adults,
                serviceId: svc.id,
                adultAgeCategoryId: svc.adultAgeCategoryId,
              });

              if (rp.total != null) {
                priceTotal = rp.total;
                priceCurrency = rp.currency || priceCurrency;
              }
            } catch (err: any) {
              console.warn('mews_availability_price_reservation_fallback', {
                serviceId: svc.id,
                categoryId: catId,
                message: err?.message,
              });
            }
          }

          allRooms.push({
            serviceId: svc.id,
            serviceName: svc.name,
            categoryId: catId,
            categoryName: info.name,
            description: info.description,
            image: info.image,
            images: info.images,
            capacity: info.capacity,
            availableUnits,
            priceTotal,
            priceCurrency: (priceCurrency || DEF_CURRENCY).toUpperCase(),
            priceNightly,
          });
        }
      } catch (e: any) {
        console.error('mews_availability_service_failed', {
          serviceId: svc.id,
          name: svc.name,
          message: e?.message,
          status: e?.response?.status || null,
          data: e?.response?.data || null,
        });
        continue;
      }
    }

    const filteredRooms = allRooms.filter((r) => typeof r.availableUnits === 'number' && r.availableUnits > 0);

    return res.json({
      ok: true,
      data: filteredRooms,
      meta: {
        from,
        to,
        nights,
        adults,
        serviceId: serviceIdParam || null,
        searchedServices: servicesToQuery,
        lang: requestedLang,
      },
    });
  } catch (err: any) {
    console.error('mews_availability_general_error', err?.response?.data || err?.message || err);
    return res.status(500).json({ ok: false, error: 'server_error', detail: err?.message || String(err) });
  }
});

// ===== SEARCH / AVAILABILITY (MEWS) =====
app.get(['/api/search', '/search', '/api/availability', '/availability'], async (req, res) => {
  try {
    const fromRaw = String(req.query.from || '');
    const toRaw = String(req.query.to || '');
    const from = fromRaw.slice(0, 10);
    const to = toRaw.slice(0, 10);
    const adults = Number(req.query.adults || 1);
    const areaSlugRaw = req.query.area ? String(req.query.area) : '';

    const langParamRaw = req.query.lang ? String(req.query.lang) : '';
    const requestedLang = (langParamRaw || LOCALE).trim();

    const { services: servicesToQuery, areaKey } = resolveServicesForArea(areaSlugRaw);

    const cacheKey = cacheSearchKey(from, to, adults) + `:area:${areaKey || 'ALL'}:lang:${requestedLang}`;
    const cached = getSearchCache(cacheKey);
    if (cached) return res.json({ ok: true, data: cached });

    if (!from || !to) {
      const resp = {
        availability: { ResourceCategoryAvailabilities: [] },
        params: { from, to, adults, area: areaKey, lang: requestedLang, warn: 'missing_params' },
      };
      setSearchCache(cacheKey, resp, 10);
      return res.json({ ok: true, data: resp });
    }

    if (!MEWS_BASE || !MEWS_CLIENT_TOKEN || !MEWS_ACCESS_TOKEN) {
      const resp = {
        availability: { ResourceCategoryAvailabilities: [] },
        params: { from, to, adults, area: areaKey, lang: requestedLang, warn: 'mews_credentials_missing' },
      };
      setSearchCache(cacheKey, resp, 30);
      return res.json({ ok: true, data: resp });
    }

    const nights = daysBetween(from, to);

    let catPrices: any[] = [];
    let pricingCurrency: string | null = DEF_CURRENCY;
    try {
      const pricing = await fetchConnectorPrices(from, to);
      catPrices = Array.isArray(pricing?.CategoryPrices) ? pricing.CategoryPrices : [];
      pricingCurrency = pricing?.Currency || DEF_CURRENCY;
    } catch (e: any) {
      console.warn('search: rates/getPricing failed, fortsetter uten forhåndspriser', e?.message || e);
    }

    const allRooms: any[] = [];

    for (const svc of servicesToQuery) {
      if (!svc.id) continue;

      try {
        const { firstUtc, lastUtc } = buildTimeUnitRange(from, to);

        const availPayload = {
          ClientToken: MEWS_CLIENT_TOKEN,
          AccessToken: MEWS_ACCESS_TOKEN,
          Client: MEWS_CLIENT_NAME,
          ServiceId: svc.id,
          FirstTimeUnitStartUtc: firstUtc,
          LastTimeUnitStartUtc: lastUtc,
        };

        const availData = await axiosWithRetry<any>({
          method: 'post',
          url: `${MEWS_BASE}/api/connector/v1/services/getAvailability`,
          data: availPayload,
          timeout: 20000,
        });

        const cats: any[] = availData?.CategoryAvailabilities || [];
        if (!cats.length) {
          console.warn('search: no categories for service', { serviceId: svc.id, name: svc.name });
          continue;
        }

        const rcPayload: any = {
          ClientToken: MEWS_CLIENT_TOKEN,
          AccessToken: MEWS_ACCESS_TOKEN,
          Client: MEWS_CLIENT_NAME,
          ServiceIds: [svc.id],
          ActivityStates: ['Active'],
          Limitation: { Count: 1000 },
        };
        if (MEWS_ENTERPRISE_ID) rcPayload.EnterpriseIds = [MEWS_ENTERPRISE_ID];

        const rcData = await axiosWithRetry<any>({
          method: 'post',
          url: `${MEWS_BASE}/api/connector/v1/resourceCategories/getAll`,
          data: rcPayload,
          timeout: 20000,
        });

        const categoryLookup: Record<
          string,
          { name: string; capacity: number | null; description: string | null; image: string | null; images: string[] | null; raw: any }
        > = {};

        for (const rc of rcData?.ResourceCategories || []) {
          if (!rc?.Id) continue;
          const rcId = String(rc.Id);

          const localizedName =
            pickLocalizedText(rc.Names, requestedLang, [LOCALE]) ||
            rc.Name ||
            rc.ExternalIdentifier ||
            'Rom';

          const cap = typeof rc.Capacity === 'number' ? (rc.Capacity as number) : null;

          const description =
            pickLocalizedText(rc.Descriptions, requestedLang, [LOCALE]) ||
            rc.Description ||
            null;

          const mappedImages = getImagesForResourceCategory(rcId);
          const primaryMappedImage = mappedImages[0] ?? null;

          const fallbackImageFromMews =
            Array.isArray(rc.ImageIds) && rc.ImageIds.length
              ? `https://cdn.mews-demo.com/Media/Image/${rc.ImageIds[0]}?Mode=Fit&Height=400&Width=600`
              : (rc.Image as string | null) || null;

          const image = primaryMappedImage || fallbackImageFromMews;

          const images: string[] | null =
            mappedImages.length > 0
              ? mappedImages
              : Array.isArray(rc.ImageIds)
              ? rc.ImageIds.map((id: string) => `https://cdn.mews-demo.com/Media/Image/${id}?Mode=Fit&Height=400&Width=600`)
              : null;

          categoryLookup[rcId] = { name: localizedName, capacity: cap, description, image, images, raw: rc };
        }

        for (const ca of cats) {
          const catId = String(ca.CategoryId || '');
          if (!catId) continue;

          const info =
            categoryLookup[catId] || { name: 'Ukjent kategori', capacity: null, description: null, image: null, images: null, raw: null };

          const availableUnits = computeAvailableUnits(ca);

          let priceNightly: (number | null)[] = [];
          let priceTotal: number | null = null;
          let priceCurrency: string | null = pricingCurrency;

          if (catPrices.length > 0) {
            const pr = pricesFromCategoryPricing(catPrices, catId, pricingCurrency);
            priceNightly = pr.nightly;
            priceTotal = pr.total;
            priceCurrency = pr.currency || pricingCurrency;
          }

          if (priceTotal == null) {
            const est = computePricesFromAvailabilities(ca);
            if (est.total != null || est.nightly.length) {
              priceNightly = est.nightly;
              priceTotal = est.total;
              priceCurrency = est.currency || priceCurrency;
            }
          }

          if (priceTotal == null && svc.adultAgeCategoryId) {
            try {
              const chosenRateId =
                pickRateIdForServiceAndNights(svc.id, nights) ||
                (svc.rateId && svc.rateId.trim().length ? svc.rateId : null);

              const rp = await priceReservationOnce({
                startYmd: from,
                endYmd: to,
                categoryId: catId,
                rateId: chosenRateId || undefined,
                adults,
                serviceId: svc.id,
                adultAgeCategoryId: svc.adultAgeCategoryId,
              });
              if (rp.total != null) {
                priceTotal = rp.total;
                priceCurrency = rp.currency || priceCurrency;
              }
            } catch (err: any) {
              console.warn('search_price_reservation_fallback', {
                serviceId: svc.id,
                categoryId: catId,
                message: err?.message,
              });
            }
          }

          allRooms.push({
            ResourceCategoryId: catId,
            RoomCategoryId: catId,
            Name: info.name,
            Description: info.description,
            Capacity: info.capacity,
            Image: info.image,
            Images: info.images,
            AvailableUnits: availableUnits,
            TotalAvailableUnitsCount: availableUnits,
            AvailableRoomCount: availableUnits,
            PriceNightly: priceNightly,
            PriceTotal: priceTotal,
            PriceCurrency: (priceCurrency || DEF_CURRENCY).toUpperCase(),
            ServiceId: svc.id,
            ServiceName: svc.name,
          });
        }
      } catch (e: any) {
        console.error('search_service_failed', {
          serviceId: svc.id,
          name: svc.name,
          message: e?.message,
          status: e?.response?.status || null,
          data: e?.response?.data || null,
        });
        continue;
      }
    }

    const rcList = allRooms.filter((r) => typeof r.AvailableUnits === 'number' && r.AvailableUnits > 0);

    const outResp = {
      availability: { ResourceCategoryAvailabilities: rcList },
      params: {
        from,
        to,
        nights,
        adults,
        area: areaKey,
        lang: requestedLang,
        src: 'mews_services_getAvailability+resourceCategories_getAll+reservations_price',
      },
    };

    setSearchCache(cacheKey, outResp, 30);
    return res.json({ ok: true, data: outResp });
  } catch (e: any) {
    console.error('search_general_error', e?.response?.data || e?.message || e);

    const fromRaw = String(req.query.from || '');
    const toRaw = String(req.query.to || '');
    const from = fromRaw.slice(0, 10);
    const to = toRaw.slice(0, 10);
    const adults = Number(req.query.adults || 1);
    const areaSlugRaw = req.query.area ? String(req.query.area) : '';

    const langParamRaw = req.query.lang ? String(req.query.lang) : '';
    const requestedLang = (langParamRaw || LOCALE).trim();

    const { areaKey } = resolveServicesForArea(areaSlugRaw);

    const resp = {
      availability: { ResourceCategoryAvailabilities: [] },
      params: { from, to, adults, area: areaKey, lang: requestedLang, warn: 'mews_search_failed' },
    };
    const cacheKeyErr = cacheSearchKey(from, to, adults) + `:area:${areaKey || 'ALL'}:lang:${requestedLang}`;
    setSearchCache(cacheKeyErr, resp, 10);
    return res.json({ ok: true, data: resp });
  }
});

// ===== SITEMINDER SEARCH =====
app.get('/api/siteminder/search', async (req, res) => {
  const from = String(req.query.from || '');
  const to = String(req.query.to || '');
  const adults = Number(req.query.adults || 1);

  try {
    const result = await fetchSiteMinderAvailability({ fromYmd: from, toYmd: to, adults });

    return res.json({
      ok: true,
      data: {
        availability: { ResourceCategoryAvailabilities: result.ResourceCategoryAvailabilities || [] },
        params: { from, to, adults, src: 'siteminder' },
        raw: result.raw ?? null,
      },
    });
  } catch (e: any) {
    console.error('siteminder_search_error', e?.response?.data || e?.message || e);
    return res.json({ ok: false, error: 'siteminder_search_failed', detail: e?.message || String(e) });
  }
});

// ===== PRODUCTS =====
app.get(['/api/products', '/products'], async (_req, res) => {
  try {
    if (!MEWS_BASE || !MEWS_CLIENT_TOKEN || !MEWS_ACCESS_TOKEN) {
      return res.json({
        ok: true,
        data: [
          {
            Id: 'demo-breakfast',
            Name: 'Breakfast tip',
            Description: 'Serveres hver morgen',
            Image: 'https://images.unsplash.com/photo-1516685018646-549198525c1b?q=80&w=1200&auto=format&fit=crop',
            Currency: DEF_CURRENCY,
            PriceGross: null,
          },
          {
            Id: 'demo-taxi',
            Name: 'Taxi',
            Description: 'Fastpris fra flyplass',
            Image: 'https://images.unsplash.com/photo-1502877338535-766e1452684d?q=80&w=1200&auto=format&fit=crop',
            Currency: DEF_CURRENCY,
            PriceGross: 50,
          },
        ],
      });
    }
    const list = await mews.fetchProducts(MEWS_SERVICE_ID || '');
    const products = (list || []).map((p: any) => ({
      Id: p?.Id,
      Name: firstLang(p?.Name, LOCALE) || p?.Name || p?.ExternalIdentifier || 'Product',
      Description: firstLang(p?.Description, LOCALE) || '',
      Image:
        Array.isArray(p?.ImageIds) && p.ImageIds.length
          ? `https://cdn.mews-demo.com/Media/Image/${p.ImageIds[0]}?Mode=Fit&Height=400&Width=600`
          : null,
      Currency: DEF_CURRENCY,
      PriceGross: p?.Price?.Value ?? p?.PriceGross ?? null,
    }));
    res.json({ ok: true, data: products });
  } catch (e: any) {
    console.error('products_error', e?.response?.data || e?.message || e);
    res.json({ ok: true, data: [] });
  }
});

// ===== PREVIEW =====
app.post(['/api/booking/preview', '/booking/preview'], async (req, res) => {
  try {
    const { startYmd, endYmd, roomCategoryId, rateId, adults, currency, products, selectedUnits, area } = req.body || {};
    const areaConfig = getMewsConfigForArea(area as string | undefined);

    const nights = daysBetween(startYmd, endYmd);
    const effectiveServiceId = (areaConfig.serviceId || MEWS_SERVICE_ID || '').trim();

    // Velg “riktig” rateId: (1) eksplisitt fra klient, ellers (2) mapping for Trysil, ellers (3) areaConfig.rateId, ellers undefined
    const chosenRateId =
      (rateId && String(rateId).trim().length ? String(rateId).trim() : null) ||
      pickRateIdForServiceAndNights(effectiveServiceId, nights) ||
      (areaConfig.rateId && String(areaConfig.rateId).trim().length ? String(areaConfig.rateId).trim() : null) ||
      null;

    let roomPriceTotal: number | null = null;
    let roomCurrency: string | null = (currency || DEF_CURRENCY).toUpperCase();

    try {
      if (roomCategoryId) {
        const rp = await priceReservationOnce({
          startYmd,
          endYmd,
          categoryId: roomCategoryId,
          rateId: chosenRateId || undefined,
          adults: Number(adults || 1),
          serviceId: effectiveServiceId,
          adultAgeCategoryId: areaConfig.adultAgeCategoryId || MEWS_ADULT_AGE_CATEGORY_ID,
        });
        roomPriceTotal = rp.total;
        roomCurrency = rp.currency || roomCurrency;
      }
    } catch (err) {
      console.warn('preview: reservations/price failed, falling back', (err as any)?.message || err);
    }

    if (roomPriceTotal == null) {
      try {
        const px = await fetchConnectorPrices(startYmd, endYmd);
        const pr = pricesFromCategoryPricing(px?.CategoryPrices || [], roomCategoryId, px?.Currency || roomCurrency);
        roomPriceTotal = pr.total;
        roomCurrency = pr.currency || roomCurrency;
      } catch (err) {
        console.warn('preview: rates/getPricing failed, falling back', (err as any)?.message || err);
      }
    }

    if (roomPriceTotal == null && effectiveServiceId && roomCategoryId) {
      try {
        const avail = await mews.fetchAvailabilityNamed(effectiveServiceId, startYmd, endYmd);
        const found = (avail?.ResourceCategoryAvailabilities || []).find(
          (rc: any) =>
            rc?.ResourceCategoryId === roomCategoryId ||
            rc?.RoomCategoryId === roomCategoryId ||
            rc?.Id === roomCategoryId
        );
        if (found) {
          const prices = computePricesFromAvailabilities(found);
          roomPriceTotal = prices.total;
          roomCurrency = prices.currency || roomCurrency;
        }
      } catch (err) {
        console.warn('preview: availability fallback failed', (err as any)?.message || err);
      }
    }

    const units = Math.max(1, Number(selectedUnits || 1));
    const totalRoomPrice = Number(roomPriceTotal ?? 0) * units;

    const productsTotal = Array.isArray(products)
      ? products.reduce((acc: number, p: any) => acc + Number(p.quantity || p.count || 0) * Number(p.price || 0), 0)
      : 0;

    const grandTotal = totalRoomPrice + productsTotal;

    res.json({
      ok: true,
      data: {
        room: {
          roomCategoryId,
          rateId: chosenRateId,
          nights,
          priceNightly: [],
          priceTotal: totalRoomPrice,
          currency: (roomCurrency || DEF_CURRENCY).toUpperCase(),
          selectedUnits: units,
        },
        products: Array.isArray(products) ? products : [],
        productsTotal,
        grandTotal,
        area: areaConfig.slug,
      },
    });
  } catch (e: any) {
    res.json({ ok: false, error: 'preview_failed', detail: e?.message || String(e) });
  }
});

// --- START PATCH: Prioriter serviceId for distributor config ---
const MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSIL_TURISTSENTER = (
  process.env.MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSIL_TURISTSENTER || ''
).trim();
const MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSIL_HOYFJELLSSENTER = (
  process.env.MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSIL_HOYFJELLSSENTER || ''
).trim();
const MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSILFJELL_HYTTEOMRADE = (
  process.env.MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSILFJELL_HYTTEOMRADE || ''
).trim();
const MEWS_DISTRIBUTION_CONFIGURATION_ID_TANDADALEN_SALEN = (
  process.env.MEWS_DISTRIBUTION_CONFIGURATION_ID_TANDADALEN_SALEN || ''
).trim();
const MEWS_DISTRIBUTION_CONFIGURATION_ID_HOGFJALLET_SALEN = (
  process.env.MEWS_DISTRIBUTION_CONFIGURATION_ID_HOGFJALLET_SALEN || ''
).trim();
const MEWS_DISTRIBUTION_CONFIGURATION_ID_LINDVALLEN_SALEN = (
  process.env.MEWS_DISTRIBUTION_CONFIGURATION_ID_LINDVALLEN_SALEN || ''
).trim();
const MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSIL_SENTRUM = (
  process.env.MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSIL_SENTRUM || ''
).trim();

const SERVICE_TO_DISTRIBUTION_CONFIG: Record<string, string> = {};

if (MEWS_SERVICE_ID_TRYSIL_TURISTSENTER && MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSIL_TURISTSENTER) {
  SERVICE_TO_DISTRIBUTION_CONFIG[MEWS_SERVICE_ID_TRYSIL_TURISTSENTER] = MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSIL_TURISTSENTER;
}
if (MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER && MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSIL_HOYFJELLSSENTER) {
  SERVICE_TO_DISTRIBUTION_CONFIG[MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER] = MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSIL_HOYFJELLSSENTER;
}
if (MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE && MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSILFJELL_HYTTEOMRADE) {
  SERVICE_TO_DISTRIBUTION_CONFIG[MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE] = MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSILFJELL_HYTTEOMRADE;
}
if (MEWS_SERVICE_ID_TANDADALEN_SALEN && MEWS_DISTRIBUTION_CONFIGURATION_ID_TANDADALEN_SALEN) {
  SERVICE_TO_DISTRIBUTION_CONFIG[MEWS_SERVICE_ID_TANDADALEN_SALEN] = MEWS_DISTRIBUTION_CONFIGURATION_ID_TANDADALEN_SALEN;
}
if (MEWS_SERVICE_ID_HOGFJALLET_SALEN && MEWS_DISTRIBUTION_CONFIGURATION_ID_HOGFJALLET_SALEN) {
  SERVICE_TO_DISTRIBUTION_CONFIG[MEWS_SERVICE_ID_HOGFJALLET_SALEN] = MEWS_DISTRIBUTION_CONFIGURATION_ID_HOGFJALLET_SALEN;
}
if (MEWS_SERVICE_ID_LINDVALLEN_SALEN && MEWS_DISTRIBUTION_CONFIGURATION_ID_LINDVALLEN_SALEN) {
  SERVICE_TO_DISTRIBUTION_CONFIG[MEWS_SERVICE_ID_LINDVALLEN_SALEN] = MEWS_DISTRIBUTION_CONFIGURATION_ID_LINDVALLEN_SALEN;
}
if (MEWS_SERVICE_ID_TRYSIL_SENTRUM && MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSIL_SENTRUM) {
  SERVICE_TO_DISTRIBUTION_CONFIG[MEWS_SERVICE_ID_TRYSIL_SENTRUM] = MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSIL_SENTRUM;
}

function pickDistributionConfigId(opts: { serviceId?: string | null; areaConfig?: any }): string | null {
  const sId = (opts.serviceId || '').trim();
  if (sId) {
    const mapped = SERVICE_TO_DISTRIBUTION_CONFIG[sId];
    if (mapped && mapped.length) return mapped;
  }
  if (opts.areaConfig && opts.areaConfig.distributionConfigurationId) {
    return opts.areaConfig.distributionConfigurationId;
  }
  return MEWS_CONFIGURATION_ID || null;
}
// --- END PATCH ---

// ===== CREATE =====
app.post(['/api/booking/create', '/booking/create'], async (req, res) => {
  const { startYmd, endYmd, roomCategoryId, rateId, adults, currency, products, selectedUnits, area, lang } = req.body || {};
  const areaConfig = getMewsConfigForArea(area as string | undefined);

  const nights = daysBetween(startYmd, endYmd);
  const effectiveServiceId = ((req.body?.serviceId as string) || areaConfig.serviceId || MEWS_SERVICE_ID || '').trim();

  const chosenRateId =
    (rateId && String(rateId).trim().length ? String(rateId).trim() : null) ||
    pickRateIdForServiceAndNights(effectiveServiceId, nights) ||
    (areaConfig.rateId && String(areaConfig.rateId).trim().length ? String(areaConfig.rateId).trim() : null) ||
    null;

  let reservationId: string | null = null;

  if (ENABLE_SERVER_RESERVATION) {
    try {
      let customerId: string | undefined;
      try {
        customerId = await mews.findOrCreateCustomer({
          firstName: 'Guest',
          lastName: 'BNO',
          email: `guest+${Date.now()}@example.invalid`,
        });
      } catch (e) {
        console.warn('findOrCreateCustomer failed (continuing without)', (e as any)?.message || e);
      }

      const Rooms = [
        {
          RoomCategoryId: roomCategoryId,
          RateId: chosenRateId || undefined,
          StartUtc: mews.toTimeUnitUtc(startYmd),
          EndUtc: mews.toTimeUnitUtc(endYmd),
          Occupancy: [
            {
              AgeCategoryId: areaConfig.adultAgeCategoryId || MEWS_ADULT_AGE_CATEGORY_ID || undefined,
              PersonCount: Number(adults || 1),
            },
          ],
          Quantity: Number(selectedUnits || 1),
        },
      ];

      try {
        const createResp = await mews.createReservation({
          ClientReference: `bno-${Date.now()}`,
          ServiceId: effectiveServiceId || undefined,
          Rooms,
          CustomerId: customerId && customerId.length > 10 ? customerId : undefined,
          SendConfirmationEmail: false,
        });
        reservationId =
          createResp?.Reservations?.[0]?.Id ||
          createResp?.ReservationId ||
          createResp?.Reservation?.Id ||
          null;
      } catch (e: any) {
        console.error('createReservation failed (continuing):', e?.mewsResponse || e?.response?.data || e?.message || e);
        reservationId = null;
      }

      if (reservationId && Array.isArray(products) && products.length > 0) {
        const orders = products
          .map((p: any) => ({
            ProductId: p.productId || p.ProductId || p.Id,
            Quantity: Number(p.quantity || p.count || 0),
            Price: p.price != null ? Number(p.price) : undefined,
            Currency: currency || DEF_CURRENCY,
          }))
          .filter((o: any) => o.ProductId && o.Quantity > 0);

        if (orders.length > 0) {
          try {
            await mews.createProductServiceOrders(effectiveServiceId || '', reservationId, orders);
          } catch (err: any) {
            console.error('createProductServiceOrders failed', err?.mewsResponse || err?.response?.data || err?.message || err);
          }
        }
      }
    } catch (e) {
      console.warn('server-side create skipped due to error', (e as any)?.message || e);
    }
  }

  function normalizeLocale(input?: string) {
    if (!input || typeof input !== 'string' || input.trim() === '') return LOCALE;
    const s = input.trim();
    if (s.includes('-')) return s;
    const map: Record<string, string> = {
      nb: 'nb-NO',
      no: 'nb-NO',
      sv: 'sv-SE',
      se: 'sv-SE',
      fr: 'fr-FR',
      en: 'en-GB',
      gb: 'en-GB',
      da: 'da-DK',
      de: 'de-DE',
    };
    const low = s.toLowerCase();
    return map[low] || `${low}-${low.toUpperCase()}`;
  }

  function buildDistributorUrl(opts: {
    fromYmd: string;
    toYmd: string;
    adults: number;
    roomCategoryId?: string;
    rateId?: string | null;
    currency?: string;
    locale?: string;
    configId?: string;
  }) {
    const cur = opts.currency || DEF_CURRENCY;
    const localeRaw = opts.locale || LOCALE;
    const localeNormalized = normalizeLocale(localeRaw);
    const route = 'rates';

    const qp: string[] = [
      `mewsStart=${encodeURIComponent(opts.fromYmd)}`,
      `mewsEnd=${encodeURIComponent(opts.toYmd)}`,
      `mewsRoute=${route}`,
      `mewsAdultCount=${encodeURIComponent(String(opts.adults || 1))}`,
      `mewsChildCount=0`,
      `currency=${encodeURIComponent(cur)}`,
      `locale=${encodeURIComponent(localeNormalized)}`,
      `language=${encodeURIComponent(localeNormalized)}`,
    ];

    if (opts.roomCategoryId) qp.push(`mewsRoom=${encodeURIComponent(opts.roomCategoryId)}`);
    if (opts.rateId) qp.push(`mewsRateId=${encodeURIComponent(opts.rateId)}`);

    const base = `${MEWS_DISTRIBUTOR_BASE.replace(/\/$/, '')}/${opts.configId || MEWS_CONFIGURATION_ID}`;
    return `${base}?${qp.join('&')}#${route}`;
  }

  const languageForMewsRaw = typeof lang === 'string' && lang.length > 0 ? lang : LOCALE;

  const chosenConfigId = pickDistributionConfigId({ serviceId: effectiveServiceId, areaConfig });

  console.log('Chosen distribution config', { effectiveServiceId, chosenConfigId });

  let nextUrl: string = buildDistributorUrl({
    fromYmd: startYmd,
    toYmd: endYmd,
    adults: Number(adults || 1),
    roomCategoryId,
    rateId: chosenRateId,
    currency,
    locale: normalizeLocale(languageForMewsRaw),
    configId: chosenConfigId || MEWS_CONFIGURATION_ID,
  });

  if (reservationId) {
    const resIdEncoded = encodeURIComponent(reservationId);
    nextUrl += (nextUrl.includes('?') ? '&' : '?') + `mewsReservation=${resIdEncoded}&reservationId=${resIdEncoded}`;
  }

  console.log('MEWS distributor redirect', {
    startYmd,
    endYmd,
    adults,
    area: areaConfig.slug,
    roomCategoryId,
    chosenRateId,
    reservationId,
    nextUrl,
  });

  res.json({
    ok: true,
    data: {
      mode: reservationId ? 'distributor_with_reservation' : 'distributor',
      bookingUrlRates: nextUrl,
      bookingUrlSummary: nextUrl,
      nextUrl,
      reservationId,
      echo: {
        roomCategoryId,
        rateId: chosenRateId,
        adults,
        currency: (currency || DEF_CURRENCY).toUpperCase(),
        products: Array.isArray(products) ? products : [],
        selectedUnits: Number(selectedUnits || 1),
        area: areaConfig.slug,
      },
    },
  });
});

// ===== MEWS WEBHOOK =====
app.post('/webhooks/mews', mewsWebhookHandler);

// ===== 404 =====
app.use((req, res) => {
  console.warn(`404 ${req.method} ${req.url}`);
  res.status(404).json({ ok: false, error: 'not_found' });
});

// start
app.listen(PORT, HOST, () => {
  const hostShown = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`✅ Server running at http://${hostShown}:${PORT}`);
  console.log(`MEWS_DISTRIBUTOR_BASE=${MEWS_DISTRIBUTOR_BASE} MEWS_DISTRIBUTION_CONFIGURATION_ID=${MEWS_CONFIGURATION_ID}`);
  console.log(`ENABLE_SERVER_RESERVATION=${ENABLE_SERVER_RESERVATION ? '1' : '0'}`);

  const routes = listRegisteredRoutes();
  console.log(
    `[BOOT] ${BOOT_TAG} route count=${routes.length} has /mews/reservations=${routes.some((r) => r.path === '/mews/reservations')}`
  );
});

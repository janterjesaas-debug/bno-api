/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * server.ts (BNO API)
 *
 * Fokus i denne versjonen:
 * - Fiks Mews-resultater som ble tomme etter Stranda-endringer.
 *   * computeAvailableUnits er tilbake til "før-Stranda"-logikk:
 *     - Bruk topp-feltene først (AvailableRoomCount / TotalAvailableUnitsCount)
 *     - Hvis Availabilities inneholder 0/undefined for enkelte netter, ignorer 0 hvis vi samtidig har >0.
 *       (Mews kan sende 0 i enkelte time units uten at hele perioden er "0 tilgjengelig".)
 * - /api/search tåler at én eller flere serviceId-er feiler (invalid/ikke-tilgang), uten å knekke hele søket.
 * - Legger tilbake debug-endpoints:
 *     GET /api/debug/mews/validate-services
 *     GET /api/debug/mews/availability-raw
 * - TypeScript-typefeil rundt credsKey er ryddet (MewsCredKey union).
 *
 * Viktig:
 * - Ikke commit .env (inneholder hemmeligheter). Bruk Render Environment Variables i prod.
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

function resolveProjectRoot(): string {
  return process.cwd();
}

function pickEnvFile(): { file: string; fullPath: string } {
  const root = resolveProjectRoot();

  const preferred = (process.env.DOTENV_FILE || '').trim(); // f.eks ".env.prod"
  const candidate = preferred || '.env';

  const full = path.resolve(root, candidate);
  if (fs.existsSync(full)) return { file: candidate, fullPath: full };

  // fallback (kan være "missing" på Render, det er OK – Render bruker ENV-vars)
  const fallback = path.resolve(root, '.env');
  return { file: '.env', fullPath: fallback };
}

const envPick = pickEnvFile();
const dotenvResult = dotenv.config({ path: envPick.fullPath, override: false });

console.log('[BOOT] dotenv', {
  envFile: envPick.file,
  envPath: envPick.fullPath,
  loaded: !dotenvResult.error,
  error: dotenvResult.error ? String(dotenvResult.error) : null,
  cwd: process.cwd(),
  node: process.version,
  portEnv: process.env.PORT,
  hasMEWS_BASE_URL: !!process.env.MEWS_BASE_URL,
  hasMEWS_CLIENT_TOKEN: !!(process.env.MEWS_CLIENT_TOKEN || '').trim(),
  hasMEWS_ACCESS_TOKEN: !!(process.env.MEWS_ACCESS_TOKEN || '').trim(),
});

// ======================
// Imports etter dotenv
// ======================
import express from 'express';
import cors from 'cors';
import axios, { AxiosRequestConfig } from 'axios';
import bodyParser from 'body-parser';
import http from 'http';
import https from 'https';
import Stripe from 'stripe';

import mews from './lib/mews';
import { fetchPrices as fetchConnectorPrices } from './lib/prices';
import { mewsWebhookHandler } from './mews-webhook';
import { fetchSiteMinderAvailability } from './lib/siteminder';
import registerHousekeepingRoutes from './lib/housekeepingRoutes';
import registerStripeRoutes from './lib/stripeRoutes';
import flightsRouter from './routes/flights';
import flightAirportsRouter from './routes/flightAirports';
import flightCheckoutRouter from './routes/flightCheckout';
import flightBookingsRouter from './routes/flightBookings';

import { getImagesForResourceCategory } from './lib/imageMap';
import { pickLocalizedText } from './lib/mewsLocalization';
import { getSupabaseDescriptionForResourceCategory } from './lib/supabaseContent';

// =============================================================
// BOOT DIAGNOSTIKK
// =============================================================
const BOOT_TAG = 'BNO-API-BOOT-2026-02-24T00:00Z';
console.log(`[BOOT] ${BOOT_TAG} server.ts loaded`, {
  cwd: process.cwd(),
  node: process.version,
  portEnv: process.env.PORT,
});

// =============================================================
// Axios keep-alive (bedrer “første kall” og generell stabilitet)
// =============================================================
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
axios.defaults.httpAgent = httpAgent;
axios.defaults.httpsAgent = httpsAgent;

// =============================================================
// MEWS multi-credentials (DEFAULT + STRANDA)
// =============================================================
export type MewsCredKey = 'DEFAULT' | 'STRANDA';

const CREDS_DEFAULT: MewsCredKey = 'DEFAULT';
const CREDS_STRANDA: MewsCredKey = 'STRANDA';

function parseCredKey(v: any): MewsCredKey {
  const s = String(v || '').trim().toUpperCase();
  if (s === 'STRANDA') return CREDS_STRANDA;
  return CREDS_DEFAULT;
}

type MewsCreds = {
  baseUrl: string;
  clientToken: string;
  accessToken: string;
  clientName: string;
  enterpriseId?: string;
};

function maskToken(t: string) {
  const s = (t || '').trim();
  if (!s) return '';
  if (s.length <= 10) return `${s.slice(0, 2)}...${s.slice(-2)}`;
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

function mustEnv(name: string): string {
  const v = (process.env[name] || '').trim();
  if (!v) throw new Error(`missing_env_${name}`);
  return v;
}

function ymd(v: any): string {
  return String(v || '').slice(0, 10);
}

function safeNum(v: any): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function isYmdAfter(a: string, b: string): boolean {
  return String(a || '').slice(0, 10) > String(b || '').slice(0, 10);
}

const BOOKING_OPEN_UNTIL_BY_AREA: Record<string, string> = {
  TRYSIL_TURISTSENTER: '2027-05-01',
  TRYSIL_HOYFJELLSSENTER: '2027-05-01',
  TRYSILFJELL_HYTTEOMRADE: '2027-05-01',
  TRYSIL_SENTRUM: '2027-05-01',
  TANDADALEN_SALEN: '2027-05-01',
  HOGFJALLET_SALEN: '2027-05-01',
  LINDVALLEN_SALEN: '2027-05-01',
  STRANDA: '2027-05-01',
};

function getBookingOpenUntil(areaKey: string | null): string | null {
  const k = normAreaKey(areaKey);
  if (!k) return null;
  return BOOKING_OPEN_UNTIL_BY_AREA[k] || null;
}
// ===== ENV =====
const PORT = Number(process.env.PORT || 4010);
const HOST = String(process.env.HOST || '0.0.0.0');
const HOTEL_TZ = String(process.env.HOTEL_TIMEZONE || 'Europe/Oslo');

const LOCALE = (process.env.MEWS_LOCALE || 'nb-NO').trim();
const DEF_CURRENCY = (process.env.MEWS_CURRENCY || 'NOK').trim();

// DEFAULT creds
const MEWS_BASE_DEFAULT = (process.env.MEWS_BASE_URL || '').trim().replace(/\/$/, '');
const MEWS_CLIENT_TOKEN_DEFAULT = (process.env.MEWS_CLIENT_TOKEN || '').trim();
const MEWS_ACCESS_TOKEN_DEFAULT = (process.env.MEWS_ACCESS_TOKEN || '').trim();
const MEWS_CLIENT_NAME_DEFAULT = (process.env.MEWS_CLIENT_NAME || 'bno-api').trim();
const MEWS_ENTERPRISE_ID_DEFAULT = (process.env.MEWS_ENTERPRISE_ID || '').trim();

// STRANDA creds (støtter begge ENV-navnekonvensjoner)
const MEWS_BASE_STRANDA = (
  process.env.MEWS_BASE_URL_STRANDA ||
  process.env.MEWS_STRANDA_BASE_URL ||
  MEWS_BASE_DEFAULT ||
  ''
)
  .trim()
  .replace(/\/$/, '');

const MEWS_CLIENT_TOKEN_STRANDA = (
  process.env.MEWS_CLIENT_TOKEN_STRANDA ||
  process.env.MEWS_STRANDA_CLIENT_TOKEN ||
  MEWS_CLIENT_TOKEN_DEFAULT ||
  ''
).trim();

const MEWS_ACCESS_TOKEN_STRANDA = (
  process.env.MEWS_ACCESS_TOKEN_STRANDA ||
  process.env.MEWS_STRANDA_ACCESS_TOKEN ||
  ''
).trim();

const MEWS_ENTERPRISE_ID_STRANDA = (
  process.env.MEWS_ENTERPRISE_ID_STRANDA ||
  process.env.MEWS_STRANDA_ENTERPRISE_ID ||
  process.env.MEWS_STRANDA_ENTERPRISE ||
  ''
).trim();

const MEWS_SERVICE_ID_STRANDA = (
  process.env.MEWS_SERVICE_ID_STRANDA ||
  process.env.MEWS_STRANDA_SERVICE_ID ||
  ''
).trim();

const MEWS_ADULT_AGE_CATEGORY_ID_STRANDA = (
  process.env.MEWS_ADULT_AGE_CATEGORY_ID_STRANDA ||
  process.env.MEWS_STRANDA_ADULT_AGE_CATEGORY_ID ||
  ''
).trim();

const MEWS_DISTRIBUTOR_BASE = (process.env.MEWS_DISTRIBUTOR_BASE || 'https://app.mews.com/distributor')
  .trim()
  .replace(/\/$/, '');

const MEWS_SERVICE_ID = (process.env.MEWS_SERVICE_ID || '').trim(); // global fallback

// Global fallback distribution config id (brukes hvis område-spesifikk mangler)
const MEWS_CONFIGURATION_ID = (
  process.env.MEWS_DISTRIBUTION_CONFIGURATION_ID ||
  process.env.MEWS_CONFIGURATION_ID ||
  ''
).trim();
// ======================
// Booking Engine / Distributor config
// NB: Dette er IKKE det samme som MEWS_CONFIGURATION_ID (connector).
// ======================

// Connector config (ikke bruk i distributor-linker)
const MEWS_CONNECTOR_CONFIGURATION_ID = (process.env.MEWS_CONFIGURATION_ID || '').trim();

// Global fallback for booking engine (brukes kun hvis area/serviceId ikke kan avgjøres).
// 👉 Sett denne i Render hvis dere vil støtte booking-link uten `area`/`serviceId`.
const MEWS_DISTRIBUTION_CONFIGURATION_ID_DEFAULT = (
  process.env.MEWS_DISTRIBUTION_CONFIGURATION_ID ||
  process.env.MEWS_BOOKING_ENGINE_CONFIGURATION_ID ||
  process.env.MEWS_BOOKING_ENGINE_CONFIG_ID ||
  ''
).trim();

// NB: beholdt for bakoverkomp (men brukes ikke som global fallback i pricing/create)
const MEWS_RATE_ID = (process.env.MEWS_RATE_ID || '').trim();

const ENABLE_SERVER_RESERVATION = String(process.env.ENABLE_SERVER_RESERVATION || '0') === '1';

// cap på fallback-prising for å unngå eksplosjon
const PRICE_FALLBACK_MAX_PER_SERVICE = Number(process.env.PRICE_FALLBACK_MAX_PER_SERVICE || 20);

function getCreds(key: MewsCredKey): MewsCreds {
  if (key === CREDS_STRANDA) {
    return {
      baseUrl: MEWS_BASE_STRANDA,
      clientToken: MEWS_CLIENT_TOKEN_STRANDA,
      accessToken: MEWS_ACCESS_TOKEN_STRANDA,
      clientName: MEWS_CLIENT_NAME_DEFAULT,
      enterpriseId: MEWS_ENTERPRISE_ID_STRANDA || undefined,
    };
  }
  return {
    baseUrl: MEWS_BASE_DEFAULT,
    clientToken: MEWS_CLIENT_TOKEN_DEFAULT,
    accessToken: MEWS_ACCESS_TOKEN_DEFAULT,
    clientName: MEWS_CLIENT_NAME_DEFAULT,
    enterpriseId: MEWS_ENTERPRISE_ID_DEFAULT || undefined,
  };
}

function hasCreds(c: MewsCreds) {
  return !!(c.baseUrl && c.clientToken && c.accessToken);
}

// DEBUG: vis hvilken MEWS-konfig Node faktisk bruker
console.log('DEBUG MEWS CREDS:');
console.log('  DEFAULT base        =', MEWS_BASE_DEFAULT);
console.log('  DEFAULT clientToken =', maskToken(MEWS_CLIENT_TOKEN_DEFAULT));
console.log('  DEFAULT accessToken =', maskToken(MEWS_ACCESS_TOKEN_DEFAULT));
console.log('  DEFAULT enterprise  =', MEWS_ENTERPRISE_ID_DEFAULT);

console.log('  STRANDA base        =', MEWS_BASE_STRANDA);
console.log('  STRANDA clientToken =', maskToken(MEWS_CLIENT_TOKEN_STRANDA));
console.log('  STRANDA accessToken =', maskToken(MEWS_ACCESS_TOKEN_STRANDA));
console.log('  STRANDA enterprise  =', MEWS_ENTERPRISE_ID_STRANDA);

// =============================================================
// SERVICE CONFIG
// =============================================================
type ServiceConfig = {
  id: string;
  name: string;
  rateId?: string | null;
  adultAgeCategoryId?: string | null;
  credsKey?: MewsCredKey;
};

/** område-spesifikke serviceId-er */
const MEWS_SERVICE_ID_TRYSIL_TURISTSENTER = (process.env.MEWS_SERVICE_ID_TRYSIL_TURISTSENTER || '').trim();
const MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER = (process.env.MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER || '').trim();
const MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE = (process.env.MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE || '').trim();
const MEWS_SERVICE_ID_TANDADALEN_SALEN = (process.env.MEWS_SERVICE_ID_TANDADALEN_SALEN || '').trim();
const MEWS_SERVICE_ID_HOGFJALLET_SALEN = (process.env.MEWS_SERVICE_ID_HOGFJALLET_SALEN || '').trim();
const MEWS_SERVICE_ID_LINDVALLEN_SALEN = (process.env.MEWS_SERVICE_ID_LINDVALLEN_SALEN || '').trim();
const MEWS_SERVICE_ID_TRYSIL_SENTRUM = (process.env.MEWS_SERVICE_ID_TRYSIL_SENTRUM || '').trim();

/** ageCategory */
const MEWS_ADULT_AGE_CATEGORY_ID = (process.env.MEWS_ADULT_AGE_CATEGORY_ID || '').trim();
const MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_TURISTSENTER = (process.env.MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_TURISTSENTER || '').trim();
const MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_HOYFJELLSSENTER = (process.env.MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_HOYFJELLSSENTER || '').trim();
const MEWS_ADULT_AGE_CATEGORY_ID_TRYSILFJELL_HYTTEOMRADE = (process.env.MEWS_ADULT_AGE_CATEGORY_ID_TRYSILFJELL_HYTTEOMRADE || '').trim();
const MEWS_ADULT_AGE_CATEGORY_ID_TANDADALEN_SALEN = (process.env.MEWS_ADULT_AGE_CATEGORY_ID_TANDADALEN_SALEN || '').trim();
const MEWS_ADULT_AGE_CATEGORY_ID_HOGFJALLET_SALEN = (process.env.MEWS_ADULT_AGE_CATEGORY_ID_HOGFJALLET_SALEN || '').trim();
const MEWS_ADULT_AGE_CATEGORY_ID_LINDVALLEN_SALEN = (process.env.MEWS_ADULT_AGE_CATEGORY_ID_LINDVALLEN_SALEN || '').trim();
const MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_SENTRUM = (process.env.MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_SENTRUM || '').trim();

/** rateId */
const MEWS_RATE_ID_TRYSIL_TURISTSENTER = (process.env.MEWS_RATE_ID_TRYSIL_TURISTSENTER || '').trim();
const MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER = (process.env.MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER || '').trim();
const MEWS_RATE_ID_TRYSILFJELL_HYTTEOMRADE = (process.env.MEWS_RATE_ID_TRYSILFJELL_HYTTEOMRADE || '').trim();
const MEWS_RATE_ID_TANDADALEN_SALEN = (process.env.MEWS_RATE_ID_TANDADALEN_SALEN || '').trim();
const MEWS_RATE_ID_HOGFJALLET_SALEN = (process.env.MEWS_RATE_ID_HOGFJALLET_SALEN || '').trim();
const MEWS_RATE_ID_LINDVALLEN_SALEN = (process.env.MEWS_RATE_ID_LINDVALLEN_SALEN || '').trim();
const MEWS_RATE_ID_TRYSIL_SENTRUM = (process.env.MEWS_RATE_ID_TRYSIL_SENTRUM || '').trim();
const MEWS_RATE_ID_STRANDA = (process.env.MEWS_RATE_ID_STRANDA || '').trim();
const MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER_2 = (process.env.MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER_2 || '').trim();
const MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER_3 = (process.env.MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER_3 || '').trim();
const MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER_4 = (process.env.MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER_4 || '').trim();
const MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER_5 = (process.env.MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER_5 || '').trim();
const MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER_7 = (process.env.MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER_7 || '').trim();

const MEWS_RATE_ID_TRYSIL_SENTRUM_2 = (process.env.MEWS_RATE_ID_TRYSIL_SENTRUM_2 || '').trim();
const MEWS_RATE_ID_TRYSIL_SENTRUM_3 = (process.env.MEWS_RATE_ID_TRYSIL_SENTRUM_3 || '').trim();
const MEWS_RATE_ID_TRYSIL_SENTRUM_4 = (process.env.MEWS_RATE_ID_TRYSIL_SENTRUM_4 || '').trim();
const MEWS_RATE_ID_TRYSIL_SENTRUM_5 = (process.env.MEWS_RATE_ID_TRYSIL_SENTRUM_5 || '').trim();
const MEWS_RATE_ID_TRYSIL_SENTRUM_7 = (process.env.MEWS_RATE_ID_TRYSIL_SENTRUM_7 || '').trim();

function parseCommaList(v: string | undefined | null): string[] {
  return String(v || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

const MEWS_SERVICE_IDS_LIST = parseCommaList(process.env.MEWS_SERVICE_IDS);

// lookup: id -> “område-name” hvis vi kjenner den
function guessServiceNameById(id: string): string {
  const map: Record<string, string> = {};
  if (MEWS_SERVICE_ID_TRYSIL_TURISTSENTER) map[MEWS_SERVICE_ID_TRYSIL_TURISTSENTER] = 'Trysil Turistsenter';
  if (MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER) map[MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER] = 'Trysil Høyfjellssenter';
  if (MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE) map[MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE] = 'Trysilfjell Hytteområde';
  if (MEWS_SERVICE_ID_TRYSIL_SENTRUM) map[MEWS_SERVICE_ID_TRYSIL_SENTRUM] = 'Trysil Sentrum';
  if (MEWS_SERVICE_ID_TANDADALEN_SALEN) map[MEWS_SERVICE_ID_TANDADALEN_SALEN] = 'Tandådalen Sälen';
  if (MEWS_SERVICE_ID_HOGFJALLET_SALEN) map[MEWS_SERVICE_ID_HOGFJALLET_SALEN] = 'Högfjället Sälen';
  if (MEWS_SERVICE_ID_LINDVALLEN_SALEN) map[MEWS_SERVICE_ID_LINDVALLEN_SALEN] = 'Lindvallen Sälen';
  if (MEWS_SERVICE_ID_STRANDA) map[MEWS_SERVICE_ID_STRANDA] = 'Stranda';

  return map[id] || `Service ${id.slice(0, 8)}…`;
}

function pickAdultAgeCategoryByServiceId(id: string): string | null {
  if (id === MEWS_SERVICE_ID_TRYSIL_TURISTSENTER) return MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_TURISTSENTER || MEWS_ADULT_AGE_CATEGORY_ID || null;
  if (id === MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER) return MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_HOYFJELLSSENTER || MEWS_ADULT_AGE_CATEGORY_ID || null;
  if (id === MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE) return MEWS_ADULT_AGE_CATEGORY_ID_TRYSILFJELL_HYTTEOMRADE || MEWS_ADULT_AGE_CATEGORY_ID || null;
  if (id === MEWS_SERVICE_ID_TRYSIL_SENTRUM) return MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_SENTRUM || MEWS_ADULT_AGE_CATEGORY_ID || null;
  if (id === MEWS_SERVICE_ID_TANDADALEN_SALEN) return MEWS_ADULT_AGE_CATEGORY_ID_TANDADALEN_SALEN || MEWS_ADULT_AGE_CATEGORY_ID || null;
  if (id === MEWS_SERVICE_ID_HOGFJALLET_SALEN) return MEWS_ADULT_AGE_CATEGORY_ID_HOGFJALLET_SALEN || MEWS_ADULT_AGE_CATEGORY_ID || null;
  if (id === MEWS_SERVICE_ID_LINDVALLEN_SALEN) return MEWS_ADULT_AGE_CATEGORY_ID_LINDVALLEN_SALEN || MEWS_ADULT_AGE_CATEGORY_ID || null;
  if (id === MEWS_SERVICE_ID_STRANDA) return MEWS_ADULT_AGE_CATEGORY_ID_STRANDA || null;
  return MEWS_ADULT_AGE_CATEGORY_ID || null;
}

function pickRateIdByServiceId(id: string, nights?: number): string | null {
  const n = Number(nights || 0);

  if (id === MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER) {
    switch (n) {
      case 2: return MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER_2 || null;
      case 3: return MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER_3 || null;
      case 4: return MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER_4 || null;
      case 5: return MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER_5 || null;
      case 7: return MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER_7 || null;
      default: return null;
    }
  }

  if (id === MEWS_SERVICE_ID_TRYSIL_SENTRUM) {
    switch (n) {
      case 2: return MEWS_RATE_ID_TRYSIL_SENTRUM_2 || null;
      case 3: return MEWS_RATE_ID_TRYSIL_SENTRUM_3 || null;
      case 4: return MEWS_RATE_ID_TRYSIL_SENTRUM_4 || null;
      case 5: return MEWS_RATE_ID_TRYSIL_SENTRUM_5 || null;
      case 7: return MEWS_RATE_ID_TRYSIL_SENTRUM_7 || null;
      default: return null;
    }
  }

  if (id === MEWS_SERVICE_ID_TRYSIL_TURISTSENTER) return MEWS_RATE_ID_TRYSIL_TURISTSENTER || null;
  if (id === MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE) return MEWS_RATE_ID_TRYSILFJELL_HYTTEOMRADE || null;
  if (id === MEWS_SERVICE_ID_TANDADALEN_SALEN) return MEWS_RATE_ID_TANDADALEN_SALEN || null;
  if (id === MEWS_SERVICE_ID_HOGFJALLET_SALEN) return MEWS_RATE_ID_HOGFJALLET_SALEN || null;
  if (id === MEWS_SERVICE_ID_LINDVALLEN_SALEN) return MEWS_RATE_ID_LINDVALLEN_SALEN || null;
  if (id === MEWS_SERVICE_ID_STRANDA) return MEWS_RATE_ID_STRANDA || null;

  return null;
}

/**
 * Bygg “alle services” robust:
 * - Starter med “område-keys” (hvis de finnes)
 * - Legger på MEWS_SERVICE_IDS-listen (hvis den finnes)
 * - Deduper på id
 */
function buildServicesAll(): ServiceConfig[] {
  const base: ServiceConfig[] = [
    {
      id: MEWS_SERVICE_ID_TRYSIL_TURISTSENTER,
      name: 'Trysil Turistsenter',
      rateId: MEWS_RATE_ID_TRYSIL_TURISTSENTER || null,
      adultAgeCategoryId: MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_TURISTSENTER || MEWS_ADULT_AGE_CATEGORY_ID || null,
      credsKey: CREDS_DEFAULT,
    },
    {
      id: MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER,
      name: 'Trysil Høyfjellssenter',
      rateId: MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER || null,
      adultAgeCategoryId: MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_HOYFJELLSSENTER || MEWS_ADULT_AGE_CATEGORY_ID || null,
      credsKey: CREDS_DEFAULT,
    },
    {
      id: MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE,
      name: 'Trysilfjell Hytteområde',
      rateId: MEWS_RATE_ID_TRYSILFJELL_HYTTEOMRADE || null,
      adultAgeCategoryId: MEWS_ADULT_AGE_CATEGORY_ID_TRYSILFJELL_HYTTEOMRADE || MEWS_ADULT_AGE_CATEGORY_ID || null,
      credsKey: CREDS_DEFAULT,
    },
    {
      id: MEWS_SERVICE_ID_TRYSIL_SENTRUM,
      name: 'Trysil Sentrum',
      rateId: MEWS_RATE_ID_TRYSIL_SENTRUM || null,
      adultAgeCategoryId: MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_SENTRUM || MEWS_ADULT_AGE_CATEGORY_ID || null,
      credsKey: CREDS_DEFAULT,
    },
    {
      id: MEWS_SERVICE_ID_TANDADALEN_SALEN,
      name: 'Tandådalen Sälen',
      rateId: MEWS_RATE_ID_TANDADALEN_SALEN || null,
      adultAgeCategoryId: MEWS_ADULT_AGE_CATEGORY_ID_TANDADALEN_SALEN || MEWS_ADULT_AGE_CATEGORY_ID || null,
      credsKey: CREDS_DEFAULT,
    },
    {
      id: MEWS_SERVICE_ID_HOGFJALLET_SALEN,
      name: 'Högfjället Sälen',
      rateId: MEWS_RATE_ID_HOGFJALLET_SALEN || null,
      adultAgeCategoryId: MEWS_ADULT_AGE_CATEGORY_ID_HOGFJALLET_SALEN || MEWS_ADULT_AGE_CATEGORY_ID || null,
      credsKey: CREDS_DEFAULT,
    },
    {
      id: MEWS_SERVICE_ID_LINDVALLEN_SALEN,
      name: 'Lindvallen Sälen',
      rateId: MEWS_RATE_ID_LINDVALLEN_SALEN || null,
      adultAgeCategoryId: MEWS_ADULT_AGE_CATEGORY_ID_LINDVALLEN_SALEN || MEWS_ADULT_AGE_CATEGORY_ID || null,
      credsKey: CREDS_DEFAULT,
    },
    {
      id: MEWS_SERVICE_ID_STRANDA,
      name: 'Stranda',
      rateId: MEWS_RATE_ID_STRANDA || null,
      adultAgeCategoryId: MEWS_ADULT_AGE_CATEGORY_ID_STRANDA || null,
      credsKey: CREDS_STRANDA,
    },
  ].filter((s) => !!s.id);

  // Legg på MEWS_SERVICE_IDS (kan inneholde “ekstra” services for sync)
  const fromList: ServiceConfig[] = (MEWS_SERVICE_IDS_LIST || []).map((id) => {
    const isStranda = !!MEWS_SERVICE_ID_STRANDA && id === MEWS_SERVICE_ID_STRANDA;
    return {
      id,
      name: guessServiceNameById(id),
      rateId: pickRateIdByServiceId(id),
      adultAgeCategoryId: pickAdultAgeCategoryByServiceId(id),
      credsKey: isStranda ? CREDS_STRANDA : CREDS_DEFAULT,
    };
  });

  const merged = [...base, ...fromList];

  // Dedup by id
  const out: ServiceConfig[] = [];
  const seen = new Set<string>();
  for (const s of merged) {
    if (!s.id) continue;
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
}

const MEWS_SERVICES_ALL: ServiceConfig[] = buildServicesAll();
console.log('MEWS_SERVICES_ALL =', MEWS_SERVICES_ALL);

// =============================================================
// Booking / Distributor helpers (per område)
// =============================================================
function normAreaKey(areaKey: string | null): string | null {
  if (!areaKey) return null;
  return String(areaKey).trim().toUpperCase().replace(/[\s-]+/g, '_');
}

type DistributionConfigResolution = {
  configId: string;
  source: 'area' | 'global' | 'missing';
  envKey: string | null;
};

function resolveDistributionConfigForArea(areaKey: string | null): DistributionConfigResolution {
  const k = normAreaKey(areaKey);

  // 1) Per area
  if (k) {
    const envKey = `MEWS_DISTRIBUTION_CONFIGURATION_ID_${k}`;
    const v = (process.env[envKey] || '').trim();
    if (v) return { configId: v, source: 'area', envKey };
  }

  // 2) Global fallback (valgfri)
  if (MEWS_DISTRIBUTION_CONFIGURATION_ID_DEFAULT) {
    return { configId: MEWS_DISTRIBUTION_CONFIGURATION_ID_DEFAULT, source: 'global', envKey: 'MEWS_DISTRIBUTION_CONFIGURATION_ID' };
  }

  // 3) Missing
  return { configId: '', source: 'missing', envKey: null };
}

function getDistributionConfigIdForArea(areaKey: string | null): string {
  // VIKTIG: Ikke kall getDistributionConfigForArea her (det gir rekursjon).
  return resolveDistributionConfigForArea(areaKey).configId;
}

function getBookingUrlOverrideForArea(areaKey: string | null): string | null {
  const k = normAreaKey(areaKey);
  if (!k) return null;
  const envKey = `MEWS_BOOKING_URL_${k}`;
  const v = (process.env[envKey] || '').trim();
  return v || null;
}
function buildMewsDistributorUrl(opts: {
  base: string;
  configId: string;

  from?: string;
  to?: string;
  adults?: number;

  // Deeplink controls
  route?: string | null; // e.g. 'rates'
  roomId?: string | null; // ResourceCategoryId
  promo?: string | null; // e.g. 'bnotravel'

  language?: string | null;
  currency?: string | null;
}): string {
  const base = String(opts.base || '')
    .trim()
    .replace(/\/$/, '');
  const configId = String(opts.configId || '').trim();

  // Aldri bygg URL med tom configId (gir ofte “Invalid PrimaryId …” i Mews)
  if (!base || !configId) return '';

  const params = new URLSearchParams();

  const from = String(opts.from || '').slice(0, 10);
  const to = String(opts.to || '').slice(0, 10);
  const adults =
    typeof opts.adults === 'number' && Number.isFinite(opts.adults)
      ? String(Math.max(1, Math.floor(opts.adults)))
      : '2';

  // Mews deeplink params
  if (from) params.set('mewsStart', from);
  if (to) params.set('mewsEnd', to);
  params.set('mewsAdultCount', adults);

  const route = String(opts.route || '').trim();
  if (route) params.set('mewsRoute', route);

  const roomId = String(opts.roomId || '').trim();
  if (roomId) params.set('mewsRoom', roomId);

  const promo = String(opts.promo || '').trim();
  if (promo) params.set('mewsVoucherCode', promo);

  const language = String(opts.language || '').trim();
  if (language) params.set('language', language);

  const currency = String(opts.currency || '').trim();
  if (currency) params.set('currency', currency);

  // Legacy params (harmløse – men greit for bakoverkompat)
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  params.set('adults', adults);

  return `${base}/${configId}?${params.toString()}`;
}
function resolveServicesForArea(areaSlugRaw: string | undefined | null): { services: ServiceConfig[]; areaKey: string | null } {
  const slug = (areaSlugRaw || '').toLowerCase().trim();

  if (!slug) return { services: MEWS_SERVICES_ALL, areaKey: null };

  // -------------------------------------------------
  // HOVEDOMRÅDER / SAMLEOMRÅDER
  // -------------------------------------------------
  if (slug === 'trysil') {
    return {
      services: MEWS_SERVICES_ALL.filter(
        (s) =>
          s.id === MEWS_SERVICE_ID_TRYSIL_TURISTSENTER ||
          s.id === MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER ||
          s.id === MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE ||
          s.id === MEWS_SERVICE_ID_TRYSIL_SENTRUM
      ),
      areaKey: 'TRYSIL',
    };
  }

  if (slug === 'sunnmorsalpene' || slug === 'sunnmørsalpene') {
    return {
      services: MEWS_SERVICES_ALL.filter(
        (s) =>
          s.id === MEWS_SERVICE_ID_STRANDA
      ),
      areaKey: 'SUNNMORSALPENE',
    };
  }

  if (slug === 'salen' || slug === 'sälen') {
    return {
      services: MEWS_SERVICES_ALL.filter(
        (s) =>
          s.id === MEWS_SERVICE_ID_TANDADALEN_SALEN ||
          s.id === MEWS_SERVICE_ID_HOGFJALLET_SALEN ||
          s.id === MEWS_SERVICE_ID_LINDVALLEN_SALEN
      ),
      areaKey: 'SALEN',
    };
  }

  // -------------------------------------------------
  // ENKELTOMRÅDER
  // -------------------------------------------------
  if (slug === 'stranda') {
    return {
      services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_STRANDA),
      areaKey: 'STRANDA',
    };
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

  if (
    slug === 'trysil-hoyfjellssenter' ||
    slug === 'trysil-høyfjellssenter' ||
    slug === 'trysil_hoyfjellssenter'
  ) {
    return {
      services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER),
      areaKey: 'TRYSIL_HOYFJELLSSENTER',
    };
  }

  if (
    slug === 'trysilfjell-hytteomrade' ||
    slug === 'trysilfjell-hytteområde' ||
    slug === 'trysilfjell_hytteomrade'
  ) {
    return {
      services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE),
      areaKey: 'TRYSILFJELL_HYTTEOMRADE',
    };
  }

  if (slug === 'tandadalen-salen' || slug === 'tandådalen-sälen' || slug === 'tandadalen_salen' || slug === 'tandadalen') {
    return {
      services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_TANDADALEN_SALEN),
      areaKey: 'TANDADALEN_SALEN',
    };
  }

  if (slug === 'hogfjallet-salen' || slug === 'högfjället-sälen' || slug === 'hogfjallet_salen' || slug === 'hogfjallet') {
    return {
      services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_HOGFJALLET_SALEN),
      areaKey: 'HOGFJALLET_SALEN',
    };
  }

  if (slug === 'lindvallen-salen' || slug === 'lindvallen-sälen' || slug === 'lindvallen_salen' || slug === 'lindvallen') {
    return {
      services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_LINDVALLEN_SALEN),
      areaKey: 'LINDVALLEN_SALEN',
    };
  }

  const normalizedKey = slug.replace(/[\s-]+/g, '_').toUpperCase();
  return { services: MEWS_SERVICES_ALL, areaKey: normalizedKey };
}
function areaKeyFromServiceId(serviceIdRaw: string | null | undefined): string | null {
  const id = String(serviceIdRaw || '').trim();
  if (!id) return null;

  if (MEWS_SERVICE_ID_STRANDA && id === MEWS_SERVICE_ID_STRANDA) return 'STRANDA';

  if (MEWS_SERVICE_ID_TRYSIL_TURISTSENTER && id === MEWS_SERVICE_ID_TRYSIL_TURISTSENTER) return 'TRYSIL_TURISTSENTER';
  if (MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER && id === MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER) return 'TRYSIL_HOYFJELLSSENTER';
  if (MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE && id === MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE) return 'TRYSILFJELL_HYTTEOMRADE';
  if (MEWS_SERVICE_ID_TRYSIL_SENTRUM && id === MEWS_SERVICE_ID_TRYSIL_SENTRUM) return 'TRYSIL_SENTRUM';

  if (MEWS_SERVICE_ID_TANDADALEN_SALEN && id === MEWS_SERVICE_ID_TANDADALEN_SALEN) return 'TANDADALEN_SALEN';
  if (MEWS_SERVICE_ID_HOGFJALLET_SALEN && id === MEWS_SERVICE_ID_HOGFJALLET_SALEN) return 'HOGFJALLET_SALEN';
  if (MEWS_SERVICE_ID_LINDVALLEN_SALEN && id === MEWS_SERVICE_ID_LINDVALLEN_SALEN) return 'LINDVALLEN_SALEN';

  return null;
}
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

function setSearchCache(key: string, data: any, ttlSec = 45) {
  setCache(key, data, ttlSec);
}
function getSearchCache(key: string) {
  return getCache(key);
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

        console.warn(`axiosWithRetry: 429 received, attempt ${attempt}, waiting ${waitMs}ms (retry-after=${retryAfterRaw})`);
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
      });
      throw err;
    }
  }
}
// =============================================================
// Helper: Stranda?
// =============================================================
function isStrandaArea(areaKey: string | null): boolean {
  return normAreaKey(areaKey) === 'STRANDA';
}

// =============================================================
// Helper: plukk roomId fra body/query uansett key-navn
// =============================================================
function pickRoomIdFromAny(raw: any): string | null {
  const v =
    raw?.roomId ??
    raw?.RoomId ??
    raw?.resourceCategoryId ??
    raw?.ResourceCategoryId ??
    raw?.RoomCategoryId ??
    raw?.categoryId ??
    raw?.CategoryId ??
    '';
  const s = String(v || '').trim();
  return s ? s : null;
}

// =============================================================
// Helper: velg route for steg 3
// - hvis route er sendt inn: bruk den
// - hvis step=3 eller roomId finnes: bruk rates
// =============================================================
function pickRouteForStep3(routeRaw: any, stepRaw: any, roomId: string | null): string | null {
  const route = String(routeRaw || '').trim().toLowerCase();
  if (route) return route;

  const step = String(stepRaw || '').trim();
  if (step === '3') return 'rates';

  if (roomId) return 'rates';
  return null;
}

// =============================================================
// Wrapper så koden din kan bruke getDistributionConfigForArea()
// uten å måtte endre all gammel logikk.
// - bruker din eksisterende getDistributionConfigIdForArea()
// - gir også envKey + source for debug
// =============================================================
function getDistributionConfigForArea(areaKey: string | null): {
  configId: string;
  source: 'area' | 'fallback' | 'missing';
  envKey: string | null;
} {
  const k = normAreaKey(areaKey);
  const envKey = k ? `MEWS_DISTRIBUTION_CONFIGURATION_ID_${k}` : null;

  const rawFromEnv = envKey ? String(process.env[envKey] || '').trim() : '';
  const configId = getDistributionConfigIdForArea(areaKey); // <-- din eksisterende funksjon

  const source: 'area' | 'fallback' | 'missing' =
    rawFromEnv ? 'area' : configId ? 'fallback' : 'missing';

  return { configId, source, envKey };
}
// ===== Concurrency helper (kontrollert parallellisering) =====
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;

  const workers = Array.from({ length: Math.max(1, limit) }).map(async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      out[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return out;
}

// ===== HELPERS =====
function daysBetween(ymdFrom: string, ymdTo: string) {
  const a = new Date(`${ymdFrom}T00:00:00Z`);
  const b = new Date(`${ymdTo}T00:00:00Z`);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

function addDaysYmd(ymdIn: string, delta: number): string {
  const [y, m, d] = ymdIn.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function buildTimeUnitRange(fromYmd: string, toYmd: string): { firstUtc: string; lastUtc: string } {
  const firstUtc = mews.toTimeUnitUtc(fromYmd);
  // Mews getAvailability bruker "LastTimeUnitStartUtc" (start på siste natt)
  const lastDayYmd = addDaysYmd(toYmd, -1);
  const lastUtc = mews.toTimeUnitUtc(lastDayYmd);
  return { firstUtc, lastUtc };
}

function firstLang(obj: any, locale: string): string {
  if (obj == null) return '';

  // Mews sender ofte plain string. Da skal vi returnere hele strengen.
  if (typeof obj === 'string') return obj;

  // Fall back for tall/bool/etc
  if (typeof obj !== 'object') return String(obj);

  // Lokalisert map
  if ((obj as any)[locale] != null) return String((obj as any)[locale]);

  const keys = Object.keys(obj);
  if (!keys.length) return '';
  const v = (obj as any)[keys[0]];
  return v == null ? '' : String(v);
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
      const v = priceObj.TotalAmount[k]?.GrossValue ?? priceObj.TotalAmount[k]?.Value ?? priceObj.TotalAmount[k]?.Total ?? null;
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
      TotalAvailableUnitCount?: unknown;
      AvailableRoomCount?: unknown;
      AvailableRoomsCount?: unknown;
      AvailableUnitsCount?: unknown;
      AvailableUnitCount?: unknown;
      AvailableUnits?: unknown;
      AvailableCount?: unknown;
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

  // Kjente felter
  const knownCandidates = [
    (x as any).TotalAvailableUnitsCount,
    (x as any).TotalAvailableUnitCount,
    (x as any).AvailableRoomCount,
    (x as any).AvailableRoomsCount,
    (x as any).AvailableUnitsCount,
    (x as any).AvailableUnitCount,
    (x as any).AvailableUnits,
    (x as any).AvailableCount,
    (x as any).Count,
  ];

  for (const c of knownCandidates) {
    const n = toNumMaybe(c);
    if (n != null) return n;
  }

  // Robust fallback: finn tall i keys som ser ut som availability
  for (const [k, v] of Object.entries(x as any)) {
    const key = String(k || '').toLowerCase();
    if (!key.includes('avail')) continue;
    const n = toNumMaybe(v);
    if (n != null) return n;
  }

  return 0;
}

/**
 * ✅ FØR-STRANDA LOGIKK (viktig)
 * - Bruk topp-felter først
 * - For Availabilities: hvis vi har både 0 og >0, ignorer 0 (bruk min over positive)
 *
 * Grunn: Mews kan sende 0/undefined på enkelte time units selv om perioden ellers har kapasitet,
 * og nyere "MIN(inkl 0)" gjorde at ALT ble filtrert bort.
 */
function computeAvailableUnits(item: any): number {
  // 1) Topp-felter først
  const topCandidates = [
    item?.AvailableRoomCount,
    item?.AvailableRoomsCount,
    item?.AvailableUnitsCount,
    item?.AvailableUnitCount,
    item?.TotalAvailableUnitsCount,
    item?.TotalAvailableUnitCount,
  ];
  for (const c of topCandidates) {
    const n = toNumMaybe(c);
    if (n != null && n >= 0) return n;
  }

  // 2) Availabilities array
  if (Array.isArray(item?.Availabilities) && item.Availabilities.length > 0) {
    const vals = (item.Availabilities as AvItem[])
      .map(avToCount)
      .filter((v: number) => Number.isFinite(v));

    if (vals.length === 0) return 0;

    // ✅ FØR-STRANDA logikk:
    // Hvis vi har både 0 og >0, ignorer 0 og bruk min over positive.
    // (Mews kan sende 0 på enkelte time units uten at hele perioden faktisk er “0 tilgjengelig”.)
       // For et opphold må ALLE netter i perioden ha kapasitet.
    // Hvis én natt er 0, skal hele oppholdet regnes som ikke tilgjengelig.
    return Math.min(...vals);
  }

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

    const candidates = [
      aRaw.Price,
      aRaw.PricePerUnit,
      aRaw.PriceTotal,
      aRaw.TimeUnitPrice,
      aRaw.TimeUnitPrices,
      aRaw.PriceAmount,
      aRaw.PriceInfo,
    ];

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

    nightly.push(foundVal ?? null);
    if (!detectedCurrency && foundCur) detectedCurrency = foundCur;
  }

  const anyPrice = nightly.some((v) => v != null);
  const total = anyPrice ? sumNumbersSafe(nightly) : null;
  return { nightly, total, currency: detectedCurrency };
}
function decorateGuestAvailability<T extends Record<string, any>>(item: T, unitsRaw: any): T {
  const units = Number(unitsRaw || 0);
  const availableUnits = Number.isFinite(units) ? units : 0;
  const isSoldOut = availableUnits <= 0;

  return {
    ...item,
    AvailableUnits: availableUnits,
    TotalAvailableUnitsCount: availableUnits,
    AvailableRoomCount: availableUnits,
    availableUnits, // for /api/mews/availability
    isSoldOut,
    IsSoldOut: isSoldOut,
    availabilityLabel: isSoldOut ? 'Fullbooket' : null,
    AvailabilityLabel: isSoldOut ? 'Fullbooket' : null,
    availabilitySortOrder: isSoldOut ? 1 : 0,
    AvailabilitySortOrder: isSoldOut ? 1 : 0,
  };
}

function sortGuestAvailability<T extends Record<string, any>>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aUnits = Number(a?.AvailableUnits ?? a?.availableUnits ?? 0);
    const bUnits = Number(b?.AvailableUnits ?? b?.availableUnits ?? 0);

    const aSoldOut = aUnits > 0 ? 0 : 1;
    const bSoldOut = bUnits > 0 ? 0 : 1;
    if (aSoldOut !== bSoldOut) return aSoldOut - bSoldOut;

    const aPrice = safeNum(a?.PriceTotal ?? a?.priceTotal);
    const bPrice = safeNum(b?.PriceTotal ?? b?.priceTotal);

    const aNoPrice = aPrice == null ? 1 : 0;
    const bNoPrice = bPrice == null ? 1 : 0;
    if (aNoPrice !== bNoPrice) return aNoPrice - bNoPrice;

    if (aPrice != null && bPrice != null && aPrice !== bPrice) {
      return aPrice - bPrice;
    }

    const aName = String(a?.Name ?? a?.categoryName ?? '');
    const bName = String(b?.Name ?? b?.categoryName ?? '');
    return aName.localeCompare(bName, 'nb');
  });
}

async function getFreshCategoryAvailability(opts: {
  credsKey: MewsCredKey;
  serviceId: string;
  categoryId: string;
  from: string;
  to: string;
}): Promise<{ ok: boolean; availableUnits: number; raw?: any; reason?: string }> {
  const serviceId = String(opts.serviceId || '').trim();
  const categoryId = String(opts.categoryId || '').trim();
  const from = String(opts.from || '').slice(0, 10);
  const to = String(opts.to || '').slice(0, 10);

  if (!serviceId || !categoryId || !from || !to) {
    return { ok: false, availableUnits: 0, reason: 'missing_params' };
  }

  const creds = getCreds(opts.credsKey);
  if (!hasCreds(creds)) {
    return { ok: false, availableUnits: 0, reason: 'mews_credentials_missing' };
  }

  const { firstUtc, lastUtc } = buildTimeUnitRange(from, to);

  const availData = await axiosWithRetry<any>({
    method: 'post',
    url: `${creds.baseUrl}/api/connector/v1/services/getAvailability`,
    data: {
      ClientToken: creds.clientToken,
      AccessToken: creds.accessToken,
      Client: creds.clientName,
      ServiceId: serviceId,
      FirstTimeUnitStartUtc: firstUtc,
      LastTimeUnitStartUtc: lastUtc,
    },
    timeout: 20000,
  });

  const cats: any[] = availData?.CategoryAvailabilities || [];
  const match = cats.find((x) => String(x?.CategoryId || '') === categoryId);

  if (!match) {
    return { ok: true, availableUnits: 0, raw: null };
  }

  return {
    ok: true,
    availableUnits: computeAvailableUnits(match),
    raw: match,
  };
}
/**
 * Hent totalpris for EN reservasjon (1 enhet) via reservations/price.
 * NB: vi sender KUN RateId hvis vi faktisk har en.
 */
async function priceReservationOnce(opts: {
  credsKey: MewsCredKey;
  startYmd: string;
  endYmd: string;
  categoryId: string;
  rateId?: string | null;
  adults: number;
  serviceId: string;
  adultAgeCategoryId: string;
}): Promise<{ total: number | null; currency: string | null }> {
  const creds = getCreds(opts.credsKey);

  if (!hasCreds(creds)) return { total: null, currency: null };
  if (!opts.serviceId) return { total: null, currency: null };

  const url = `${creds.baseUrl}/api/connector/v1/reservations/price`;

  async function tryPrice(args: {
    rateId: string | null;
    adultAgeCategoryId: string | null;
  }): Promise<{ total: number | null; currency: string | null }> {
    if (!args.adultAgeCategoryId || !String(args.adultAgeCategoryId).trim()) {
      return { total: null, currency: null };
    }

    const reservation: any = {
      Identifier: 'preview-1',
      StartUtc: mews.toTimeUnitUtc(opts.startYmd),
      EndUtc: mews.toTimeUnitUtc(opts.endYmd),
      RequestedCategoryId: opts.categoryId,
      AdultCount: Math.max(1, Number(opts.adults || 1)),
      PersonCounts: [
        {
          AgeCategoryId: String(args.adultAgeCategoryId).trim(),
          Count: Math.max(1, Number(opts.adults || 1)),
        },
      ],
    };

    if (args.rateId && String(args.rateId).trim().length > 0) {
      reservation.RateId = String(args.rateId).trim();
    }

    const payload = {
      ClientToken: creds.clientToken,
      AccessToken: creds.accessToken,
      Client: creds.clientName,
      ServiceId: opts.serviceId,
      Reservations: [reservation],
    };

    try {
      const respData = await axiosWithRetry<any>(
        {
          method: 'post',
          url,
          data: payload,
          timeout: 15000,
        },
        2,
        500,
        true
      );

      const item = respData?.ReservationPrices?.[0] || respData?.ReservationPrice || null;
      if (!item) return { total: null, currency: null };

      const amountObj = item.TotalAmount || item.Total || item.TotalPrice || item.Price || null;
      const ex = extractPriceValueCurrency(amountObj);
      return { total: ex.value, currency: ex.currency || DEF_CURRENCY };
    } catch {
      return { total: null, currency: null };
    }
  }

  const preferredRateId =
    opts.rateId && String(opts.rateId).trim().length > 0
      ? String(opts.rateId).trim()
      : null;

  const preferredAdultAgeCategoryId =
    opts.adultAgeCategoryId && String(opts.adultAgeCategoryId).trim().length > 0
      ? String(opts.adultAgeCategoryId).trim()
      : null;

  const globalAdultAgeCategoryId =
    MEWS_ADULT_AGE_CATEGORY_ID && String(MEWS_ADULT_AGE_CATEGORY_ID).trim().length > 0
      ? String(MEWS_ADULT_AGE_CATEGORY_ID).trim()
      : null;

  const attempt1 = await tryPrice({
    rateId: preferredRateId,
    adultAgeCategoryId: preferredAdultAgeCategoryId,
  });
  if (attempt1.total != null) return attempt1;

  const attempt2 = await tryPrice({
    rateId: null,
    adultAgeCategoryId: preferredAdultAgeCategoryId,
  });
  if (attempt2.total != null) return attempt2;

  if (globalAdultAgeCategoryId && globalAdultAgeCategoryId !== preferredAdultAgeCategoryId) {
    const attempt3 = await tryPrice({
      rateId: preferredRateId,
      adultAgeCategoryId: globalAdultAgeCategoryId,
    });
    if (attempt3.total != null) return attempt3;

    const attempt4 = await tryPrice({
      rateId: null,
      adultAgeCategoryId: globalAdultAgeCategoryId,
    });
    if (attempt4.total != null) return attempt4;
  }

  return { total: null, currency: null };
}

// =======================
// Express app + middleware
// =======================
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

registerHousekeepingRoutes(app);
registerStripeRoutes(app);
app.use('/api/flights', flightsRouter);
app.use('/api/flights', flightAirportsRouter);
app.use(flightCheckoutRouter);
app.use(flightBookingsRouter);

// =============================================================
// ✅ APP-KOMPAT ROUTES
// =============================================================

/**
 * POST /api/booking/create
 * Forventet av app/(tabs)/overnatting/kort.tsx
 * Return: { ok:true, data:{ nextUrl } }
 */
app.post('/api/booking/create', (req, res) => {
  try {
    const startYmd = ymd(req.body?.startYmd);
    const endYmd = ymd(req.body?.endYmd);
    const adults = Math.max(1, Number(req.body?.adults || 1));

    const areaSlugRaw = req.body?.area ? String(req.body.area) : '';
    const serviceId = String(req.body?.serviceId || '').trim();
    const roomId = String(req.body?.roomId || req.body?.categoryId || '').trim(); // valgfritt
    const route = req.body?.route ? String(req.body.route) : undefined; // valgfritt

    if (!startYmd || !endYmd) {
      return res.status(400).json({ ok: false, error: 'missing_startYmd_endYmd' });
    }

    // 1) areaKey fra area-slug (hvis sendt)
    const resolvedFromArea = resolveServicesForArea(areaSlugRaw);
    let areaKey = resolvedFromArea.areaKey;

    // 2) hvis ikke area: prøv serviceId -> areaKey
    if (!areaKey && serviceId) {
      areaKey = areaKeyFromServiceId(serviceId);
    }

    const cfg = resolveDistributionConfigForArea(areaKey);
    const overrideUrl = getBookingUrlOverrideForArea(areaKey);

    const nextUrl =
      overrideUrl ||
      (cfg.configId
        ? buildMewsDistributorUrl({
            base: MEWS_DISTRIBUTOR_BASE,
            configId: cfg.configId,
            from: startYmd,
            to: endYmd,
            adults,
            route: route || undefined,
            roomId: roomId || undefined,
          })
        : '');

    if (!nextUrl) {
      return res.status(500).json({
        ok: false,
        error: 'booking_link_missing',
        detail: 'Mangler distributor configId (eller overrideUrl) for dette området. Send `area` eller `serviceId`, eller sett MEWS_DISTRIBUTION_CONFIGURATION_ID i Render.',
        debug: { areaKey, serviceId: serviceId || null, configSource: cfg.source, configEnvKey: cfg.envKey },
      });
    }

    const depositRequired = areaKey === 'STRANDA';

    return res.json({
      ok: true,
      data: {
        nextUrl,
        depositRequired, // UI: hvis true -> bruk Stripe først
        areaKey,
        serviceId: serviceId || null,
        configSource: cfg.source,
        configEnvKey: cfg.envKey,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: 'booking_create_failed', detail: e?.message || String(e) });
  }
});
/**
 * POST /api/stripe/fee/checkout
 * Forventet av kort.tsx Stranda-flow
 * Return: { ok:true, data:{ url } }
 */
app.post('/api/stripe/fee/checkout', async (req, res) => {
  try {
    const stripeKey = mustEnv('STRIPE_SECRET_KEY');
    const stripe = new Stripe(stripeKey, {
      // La være å hardkode nyere API-versjon hvis dere ikke trenger det,
      // men Stripe-typene krever ofte apiVersion i TS-prosjekter.
      apiVersion: (process.env.STRIPE_API_VERSION as any) || ('2023-10-16' as any),
    });

    const priceTotal = safeNum(req.body?.priceTotal);
    const currency = String(req.body?.currency || 'NOK').toLowerCase();

    const feePercent = safeNum(req.body?.feePercent);
    const feeFixedNok = safeNum(req.body?.feeFixedNok);
    const returnUrl = String(req.body?.returnUrl || '').trim();

    const metadataIn = (req.body?.metadata || {}) as Record<string, any>;
        const areaKey = normAreaKey(String(metadataIn.area || '')) || 'STRANDA';
    const bookingOpenUntil = getBookingOpenUntil(areaKey);
    const to = String(metadataIn.to || metadataIn.endYmd || '').slice(0, 10);

    if (bookingOpenUntil && to && isYmdAfter(to, bookingOpenUntil)) {
      return res.status(409).json({
        ok: false,
        error: 'booking_not_open',
        message:
          'Denne enheten ser ikke ut til å være åpen for booking i valgt periode akkurat nå. Du er velkommen til å sende oss en forespørsel.',
        inquiryEmail: 'booking@bno-travel.com',
        resolved: {
          areaKey,
          bookingOpenUntil,
        },
      });
    }
    if (priceTotal == null || priceTotal <= 0) return res.status(400).json({ ok: false, error: 'invalid_priceTotal' });
    if (feePercent == null || feePercent <= 0) return res.status(400).json({ ok: false, error: 'invalid_feePercent' });
    if (feeFixedNok == null || feeFixedNok < 0) return res.status(400).json({ ok: false, error: 'invalid_feeFixedNok' });
    if (!returnUrl) return res.status(400).json({ ok: false, error: 'missing_returnUrl' });

    const depositNok = Math.round(priceTotal * feePercent);
    const amountNok = depositNok + Math.round(feeFixedNok);

    // Stripe: minor units
    const unitAmount = Math.max(0, Math.round(amountNok * 100));

    // Returskjermen i appen leser:
    // - success: ?session_id=...
    // - cancel:  ?canceled=1
    const successUrl = `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${returnUrl}?canceled=1`;

    // Stripe metadata må være string-string
    const metadata: Record<string, string> = {};
    for (const [k, v] of Object.entries(metadataIn)) {
      metadata[String(k)] = v == null ? '' : String(v);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: {
              name: 'Stranda depositum + gebyr',
              description: `Depositum ${depositNok} NOK + gebyr ${feeFixedNok} NOK`,
            },
          },
        },
      ],
      metadata,
    });

    const url = session.url || '';
    if (!url) return res.status(500).json({ ok: false, error: 'stripe_session_missing_url' });

    return res.json({ ok: true, data: { url } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: 'stripe_fee_checkout_failed', detail: e?.message || String(e) });
  }
});

/**
 * GET /api/stripe/session?sessionId=cs_...
 * Forventet av stranda-fee-return.tsx
 * Return: { ok:true, data:{ session } }
 */
app.get('/api/stripe/session', async (req, res) => {
  try {
    const stripeKey = mustEnv('STRIPE_SECRET_KEY');
    const stripe = new Stripe(stripeKey, {
      apiVersion: (process.env.STRIPE_API_VERSION as any) || ('2023-10-16' as any),
    });

    const sessionId = String((req.query.sessionId || req.query.session_id || '')).trim();
    if (!sessionId) return res.status(400).json({ ok: false, error: 'missing_sessionId' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return res.json({ ok: true, data: { session } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: 'stripe_session_failed', detail: e?.message || String(e) });
  }
});

  /**
   * Fortsetter etter Stripe-betaling.
   * Returnerer JSON med nextUrl (Mews steg 3).
   *
   * Støtter både:
   *  - /api/stripe/fee/continue?sessionId=cs_...
   *  - /api/stripe/fee/continue?session_id=cs_...
   */
  app.get('/api/stripe/fee/continue', async (req, res) => {
    try {
      const stripeKey = mustEnv('STRIPE_SECRET_KEY');
      const stripe = new Stripe(stripeKey, {
        apiVersion: (process.env.STRIPE_API_VERSION as any) || '2023-10-16',
      });

      const sessionId = String((req.query.sessionId || req.query.session_id || '')).trim();
      if (!sessionId) return res.status(400).json({ ok: false, error: 'missing_sessionId' });

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // Bruk payment_status (denne er stabil og er det vi faktisk bryr oss om).
      const paid = session.payment_status === 'paid';
      if (!paid) {
        return res.status(400).json({
          ok: false,
          error: 'not_paid',
          detail: { status: session.status, payment_status: session.payment_status },
        });
      }

      const md = (session.metadata || {}) as Record<string, string>;

      const from = md.from || '';
      const to = md.to || '';
      const adults = Number(md.adults || '2') || 2;

      const serviceId = md.serviceId || '';
const roomId = md.roomId || '';

if (!serviceId) {
  return res.status(400).json({ ok: false, error: 'missing_serviceId_in_metadata' });
}
if (!roomId) {
  return res.status(400).json({ ok: false, error: 'missing_roomId_in_metadata' });
}
if (!from || !to) {
  return res.status(400).json({ ok: false, error: 'missing_dates_in_metadata' });
}

const fresh = await getFreshCategoryAvailability({
  credsKey: CREDS_STRANDA,
  serviceId,
  categoryId: roomId,
  from,
  to,
});

if (!fresh.ok) {
  return res.status(500).json({
    ok: false,
    error: 'fresh_availability_check_failed',
    detail: fresh.reason || 'unknown',
  });
}

if (fresh.availableUnits <= 0) {
  return res.status(409).json({
    ok: false,
    error: 'room_no_longer_available',
    detail: 'Enheten er dessverre ikke lenger tilgjengelig hos Stranda Booking.',
    data: {
      serviceId,
      roomId,
      from,
      to,
      availableUnits: fresh.availableUnits,
    },
  });
}

// STRANDA: alltid Stranda-config + voucher
const areaKey = 'STRANDA';
      const config = getDistributionConfigForArea(areaKey);

      if (!config.configId) {
        return res.status(500).json({
          ok: false,
          error: 'missing_distribution_config_stranda',
          detail: { areaKey, envKey: config.envKey, source: config.source },
        });
      }

      // Voucher-kode (env-styrt, fallback til bnotravel)
      const voucherCode =
        (process.env.MEWS_VOUCHER_CODE_STRANDA || 'bnotravel').trim() || 'bnotravel';

      const url = buildMewsDistributorUrl({
        base: MEWS_DISTRIBUTOR_BASE,
        configId: config.configId,
        from,
        to,
        adults,
        promo: voucherCode, // => mewsVoucherCode=bnotravel
        route: 'rates',
        roomId: roomId || undefined,
        language: 'nb-NO',
        currency: 'NOK',
      });

      return res.json({ ok: true, data: { nextUrl: url } });
    } catch (e: any) {
      return res.status(500).json({
        ok: false,
        error: 'stripe_fee_continue_failed',
        detail: String(e?.message || e),
      });
    }
  });

  /**
   * Praktisk redirect-endpoint du kan bruke direkte som Stripe success_url-base:
   * success_url = .../api/stripe/fee/return?session_id={CHECKOUT_SESSION_ID}
   *
   * Den verifiserer betaling og redirecter (302) rett til Mews steg 3.
   */
  app.get('/api/stripe/fee/return', async (req, res) => {
    try {
      const stripeKey = mustEnv('STRIPE_SECRET_KEY');
      const stripe = new Stripe(stripeKey, {
        apiVersion: (process.env.STRIPE_API_VERSION as any) || '2023-10-16',
      });

      const sessionId = String((req.query.session_id || req.query.sessionId || '')).trim();
      if (!sessionId) return res.status(400).send('Missing session_id');

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      const paid = session.payment_status === 'paid';
      if (!paid) return res.status(400).send('Not paid');

      const md = (session.metadata || {}) as Record<string, string>;
const from = md.from || '';
const to = md.to || '';
const adults = Number(md.adults || '2') || 2;
const serviceId = md.serviceId || '';
const roomId = md.roomId || '';

if (!serviceId) return res.status(400).send('Missing serviceId in metadata');
if (!roomId) return res.status(400).send('Missing roomId in metadata');
if (!from || !to) return res.status(400).send('Missing dates in metadata');

const fresh = await getFreshCategoryAvailability({
  credsKey: CREDS_STRANDA,
  serviceId,
  categoryId: roomId,
  from,
  to,
});

if (!fresh.ok) {
  return res.status(500).send('Fresh availability check failed');
}

if (fresh.availableUnits <= 0) {
  return res.status(409).send(
    'Enheten er dessverre ikke lenger tilgjengelig hos Stranda Booking. Ikke send gjesten videre til Mews. Håndter refusjon eller ny enhet i BNO Travel.'
  );
}

const areaKey = 'STRANDA';
const config = getDistributionConfigForArea(areaKey);

      if (!config.configId) return res.status(500).send('Missing Stranda distribution config');

      const voucherCode =
        (process.env.MEWS_VOUCHER_CODE_STRANDA || 'bnotravel').trim() || 'bnotravel';

      const url = buildMewsDistributorUrl({
        base: MEWS_DISTRIBUTOR_BASE,
        configId: config.configId,
        from,
        to,
        adults,
        promo: voucherCode,
        route: 'rates',
        roomId: roomId || undefined,
        language: 'nb-NO',
        currency: 'NOK',
      });

      return res.redirect(302, url);
    } catch (e: any) {
      return res.status(500).send(String(e?.message || e));
    }
  });

// =============================================================
// SUPABASE IMAGE PROXY
// =============================================================
const SUPABASE_IMAGES_URL = String(process.env.SUPABASE_IMAGES_URL || '').trim().replace(/\/$/, '');
const SUPABASE_IMAGES_BUCKET = String(process.env.SUPABASE_IMAGES_BUCKET || '').trim();

function normalizeImgKey(rawKey: string): { key: string; hadBucketPrefix: boolean } {
  let k = String(rawKey || '').trim();
  k = k.replace(/^\/+/, '');

  let decoded = k;
  try {
    decoded = decodeURIComponent(k);
  } catch {
    decoded = k;
  }

  decoded = decoded.replace(/^\/+/, '');

  let hadBucketPrefix = false;
  if (SUPABASE_IMAGES_BUCKET) {
    const bucketPrefix = `${SUPABASE_IMAGES_BUCKET.replace(/^\/+|\/+$/g, '')}/`;
    if (decoded.toLowerCase().startsWith(bucketPrefix.toLowerCase())) {
      decoded = decoded.slice(bucketPrefix.length);
      hadBucketPrefix = true;
    }
  }

  const encoded = decoded
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/');

  return { key: encoded, hadBucketPrefix };
}

function buildSupabasePublicObjectUrl(encodedKey: string): string {
  return `${SUPABASE_IMAGES_URL}/storage/v1/object/public/${encodeURIComponent(SUPABASE_IMAGES_BUCKET)}/${encodedKey}`;
}

async function handleImgProxy(req: express.Request, res: express.Response) {
  try {
    if (!SUPABASE_IMAGES_URL || !SUPABASE_IMAGES_BUCKET) {
      return res.status(500).json({
        ok: false,
        error: 'img_proxy_env_missing',
        detail: 'SUPABASE_IMAGES_URL eller SUPABASE_IMAGES_BUCKET mangler på server',
      });
    }

    const raw = (req.params as any)[0] || '';
    if (!raw) {
      return res.status(400).json({ ok: false, error: 'img_missing_key', detail: 'Mangler filsti etter /api/img/' });
    }

    const { key: encodedKey, hadBucketPrefix } = normalizeImgKey(raw);
    if (!encodedKey) {
      return res.status(400).json({ ok: false, error: 'img_invalid_key', detail: 'Ugyldig filsti' });
    }

    const upstreamUrl = buildSupabasePublicObjectUrl(encodedKey);

    const upstream = await axios.get(upstreamUrl, {
      responseType: 'arraybuffer',
      timeout: 20000,
      validateStatus: () => true,
      headers: { Accept: '*/*' },
    });

    if (upstream.status < 200 || upstream.status >= 300) {
      return res.status(400).json({
        ok: false,
        error: 'img_supabase_proxy_failed',
        detail: `Upstream status ${upstream.status}`,
        debug: {
          hadBucketPrefix,
          upstreamUrl,
          contentType: upstream.headers?.['content-type'] || null,
        },
      });
    }

    const contentType = upstream.headers?.['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');

    if (req.method === 'HEAD') return res.status(200).end();

    return res.status(200).send(Buffer.from(upstream.data));
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: 'img_proxy_error',
      detail: e?.message || String(e),
    });
  }
}

app.get(['/api/img/*', '/img/*'], handleImgProxy);
app.head(['/api/img/*', '/img/*'], handleImgProxy);

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
      for (const m of methods) routes.push({ method: m, path: String(layer.route.path) });
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
    // OBS: i Express blir route.path en array-string ved alias; dette er kun "best effort"
    hasMewsReservations: routes.some((r) => r.path.includes('/mews/reservations')),
    hasServerReservation: routes.some((r) => r.path.includes('/api/mews/reservation')),
    routes,
  });
});

// ===== PING / HEALTH =====
app.get('/api/ping', (_req, res) => res.json({ ok: true, where: 'api', at: Date.now(), tz: HOTEL_TZ }));
app.get('/ping', (_req, res) => res.json({ ok: true, where: 'root', at: Date.now(), tz: HOTEL_TZ }));
app.get('/api/health', (_req, res) =>
  res.json({
    ok: true,
    bootTag: BOOT_TAG,
    tz: HOTEL_TZ,
    creds: {
      DEFAULT: { ok: hasCreds(getCreds(CREDS_DEFAULT)) },
      STRANDA: { ok: hasCreds(getCreds(CREDS_STRANDA)) },
    },
    env: {
      envFile: envPick.file,
      MEWS_DISTRIBUTION_CONFIGURATION_ID: process.env.MEWS_DISTRIBUTION_CONFIGURATION_ID || '',
      MEWS_CONFIGURATION_ID: process.env.MEWS_CONFIGURATION_ID || '',
      MEWS_SERVICE_IDS: (process.env.MEWS_SERVICE_IDS || '').trim() || null,
    },
    services: {
      total: MEWS_SERVICES_ALL.length,
      defaultCount: MEWS_SERVICES_ALL.filter((s) => (s.credsKey || CREDS_DEFAULT) === CREDS_DEFAULT).length,
      strandaCount: MEWS_SERVICES_ALL.filter((s) => (s.credsKey || CREDS_DEFAULT) === CREDS_STRANDA).length,
    },
  })
);
app.get('/api/debug/stripe-env', (_req, res) => {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();

  return res.json({
    ok: true,
    hasStripeKey: !!key,
    prefix: key ? key.slice(0, 7) : null,
    length: key ? key.length : 0,
  });
});
app.get('/api/debug/supabase-description', async (req, res) => {
  try {
    const rcId = String(req.query.rcId || '').trim();
    const lang = String(req.query.lang || 'en').trim();

    if (!rcId) {
      return res.status(400).json({ ok: false, error: 'missing_rcId' });
    }

    const data = await getSupabaseDescriptionForResourceCategory(rcId, lang);

    let rawRows: any[] | null = null;
    let rawError: any = null;

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const dbg = createClient(
        String(process.env.SUPABASE_URL || '').trim(),
        String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
      );

      const q = await dbg
        .from('resource_category_translations')
        .select('resource_category_id, locale, title, short_description')
        .eq('resource_category_id', rcId);

      rawRows = q.data || null;
      rawError = q.error || null;
    } catch (e: any) {
      rawError = e?.message || String(e);
    }

    return res.json({
      ok: true,
      rcId,
      lang,
      data,
      rawRows,
      rawError,
      env: {
        hasSUPABASE_URL: !!String(process.env.SUPABASE_URL || '').trim(),
        hasSUPABASE_SERVICE_ROLE_KEY: !!String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
      },
    });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: 'supabase_debug_failed',
      detail: e?.message || String(e),
    });
  }
});
// =============================================================
// DEBUG: Validér at våre konfigurerte serviceId-er faktisk finnes i Mews
// GET /api/debug/mews/validate-services
// =============================================================
app.get('/api/debug/mews/validate-services', async (_req, res) => {
  try {
    const configured = MEWS_SERVICES_ALL.map((s) => ({
      id: s.id,
      name: s.name,
      credsKey: (s.credsKey || CREDS_DEFAULT) as MewsCredKey,
    }));

    const fetchServiceIds = async (credsKey: MewsCredKey) => {
      try {
        const rData = await mewsConnectorPost<any>(credsKey, 'services/getAll', { Limitation: { Count: 1000 } }, 20000);
        const ids = (rData?.Services || []).map((svc: any) => String(svc?.Id || '')).filter(Boolean);
        return { ok: true, count: ids.length, ids };
      } catch (e: any) {
        return { ok: false, error: e?.response?.data || e?.message || String(e) };
      }
    };

    const mewsDefault = await fetchServiceIds(CREDS_DEFAULT);
    const mewsStranda = await fetchServiceIds(CREDS_STRANDA);

    const invalidDefault =
      mewsDefault.ok ? configured.filter((x) => x.credsKey === CREDS_DEFAULT && !mewsDefault.ids.includes(x.id)) : [];

    const invalidStranda =
      mewsStranda.ok ? configured.filter((x) => x.credsKey === CREDS_STRANDA && !mewsStranda.ids.includes(x.id)) : [];

    return res.json({
      ok: true,
      configuredCount: configured.length,
      configured,
      mews: { DEFAULT: mewsDefault, STRANDA: mewsStranda },
      invalid: { DEFAULT: invalidDefault, STRANDA: invalidStranda },
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: 'debug_validate_failed', detail: e?.message || String(e) });
  }
});

// =============================================================
// DEBUG: rå getAvailability fra Mews (for ett serviceId)
// GET /api/debug/mews/availability-raw?from=YYYY-MM-DD&to=YYYY-MM-DD&serviceId=...&credsKey=DEFAULT
// (alternativ) ...&area=trysil-turistsenter
// =============================================================
app.get('/api/debug/mews/availability-raw', async (req, res) => {
  try {
    const from = String(req.query.from || '').slice(0, 10);
    const to = String(req.query.to || '').slice(0, 10);
    const credsKey = parseCredKey(req.query.credsKey);

    const areaSlugRaw = req.query.area ? String(req.query.area) : '';
    const serviceIdFromQuery = req.query.serviceId ? String(req.query.serviceId).trim() : '';

    const { services } = resolveServicesForArea(areaSlugRaw);
    const serviceId = serviceIdFromQuery || services?.[0]?.id || '';

    if (!from || !to) return res.status(400).json({ ok: false, error: 'missing_from_to' });
    if (!serviceId) return res.status(400).json({ ok: false, error: 'missing_serviceId', detail: 'Send serviceId=... eller area=...' });

    const { firstUtc, lastUtc } = buildTimeUnitRange(from, to);

    const creds = getCreds(credsKey);
    if (!hasCreds(creds)) return res.status(500).json({ ok: false, error: 'mews_credentials_missing', credsKey });

    const payload = {
      ClientToken: creds.clientToken,
      AccessToken: creds.accessToken,
      Client: creds.clientName,
      ServiceId: serviceId,
      FirstTimeUnitStartUtc: firstUtc,
      LastTimeUnitStartUtc: lastUtc,
    };

    const data = await axiosWithRetry<any>({
      method: 'post',
      url: `${creds.baseUrl}/api/connector/v1/services/getAvailability`,
      data: payload,
      timeout: 20000,
    });

    const cats = data?.CategoryAvailabilities || [];
    const sample = cats.slice(0, 3).map((c: any) => ({
      CategoryId: c?.CategoryId,
      top: {
        AvailableRoomCount: c?.AvailableRoomCount ?? null,
        TotalAvailableUnitsCount: c?.TotalAvailableUnitsCount ?? null,
      },
      availabilitiesLen: Array.isArray(c?.Availabilities) ? c.Availabilities.length : 0,
      computedAvailableUnits: computeAvailableUnits(c),
      availCountsFirst10: Array.isArray(c?.Availabilities) ? c.Availabilities.slice(0, 10).map(avToCount) : [],
    }));

    return res.json({
      ok: true,
      input: { from, to, firstUtc, lastUtc, credsKey, serviceId, area: areaSlugRaw || null },
      meta: { categoryCount: cats.length },
      sample,
      raw: data, // NB: kun for debug
    });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: 'debug_availability_failed',
      detail: e?.response?.data || e?.message || String(e),
    });
  }
});
// =============================================================
// DEBUG: list rates for one service
// GET /api/debug/mews/rates?serviceId=...&credsKey=DEFAULT
// (alternativ) ...&area=trysil-hoyfjellssenter
// =============================================================
app.get('/api/debug/mews/rates', async (req, res) => {
  try {
    const credsKey = parseCredKey(req.query.credsKey);

    const areaSlugRaw = req.query.area ? String(req.query.area) : '';
    const serviceIdFromQuery = req.query.serviceId ? String(req.query.serviceId).trim() : '';

    const { services } = resolveServicesForArea(areaSlugRaw);
    const serviceId = serviceIdFromQuery || services?.[0]?.id || '';

    if (!serviceId) {
      return res.status(400).json({
        ok: false,
        error: 'missing_serviceId',
        detail: 'Send serviceId=... eller area=...',
      });
    }

    const creds = getCreds(credsKey);
    if (!hasCreds(creds)) {
      return res.status(500).json({
        ok: false,
        error: 'mews_credentials_missing',
        credsKey,
      });
    }

    const payload: any = {
      ClientToken: creds.clientToken,
      AccessToken: creds.accessToken,
      Client: creds.clientName,
      ServiceIds: [serviceId],
      ActivityStates: ['Active'],
      Limitation: { Count: 1000 },
    };

    if (creds.enterpriseId) {
      payload.EnterpriseIds = [creds.enterpriseId];
    }

    const data = await axiosWithRetry<any>({
      method: 'post',
      url: `${creds.baseUrl}/api/connector/v1/rates/getAll`,
      data: payload,
      timeout: 20000,
    });

    const rates = (data?.Rates || []).map((r: any) => ({
      Id: r?.Id || null,
      ServiceId: r?.ServiceId || null,
      Name:
        firstLang(r?.Names, LOCALE) ||
        r?.Name ||
        firstLang(r?.ExternalNames, LOCALE) ||
        r?.ExternalName ||
        null,
      IsActive: r?.IsActive ?? null,
      IsEnabled: r?.IsEnabled ?? null,
      IsPublic: r?.IsPublic ?? null,
      IsDefault: r?.IsDefault ?? null,
      ExternalIdentifier: r?.ExternalIdentifier ?? null,
      UpdatedUtc: r?.UpdatedUtc ?? null,
    }));

    return res.json({
      ok: true,
      serviceId,
      credsKey,
      count: rates.length,
      rates,
    });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: 'debug_rates_failed',
      detail: e?.response?.data || e?.message || String(e),
    });
  }
});


// =============================================================
// Booking-link endpoint (per område)
// GET /api/mews/booking-link?area=trysil-turistsenter&from=YYYY-MM-DD&to=YYYY-MM-DD&adults=2
// =============================================================
// =============================================================
// Booking-link endpoint (per enhet / step3 deeplink)
// GET /api/mews/booking-link?serviceId=...&roomId=...&route=rates&promo=bnotravel&from=YYYY-MM-DD&to=YYYY-MM-DD&adults=2
// (alternativ) ...?area=trysil-turistsenter&from=...&to=...&adults=...
// =============================================================

function bookingLink_resolveAreaKeyFromServiceId(serviceIdRaw: any): string | null {
  const id = String(serviceIdRaw || '').trim();
  if (!id) return null;

  // Stranda
  if (MEWS_SERVICE_ID_STRANDA && id === MEWS_SERVICE_ID_STRANDA) return 'STRANDA';

  // Trysil / Sälen
  if (MEWS_SERVICE_ID_TRYSIL_TURISTSENTER && id === MEWS_SERVICE_ID_TRYSIL_TURISTSENTER) return 'TRYSIL_TURISTSENTER';
  if (MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER && id === MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER) return 'TRYSIL_HOYFJELLSSENTER';
  if (MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE && id === MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE) return 'TRYSILFJELL_HYTTEOMRADE';
  if (MEWS_SERVICE_ID_TRYSIL_SENTRUM && id === MEWS_SERVICE_ID_TRYSIL_SENTRUM) return 'TRYSIL_SENTRUM';

  if (MEWS_SERVICE_ID_TANDADALEN_SALEN && id === MEWS_SERVICE_ID_TANDADALEN_SALEN) return 'TANDADALEN_SALEN';
  if (MEWS_SERVICE_ID_HOGFJALLET_SALEN && id === MEWS_SERVICE_ID_HOGFJALLET_SALEN) return 'HOGFJALLET_SALEN';
  if (MEWS_SERVICE_ID_LINDVALLEN_SALEN && id === MEWS_SERVICE_ID_LINDVALLEN_SALEN) return 'LINDVALLEN_SALEN';

  return null;
}

app.get(['/api/mews/booking-link', '/mews/booking-link'], (req, res) => {
  const startedAt = Date.now();

  try {
    const areaSlugRaw = req.query.area ? String(req.query.area).trim() : '';
    const serviceId = req.query.serviceId ? String(req.query.serviceId).trim() : '';
    const roomId = req.query.roomId ? String(req.query.roomId).trim() : '';

    const from = req.query.from ? String(req.query.from).trim() : '';
    const to = req.query.to ? String(req.query.to).trim() : '';
    const adults = req.query.adults ? Number(req.query.adults) : 2;

    // Default: rates (for å hoppe forbi "Datoer" når roomId er med)
    const route = req.query.route ? String(req.query.route).trim() : 'rates';

    // voucher/promo (STRANDA: settes kun etter Stripe-betaling via /api/stripe/fee/continue)
    const promoFromQuery = req.query.promo ? String(req.query.promo).trim() : '';

    // 1) Finn areaKey
    const areaKeyFromArea = areaSlugRaw ? resolveServicesForArea(areaSlugRaw).areaKey : null;
  const areaKeyFromService = serviceId ? bookingLink_resolveAreaKeyFromServiceId(serviceId) : null;
    const areaKey = areaKeyFromService || areaKeyFromArea;

    const normalizedAreaKey = normAreaKey(areaKey);
        const bookingOpenUntil = getBookingOpenUntil(normalizedAreaKey);
    if (bookingOpenUntil && to && isYmdAfter(to, bookingOpenUntil)) {
      return res.json({
        ok: false,
        error: 'booking_not_open',
        message:
          'Denne enheten ser ikke ut til å være åpen for booking i valgt periode akkurat nå. Du er velkommen til å sende oss en forespørsel.',
        inquiryEmail: 'booking@bno-travel.com',
        input: { area: areaSlugRaw || null, serviceId: serviceId || null, roomId: roomId || null, from, to, adults },
        resolved: {
          areaKey: areaKey || null,
          normalizedAreaKey: normalizedAreaKey || null,
          bookingOpenUntil,
        },
      });
    }

    // 2) Finn config/override
    const overrideUrl = getBookingUrlOverrideForArea(normalizedAreaKey);
  const cfg = getDistributionConfigForArea(normalizedAreaKey);

    const depositRequired = normalizedAreaKey === 'STRANDA';

  const promo = depositRequired ? '' : promoFromQuery;
    // 3) Bygg URL
    const url =
      overrideUrl ||
      (cfg.configId
        ? buildMewsDistributorUrl({
            base: MEWS_DISTRIBUTOR_BASE,
            configId: cfg.configId,
            from,
            to,
            adults,
            route,
            roomId,
            promo,
            language: 'nb-NO',
          })
        : null);

    // 4) Returnér alltid JSON (ingen “stum 500”)
    const out: any = {
      ok: Boolean(url),
      ms: Date.now() - startedAt,
      input: { area: areaSlugRaw || null, serviceId: serviceId || null, roomId: roomId || null, route, from, to, adults },
      resolved: {
        areaKey: areaKey || null,
        normalizedAreaKey: normalizedAreaKey || null,
        distributionBase: MEWS_DISTRIBUTOR_BASE,
        overrideUrl: overrideUrl || null,
        config: cfg,
        depositRequired,
      },
      url,
    };

    if (!url) out.error = 'booking_link_missing_config_or_override';

    return res.json(out);
  } catch (e: any) {
    console.error('[BOOKING-LINK] failed', {
      message: e?.message,
      stack: e?.stack,
      query: req.query,
    });

    // Viktig: returnér JSON, så PowerShell/klient ser hva som skjedde
    return res.json({
      ok: false,
      error: 'booking_link_failed',
      message: e?.message || String(e),
    });
  }
});


/**
 * BNO Travel “Steg 3” lenker for ALLE områder unntatt STRANDA.
 * GET /api/mews/booking-links?from=YYYY-MM-DD&to=YYYY-MM-DD&adults=2
 */
app.get('/api/mews/booking-links', (req, res) => {
  const from = req.query.from ? String(req.query.from).slice(0, 10) : '';
  const to = req.query.to ? String(req.query.to).slice(0, 10) : '';
  const adults = req.query.adults ? Number(req.query.adults) : 2;

  const areaKeys = [
    'TRYSIL_TURISTSENTER',
    'TRYSIL_HOYFJELLSSENTER',
    'TRYSILFJELL_HYTTEOMRADE',
    'TRYSIL_SENTRUM',
    'TANDADALEN_SALEN',
    'HOGFJALLET_SALEN',
    'LINDVALLEN_SALEN',
  ];

  const links = areaKeys.map((k) => {
    const configId = getDistributionConfigIdForArea(k);
    const overrideUrl = getBookingUrlOverrideForArea(k);
    const url =
      overrideUrl ||
      buildMewsDistributorUrl({
        base: MEWS_DISTRIBUTOR_BASE,
        configId,
        from: from || undefined,
        to: to || undefined,
        adults: Number.isFinite(adults) ? adults : 2,
      });
    return { areaKey: k, configId: configId || null, url: url || null };
  });

  return res.json({
    ok: true,
    input: { from: from || null, to: to || null, adults },
    count: links.length,
    data: links,
  });
});

// =============================================================
// MEWS connector post helper (med credsKey)
// =============================================================
async function mewsConnectorPost<T = any>(credsKey: MewsCredKey, p: string, data: any, timeoutMs = 20000): Promise<T> {
  const creds = getCreds(credsKey);
  if (!hasCreds(creds)) throw new Error('mews_credentials_missing');

  const url = `${creds.baseUrl}/api/connector/v1/${p.replace(/^\//, '')}`;
  return axiosWithRetry<T>({
    method: 'post',
    url,
    data: {
      ClientToken: creds.clientToken,
      AccessToken: creds.accessToken,
      Client: creds.clientName,
      ...data,
    },
    timeout: timeoutMs,
  });
}

// =============================================================
// INLINE ROUTES: mewsServices / mewsSpaces / mewsReservations
// =============================================================

// /mews/services (+ alias /api/mews/services)  støtter ?credsKey=STRANDA
app.get(['/mews/services', '/api/mews/services'], async (req, res) => {
  try {
    const credsKey = parseCredKey(req.query.credsKey);

    const cacheKey = `mews_services_getAll_v1:${credsKey}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json({ ok: true, data: cached });

    const rData = await mewsConnectorPost<any>(credsKey, 'services/getAll', { Limitation: { Count: 1000 } }, 20000);
    const services: any[] = rData?.Services || [];
    const out = services.map((svc: any) => ({
      Id: svc?.Id,
      Name: firstLang(svc?.Name, LOCALE) || svc?.Name || svc?.ExternalIdentifier,
      Type: svc?.Type || null,
      EnterpriseId: svc?.EnterpriseId || null,
    }));

    setCache(cacheKey, out, 300);
    return res.json({ ok: true, data: out });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: 'mews_services_failed', detail: e?.message || String(e) });
  }
});

// /mews/spaces (+ alias /api/mews/spaces) støtter ?credsKey=STRANDA
app.get(['/mews/spaces', '/api/mews/spaces'], async (req, res) => {
  try {
    const credsKey = parseCredKey(req.query.credsKey);

    const serviceId = String(req.query.serviceId || '').trim();
    const serviceIds = serviceId
      ? [serviceId]
      : MEWS_SERVICES_ALL.filter((s) => (s.credsKey || CREDS_DEFAULT) === credsKey)
          .map((s) => s.id)
          .filter(Boolean);

    const cacheKey = `mews_resources_getAll_v1:${credsKey}:${serviceIds.slice().sort().join(',')}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json({ ok: true, data: cached });

    const payload: any = { ServiceIds: serviceIds, Limitation: { Count: 1000 } };
    const rData = await mewsConnectorPost<any>(credsKey, 'resources/getAll', payload, 25000);
    const resources: any[] = rData?.Resources || [];

    const out = resources.map((r: any) => ({
      Id: r?.Id,
      Name: firstLang(r?.Name, LOCALE) || firstLang(r?.Names, LOCALE) || r?.Name || r?.ExternalIdentifier || null,
      ServiceId: r?.ServiceId || null,
      Type: r?.Type || null,
      IsActive: r?.IsActive ?? null,
    }));

    setCache(cacheKey, out, 300);
    return res.json({ ok: true, data: out, meta: { serviceIds, credsKey } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: 'mews_spaces_failed', detail: e?.message || String(e) });
  }
});

// /mews/reservations (+ alias /api/mews/reservations) støtter ?credsKey=STRANDA
app.get(['/mews/reservations', '/api/mews/reservations'], async (req, res) => {
  try {
    const credsKey = parseCredKey(req.query.credsKey);

    const from = String(req.query.from || '').slice(0, 10);
    const to = String(req.query.to || '').slice(0, 10);

    const serviceId = String(req.query.serviceId || '').trim();
    const serviceIds = serviceId
      ? [serviceId]
      : MEWS_SERVICES_ALL.filter((s) => (s.credsKey || CREDS_DEFAULT) === credsKey)
          .map((s) => s.id)
          .filter(Boolean);

    const statesRaw = String(req.query.states || '').trim();
    const states = statesRaw ? statesRaw.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

    if (!from || !to) {
      return res.json({
        ok: true,
        data: [],
        warn: 'missing_from_to',
        params: { from, to, serviceIds, states, credsKey },
      });
    }

    const payload: any = {
      ServiceIds: serviceIds,
      Limitation: { Count: 1000 },
      StartUtc: mews.toTimeUnitUtc(from),
      EndUtc: mews.toTimeUnitUtc(to),
    };
    if (states && states.length) payload.ReservationStates = states;

    const rData = await mewsConnectorPost<any>(credsKey, 'reservations/getAll/2023-06-06', payload, 30000);
    const reservations: any[] = rData?.Reservations || [];

    return res.json({
      ok: true,
      data: reservations,
      meta: { count: reservations.length, from, to, serviceIds, states: states || null, credsKey },
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: 'mews_reservations_failed', detail: e?.message || String(e) });
  }
});

// =============================================================
// ResourceCategories cache helper
// =============================================================
async function getResourceCategoriesForServiceCached(
  credsKey: MewsCredKey,
  serviceId: string,
  requestedLang: string
): Promise<Record<string, { name: string; capacity: number | null; description: string | null; image: string | null; images: string[] | null; raw: any }>> {
  const cacheKey = `rc_lookup:${credsKey}:${serviceId}:lang:${requestedLang}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const creds = getCreds(credsKey);
  const rcPayload: any = {
    ClientToken: creds.clientToken,
    AccessToken: creds.accessToken,
    Client: creds.clientName,
    ServiceIds: [serviceId],
    ActivityStates: ['Active'],
    Limitation: { Count: 1000 },
  };
  if (creds.enterpriseId) rcPayload.EnterpriseIds = [creds.enterpriseId];

  const rcData = await axiosWithRetry<any>({
    method: 'post',
    url: `${creds.baseUrl}/api/connector/v1/resourceCategories/getAll`,
    data: rcPayload,
    timeout: 20000,
  });

  const lookup: Record<string, any> = {};
  for (const rc of rcData?.ResourceCategories || []) {
    if (!rc?.Id) continue;
    const rcId = String(rc.Id);

   const mewsName =
  pickLocalizedText(rc.Names, requestedLang, [LOCALE]) ||
  rc.Name ||
  rc.ExternalIdentifier ||
  null;

const cap = typeof rc.Capacity === 'number' ? (rc.Capacity as number) : null;

const mewsDescription =
  pickLocalizedText(rc.Descriptions, requestedLang, [LOCALE]) ||
  rc.Description ||
  null;

const supabaseContent = await getSupabaseDescriptionForResourceCategory(rcId, requestedLang);

const preferSupabaseText = credsKey === CREDS_STRANDA;

const localizedName = preferSupabaseText
  ? (supabaseContent?.title || mewsName || 'Rom')
  : (mewsName || supabaseContent?.title || 'Rom');

const description = preferSupabaseText
  ? (supabaseContent?.description || mewsDescription || null)
  : (mewsDescription || supabaseContent?.description || null);
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

    lookup[rcId] = { name: localizedName, capacity: cap, description, image, images, raw: rc };
  }

  setCache(cacheKey, lookup, 10 * 60); // 10 min
  return lookup;
}

// =============================================================
// GENERELL MEWS-AVAILABILITY
// GET /api/mews/availability?from=YYYY-MM-DD&to=YYYY-MM-DD[&serviceId=...][&adults=2][&lang=...][&credsKey=...]
// =============================================================
app.get('/api/mews/availability', async (req, res) => {
  try {
    const from = String(req.query.from || '').slice(0, 10);
    const to = String(req.query.to || '').slice(0, 10);
    const adults = Number(req.query.adults || 1);
    const includeUnavailable = String(req.query.includeUnavailable || '').toLowerCase();
    const includeAll = includeUnavailable === '1' || includeUnavailable === 'true';

    const credsKeyParam = parseCredKey(req.query.credsKey);
    const serviceIdParam = req.query.serviceId ? String(req.query.serviceId).trim() : '';

    const langParamRaw = req.query.lang ? String(req.query.lang) : '';
    const requestedLang = (langParamRaw || LOCALE).trim();

    if (!from || !to) {
      return res.status(400).json({ ok: false, error: 'missing_params', detail: 'from og to (YYYY-MM-DD) er påkrevd' });
    }

    // servicesToQuery
    let servicesToQuery: ServiceConfig[] = [];
    if (serviceIdParam) {
      const found = MEWS_SERVICES_ALL.find((s) => s.id === serviceIdParam);
      servicesToQuery = found ? [found] : [{ id: serviceIdParam, name: 'Ukjent område (fra serviceId)', credsKey: credsKeyParam }];
    } else {
      servicesToQuery = MEWS_SERVICES_ALL.filter((s) => (s.credsKey || CREDS_DEFAULT) === credsKeyParam);
    }

    const allRooms: any[] = [];
    const serviceErrors: any[] = [];

    await mapLimit(servicesToQuery, 3, async (svc) => {
      if (!svc.id) return;

      try {
        const svcCredsKey: MewsCredKey = svc.credsKey || CREDS_DEFAULT;
        const creds = getCreds(svcCredsKey);

        if (!hasCreds(creds)) {
          serviceErrors.push({ serviceId: svc.id, name: svc.name, credsKey: svcCredsKey, error: 'mews_credentials_missing' });
          return;
        }

        let pricingCurrency: string | null = DEF_CURRENCY;
        if (svcCredsKey === CREDS_DEFAULT) {
          try {
            const pricing = await fetchConnectorPrices(from, to);
            pricingCurrency = pricing?.Currency || DEF_CURRENCY;
          } catch {
            // non-fatal
          }
        }

        const { firstUtc, lastUtc } = buildTimeUnitRange(from, to);

        const availPayload = {
          ClientToken: creds.clientToken,
          AccessToken: creds.accessToken,
          Client: creds.clientName,
          ServiceId: svc.id,
          FirstTimeUnitStartUtc: firstUtc,
          LastTimeUnitStartUtc: lastUtc,
        };

        const availData = await axiosWithRetry<any>({
          method: 'post',
          url: `${creds.baseUrl}/api/connector/v1/services/getAvailability`,
          data: availPayload,
          timeout: 20000,
        });

        const cats: any[] = availData?.CategoryAvailabilities || [];
        if (!cats.length) return;

        const categoryLookup = await getResourceCategoriesForServiceCached(svcCredsKey, svc.id, requestedLang);

        for (const ca of cats) {
          const catId = String(ca.CategoryId || '');
          if (!catId) continue;

          const info =
            categoryLookup[catId] || { name: 'Ukjent kategori', capacity: null, description: null, image: null, images: null, raw: null };

          const availableUnits = computeAvailableUnits(ca);

          let priceNightly: (number | null)[] = [];
          let priceTotal: number | null = null;
          let priceCurrency: string | null = pricingCurrency;

          const est = computePricesFromAvailabilities(ca);
          if (est.total != null || est.nightly.length) {
            priceNightly = est.nightly;
            priceTotal = est.total;
            priceCurrency = est.currency || priceCurrency;
          }

          const outItem = decorateGuestAvailability(
  {
    serviceId: svc.id,
    serviceName: svc.name,
    categoryId: catId,
    categoryName: info.name,
    description: info.description,
    image: info.image,
    images: info.images,
    capacity: info.capacity,
    priceTotal,
    priceCurrency: (priceCurrency || DEF_CURRENCY).toUpperCase(),
    priceNightly,
    credsKey: svcCredsKey,
    rawTop: {
      AvailableRoomCount: ca?.AvailableRoomCount ?? null,
      TotalAvailableUnitsCount: ca?.TotalAvailableUnitsCount ?? null,
    },
  },
  availableUnits
);

allRooms.push(outItem);
        }
      } catch (e: any) {
        serviceErrors.push({
          serviceId: svc.id,
          name: svc.name,
          credsKey: svc.credsKey || CREDS_DEFAULT,
          status: e?.response?.status || null,
          detail: e?.response?.data || e?.message || String(e),
        });
      }
    });

const filteredRoomsBase = includeAll
  ? allRooms
  : allRooms.filter((r) => typeof r.availableUnits === 'number' && r.availableUnits > 0);

const filteredRooms = sortGuestAvailability(filteredRoomsBase);
    return res.json({
      ok: true,
      data: filteredRooms,
      meta: {
        from,
        to,
        adults,
        serviceId: serviceIdParam || null,
        searchedServices: servicesToQuery,
        lang: requestedLang,
        credsKey: credsKeyParam,
        includeUnavailable: includeAll,
        serviceErrors: serviceErrors.length ? serviceErrors : null,
      },
    });
  } catch (err: any) {
    console.error('mews_availability_general_error', err?.response?.data || err?.message || err);
    return res.status(500).json({ ok: false, error: 'server_error', detail: err?.message || String(err) });
  }
});

// =============================================================
// SEARCH / AVAILABILITY (MEWS)
// GET /api/search?from=YYYY-MM-DD&to=YYYY-MM-DD&adults=2&lang=nb[&area=trysil-turistsenter][&includeUnavailable=1]
// =============================================================
app.get(['/api/search', '/search', '/api/availability', '/availability'], async (req, res) => {
  try {
    const fromRaw = String(req.query.from || '');
    const toRaw = String(req.query.to || '');
    const from = fromRaw.slice(0, 10);
    const to = toRaw.slice(0, 10);
    const adults = Number(req.query.adults || 1);
    const areaSlugRaw = req.query.area ? String(req.query.area) : '';

    const scope = String(req.query.scope || '').toLowerCase();
    const debugMode = scope === 'debug' || String(req.query.debug || '').trim() === '1';

    const includeUnavailable = String(req.query.includeUnavailable || '').toLowerCase();
    const includeAll = includeUnavailable === '1' || includeUnavailable === 'true';

    const langParamRaw = req.query.lang ? String(req.query.lang) : '';
    const requestedLang = (langParamRaw || LOCALE).trim();

    const { services: servicesToQuery, areaKey } = resolveServicesForArea(areaSlugRaw);

    const cacheKey = `search:${from}:${to}:a${adults}:area:${areaKey || 'ALL'}:lang:${requestedLang}:all:${includeAll ? '1' : '0'}`;
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

    const nights = daysBetween(from, to);
    const allRooms: any[] = [];
    const serviceErrors: any[] = [];

    await mapLimit(servicesToQuery, 3, async (svc) => {
      if (!svc.id) return;

      try {
        const svcCredsKey: MewsCredKey = svc.credsKey || CREDS_DEFAULT;
        const creds = getCreds(svcCredsKey);

        if (!hasCreds(creds)) {
          serviceErrors.push({ serviceId: svc.id, name: svc.name, credsKey: svcCredsKey, error: 'mews_credentials_missing' });
          return;
        }

        let pricingCurrency: string | null = DEF_CURRENCY;
        if (svcCredsKey === CREDS_DEFAULT) {
          try {
            const pricing = await fetchConnectorPrices(from, to);
            pricingCurrency = pricing?.Currency || DEF_CURRENCY;
          } catch {
            // non-fatal
          }
        }

        const { firstUtc, lastUtc } = buildTimeUnitRange(from, to);

        const availPayload = {
          ClientToken: creds.clientToken,
          AccessToken: creds.accessToken,
          Client: creds.clientName,
          ServiceId: svc.id,
          FirstTimeUnitStartUtc: firstUtc,
          LastTimeUnitStartUtc: lastUtc,
        };

        const availData = await axiosWithRetry<any>({
          method: 'post',
          url: `${creds.baseUrl}/api/connector/v1/services/getAvailability`,
          data: availPayload,
          timeout: 20000,
        });

        const cats: any[] = availData?.CategoryAvailabilities || [];
        if (!cats.length) return;

        const categoryLookup = await getResourceCategoriesForServiceCached(svcCredsKey, svc.id, requestedLang);

        // fallback pricing per service (begrenset)
        let priceFallbackUsed = 0;

        for (const ca of cats) {
          const catId = String(ca.CategoryId || '');
          if (!catId) continue;

          const info =
            categoryLookup[catId] || { name: 'Ukjent kategori', capacity: null, description: null, image: null, images: null, raw: null };

          const availableUnits = computeAvailableUnits(ca);

          let priceNightly: (number | null)[] = [];
          let priceTotal: number | null = null;
          let priceCurrency: string | null = pricingCurrency;

          const est = computePricesFromAvailabilities(ca);
          if (est.total != null || est.nightly.length) {
            priceNightly = est.nightly;
            priceTotal = est.total;
            priceCurrency = est.currency || priceCurrency;
          }

          // fallback: reservations/price (begrenset)
if (priceTotal == null && availableUnits > 0 && svc.adultAgeCategoryId && priceFallbackUsed < PRICE_FALLBACK_MAX_PER_SERVICE) {
  try {
    const chosenRateId =
      pickRateIdByServiceId(svc.id, nights) ||
      ((svc.rateId && svc.rateId.trim().length ? svc.rateId : null) || null);

    const rp = await priceReservationOnce({
      credsKey: svcCredsKey,
      startYmd: from,
      endYmd: to,
      categoryId: catId,
      rateId: chosenRateId || undefined,
      adults,
      serviceId: svc.id,
      adultAgeCategoryId: svc.adultAgeCategoryId,
    });

    console.log('[PRICE DEBUG]', {
      serviceId: svc.id,
      serviceName: svc.name,
      categoryId: catId,
      chosenRateId,
      adultAgeCategoryId: svc.adultAgeCategoryId,
      availableUnits,
      priceResult: rp,
    });

    priceFallbackUsed++;
    if (rp.total != null) {
      priceTotal = rp.total;
      priceCurrency = rp.currency || priceCurrency;
    }
  } catch (e) {
    serviceErrors.push({
      serviceId: svc.id,
      name: svc.name,
      credsKey: svcCredsKey,
      status: (e as any)?.response?.status ?? null,
      detail: (e as any)?.response?.data?.Message || (e as any)?.message || String(e),
    });
  }
}

          let outItem: any = decorateGuestAvailability(
  {
    ResourceCategoryId: catId,
    RoomCategoryId: catId,
    Name: info.name,
    Description: info.description,
    Capacity: info.capacity,
    Image: info.image,
    Images: info.images,
    PriceNightly: priceNightly,
    PriceTotal: priceTotal,
    PriceCurrency: (priceCurrency || DEF_CURRENCY).toUpperCase(),
    ServiceId: svc.id,
    ServiceName: svc.name,
    credsKey: svcCredsKey,
  },
  availableUnits
);
          if (debugMode) {
            outItem._debug = {
              rawTop: {
                AvailableRoomCount: ca?.AvailableRoomCount ?? null,
                TotalAvailableUnitsCount: ca?.TotalAvailableUnitsCount ?? null,
              },
              availCountsFirst10: Array.isArray(ca?.Availabilities)
                ? ca.Availabilities.slice(0, 10).map(avToCount)
                : [],
            };
          }

          allRooms.push(outItem);
        }
      } catch (e: any) {
        serviceErrors.push({
          serviceId: svc.id,
          name: svc.name,
          credsKey: svc.credsKey || CREDS_DEFAULT,
          status: e?.response?.status || null,
          detail: e?.response?.data || e?.message || String(e),
        });
      }
    });

const rcListBase = includeAll
  ? allRooms
  : allRooms.filter((r) => typeof r.AvailableUnits === 'number' && r.AvailableUnits > 0);

const rcList = sortGuestAvailability(rcListBase);
    const outResp: any = {
      availability: { ResourceCategoryAvailabilities: rcList },
      params: {
        from,
        to,
        nights,
        adults,
        area: areaKey,
        lang: requestedLang,
        includeUnavailable: includeAll,
        src: 'mews_services_getAvailability+resourceCategories_getAll(cached)+reservations_price(optional)',
        priceFallbackMaxPerService: PRICE_FALLBACK_MAX_PER_SERVICE,
      },
    };

    // hvis ALLE services feilet, behold "warn" men ikke kast
    if (rcList.length === 0 && serviceErrors.length > 0) {
      outResp.params.warn = 'mews_search_failed';
      outResp.params.serviceErrors = serviceErrors;
    } else if (serviceErrors.length > 0) {
      outResp.params.warn = 'partial_service_errors';
      outResp.params.serviceErrors = serviceErrors;
    }

    setSearchCache(cacheKey, outResp, 45);
    return res.json({ ok: true, data: outResp });
  } catch (e: any) {
    console.error('search_general_error', e?.response?.data || e?.message || e);

    const fromRaw = String((req.query as any).from || '');
    const toRaw = String((req.query as any).to || '');
    const from = fromRaw.slice(0, 10);
    const to = toRaw.slice(0, 10);
    const adults = Number((req.query as any).adults || 1);
    const areaSlugRaw = (req.query as any).area ? String((req.query as any).area) : '';

    const langParamRaw = (req.query as any).lang ? String((req.query as any).lang) : '';
    const requestedLang = (langParamRaw || LOCALE).trim();

    const { areaKey } = resolveServicesForArea(areaSlugRaw);

    const resp = {
      availability: { ResourceCategoryAvailabilities: [] },
      params: { from, to, adults, area: areaKey, lang: requestedLang, warn: 'mews_search_failed' },
    };
    const cacheKeyErr = `search:${from}:${to}:a${adults}:area:${areaKey || 'ALL'}:lang:${requestedLang}:all:0`;
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
    if (!MEWS_BASE_DEFAULT || !MEWS_CLIENT_TOKEN_DEFAULT || !MEWS_ACCESS_TOKEN_DEFAULT) {
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
      Image: Array.isArray(p?.ImageIds) && p.ImageIds.length ? `https://cdn.mews-demo.com/Media/Image/${p.ImageIds[0]}?Mode=Fit&Height=400&Width=600` : null,
      Currency: DEF_CURRENCY,
      PriceGross: p?.Price?.Value ?? p?.PriceGross ?? null,
    }));
    res.json({ ok: true, data: products });
  } catch (e: any) {
    console.error('products_error', e?.response?.data || e?.message || e);
    res.json({ ok: true, data: [] });
  }
});

app.post('/webhooks/mews', mewsWebhookHandler);

// =============================================================
// BNO Travel Helper
// Erstatt hele travel-helper-blokken med denne
// =============================================================

const BNO_TRAVEL_HELPER_SYSTEM = `
Du er BNO Reisehjelper i BNO Travel-appen.

Målet ditt er å hjelpe brukeren før, under og etter reisen. Du skal også kunne svare på spørsmål om vertskap, utleie og formidling av hytter og leiligheter via BNO Travel når verifisert innhold finnes.

VIKTIGE REGLER:
1. Prioriter alltid BNO Travel sitt eget innhold først.
2. Du må ALDRI finne opp overnatting, priser, tilgjengelighet, navn på hytter/leiligheter, områder, fly, tider, aktiviteter, restauranter, shoppingsteder, vertsfordeler, provisjon eller reisevilkår.
3. Hvis du får "BNO_AVAILABILITY_CONTEXT", skal du KUN bruke dataene som står der.
4. Hvis BNO_AVAILABILITY_CONTEXT inneholder ekte treff, skal du ikke gi generelle svar først.
5. Hvis det er 0 treff, si det tydelig og foreslå hvordan brukeren kan justere søket.
6. Hvis viktig informasjon mangler, still ett kort og tydelig oppfølgingsspørsmål.
7. Svar helst på samme språk som brukeren skriver i.
8. Svar konkret, nyttig og handlingsrettet.
9. Hvis du får "BNO_CONTENT_CONTEXT", skal du bruke dette som verifisert BNO-innhold.
10. Når BNO_CONTENT_CONTEXT finnes, prioriter dette før generelle råd.
11. Ikke dikt opp konkrete aktiviteter, restauranter, shoppingsteder, spa, treningstilbud, vertsfordeler, provisjon, betingelser eller reisevilkår som ikke finnes i BNO_CONTENT_CONTEXT.
12. Hvis BNO_CONTENT_CONTEXT er på norsk, men brukeren skriver på et annet språk, kan du oversette og oppsummere korrekt til brukerens språk.
13. Hvis noe ikke er sanntidsbookbart, vær tydelig på det.
14. Når reisevilkår inneholder konkrete tall, aldersgrenser, tider eller beløp, skal du gjengi disse eksplisitt og ikke bare oppsummere generelt.
15. Hvis spørsmålet gjelder aldersgrense, og innholdet sier både hovedregel og unntak, skal du nevne begge deler.
16. Hvis spørsmålet gjelder innsjekk og utsjekk, og tidene finnes i BNO_CONTENT_CONTEXT, skal du oppgi de eksakte tidene.
17. Hvis brukeren ber om booking av fly eller overnatting, skal du være tydelig på at booking fullføres via knapp/checkout i appen.
18. Du skal ikke samle inn navn, e-post, telefonnummer, passasjerdata eller betalingsinformasjon i chatten.
19. Hvis brukeren ber om et komplett reiseforslag, skal du sette sammen et konkret forslag med fly, overnatting, aktiviteter, restauranter og shopping når verifiserte data finnes.
20. Hvis du bare har verifiserte forslag for deler av pakken, skal du være tydelig på hva som er verifisert og hva som må sjekkes nærmere.
21. Hvis innhold antyder at tilbud kan være sesongavhengige, skal du være tydelig på dette og ikke presentere dem som sikkert åpne hvis det ikke er bekreftet.
22. Hvis brukeren spør om å leie ut hytte eller leilighet via BNO Travel, bruk verifisert BNO-innhold om vertskap/utleie og ikke dikt opp betingelser eller kommersielle vilkår.
23. Når BNO_CONTENT_CONTEXT inneholder vertskapsinnhold, skal du bruke dette aktivt og konkret.
24. Hvis brukeren spør om formidling / utleie via BNO Travel, forklar ordningen med de konkrete punktene som faktisk finnes i innholdet.
25. Når brukeren spør kun om restaurant, skal du ikke begynne å svare om overnatting eller fly.
26. Når brukeren spør kun om aktiviteter, skal du ikke begynne å svare om overnatting eller fly.
27. Når brukeren spør kun om shopping, skal du ikke begynne å svare om overnatting eller fly.
28. Når brukeren svarer med korte preferanser i en oppfølging, for eksempel "italiensk", "familierestaurant", "sportsklær", "pris spiller ingen rolle", skal du tolke dette i lys av forrige tema og IKKE bytte tema.
29. Når brukeren spør om en reisepakke, skal du bruke ankomstdestinasjonen som destinasjon for aktiviteter, restauranter og shopping. Ikke bruk avreisestedet som destinasjon.
30. Hvis brukeren ikke har bedt om overnatting, skal du ikke legge inn overnatting i et samlet forslag.
31. Hvis du har konkrete verifiserte steder i restaurant eller shopping, skal du anbefale disse direkte i stedet for å svare generelt.
32. Ikke si at informasjon mangler hvis BNO_CONTENT_CONTEXT faktisk inneholder konkrete forslag.

Hvis brukeren spør om overnatting:
- bruk BNO Travel sitt eget innhold først
- presenter konkrete alternativer hvis du har dem
- ta med navn, pris, kapasitet og område hvis det finnes
- bruk punktliste når det er flere treff
- ikke gjett
- du skal ikke samle inn navn, e-post, telefonnummer eller betalingsinformasjon i chatten for å fullføre overnattingsbooking
- hvis bookingAction finnes, skal du heller oppfordre brukeren til å bruke bookingknappen
- du skal ikke si at en booking er registrert eller fullført med mindre systemet faktisk har gjort det

Hvis brukeren ber om en hel reise:
- sett sammen et konkret forslag hvis du har verifiserte data
- prioriter ett anbefalt fly først
- ta bare med overnatting hvis brukeren faktisk har bedt om overnatting
- ta med 2–4 relevante aktiviteter hvis de finnes i BNO_CONTENT_CONTEXT
- ta med 2–4 relevante restaurantforslag hvis de finnes i BNO_CONTENT_CONTEXT
- ta med 2–4 relevante shoppingforslag hvis de finnes i BNO_CONTENT_CONTEXT
- hvis sesong er relevant, bruk bare forslag som virker relevante for sesongen ut fra innholdet
- hvis du lager et dagsprogram, kall det et enkelt forslag for de første dagene og ikke som en full plan for hele reisen med mindre du har grunnlag for hele perioden
- vær tydelig på at fly og overnatting fullføres via bookingknappene i appen

Hvis brukeren spør om restaurant:
- bruk BNO Travel sitt innhold først
- presenter konkrete restaurantnavn hvis de finnes
- prioriter konkrete steder foran generelle guideartikler
- hvis preferanser finnes, bruk dem aktivt til å velge de mest relevante stedene
- hvis du mangler preferanser, still ett kort oppfølgingsspørsmål
- ikke bytt tema

Hvis brukeren spør om shopping:
- bruk BNO Travel sitt innhold først
- presenter konkrete shoppingsteder hvis de finnes
- prioriter konkrete steder foran generelle guideartikler
- hvis preferanser finnes, bruk dem aktivt til å velge de mest relevante stedene
- hvis du mangler preferanser, still ett kort oppfølgingsspørsmål
- ikke bytt tema

Hvis brukeren spør om aktiviteter, restauranter, shopping, spa, trening, reisevilkår eller vertskap/utleie:
- bruk BNO Travel sitt innhold først
- still ett kort oppfølgingsspørsmål hvis du trenger preferanser
- vær tydelig dersom noe ikke er sanntidsbookbart
`;

type TravelHelperIntent =
  | 'availability_search'
  | 'general_travel_help'
  | 'trip_planning'
  | 'host_rental_help';

type TravelHelperResponseMode =
  | 'accommodation_only'
  | 'flight_only'
  | 'restaurant_only'
  | 'activity_only'
  | 'shopping_only'
  | 'trip_package'
  | 'host_only'
  | 'general';

type FlightAction = {
  type: 'book_flight';
  label: string;
  offer: any;
  search: {
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string | null;
    adults: number;
    cabinClass: 'economy' | 'premium_economy' | 'business' | 'first';
    directOnly: boolean;
  };
};

type FlightSearchContextPayload = {
  offers: any[];
  search: {
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string | null;
    adults: number;
    cabinClass: 'economy' | 'premium_economy' | 'business' | 'first';
    directOnly: boolean;
  } | null;
};

type TripProposal = {
  destination: {
    area: string | null;
    destinationSlug: string;
    label: string;
    season: 'winter' | 'summer' | 'unknown';
  } | null;
  accommodation: any | null;
  flight: any | null;
  activities: any[];
  restaurants: any[];
  shopping: any[];
  transport: string | null;
  itinerary: Array<{
    day: number;
    title: string;
    items: string[];
  }>;
  summary: string[];
};

function normalizeTravelHelperText(inputRaw: string): string {
  return String(inputRaw || '')
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o');
}

function containsAny(text: string, values: string[]): boolean {
  return values.some((value) => text.includes(value));
}

function buildTravelHelperSearchBasis(message: string, history: any[]): string {
  const recentUserTexts = (Array.isArray(history) ? history : [])
    .filter((item: any) => item?.role === 'user')
    .slice(-6)
    .map((item: any) => String(item?.text || '').trim())
    .filter(Boolean);

  return [...recentUserTexts, String(message || '').trim()]
    .filter(Boolean)
    .join('\n');
}

function getLastUserMessage(history: any[]): string {
  const arr = (Array.isArray(history) ? history : []).filter((item: any) => item?.role === 'user');
  const last = arr[arr.length - 1];
  return String(last?.text || '').trim();
}

function getPreviousUserMessage(history: any[]): string {
  const arr = (Array.isArray(history) ? history : []).filter((item: any) => item?.role === 'user');
  const prev = arr[arr.length - 2];
  return String(prev?.text || '').trim();
}

function isShortPreferenceReply(messageRaw: string): boolean {
  const s = String(messageRaw || '').trim();
  if (!s) return false;
  if (s.length > 80) return false;
  if (s.includes('?')) return false;
  return true;
}

function detectTravelHelperResponseMode(
  messageRaw: string,
  history: any[] = []
): TravelHelperResponseMode {
  const message = normalizeTravelHelperText(messageRaw);
  const previous = normalizeTravelHelperText(getPreviousUserMessage(history));
  const last = normalizeTravelHelperText(getLastUserMessage(history));
  const combined = normalizeTravelHelperText(
    buildTravelHelperSearchBasis(String(messageRaw || ''), history || [])
  );

  const hostWords = [
    'leie ut',
    'utleie',
    'utleier',
    'utleiermodell',
    'vert',
    'vaere vert',
    'være vert',
    'host',
    'formidling',
    'eier',
    'eierside',
    'provisjon',
    'serviceapparat',
    'bookingstatus',
  ];

  const accommodationWords = [
    'ledig',
    'ledige',
    'tilgjengelig',
    'tilgjengelige',
    'overnatting',
    'opphold',
    'sted a bo',
    'bo',
    'hytte',
    'hytter',
    'leilighet',
    'leiligheter',
    'hotell',
    'rom',
    'ski in',
    'ski out',
    'ski-in',
    'ski-out',
    'booke',
    'bestille',
    'bestill',
    'booking',
  ];

  const flightWords = [
    'fly',
    'flight',
    'flybillett',
    'flybilletter',
    'flyreise',
    'avganger',
    'avgang',
    'returfly',
    'direktefly',
    'fly fra',
    'flight from',
  ];

  const restaurantWords = [
    'restaurant',
    'restauranter',
    'middag',
    'lunsj',
    'spisested',
    'spisesteder',
    'italiensk',
    'pizza',
    'familierestaurant',
    'romantisk',
    'fine dining',
    'cafe',
    'kafe',
    'mat',
  ];

  const activityWords = [
    'aktivitet',
    'aktiviteter',
    'ting a gjore',
    'ting å gjøre',
    'alpint',
    'langrenn',
    'spa',
    'massasje',
    'trening',
    'fitness',
    'gym',
    'yoga',
    'vandring',
    'sykkel',
    'museum',
    'guide',
  ];

  const shoppingWords = [
    'shopping',
    'butikk',
    'butikker',
    'shoppe',
    'sportsklaer',
    'sportsklær',
    'klaer',
    'klær',
    'mote',
    'design',
    'gaver',
    'souvenir',
    'souvenirer',
    'dagligvarer',
    'skiutstyr',
    'sportsutstyr',
  ];

  const packageHints = [
    'sett opp et forslag',
    'sett opp forslag',
    'reiseforslag',
    'ferieforslag',
    'reiseplan',
    'dagsprogram',
    'kan du sette opp',
    'kan du lage et forslag',
    'kan du lage et opplegg',
    'vi vil reise',
    'skiferie',
    'sommerferie',
    'familieferie',
  ];

  if (containsAny(combined, hostWords)) return 'host_only';

  const hasAccommodation = containsAny(message, accommodationWords);
  const hasFlight = containsAny(message, flightWords);
  const hasRestaurant = containsAny(message, restaurantWords);
  const hasActivity = containsAny(message, activityWords);
  const hasShopping = containsAny(message, shoppingWords);
  const hasPackageHint = containsAny(message, packageHints);

  const categoryCount = [
    hasAccommodation,
    hasFlight,
    hasRestaurant,
    hasActivity,
    hasShopping,
  ].filter(Boolean).length;

  if (hasPackageHint || categoryCount >= 2) {
    return 'trip_package';
  }

  if (hasRestaurant && !hasAccommodation && !hasFlight && !hasActivity && !hasShopping) {
    return 'restaurant_only';
  }

  if (hasShopping && !hasAccommodation && !hasFlight && !hasActivity && !hasRestaurant) {
    return 'shopping_only';
  }

  if (hasActivity && !hasAccommodation && !hasFlight && !hasRestaurant && !hasShopping) {
    return 'activity_only';
  }

  if (hasFlight && !hasAccommodation && !hasRestaurant && !hasActivity && !hasShopping) {
    return 'flight_only';
  }

  if (hasAccommodation && !hasFlight && !hasRestaurant && !hasActivity && !hasShopping) {
    return 'accommodation_only';
  }

  if (isShortPreferenceReply(messageRaw)) {
    if (containsAny(previous, restaurantWords) || containsAny(last, restaurantWords)) {
      return 'restaurant_only';
    }
    if (containsAny(previous, shoppingWords) || containsAny(last, shoppingWords)) {
      return 'shopping_only';
    }
    if (containsAny(previous, activityWords) || containsAny(last, activityWords)) {
      return 'activity_only';
    }
  }

  return 'general';
}

function detectTravelHelperIntent(messageRaw: string): TravelHelperIntent {
  const message = normalizeTravelHelperText(messageRaw);

  if (
    message.includes('leie ut') ||
    message.includes('utleie') ||
    message.includes('vert') ||
    message.includes('formidling') ||
    message.includes('provisjon')
  ) {
    return 'host_rental_help';
  }

  const planningNeedsCount = [
    message.includes('overnatting') || message.includes('hytte') || message.includes('leilighet'),
    message.includes('fly') || message.includes('flight'),
    message.includes('aktivitet') || message.includes('aktiviteter'),
    message.includes('restaurant') || message.includes('restauranter'),
    message.includes('shopping') || message.includes('butikker'),
  ].filter(Boolean).length;

  if (planningNeedsCount >= 2) {
    return 'trip_planning';
  }

  if (
    message.includes('overnatting') ||
    message.includes('hytte') ||
    message.includes('leilighet') ||
    message.includes('rom')
  ) {
    return 'availability_search';
  }

  return 'general_travel_help';
}

function extractTravelHelperArea(messageRaw: string): string | null {
  const message = normalizeTravelHelperText(messageRaw);

  const mappings: Array<{ keywords: string[]; area: string }> = [
    { keywords: ['trysil sentrum'], area: 'trysil-sentrum' },
    { keywords: ['turistsenter', 'trysil turistsenter'], area: 'trysil-turistsenter' },
    { keywords: ['hoyfjellssenter', 'trysil hoyfjellssenter', 'fagerasen', 'fageraasen'], area: 'trysil-hoyfjellssenter' },
    { keywords: ['trysilfjell', 'trysilfjellet'], area: 'trysilfjell-hytteomrade' },
    { keywords: ['trysil'], area: 'trysil' },
    { keywords: ['salen', 'saelen', 'sälen'], area: 'salen' },
    { keywords: ['geiranger'], area: 'stranda' },
    { keywords: ['stranda'], area: 'stranda' },
    { keywords: ['sunnmorsalpene', 'sunnmørsalpene'], area: 'sunnmorsalpene' },
    { keywords: ['oslo'], area: 'oslo' },
    { keywords: ['london'], area: 'london' },
    { keywords: ['amsterdam'], area: 'amsterdam' },
    { keywords: ['kobenhavn', 'københavn', 'copenhagen'], area: 'copenhagen' },
    { keywords: ['stockholm'], area: 'stockholm' },
    { keywords: ['los angeles', 'losangeles'], area: 'losangeles' },
    { keywords: ['miami'], area: 'miami' },
    { keywords: ['paris'], area: 'paris' },
    { keywords: ['rome', 'roma'], area: 'rome' },
  ];

  for (const item of mappings) {
    if (item.keywords.some((keyword) => message.includes(keyword))) {
      return item.area;
    }
  }

  return null;
}

function extractBoundedPlace(
  messageRaw: string,
  kind: 'origin' | 'destination'
): string {
  const raw = String(messageRaw || '');

  if (kind === 'origin') {
    const match = raw.match(/\bfra\s+(.+?)(?:\s+til\s+|$)/i);
    return String(match?.[1] || '').trim();
  }

  const match = raw.match(/\btil\s+(.+?)(?:\s+fra\s+|$)/i);
  return String(match?.[1] || '').trim();
}

function extractTripDestinationArea(
  messageRaw: string,
  history: any[]
): string | null {
  const directDestination = extractBoundedPlace(messageRaw, 'destination');
  const directArea = extractTravelHelperArea(directDestination);
  if (directArea) return directArea;

  const direct = extractTravelHelperArea(messageRaw);
  if (direct) {
    const originBounded = extractBoundedPlace(messageRaw, 'origin');
    const originArea = extractTravelHelperArea(originBounded);

    if (originArea && direct === originArea) {
      const destinationBounded = extractBoundedPlace(messageRaw, 'destination');
      const destinationArea = extractTravelHelperArea(destinationBounded);
      if (destinationArea) return destinationArea;
    }

    return direct;
  }

  const prev = getPreviousUserMessage(history);
  const prevDestination = extractBoundedPlace(prev, 'destination');
  const prevArea = extractTravelHelperArea(prevDestination || prev);
  if (prevArea) return prevArea;

  return null;
}

function mapTravelHelperAreaToContentDestinationSlug(area: string | null): string {
  const normalized = String(area || '').trim().toLowerCase();

  if (!normalized) return 'global';

  if (
    normalized === 'trysil' ||
    normalized === 'trysil-sentrum' ||
    normalized === 'trysil-turistsenter' ||
    normalized === 'trysil-hoyfjellssenter' ||
    normalized === 'trysilfjell-hytteomrade'
  ) {
    return 'trysil';
  }

  if (
    normalized === 'stranda' ||
    normalized === 'sunnmorsalpene' ||
    normalized === 'geiranger'
  ) {
    return 'stranda';
  }

  if (normalized === 'salen') return 'salen';
  if (normalized === 'oslo') return 'oslo';
  if (normalized === 'london') return 'london';
  if (normalized === 'amsterdam') return 'amsterdam';
  if (normalized === 'copenhagen') return 'copenhagen';
  if (normalized === 'stockholm') return 'stockholm';
  if (normalized === 'losangeles') return 'losangeles';
  if (normalized === 'miami') return 'miami';
  if (normalized === 'paris') return 'paris';
  if (normalized === 'rome') return 'rome';

  return 'global';
}

function extractTravelHelperAdults(messageRaw: string): number | null {
  const message = normalizeTravelHelperText(messageRaw);

  const patterns = [
    /(\d+)\s*(personer|person|voksne|gjester|adults|people)/,
    /for\s+(\d+)/,
    /vi\s+er\s+(\d+)/,
    /oss\s+(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }

  return null;
}

function extractTravelHelperDates(
  messageRaw: string
): { from: string | null; to: string | null } {
  const raw = String(messageRaw || '');
  const message = normalizeTravelHelperText(raw);

  const pad = (n: number) => String(n).padStart(2, '0');

  const monthMap: Record<string, number> = {
    januar: 1,
    februar: 2,
    mars: 3,
    april: 4,
    mai: 5,
    juni: 6,
    juli: 7,
    august: 8,
    september: 9,
    oktober: 10,
    november: 11,
    desember: 12,
  };

  const currentYear = new Date().getFullYear();

  const isoDates = raw.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
  if (isoDates.length >= 2) {
    return { from: isoDates[0] ?? null, to: isoDates[1] ?? null };
  }

  const dottedDates = [...raw.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g)];
  if (dottedDates.length >= 2) {
    const first = dottedDates[0];
    const second = dottedDates[1];
    return {
      from: `${first[3]}-${pad(Number(first[2]))}-${pad(Number(first[1]))}`,
      to: `${second[3]}-${pad(Number(second[2]))}-${pad(Number(second[1]))}`,
    };
  }

  const rangeSameMonth = message.match(
    /\b(\d{1,2})\.?\s*(?:-|til)\s*(\d{1,2})\.?\s*(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)(?:\s+(\d{4}))?\b/
  );
  if (rangeSameMonth) {
    const fromDay = Number(rangeSameMonth[1]);
    const toDay = Number(rangeSameMonth[2]);
    const month = monthMap[rangeSameMonth[3]];
    const year = Number(rangeSameMonth[4] || currentYear);
    return {
      from: `${year}-${pad(month)}-${pad(fromDay)}`,
      to: `${year}-${pad(month)}-${pad(toDay)}`,
    };
  }

  const longDates = [
    ...message.matchAll(
      /\b(\d{1,2})\.?\s+(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)(?:\s+(\d{4}))?\b/g
    ),
  ];

  if (longDates.length >= 2) {
    const first = longDates[0];
    const second = longDates[1];
    const firstYear = Number(first[3] || currentYear);
    let secondYear = Number(second[3] || currentYear);
    const firstMonth = monthMap[first[2]];
    const secondMonth = monthMap[second[2]];
    if (!second[3] && secondMonth < firstMonth) secondYear = firstYear + 1;

    return {
      from: `${firstYear}-${pad(firstMonth)}-${pad(Number(first[1]))}`,
      to: `${secondYear}-${pad(secondMonth)}-${pad(Number(second[1]))}`,
    };
  }

  return { from: null, to: null };
}

function detectTravelSeason(
  messageRaw: string,
  dates?: { from: string | null; to: string | null }
): 'winter' | 'summer' | 'unknown' {
  const message = normalizeTravelHelperText(messageRaw);

  if (
    message.includes('skiferie') ||
    message.includes('ski') ||
    message.includes('alpint') ||
    message.includes('langrenn') ||
    message.includes('vinter')
  ) {
    return 'winter';
  }

  if (
    message.includes('sommerferie') ||
    message.includes('sommer') ||
    message.includes('vandring') ||
    message.includes('hiking') ||
    message.includes('sykkel')
  ) {
    return 'summer';
  }

  const dateToCheck = dates?.from || null;
  if (dateToCheck) {
    const d = new Date(`${dateToCheck}T12:00:00Z`);
    if (!Number.isNaN(d.getTime())) {
      const month = d.getUTCMonth() + 1;
      if (month === 12 || month <= 4) return 'winter';
      if (month >= 6 && month <= 8) return 'summer';
    }
  }

  return 'unknown';
}

function rankTravelHelperAvailabilityRows(
  rows: any[],
  adults: number | null,
  messageRaw: string
) {
  const message = normalizeTravelHelperText(messageRaw);

  const wantsCabin = message.includes('hytte') || message.includes('cabin') || message.includes('chalet');
  const wantsSkiInOut = message.includes('ski in') || message.includes('ski out') || message.includes('ski-in') || message.includes('ski-out');
  const wantsFamily = message.includes('familie') || message.includes('barn') || message.includes('family');

  const scored = (Array.isArray(rows) ? rows : []).map((item: any) => {
    let score = 0;

    const capacity = Number(item?.Capacity || item?.capacity || 0);
    const name = String(item?.Name || item?.name || '').toLowerCase();
    const description = String(item?.Description || item?.description || '').toLowerCase();
    const serviceName = String(item?.ServiceName || item?.serviceName || '').toLowerCase();
    const textBlob = `${name} ${description} ${serviceName}`;

    if (adults && capacity >= adults) {
      score += 100;
      if (capacity === adults) score += 30;
      if (capacity <= adults + 2) score += 15;
    } else if (adults && capacity > 0 && capacity < adults) {
      score -= 200;
    }

    if (wantsCabin && (textBlob.includes('hytte') || textBlob.includes('cabin') || textBlob.includes('chalet'))) {
      score += 20;
    }

    if (wantsFamily && (textBlob.includes('familie') || textBlob.includes('family') || capacity >= 4)) {
      score += 12;
    }

    if (
      wantsSkiInOut &&
      (
        textBlob.includes('ski in/ski out') ||
        textBlob.includes('ski-in/ski-out') ||
        textBlob.includes('ski in') ||
        textBlob.includes('ski out') ||
        textBlob.includes('ski-in') ||
        textBlob.includes('ski-out')
      )
    ) {
      score += 25;
    }

    if (item?.PriceTotal != null || item?.priceTotal != null) score += 5;
    if (
      (item?.AvailableUnits != null && Number(item.AvailableUnits) > 0) ||
      (item?.availableUnits != null && Number(item.availableUnits) > 0)
    ) {
      score += 5;
    }

    return { ...item, __travelHelperScore: score };
  });

  return scored.sort((a: any, b: any) => {
    const scoreDiff = Number(b.__travelHelperScore || 0) - Number(a.__travelHelperScore || 0);
    if (scoreDiff !== 0) return scoreDiff;

    const priceA =
      a?.PriceTotal != null ? Number(a.PriceTotal)
      : a?.priceTotal != null ? Number(a.priceTotal)
      : Number.POSITIVE_INFINITY;

    const priceB =
      b?.PriceTotal != null ? Number(b.PriceTotal)
      : b?.priceTotal != null ? Number(b.priceTotal)
      : Number.POSITIVE_INFINITY;

    return priceA - priceB;
  });
}

function buildAvailabilityContextText(
  searchData: any,
  adults: number | null,
  messageRaw: string
): string {
  const rows =
    searchData?.availability?.ResourceCategoryAvailabilities ||
    searchData?.data ||
    [];
  const params = searchData?.params || searchData?.meta || {};

  if (!Array.isArray(rows) || rows.length === 0) {
    return [
      'BNO_AVAILABILITY_CONTEXT',
      `Område: ${params?.area || 'ukjent'}`,
      `Fra: ${params?.from || 'ukjent'}`,
      `Til: ${params?.to || 'ukjent'}`,
      `Voksne: ${params?.adults || 'ukjent'}`,
      'Treff: 0',
      'INSTRUKS: Ingen tilgjengelige enheter funnet. Ikke finn opp alternativer.',
    ].join('\n');
  }

  const rankedRows = rankTravelHelperAvailabilityRows(rows, adults, messageRaw);
  const topRows = rankedRows.slice(0, 5);

  const formattedRows = topRows.map((item: any, index: number) => {
    const price =
      item?.PriceTotal != null && item?.PriceCurrency
        ? `${item.PriceTotal} ${item.PriceCurrency}`
        : item?.priceTotal != null && item?.priceCurrency
          ? `${item.priceTotal} ${item.priceCurrency}`
          : item?.PriceTotal != null
            ? String(item.PriceTotal)
            : item?.priceTotal != null
              ? String(item.priceTotal)
              : 'ukjent pris';

    const capacity =
      item?.Capacity != null ? String(item.Capacity)
      : item?.capacity != null ? String(item.capacity)
      : 'ukjent kapasitet';

    const availableUnits =
      item?.AvailableUnits != null ? String(item.AvailableUnits)
      : item?.availableUnits != null ? String(item.availableUnits)
      : 'ukjent';

    const area =
      item?.ServiceName ||
      item?.serviceName ||
      item?.AreaName ||
      params?.area ||
      'ukjent område';

    const name = item?.Name || item?.name || 'Ukjent enhet';
    const description = item?.Description || item?.description || '';
    const features = item?.Features || item?.FeatureSummary || '';

    return [
      `ALTERNATIV_${index + 1}`,
      `NAVN: ${name}`,
      `OMRÅDE: ${area}`,
      `PRIS: ${price}`,
      `KAPASITET: ${capacity}`,
      `LEDIGE_ENHETER: ${availableUnits}`,
      `BESKRIVELSE: ${description}`,
      `FEATURES: ${features}`,
    ].join('\n');
  });

  return [
    'BNO_AVAILABILITY_CONTEXT',
    'Dette er ekte tilgjengelighet fra BNO Travel.',
    `Område: ${params?.area || 'ukjent'}`,
    `Fra: ${params?.from || 'ukjent'}`,
    `Til: ${params?.to || 'ukjent'}`,
    `Voksne: ${params?.adults || 'ukjent'}`,
    `Treff: ${rows.length}`,
    '',
    ...formattedRows,
    '',
    'INSTRUKS:',
    '- Bruk KUN alternativene over',
    '- Ikke legg til nye navn',
    '- Ikke dikt opp priser',
    '- Ikke dikt opp områder',
    '- Oppsummer kort og konkret',
  ].join('\n\n');
}

function buildDeterministicAccommodationReply(rows: any[], params: any): string {
  if (!Array.isArray(rows) || rows.length === 0) {
    return `Jeg fant dessverre ingen ledige overnattingsalternativer i ${params?.area || 'valgt område'} fra ${params?.from || ''} til ${params?.to || ''} for ${params?.adults || ''} personer. Du kan prøve å justere datoer, område eller antall personer.`;
  }

  const rankedRows = rankTravelHelperAvailabilityRows(rows, params?.adults || null, '');
  const topRows = rankedRows.slice(0, 3);

  const lines: string[] = [
    `Her er ${topRows.length === 1 ? 'et ledig overnattingsalternativ' : 'ledige overnattingsalternativer'} i ${params?.area || 'området'} fra ${params?.from || ''} til ${params?.to || ''} for ${params?.adults || ''} personer:`,
    '',
  ];

  topRows.forEach((item, index) => {
    const name = item?.Name || item?.name || 'Ukjent enhet';
    const area = item?.ServiceName || item?.serviceName || params?.area || 'Ukjent område';
    const capacity = item?.Capacity ?? item?.capacity ?? 'Ukjent';
    const price =
      item?.PriceTotal != null && item?.PriceCurrency
        ? `${item.PriceTotal} ${item.PriceCurrency}`
        : item?.priceTotal != null && item?.priceCurrency
          ? `${item.priceTotal} ${item.priceCurrency}`
          : 'Pris ikke tilgjengelig';
    const availableUnits = item?.AvailableUnits ?? item?.availableUnits ?? 'Ukjent';
    const description = item?.Description || item?.description || '';

    lines.push(`${index + 1}. ${name}`);
    lines.push(`- Område: ${area}`);
    lines.push(`- Kapasitet: ${capacity}`);
    lines.push(`- Pris: ${price}`);
    lines.push(`- Ledige enheter: ${availableUnits}`);
    if (description) lines.push(`- Beskrivelse: ${description}`);
    lines.push('');
  });

  lines.push('Du kan bruke bookingknappen i appen for å se detaljer og fullføre bestillingen.');
  return lines.join('\n');
}

function isTravelHelperBookingIntent(messageRaw: string): boolean {
  const message = normalizeTravelHelperText(messageRaw);

  const bookingPhrases = [
    'book',
    'booking',
    'bestill',
    'bestille',
    'gaa videre med',
    'hjelpe med booking',
    'fullfor booking',
    'fullfor bestilling',
    'jeg vil booke',
    'jeg vil bestille',
    'kan du booke',
  ];

  return bookingPhrases.some((phrase) => message.includes(phrase));
}

function findRequestedRoomFromMessage(
  messageRaw: string,
  rows: any[],
  adults?: number | null
): any | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const message = normalizeTravelHelperText(messageRaw);

  const directNameMatch = rows.find((row: any) => {
    const name = normalizeTravelHelperText(row?.Name || row?.name || '');
    return !!name && message.includes(name);
  });
  if (directNameMatch) return directNameMatch;

  const pronounBookingHints = ['den', 'denne', 'ja', 'book den', 'bestill den', 'ja takk'];
  if (pronounBookingHints.some((phrase) => message.includes(phrase) || message === phrase)) {
    const ranked = rankTravelHelperAvailabilityRows(rows, adults ?? null, messageRaw);
    return ranked[0] || null;
  }

  return null;
}

function detectTravelContentIntent(messageRaw: string): boolean {
  const message = normalizeTravelHelperText(messageRaw);

  const keywords = [
    'reisevilkar',
    'reisevilkår',
    'aldersgrense',
    'innsjekk',
    'utsjekk',
    'depositum',
    'avbestilling',
    'husregler',
    'aktivitet',
    'restaurant',
    'restauranter',
    'shopping',
    'butikker',
    'spa',
    'massasje',
    'trening',
    'leie ut',
    'utleie',
    'vert',
    'formidling',
    'provisjon',
  ];

  return keywords.some((word) => message.includes(word));
}

function extractTravelContentCategory(
  messageRaw: string,
  history: any[] = []
): string | null {
  const message = normalizeTravelHelperText(messageRaw);
  const responseMode = detectTravelHelperResponseMode(messageRaw, history);

  if (responseMode === 'restaurant_only') return 'restaurant';
  if (responseMode === 'shopping_only') return 'shopping';
  if (responseMode === 'activity_only') return 'activity';
  if (responseMode === 'host_only') return 'host_rental';

  if (
    message.includes('leie ut') ||
    message.includes('utleie') ||
    message.includes('vert') ||
    message.includes('formidling') ||
    message.includes('provisjon')
  ) {
    return 'host_rental';
  }

  if (
    message.includes('reisevilkar') ||
    message.includes('reisevilkår') ||
    message.includes('aldersgrense') ||
    message.includes('innsjekk') ||
    message.includes('utsjekk') ||
    message.includes('depositum') ||
    message.includes('avbestilling') ||
    message.includes('husregler')
  ) {
    return 'travel_terms';
  }

  if (
    message.includes('restaurant') ||
    message.includes('restauranter') ||
    message.includes('middag') ||
    message.includes('lunsj') ||
    message.includes('italiensk') ||
    message.includes('pizza')
  ) {
    return 'restaurant';
  }

  if (
    message.includes('shopping') ||
    message.includes('butikk') ||
    message.includes('butikker') ||
    message.includes('sportsklaer') ||
    message.includes('sportsklær') ||
    message.includes('klaer') ||
    message.includes('klær') ||
    message.includes('mote') ||
    message.includes('souvenir')
  ) {
    return 'shopping';
  }

  if (
    message.includes('aktivitet') ||
    message.includes('aktiviteter') ||
    message.includes('alpint') ||
    message.includes('langrenn') ||
    message.includes('museum') ||
    message.includes('spa') ||
    message.includes('massasje') ||
    message.includes('trening')
  ) {
    return 'activity';
  }

  return null;
}

function extractTravelTermsKeywords(messageRaw: string): string[] {
  const message = normalizeTravelHelperText(messageRaw);
  const keywords: string[] = [];

  if (message.includes('aldersgrense')) keywords.push('aldersgrense');
  if (message.includes('innsjekk') || message.includes('utsjekk')) keywords.push('innsjekk', 'utsjekk');
  if (message.includes('avbestilling')) keywords.push('avbestilling');
  if (message.includes('depositum')) keywords.push('depositum');
  if (message.includes('husregler')) keywords.push('husregler');
  if (message.includes('utleie') || message.includes('vert') || message.includes('formidling') || message.includes('provisjon')) {
    keywords.push('utleie', 'vert', 'formidling', 'provisjon');
  }

  return [...new Set(keywords)];
}

async function getTravelHelperContent(opts: {
  destinationSlug: string | null;
  category: string | null;
  language: string;
  message?: string;
}) {
  const destinationSlug = String(opts.destinationSlug || 'global').trim().toLowerCase();
  const category = opts.category ? String(opts.category).trim().toLowerCase() : null;
  const language = String(opts.language || 'nb').trim().toLowerCase();

  const { createClient } = await import('@supabase/supabase-js');

  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const supabaseKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('supabase_env_missing');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const runQuery = async (langToUse: string) => {
    let query = supabase
      .from('travel_helper_content')
      .select('*')
      .eq('is_active', true)
      .eq('language', langToUse)
      .in(
        'destination_slug',
        destinationSlug === 'global' ? ['global'] : [destinationSlug, 'global']
      )
      .order('is_featured', { ascending: false })
      .order('sort_order', { ascending: true })
      .limit(80);

    if (category) {
      query = query.eq('category', category);
    }

    if ((category === 'travel_terms' || category === 'host_rental') && opts.message) {
      const keywordHints = extractTravelTermsKeywords(opts.message);
      if (keywordHints.length > 0) {
        const orParts: string[] = [];
        for (const keyword of keywordHints) {
          orParts.push(`title.ilike.%${keyword}%`);
          orParts.push(`summary.ilike.%${keyword}%`);
          orParts.push(`body.ilike.%${keyword}%`);
        }
        query = query.or(orParts.join(','));
      }
    }

    return await query;
  };

  const languagesToTry: string[] = [];
  const pushLanguage = (value: string) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return;
    if (!languagesToTry.includes(normalized)) {
      languagesToTry.push(normalized);
    }
  };

  pushLanguage(language);

  if (language === 'nb') {
    pushLanguage('en');
  } else if (language === 'en') {
    pushLanguage('nb');
  } else {
    pushLanguage('en');
    pushLanguage('nb');
  }

  const merged: any[] = [];

  for (const langToUse of languagesToTry) {
    const { data, error } = await runQuery(langToUse);
    if (error) throw error;

    if (Array.isArray(data) && data.length > 0) {
      merged.push(...data);
    }
  }

  if (!Array.isArray(merged) || merged.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const deduped = merged.filter((item) => {
    const slug = String(item?.slug || '').trim();
    if (!slug) return false;
    if (seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });

  return deduped;
}

function normalizeTags(tags: any): string[] {
  return Array.isArray(tags)
    ? tags.map((t: any) => normalizeTravelHelperText(String(t || ''))).filter(Boolean)
    : [];
}

function isGuideLikeContentItem(item: any): boolean {
  const title = normalizeTravelHelperText(item?.title || '');
  const slug = normalizeTravelHelperText(item?.slug || '');
  const sourceType = normalizeTravelHelperText(item?.source_type || '');

  return (
    title.includes('restauranttips') ||
    title.includes('restauranter i') ||
    title.includes('shopping i') ||
    title.includes('shoppingtips') ||
    title.includes('aktiviteter i') ||
    title.includes('opplev ') ||
    slug.includes('guide-') ||
    sourceType === 'editorial'
  );
}

function scoreTravelContentSource(item: any): number {
  const sourceType = normalizeTravelHelperText(item?.source_type || '');

  if (sourceType === 'pdf_curation') return 120;
  if (sourceType === 'pdf') return 100;
  if (sourceType === 'curated') return 40;
  if (sourceType === 'bno') return 15;
  if (sourceType === 'editorial') return -20;

  return 0;
}

function extractRestaurantPreferenceKeywords(
  messageRaw: string,
  history: any[] = []
): string[] {
  const text = normalizeTravelHelperText(
    `${getPreviousUserMessage(history)}\n${getLastUserMessage(history)}\n${messageRaw}`
  );

  const keywords: string[] = [];

  if (text.includes('italiensk')) keywords.push('italiensk', 'italian', 'pizza', 'pasta');
  if (text.includes('familierestaurant') || text.includes('familie')) {
    keywords.push('familie', 'family', 'barn');
  }
  if (text.includes('romantisk')) keywords.push('romantisk', 'romantic', 'par', 'couples');
  if (text.includes('lunsj')) keywords.push('lunsj', 'lunch');
  if (text.includes('middag')) keywords.push('middag', 'dinner');
  if (text.includes('fine dining')) keywords.push('fine dining', 'premium', 'luxury');
  if (text.includes('pris spiller ingen rolle')) {
    keywords.push('premium', 'fine dining', 'luxury');
  }
  if (text.includes('rimelig') || text.includes('billig')) {
    keywords.push('rimelig', 'casual', 'budget');
  }
  if (text.includes('sentrum')) keywords.push('sentrum', 'center', 'centrum');
  if (text.includes('bakken') || text.includes('ski in') || text.includes('ski-in')) {
    keywords.push('bakken', 'slope', 'ski');
  }

  return [...new Set(keywords)];
}

function extractShoppingPreferenceKeywords(
  messageRaw: string,
  history: any[] = []
): string[] {
  const text = normalizeTravelHelperText(
    `${getPreviousUserMessage(history)}\n${getLastUserMessage(history)}\n${messageRaw}`
  );

  const keywords: string[] = [];

  if (text.includes('sportsklaer') || text.includes('sportsklær')) {
    keywords.push('sportsklaer', 'sportsklær', 'sportswear');
  }
  if (text.includes('skiutstyr') || text.includes('sportsutstyr')) {
    keywords.push('skiutstyr', 'sportsutstyr', 'ski', 'outdoor');
  }
  if (text.includes('klaer') || text.includes('klær')) {
    keywords.push('klaer', 'klær', 'fashion', 'apparel');
  }
  if (text.includes('mote')) keywords.push('mote', 'fashion', 'design');
  if (text.includes('gaver') || text.includes('souvenir')) {
    keywords.push('gaver', 'souvenir', 'gifts');
  }
  if (text.includes('dagligvarer')) keywords.push('dagligvarer', 'groceries');

  return [...new Set(keywords)];
}

function extractActivityPreferenceKeywords(
  messageRaw: string,
  history: any[] = []
): string[] {
  const text = normalizeTravelHelperText(
    `${getPreviousUserMessage(history)}\n${getLastUserMessage(history)}\n${messageRaw}`
  );

  const keywords: string[] = [];

  if (text.includes('ski') || text.includes('alpint')) {
    keywords.push('ski', 'alpint', 'alpine');
  }
  if (text.includes('langrenn')) {
    keywords.push('langrenn', 'cross-country');
  }
  if (text.includes('familie') || text.includes('barn')) {
    keywords.push('familie', 'family', 'barn');
  }
  if (text.includes('spa') || text.includes('wellness')) {
    keywords.push('spa', 'wellness');
  }
  if (text.includes('snoscooter') || text.includes('snøscooter')) {
    keywords.push('snoscooter', 'snøscooter', 'snowmobile');
  }
  if (text.includes('vinter')) {
    keywords.push('winter', 'vinter');
  }
  if (text.includes('sommer')) {
    keywords.push('summer', 'sommer');
  }

  return [...new Set(keywords)];
}

function scoreSeasonalContentItem(
  item: any,
  season: 'winter' | 'summer' | 'unknown',
  messageRaw: string,
  history: any[] = []
): number {
  const title = normalizeTravelHelperText(item?.title || '');
  const summary = normalizeTravelHelperText(item?.summary || '');
  const body = normalizeTravelHelperText(item?.body || '');
  const tags = normalizeTags(item?.tags);
  const text = `${title} ${summary} ${body} ${tags.join(' ')}`;

  let score = 0;

  if (item?.is_featured) score += 20;
  score += scoreTravelContentSource(item);

  if (season === 'winter') {
    if (
      text.includes('winter') ||
      text.includes('vinter') ||
      text.includes('ski') ||
      text.includes('alpint') ||
      text.includes('langrenn') ||
      text.includes('snow') ||
      tags.includes('winter') ||
      tags.includes('vinter') ||
      tags.includes('year_round') ||
      tags.includes('helar')
    ) {
      score += 50;
    }
  }

  if (season === 'summer') {
    if (
      text.includes('summer') ||
      text.includes('sommer') ||
      text.includes('hiking') ||
      text.includes('vandring') ||
      text.includes('bike') ||
      text.includes('sykkel') ||
      tags.includes('summer') ||
      tags.includes('sommer') ||
      tags.includes('year_round') ||
      tags.includes('helar')
    ) {
      score += 50;
    }
  }

  if (item?.category === 'restaurant') {
    const prefs = extractRestaurantPreferenceKeywords(messageRaw, history);
    for (const pref of prefs) {
      if (text.includes(normalizeTravelHelperText(pref))) score += 40;
    }

    if (isGuideLikeContentItem(item)) score -= 60;
    else score += 40;
  }

  if (item?.category === 'shopping') {
    const prefs = extractShoppingPreferenceKeywords(messageRaw, history);
    for (const pref of prefs) {
      if (text.includes(normalizeTravelHelperText(pref))) score += 40;
    }

    if (isGuideLikeContentItem(item)) score -= 60;
    else score += 40;
  }

  if (item?.category === 'activity') {
    const prefs = extractActivityPreferenceKeywords(messageRaw, history);
    for (const pref of prefs) {
      if (text.includes(normalizeTravelHelperText(pref))) score += 35;
    }

    if (isGuideLikeContentItem(item)) score -= 30;
    else score += 20;
  }

  return score;
}

function filterAndRankTravelContentForSeason(
  items: any[],
  season: 'winter' | 'summer' | 'unknown',
  messageRaw: string,
  history: any[] = []
): any[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  return items
    .filter((item) => item && item.is_active !== false)
    .map((item) => ({
      ...item,
      __seasonScore: scoreSeasonalContentItem(item, season, messageRaw, history),
    }))
    .sort((a, b) => {
      const diff = Number(b.__seasonScore || 0) - Number(a.__seasonScore || 0);
      if (diff !== 0) return diff;
      return Number(a?.sort_order || 0) - Number(b?.sort_order || 0);
    });
}

function prioritizeTravelTermItems(items: any[], messageRaw: string): any[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const message = normalizeTravelHelperText(messageRaw);

  return items
    .map((item: any) => {
      const text = normalizeTravelHelperText(
        `${item?.title || ''} ${item?.summary || ''} ${item?.body || ''}`
      );
      let score = 0;

      if (message.includes('aldersgrense') && text.includes('aldersgrense')) score += 100;
      if (
        (message.includes('innsjekk') || message.includes('utsjekk')) &&
        (text.includes('innsjekk') || text.includes('utsjekk'))
      ) {
        score += 100;
      }
      if (message.includes('depositum') && text.includes('depositum')) score += 100;
      if (
        (message.includes('utleie') || message.includes('vert')) &&
        (text.includes('utleie') || text.includes('vert'))
      ) {
        score += 100;
      }

      return { ...item, __priorityScore: score };
    })
    .sort(
      (a: any, b: any) => Number(b.__priorityScore || 0) - Number(a.__priorityScore || 0)
    );
}

function buildTravelContentContext(items: any[]): string {
  if (!Array.isArray(items) || items.length === 0) return '';

  const lines = [
    'BNO_CONTENT_CONTEXT',
    'Dette er verifisert innhold fra BNO Travel sitt innholdslager.',
    'Bruk dette aktivt når du svarer.',
    'Prioriter dette før generelle råd.',
    'Ikke dikt opp konkrete produkter, priser eller tilgjengelighet som ikke står her.',
    '',
  ];

  items.forEach((item, index) => {
    lines.push(`INNHOLD_${index + 1}`);
    lines.push(`SLUG: ${item?.slug || ''}`);
    lines.push(`TITTEL: ${item?.title || ''}`);
    lines.push(`DESTINASJON: ${item?.destination_slug || ''}`);
    lines.push(`KATEGORI: ${item?.category || ''}`);
    lines.push(`SOURCE_TYPE: ${item?.source_type || ''}`);
    lines.push(`SAMMENDRAG: ${item?.summary || ''}`);
    lines.push(`BRØDTEKST: ${item?.body || ''}`);
    lines.push(`TAGS: ${Array.isArray(item?.tags) ? item.tags.join(', ') : ''}`);
    lines.push(`APP_ROUTE: ${item?.app_route || ''}`);
    lines.push(`EXTERNAL_URL: ${item?.external_url || ''}`);
    lines.push('');
  });

  return lines.join('\n');
}

function detectTravelFlightIntent(messageRaw: string): boolean {
  const message = normalizeTravelHelperText(messageRaw);

  const keywords = [
    'fly',
    'flight',
    'flybillett',
    'flybilletter',
    'flyreise',
    'avganger',
    'avgang',
    'returfly',
    'direktefly',
    'fly fra',
    'flight from',
  ];

  return keywords.some((word) => message.includes(word));
}

function isTravelHelperFlightBookingIntent(messageRaw: string): boolean {
  const message = normalizeTravelHelperText(messageRaw);

  const phrases = [
    'bestill flyet',
    'book flyet',
    'bestill det flyet',
    'jeg vil bestille flyet',
    'jeg vil booke flyet',
    'bestill det første flyet',
    'book det første flyet',
    'det første',
    'nummer 1',
    'ja',
    'ja takk',
  ];

  return phrases.some((phrase) => message.includes(phrase) || message === phrase);
}

function extractTravelFlightCabinClass(
  messageRaw: string
): 'economy' | 'premium_economy' | 'business' | 'first' {
  const message = normalizeTravelHelperText(messageRaw);

  if (message.includes('premium economy') || message.includes('premium_economy')) {
    return 'premium_economy';
  }
  if (message.includes('business')) return 'business';
  if (
    message.includes('first class') ||
    message.includes('første klasse') ||
    message.includes('forste klasse')
  ) {
    return 'first';
  }

  return 'economy';
}

function extractTravelFlightDirectOnly(messageRaw: string): boolean {
  const message = normalizeTravelHelperText(messageRaw);

  return (
    message.includes('direktefly') ||
    message.includes('direkte fly') ||
    message.includes('kun direkte') ||
    message.includes('uten mellomlanding') ||
    message.includes('nonstop')
  );
}

function mapTravelFlightPlaceToCode(
  messageRaw: string,
  kind: 'origin' | 'destination'
): string | null {
  const bounded = normalizeTravelHelperText(extractBoundedPlace(messageRaw, kind));
  const allText = normalizeTravelHelperText(messageRaw);

  const mappings: Array<{ keywords: string[]; code: string }> = [
    { keywords: ['oslo', 'gardermoen', 'osl'], code: 'OSL' },
    { keywords: ['trondheim', 'vaernes', 'værnes', 'trd'], code: 'TRD' },
    { keywords: ['bergen', 'flesland', 'bgo'], code: 'BGO' },
    { keywords: ['alesund', 'ålesund', 'vigra', 'aes'], code: 'AES' },
    { keywords: ['london', 'lon'], code: 'LON' },
    { keywords: ['heathrow', 'lhr'], code: 'LHR' },
    { keywords: ['gatwick', 'lgw'], code: 'LGW' },
    { keywords: ['luton', 'ltn'], code: 'LTN' },
    { keywords: ['amsterdam', 'schiphol', 'ams'], code: 'AMS' },
    { keywords: ['kobenhavn', 'københavn', 'copenhagen', 'cph'], code: 'CPH' },
    { keywords: ['stockholm', 'arlanda', 'arn'], code: 'ARN' },
    { keywords: ['paris', 'cdg'], code: 'PAR' },
    { keywords: ['rome', 'roma', 'fco'], code: 'ROM' },
    { keywords: ['miami', 'mia'], code: 'MIA' },
    { keywords: ['los angeles', 'lax'], code: 'LAX' },
    { keywords: ['salen', 'sälen', 'scr'], code: 'SCR' },
    { keywords: ['dublin', 'dub'], code: 'DUB' },
  ];

  if (bounded) {
    for (const item of mappings) {
      if (
        item.keywords.some((keyword) =>
          bounded.includes(normalizeTravelHelperText(keyword))
        )
      ) {
        return item.code;
      }
    }
  }

  for (const item of mappings) {
    if (
      item.keywords.some((keyword) =>
        allText.includes(normalizeTravelHelperText(keyword))
      )
    ) {
      return item.code;
    }
  }

  return null;
}

function inferAirportFromTravelArea(area: string | null): string | null {
  const normalized = String(area || '').trim().toLowerCase();

  if (!normalized) return null;

  if (
    normalized === 'trysil' ||
    normalized === 'trysil-sentrum' ||
    normalized === 'trysil-turistsenter' ||
    normalized === 'trysil-hoyfjellssenter' ||
    normalized === 'trysilfjell-hytteomrade'
  ) {
    return 'OSL';
  }

  if (
    normalized === 'stranda' ||
    normalized === 'sunnmorsalpene' ||
    normalized === 'geiranger'
  ) {
    return 'AES';
  }

  if (normalized === 'salen') return 'SCR';
  if (normalized === 'oslo') return 'OSL';
  if (normalized === 'london') return 'LON';
  if (normalized === 'amsterdam') return 'AMS';
  if (normalized === 'copenhagen') return 'CPH';
  if (normalized === 'stockholm') return 'ARN';
  if (normalized === 'losangeles') return 'LAX';
  if (normalized === 'miami') return 'MIA';
  if (normalized === 'paris') return 'PAR';
  if (normalized === 'rome') return 'ROM';
  if (normalized === 'dublin') return 'DUB';

  return null;
}

function extractTravelFlightSearchParams(messageRaw: string, history: any[]) {
  const currentMessage = String(messageRaw || '').trim();
  const previous = getPreviousUserMessage(history);
  const datesFromCurrent = extractTravelHelperDates(currentMessage);
  const datesFromPrevious = extractTravelHelperDates(previous);

  const departureDate = datesFromCurrent.from || datesFromPrevious.from || null;
  const returnDate = datesFromCurrent.to || datesFromPrevious.to || null;

  const adults =
    extractTravelHelperAdults(currentMessage) ||
    extractTravelHelperAdults(previous) ||
    1;

  let origin = mapTravelFlightPlaceToCode(currentMessage, 'origin');
  let destination = mapTravelFlightPlaceToCode(currentMessage, 'destination');

  if (!origin) origin = mapTravelFlightPlaceToCode(previous, 'origin');
  if (!destination) destination = mapTravelFlightPlaceToCode(previous, 'destination');

  const cabinClass = extractTravelFlightCabinClass(`${previous}\n${currentMessage}`);
  const directOnly = extractTravelFlightDirectOnly(`${previous}\n${currentMessage}`);

  return {
    origin,
    destination,
    departureDate,
    returnDate,
    adults,
    cabinClass,
    directOnly,
  };
}

function formatFlightTime(value?: string | null): string {
  if (!value) return '-';

  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return String(value);
  }
}

function getFlightSliceSummary(slice?: any) {
  const segments = Array.isArray(slice?.segments) ? slice.segments : [];
  const first = segments[0];
  const last = segments[segments.length - 1];

  return {
    origin: first?.origin?.iata_code || '',
    destination: last?.destination?.iata_code || '',
    departure: first?.departing_at || null,
    arrival: last?.arriving_at || null,
    airline:
      first?.marketing_carrier?.name ||
      first?.operating_carrier?.name ||
      slice?.owner?.name ||
      '',
    stops: Math.max(0, segments.length - 1),
  };
}

function rankFlightOffersForTrip(offers: any[], messageRaw: string): any[] {
  const message = normalizeTravelHelperText(messageRaw);

  return [...(Array.isArray(offers) ? offers : [])].sort((a: any, b: any) => {
    const aOut = getFlightSliceSummary(a?.slices?.[0]);
    const bOut = getFlightSliceSummary(b?.slices?.[0]);

    let aScore = 0;
    let bScore = 0;

    if (message.includes('direkte')) {
      if (aOut.stops === 0) aScore += 30;
      if (bOut.stops === 0) bScore += 30;
    }

    const aPrice = Number(
      a?.total_with_fee ?? a?.total_amount ?? Number.MAX_SAFE_INTEGER
    );
    const bPrice = Number(
      b?.total_with_fee ?? b?.total_amount ?? Number.MAX_SAFE_INTEGER
    );

    if (Number.isFinite(aPrice)) aScore += 10;
    if (Number.isFinite(bPrice)) bScore += 10;

    if (aScore !== bScore) return bScore - aScore;
    return aPrice - bPrice;
  });
}

function buildFlightContextText(offers: any[], searchParams: any): string {
  const safeOffers = Array.isArray(offers) ? offers.slice(0, 10) : [];

  if (safeOffers.length === 0) {
    return [
      'BNO_FLIGHT_CONTEXT',
      'Ingen flytilbud funnet.',
      `Fra: ${searchParams?.origin || '-'}`,
      `Til: ${searchParams?.destination || '-'}`,
      `Utreise: ${searchParams?.departureDate || '-'}`,
      `Retur: ${searchParams?.returnDate || '-'}`,
      `Voksne: ${searchParams?.adults || '-'}`,
      '',
      'INSTRUKS:',
      '- Ikke dikt opp flyalternativer',
      '- Si tydelig at ingen treff ble funnet',
      '- Foreslå justering av datoer, flyplass eller direktefly-filter',
    ].join('\n');
  }

  const lines = [
    'BNO_FLIGHT_CONTEXT',
    'Dette er ekte flytilbud fra Duffel via BNO Travel.',
    'Bruk kun disse flydataene som grunnlag.',
    'Ikke dikt opp priser, tider, flyselskap eller stopp.',
    `Fra: ${searchParams?.origin || '-'}`,
    `Til: ${searchParams?.destination || '-'}`,
    `Utreise: ${searchParams?.departureDate || '-'}`,
    `Retur: ${searchParams?.returnDate || '-'}`,
    `Voksne: ${searchParams?.adults || '-'}`,
    `Kabinklasse: ${searchParams?.cabinClass || 'economy'}`,
    `Kun direkte: ${searchParams?.directOnly ? 'ja' : 'nei'}`,
    '',
  ];

  safeOffers.forEach((offer: any, index: number) => {
    const outbound = getFlightSliceSummary(offer?.slices?.[0]);
    const returnTrip = getFlightSliceSummary(offer?.slices?.[1]);

    lines.push(`FLIGHT_${index + 1}`);
    lines.push(`OFFER_ID: ${offer?.id || ''}`);
    lines.push(
      `FLYSELSKAP: ${offer?.owner?.name || outbound.airline || 'Ukjent'}`
    );
    lines.push(`PRIS: ${offer?.total_amount || '-'} ${offer?.total_currency || ''}`);
    lines.push(`SERVICE_FEE: ${offer?.service_fee_amount ?? '-'}`);
    lines.push(`TOTAL_WITH_FEE: ${offer?.total_with_fee ?? '-'}`);
    lines.push(
      `UTREISE: ${outbound.origin} ${formatFlightTime(
        outbound.departure
      )} -> ${outbound.destination} ${formatFlightTime(outbound.arrival)}`
    );
    lines.push(`UTREISE_STOPP: ${outbound.stops}`);

    if (returnTrip?.origin || returnTrip?.destination) {
      lines.push(
        `RETUR: ${returnTrip.origin} ${formatFlightTime(
          returnTrip.departure
        )} -> ${returnTrip.destination} ${formatFlightTime(returnTrip.arrival)}`
      );
      lines.push(`RETUR_STOPP: ${returnTrip.stops}`);
    }

    lines.push('');
  });

  lines.push('INSTRUKS:');
  lines.push('- Hvis brukeren vil bestille et bestemt alternativ, velg riktig nummer.');
  lines.push('- Forstå "nr 2", "alternativ 2", "det andre", "British Airways" osv.');
  lines.push('- Hvis brukeren ber om flere alternativer, vis neste tilbud fra listen som ikke allerede er vist først.');
  lines.push('- Ikke svar som om bare første alternativ kan bestilles.');

  return lines.join('\n');
}

function findRequestedFlightOfferFromMessage(messageRaw: string, offers: any[]): any | null {
  if (!Array.isArray(offers) || offers.length === 0) return null;

  const message = normalizeTravelHelperText(messageRaw);

  const airlineMatch = offers.find((offer) => {
    const airline = normalizeTravelHelperText(
      offer?.owner?.name ||
        getFlightSliceSummary(offer?.slices?.[0])?.airline ||
        ''
    );
    return airline && message.includes(airline);
  });
  if (airlineMatch) return airlineMatch;

  const numberMatch =
    message.match(/\bnr\.?\s*(\d+)\b/) ||
    message.match(/\bnummer\s+(\d+)\b/) ||
    message.match(/\balternativ\s+(\d+)\b/) ||
    message.match(/\boption\s+(\d+)\b/);

  if (numberMatch?.[1]) {
    const idx = Number(numberMatch[1]) - 1;
    if (idx >= 0 && idx < offers.length) {
      return offers[idx];
    }
  }

  if (
    message.includes('første') ||
    message.includes('forste') ||
    message.includes('nummer 1') ||
    message.includes('1.')
  ) {
    return offers[0] || null;
  }
  if (
    message.includes('andre') ||
    message.includes('nummer 2') ||
    message.includes('2.')
  ) {
    return offers[1] || offers[0] || null;
  }
  if (
    message.includes('tredje') ||
    message.includes('nummer 3') ||
    message.includes('3.')
  ) {
    return offers[2] || offers[0] || null;
  }
  if (
    message.includes('fjerde') ||
    message.includes('nummer 4') ||
    message.includes('4.')
  ) {
    return offers[3] || offers[0] || null;
  }
  if (
    message.includes('femte') ||
    message.includes('nummer 5') ||
    message.includes('5.')
  ) {
    return offers[4] || offers[0] || null;
  }

  return offers[0] || null;
}

function pickTransportSuggestion(area: string | null): string | null {
  const normalized = String(area || '').trim().toLowerCase();

  if (normalized === 'trysil' || normalized.startsWith('trysil-')) {
    return 'Leiebil via BNO Travel eller buss fra Oslo/Gardermoen til Trysil.';
  }
  if (normalized === 'amsterdam') {
    return 'Tog, trikk eller taxi fra Schiphol videre inn til sentrum.';
  }
  if (normalized === 'london') {
    return 'Tog, Underground eller taxi fra flyplassen videre inn til byen.';
  }
  if (normalized === 'oslo') {
    return 'Tog, Flytoget, buss eller taxi fra flyplassen videre inn til sentrum.';
  }
  if (
    normalized === 'stranda' ||
    normalized === 'sunnmorsalpene' ||
    normalized === 'geiranger'
  ) {
    return 'Leiebil anbefales fra Ålesund eller nærmeste ankomstpunkt.';
  }

  return null;
}

function buildTripProposalContextText(proposal: TripProposal | null): string {
  if (!proposal) return '';

  const lines: string[] = [
    'BNO_TRIP_PROPOSAL_CONTEXT',
    'Dette er et strukturert reiseforslag laget av BNO Travel backend.',
    'Bruk dette som grunnlag for å presentere et konkret forslag.',
    '',
  ];

  lines.push(`DESTINASJON: ${proposal.destination?.label || '-'}`);
  lines.push(`SESONG: ${proposal.destination?.season || 'unknown'}`);
  lines.push(`TRANSPORT: ${proposal.transport || '-'}`);
  lines.push('');

  if (proposal.accommodation) {
    lines.push('ANBEFALT_OVERNATTING');
    lines.push(
      `NAVN: ${proposal.accommodation?.Name || proposal.accommodation?.name || '-'}`
    );
    lines.push(
      `OMRÅDE: ${
        proposal.accommodation?.ServiceName ||
        proposal.accommodation?.serviceName ||
        '-'
      }`
    );
    lines.push(
      `PRIS: ${
        proposal.accommodation?.PriceTotal != null &&
        proposal.accommodation?.PriceCurrency
          ? `${proposal.accommodation.PriceTotal} ${proposal.accommodation.PriceCurrency}`
          : proposal.accommodation?.priceTotal != null &&
              proposal.accommodation?.priceCurrency
            ? `${proposal.accommodation.priceTotal} ${proposal.accommodation.priceCurrency}`
            : '-'
      }`
    );
    lines.push(
      `KAPASITET: ${
        proposal.accommodation?.Capacity ?? proposal.accommodation?.capacity ?? '-'
      }`
    );
    lines.push(
      `BESKRIVELSE: ${
        proposal.accommodation?.Description ||
        proposal.accommodation?.description ||
        ''
      }`
    );
    lines.push('');
  }

  if (proposal.flight) {
    const outbound = getFlightSliceSummary(proposal.flight?.slices?.[0]);
    const returnTrip = getFlightSliceSummary(proposal.flight?.slices?.[1]);

    lines.push('ANBEFALT_FLY');
    lines.push(`FLYSELSKAP: ${proposal.flight?.owner?.name || outbound.airline || '-'}`);
    lines.push(
      `PRIS: ${
        proposal.flight?.total_with_fee ?? proposal.flight?.total_amount ?? '-'
      } ${proposal.flight?.total_currency || ''}`
    );
    lines.push(
      `UTREISE: ${outbound.origin} ${formatFlightTime(
        outbound.departure
      )} -> ${outbound.destination} ${formatFlightTime(outbound.arrival)}`
    );
    if (returnTrip?.origin || returnTrip?.destination) {
      lines.push(
        `RETUR: ${returnTrip.origin} ${formatFlightTime(
          returnTrip.departure
        )} -> ${returnTrip.destination} ${formatFlightTime(returnTrip.arrival)}`
      );
    }
    lines.push('');
  }

  if (proposal.activities.length > 0) {
    lines.push('AKTIVITETER');
    proposal.activities.forEach((item: any, index: number) => {
      lines.push(`AKTIVITET_${index + 1}: ${item?.title || '-'}`);
      lines.push(`SAMMENDRAG_${index + 1}: ${item?.summary || ''}`);
    });
    lines.push('');
  }

  if (proposal.restaurants.length > 0) {
    lines.push('RESTAURANTER');
    proposal.restaurants.forEach((item: any, index: number) => {
      lines.push(`RESTAURANT_${index + 1}: ${item?.title || '-'}`);
      lines.push(`SAMMENDRAG_${index + 1}: ${item?.summary || ''}`);
    });
    lines.push('');
  }

  if (proposal.shopping.length > 0) {
    lines.push('SHOPPING');
    proposal.shopping.forEach((item: any, index: number) => {
      lines.push(`SHOPPING_${index + 1}: ${item?.title || '-'}`);
      lines.push(`SAMMENDRAG_${index + 1}: ${item?.summary || ''}`);
    });
    lines.push('');
  }

  if (proposal.itinerary.length > 0) {
    lines.push('DAGSPROGRAM');
    proposal.itinerary.forEach((day) => {
      lines.push(`DAG_${day.day}: ${day.title}`);
      day.items.forEach((item) => lines.push(`- ${item}`));
    });
  }

  return lines.join('\n');
}

function inferDestinationLabel(destinationSlug: string): string {
  const map: Record<string, string> = {
    trysil: 'Trysil',
    stranda: 'Stranda',
    salen: 'Sälen',
    oslo: 'Oslo',
    london: 'London',
    amsterdam: 'Amsterdam',
    copenhagen: 'København',
    stockholm: 'Stockholm',
    losangeles: 'Los Angeles',
    miami: 'Miami',
    paris: 'Paris',
    rome: 'Roma',
    dublin: 'Dublin',
    global: 'Ukjent destinasjon',
  };
  return map[destinationSlug] || destinationSlug || 'Ukjent destinasjon';
}

async function buildTripProposal(opts: {
  message: string;
  history: any[];
  lang: string;
  includeAccommodation: boolean;
  availabilityRows: any[];
  availabilityParams: any | null;
  flightOffers: any[];
  flightSearch: any | null;
}): Promise<TripProposal | null> {
  const message = String(opts.message || '');
  const destinationArea = extractTripDestinationArea(message, opts.history);
  const destinationSlug = mapTravelHelperAreaToContentDestinationSlug(destinationArea);
  const destinationLabel = inferDestinationLabel(destinationSlug);
  const season = detectTravelSeason(message, extractTravelHelperDates(message));

  const adults = opts.availabilityParams?.adults || extractTravelHelperAdults(message) || null;

  const rankedAccommodation = opts.includeAccommodation
    ? rankTravelHelperAvailabilityRows(opts.availabilityRows || [], adults, message)
    : [];
  const selectedAccommodation = opts.includeAccommodation
    ? rankedAccommodation[0] || null
    : null;

  const rankedFlights = rankFlightOffersForTrip(opts.flightOffers || [], message);
  const selectedFlight = rankedFlights[0] || null;

  let allActivities: any[] = [];
  let allRestaurants: any[] = [];
  let allShopping: any[] = [];

  try {
    const [activityItems, restaurantItems, shoppingItems] = await Promise.all([
      getTravelHelperContent({
        destinationSlug,
        category: 'activity',
        language: opts.lang,
        message,
      }),
      getTravelHelperContent({
        destinationSlug,
        category: 'restaurant',
        language: opts.lang,
        message,
      }),
      getTravelHelperContent({
        destinationSlug,
        category: 'shopping',
        language: opts.lang,
        message,
      }),
    ]);

    allActivities = filterAndRankTravelContentForSeason(
      activityItems,
      season,
      message,
      opts.history
    ).slice(0, 6);

    allRestaurants = filterAndRankTravelContentForSeason(
      restaurantItems,
      season,
      message,
      opts.history
    ).slice(0, 6);

    allShopping = filterAndRankTravelContentForSeason(
      shoppingItems,
      season,
      message,
      opts.history
    ).slice(0, 6);
  } catch (e) {
    console.error('buildTripProposal content fetch failed', e);
  }

  const transport = pickTransportSuggestion(destinationArea);

  const itinerary: Array<{ day: number; title: string; items: string[] }> = [];

  itinerary.push({
    day: 1,
    title: 'Forslag for første dag',
    items: [
      selectedFlight
        ? 'Reis med anbefalt fly og gå videre til destinasjonen.'
        : 'Ankomst til destinasjonen.',
      transport || 'Planlegg transport videre fra ankomststedet.',
      selectedAccommodation
        ? `Sjekk inn på ${
            selectedAccommodation?.Name ||
            selectedAccommodation?.name ||
            'anbefalt overnatting'
          }.`
        : 'Bruk dagen til å komme på plass på destinasjonen.',
      allRestaurants[0]?.title
        ? `Middagstips: ${allRestaurants[0].title}.`
        : 'Avslutt dagen med en god middag.',
    ],
  });

  if (allActivities[0] || allRestaurants[1] || allShopping[0]) {
    itinerary.push({
      day: 2,
      title: 'Forslag for dag to',
      items: [
        allActivities[0]?.title
          ? `Aktivitet: ${allActivities[0].title}.`
          : 'Utforsk aktiviteter på destinasjonen.',
        allRestaurants[1]?.title
          ? `Restauranttips: ${allRestaurants[1].title}.`
          : 'Velg et sted for lunsj eller middag.',
        allShopping[0]?.title
          ? `Shoppingtips: ${allShopping[0].title}.`
          : 'Ta en runde i nærområdet for shopping eller lokale stopp.',
      ],
    });
  }

  if (allActivities[1] || allShopping[1]) {
    itinerary.push({
      day: 3,
      title: 'Forslag for dag tre',
      items: [
        allActivities[1]?.title
          ? `Formiddagstips: ${allActivities[1].title}.`
          : 'Bruk dagen på en ny opplevelse.',
        allShopping[1]?.title
          ? `Et siste stopp: ${allShopping[1].title}.`
          : 'Bruk litt tid på lokale stopp før hjemreise.',
        'Dette er kun et enkelt forslag for de første dagene av reisen.',
      ],
    });
  }

  const summary: string[] = [];

  if (selectedFlight) {
    summary.push('Det finnes et konkret flyforslag som matcher reisen.');
  }
  if (selectedAccommodation) {
    summary.push(
      `${
        selectedAccommodation?.Name ||
        selectedAccommodation?.name ||
        'Anbefalt overnatting'
      } ser ut til å passe godt for reisefølget.`
    );
  }
  if (allActivities.length > 0) {
    summary.push(`Fant ${allActivities.length} relevante aktivitetsforslag.`);
  }
  if (allRestaurants.length > 0) {
    summary.push(`Fant ${allRestaurants.length} relevante restaurantforslag.`);
  }
  if (allShopping.length > 0) {
    summary.push(`Fant ${allShopping.length} relevante shoppingforslag.`);
  }

  return {
    destination: {
      area: destinationArea || null,
      destinationSlug,
      label: destinationLabel,
      season,
    },
    accommodation: selectedAccommodation,
    flight: selectedFlight,
    activities: allActivities,
    restaurants: allRestaurants,
    shopping: allShopping,
    transport,
    itinerary,
    summary,
  };
}

function formatContentLinkSuffix(item: any): string {
  const bits: string[] = [];
  if (item?.external_url) bits.push(`Lenke: ${item.external_url}`);
  return bits.length ? ` (${bits.join(' · ')})` : '';
}

function buildDeterministicRestaurantReply(
  items: any[],
  messageRaw: string,
  history: any[]
): string {
  const ranked = filterAndRankTravelContentForSeason(
    items || [],
    'unknown',
    messageRaw,
    history
  );
  const concrete = ranked.filter((item) => !isGuideLikeContentItem(item));
  const preferred = concrete.length > 0 ? concrete.slice(0, 6) : ranked.slice(0, 6);

  if (preferred.length === 0) {
    return 'Jeg fant dessverre ingen verifiserte restaurantforslag akkurat nå. Du kan gjerne prøve med destinasjon eller ønsket type mat.';
  }

  const lines: string[] = ['Her er noen verifiserte restaurantforslag fra BNO Travel:', ''];

  preferred.forEach((item: any, index: number) => {
    lines.push(`${index + 1}. ${item?.title || 'Ukjent restaurant'}`);
    if (item?.summary) lines.push(`- ${item.summary}`);
    const suffix = formatContentLinkSuffix(item);
    if (suffix) lines.push(`- ${suffix}`);
    lines.push('');
  });

  return lines.join('\n');
}

function buildDeterministicShoppingReply(
  items: any[],
  messageRaw: string,
  history: any[]
): string {
  const ranked = filterAndRankTravelContentForSeason(
    items || [],
    'unknown',
    messageRaw,
    history
  );
  const concrete = ranked.filter((item) => !isGuideLikeContentItem(item));
  const preferred = concrete.length > 0 ? concrete.slice(0, 6) : ranked.slice(0, 6);

  if (preferred.length === 0) {
    return 'Jeg fant dessverre ingen verifiserte shoppingforslag akkurat nå. Du kan gjerne prøve med destinasjon eller type shopping.';
  }

  const lines: string[] = ['Her er noen verifiserte shoppingforslag fra BNO Travel:', ''];

  preferred.forEach((item: any, index: number) => {
    lines.push(`${index + 1}. ${item?.title || 'Ukjent shoppingsted'}`);
    if (item?.summary) lines.push(`- ${item.summary}`);
    const suffix = formatContentLinkSuffix(item);
    if (suffix) lines.push(`- ${suffix}`);
    lines.push('');
  });

  return lines.join('\n');
}

function buildDeterministicActivityReply(
  items: any[],
  messageRaw: string,
  history: any[]
): string {
  const ranked = filterAndRankTravelContentForSeason(
    items || [],
    'unknown',
    messageRaw,
    history
  );
  const preferred = ranked.filter((item) => !isGuideLikeContentItem(item)).slice(0, 6);

  if (preferred.length === 0) {
    return 'Jeg fant dessverre ingen verifiserte aktivitetsforslag akkurat nå.';
  }

  const lines: string[] = ['Her er noen verifiserte aktivitetsforslag fra BNO Travel:', ''];

  preferred.forEach((item: any, index: number) => {
    lines.push(`${index + 1}. ${item?.title || 'Ukjent aktivitet'}`);
    if (item?.summary) lines.push(`- ${item.summary}`);
    const suffix = formatContentLinkSuffix(item);
    if (suffix) lines.push(`- ${suffix}`);
    lines.push('');
  });

  return lines.join('\n');
}

function buildDeterministicTripPackageReply(opts: {
  tripProposal: TripProposal | null;
  includeAccommodation: boolean;
}): string {
  const proposal = opts.tripProposal;
  if (!proposal) {
    return 'Beklager, jeg fikk ikke laget et samlet reiseforslag akkurat nå.';
  }

  const lines: string[] = [
    `Her er et samlet reiseforslag til ${proposal.destination?.label || 'destinasjonen'}:`,
    '',
  ];

  if (proposal.flight) {
    const outbound = getFlightSliceSummary(proposal.flight?.slices?.[0]);
    const returnTrip = getFlightSliceSummary(proposal.flight?.slices?.[1]);

    lines.push('Fly:');
    lines.push(
      `- ${
        proposal.flight?.owner?.name || outbound.airline || 'Ukjent flyselskap'
      }: ${outbound.origin} ${formatFlightTime(outbound.departure)} -> ${
        outbound.destination
      } ${formatFlightTime(outbound.arrival)}`
    );
    if (returnTrip?.origin || returnTrip?.destination) {
      lines.push(
        `- Retur: ${returnTrip.origin} ${formatFlightTime(
          returnTrip.departure
        )} -> ${returnTrip.destination} ${formatFlightTime(returnTrip.arrival)}`
      );
    }
    lines.push(
      `- Pris: ${
        proposal.flight?.total_with_fee ?? proposal.flight?.total_amount ?? '-'
      } ${proposal.flight?.total_currency || ''}`
    );
    lines.push('- Flybestilling fullføres via bookingknappen i appen.');
    lines.push('');
  } else {
    lines.push('Fly:');
    lines.push('- Jeg fant ikke et verifisert flyforslag akkurat nå.');
    lines.push('');
  }

  if (opts.includeAccommodation) {
    lines.push('Overnatting:');
    if (proposal.accommodation) {
      lines.push(
        `- ${
          proposal.accommodation?.Name ||
          proposal.accommodation?.name ||
          'Ukjent enhet'
        }`
      );
      lines.push(
        `- Område: ${
          proposal.accommodation?.ServiceName ||
          proposal.accommodation?.serviceName ||
          '-'
        }`
      );
      lines.push(
        `- Kapasitet: ${
          proposal.accommodation?.Capacity ?? proposal.accommodation?.capacity ?? '-'
        }`
      );
      lines.push(
        `- Pris: ${
          proposal.accommodation?.PriceTotal != null &&
          proposal.accommodation?.PriceCurrency
            ? `${proposal.accommodation.PriceTotal} ${proposal.accommodation.PriceCurrency}`
            : proposal.accommodation?.priceTotal != null &&
                proposal.accommodation?.priceCurrency
              ? `${proposal.accommodation.priceTotal} ${proposal.accommodation.priceCurrency}`
              : '-'
        }`
      );
      if (proposal.accommodation?.Description || proposal.accommodation?.description) {
        lines.push(
          `- ${
            proposal.accommodation?.Description ||
            proposal.accommodation?.description
          }`
        );
      }
      lines.push('- Overnatting bestilles via bookingknappen i appen.');
    } else {
      lines.push('- Jeg fant ikke verifisert overnatting akkurat nå.');
    }
    lines.push('');
  }

  if (proposal.transport) {
    lines.push('Transport:');
    lines.push(`- ${proposal.transport}`);
    lines.push('');
  }

  if (proposal.activities.length > 0) {
    lines.push('Aktiviteter:');
    proposal.activities.slice(0, 3).forEach((item) => {
      lines.push(`- ${item?.title || 'Ukjent aktivitet'}`);
      if (item?.summary) lines.push(`  ${item.summary}`);
    });
    lines.push('');
  }

  if (proposal.restaurants.length > 0) {
    lines.push('Restauranter:');
    proposal.restaurants.slice(0, 3).forEach((item) => {
      lines.push(`- ${item?.title || 'Ukjent restaurant'}`);
      if (item?.summary) lines.push(`  ${item.summary}`);
    });
    lines.push('');
  }

  if (proposal.shopping.length > 0) {
    lines.push('Shopping:');
    proposal.shopping.slice(0, 3).forEach((item) => {
      lines.push(`- ${item?.title || 'Ukjent shoppingsted'}`);
      if (item?.summary) lines.push(`  ${item.summary}`);
    });
    lines.push('');
  }

  if (proposal.itinerary.length > 0) {
    lines.push('Enkelt forslag for de første dagene:');
    proposal.itinerary.forEach((day) => {
      lines.push(`${day.day}. ${day.title}`);
      day.items.forEach((item) => lines.push(`- ${item}`));
    });
  }

  return lines.join('\n');
}
app.post('/api/travel-helper', async (req, res) => {
  try {
    const {
      message,
      history,
      searchContext,
      lastSearchRows,
      lastSearchParams,
      lastFlightOffers,
      lastFlightSearch,
      flightSearchContext,
      lang,
    } = req.body || {};

    console.log('TRAVEL_HELPER request', {
      message,
      historyCount: Array.isArray(history) ? history.length : 0,
      hasLastSearchRows: Array.isArray(lastSearchRows) ? lastSearchRows.length : 0,
      hasLastFlightOffers: Array.isArray(lastFlightOffers) ? lastFlightOffers.length : 0,
      hasFlightSearchContextOffers: Array.isArray(flightSearchContext?.offers)
        ? flightSearchContext.offers.length
        : 0,
      lang,
    });

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ ok: false, error: 'message_mangler' });
    }

    const openAiKey = String(process.env.OPENAI_API_KEY || '').trim();
    if (!openAiKey) {
      return res.status(500).json({ ok: false, error: 'OPENAI_API_KEY_mangler' });
    }

    const safeHistory = Array.isArray(history) ? history.slice(-14) : [];
    const appLang =
      typeof lang === 'string' && lang.trim()
        ? lang.trim().toLowerCase()
        : 'nb';

    const safeSearchContext =
      searchContext &&
      typeof searchContext === 'object' &&
      !Array.isArray(searchContext)
        ? searchContext
        : null;

    const safeLastSearchRows = Array.isArray(lastSearchRows) ? lastSearchRows : [];
    const safeLastSearchParams =
      lastSearchParams &&
      typeof lastSearchParams === 'object' &&
      !Array.isArray(lastSearchParams)
        ? lastSearchParams
        : null;

    const safeFlightSearchContext: FlightSearchContextPayload | null =
      flightSearchContext &&
      typeof flightSearchContext === 'object' &&
      !Array.isArray(flightSearchContext)
        ? {
            offers: Array.isArray(flightSearchContext.offers) ? flightSearchContext.offers : [],
            search:
              flightSearchContext.search &&
              typeof flightSearchContext.search === 'object' &&
              !Array.isArray(flightSearchContext.search)
                ? {
                    origin: String(flightSearchContext.search.origin || '').trim().toUpperCase(),
                    destination: String(flightSearchContext.search.destination || '').trim().toUpperCase(),
                    departureDate: String(flightSearchContext.search.departureDate || '').slice(0, 10),
                    returnDate: flightSearchContext.search.returnDate
                      ? String(flightSearchContext.search.returnDate).slice(0, 10)
                      : null,
                    adults: Number(flightSearchContext.search.adults || 1),
                    cabinClass: (String(
                      flightSearchContext.search.cabinClass || 'economy'
                    ) as 'economy' | 'premium_economy' | 'business' | 'first'),
                    directOnly: Boolean(flightSearchContext.search.directOnly),
                  }
                : null,
          }
        : null;

    const currentMessageText = String(message || '').trim();
    const conversationText = buildTravelHelperSearchBasis(currentMessageText, safeHistory);

    const intent = detectTravelHelperIntent(currentMessageText);
    const responseMode = detectTravelHelperResponseMode(currentMessageText, safeHistory);
    const contentCategory = extractTravelContentCategory(currentMessageText, safeHistory);

    const contentIntent =
      detectTravelContentIntent(currentMessageText) ||
      responseMode === 'restaurant_only' ||
      responseMode === 'shopping_only' ||
      responseMode === 'activity_only' ||
      responseMode === 'host_only' ||
      responseMode === 'trip_package';

    const flightIntent =
      detectTravelFlightIntent(currentMessageText) ||
      responseMode === 'flight_only' ||
      responseMode === 'trip_package';

    const tripPlanningIntent = responseMode === 'trip_package';
    const hostRentalIntent = responseMode === 'host_only';
    const includeAccommodationInTrip =
      responseMode === 'trip_package' &&
      (
        normalizeTravelHelperText(currentMessageText).includes('overnatting') ||
        normalizeTravelHelperText(currentMessageText).includes('hotell') ||
        normalizeTravelHelperText(currentMessageText).includes('hytte') ||
        normalizeTravelHelperText(currentMessageText).includes('leilighet') ||
        normalizeTravelHelperText(getPreviousUserMessage(safeHistory)).includes('overnatting') ||
        normalizeTravelHelperText(getPreviousUserMessage(safeHistory)).includes('hotell') ||
        normalizeTravelHelperText(getPreviousUserMessage(safeHistory)).includes('hytte') ||
        normalizeTravelHelperText(getPreviousUserMessage(safeHistory)).includes('leilighet')
      );

    const shouldRunAvailabilitySearch =
      responseMode === 'accommodation_only' ||
      includeAccommodationInTrip;

    let dynamicContext = '';
    let contentContext = '';
    let flightContext = '';
    let tripProposalContext = '';
    let contentItemsCount = 0;
    let contentItemsForReply: any[] = [];

    let latestSearchRows: any[] = [];
    let latestSearchParams: {
      from: string;
      to: string;
      adults: number;
      area: string;
      promo: string;
      lang: string;
    } | null = null;

    let latestFlightOffers: any[] =
      Array.isArray(lastFlightOffers) && lastFlightOffers.length > 0
        ? lastFlightOffers
        : Array.isArray(safeFlightSearchContext?.offers)
          ? safeFlightSearchContext!.offers
          : [];

    let latestFlightSearch:
      | {
          origin: string;
          destination: string;
          departureDate: string;
          returnDate?: string | null;
          adults: number;
          cabinClass: 'economy' | 'premium_economy' | 'business' | 'first';
          directOnly: boolean;
        }
      | null =
      lastFlightSearch &&
      typeof lastFlightSearch === 'object' &&
      !Array.isArray(lastFlightSearch)
        ? {
            origin: String(lastFlightSearch.origin || '').trim().toUpperCase(),
            destination: String(lastFlightSearch.destination || '').trim().toUpperCase(),
            departureDate: String(lastFlightSearch.departureDate || '').slice(0, 10),
            returnDate: lastFlightSearch.returnDate
              ? String(lastFlightSearch.returnDate).slice(0, 10)
              : null,
            adults: Number(lastFlightSearch.adults || 1),
            cabinClass: (String(lastFlightSearch.cabinClass || 'economy') as
              | 'economy'
              | 'premium_economy'
              | 'business'
              | 'first'),
            directOnly: Boolean(lastFlightSearch.directOnly),
          }
        : safeFlightSearchContext?.search || null;

    if (safeLastSearchRows.length > 0 && safeLastSearchParams) {
      latestSearchRows = safeLastSearchRows;
      latestSearchParams = {
        from: String(safeLastSearchParams?.from || '').slice(0, 10),
        to: String(safeLastSearchParams?.to || '').slice(0, 10),
        adults: Number(safeLastSearchParams?.adults || 1),
        area: String(safeLastSearchParams?.area || '').trim(),
        promo: String(safeLastSearchParams?.promo || '').trim(),
        lang: String(safeLastSearchParams?.lang || appLang).trim() || appLang,
      };
    } else if (
      safeSearchContext?.rows &&
      Array.isArray(safeSearchContext.rows) &&
      safeSearchContext.rows.length > 0 &&
      safeSearchContext?.params
    ) {
      latestSearchRows = safeSearchContext.rows;
      latestSearchParams = {
        from: String(safeSearchContext.params?.from || '').slice(0, 10),
        to: String(safeSearchContext.params?.to || '').slice(0, 10),
        adults: Number(safeSearchContext.params?.adults || 1),
        area: String(safeSearchContext.params?.area || '').trim(),
        promo: String(safeSearchContext.params?.promo || '').trim(),
        lang: String(safeSearchContext.params?.lang || appLang).trim() || appLang,
      };
    }

    if (shouldRunAvailabilitySearch) {
      const destinationArea =
        extractTripDestinationArea(currentMessageText, safeHistory) ||
        latestSearchParams?.area ||
        null;

      const adults =
        extractTravelHelperAdults(currentMessageText) ||
        extractTravelHelperAdults(getPreviousUserMessage(safeHistory)) ||
        latestSearchParams?.adults ||
        null;

      const datesFromCurrent = extractTravelHelperDates(currentMessageText);
      const datesFromPrevious = extractTravelHelperDates(getPreviousUserMessage(safeHistory));

      const dates = {
        from: datesFromCurrent.from || datesFromPrevious.from || latestSearchParams?.from || null,
        to: datesFromCurrent.to || datesFromPrevious.to || latestSearchParams?.to || null,
      };

      if (destinationArea && adults && dates.from && dates.to) {
        try {
          const searchUrl = new URL(`http://127.0.0.1:${PORT}/api/search`);
          searchUrl.searchParams.set('area', destinationArea);
          searchUrl.searchParams.set('from', dates.from);
          searchUrl.searchParams.set('to', dates.to);
          searchUrl.searchParams.set('adults', String(adults));
          searchUrl.searchParams.set('lang', appLang);

          const searchResponse = await fetch(searchUrl.toString());
          const searchJson: any = await searchResponse.json();

          if (searchResponse.ok && searchJson?.ok && searchJson?.data) {
            latestSearchRows =
              searchJson?.data?.availability?.ResourceCategoryAvailabilities ||
              searchJson?.data?.data ||
              [];

            latestSearchParams = {
              from: dates.from,
              to: dates.to,
              adults,
              area: destinationArea,
              promo: '',
              lang: appLang,
            };

            dynamicContext = buildAvailabilityContextText(
              searchJson.data,
              adults,
              currentMessageText
            );
          } else {
            dynamicContext = [
              'BNO_AVAILABILITY_CONTEXT',
              'Sanntidsoppslaget ble kjørt, men ga ingen gyldige treff.',
              `Område: ${destinationArea}`,
              `Fra: ${dates.from}`,
              `Til: ${dates.to}`,
              `Voksne: ${adults}`,
              'Treff: 0',
              'Hvis det ikke finnes treff, si det tydelig og foreslå justering av datoer, område eller antall gjester.',
            ].join('\n');
          }
        } catch (searchError) {
          console.error('travel-helper availability lookup failed', searchError);
          dynamicContext = [
            'BNO_AVAILABILITY_CONTEXT',
            'Sanntidsoppslaget feilet teknisk.',
            'Ikke dikt opp tilgjengelighet.',
            'Forklar kort at sanntidsoppslaget ikke kunne fullføres akkurat nå.',
          ].join('\n');
        }
      }
    }

    if (contentIntent || tripPlanningIntent || hostRentalIntent) {
      try {
        const destinationArea =
          extractTripDestinationArea(currentMessageText, safeHistory) ||
          latestSearchParams?.area ||
          'trysil';

        const destinationSlug = mapTravelHelperAreaToContentDestinationSlug(destinationArea);
        const season = detectTravelSeason(currentMessageText, extractTravelHelperDates(conversationText));

        let categoriesToFetch: string[] = [];

        if (responseMode === 'host_only') {
          categoriesToFetch = ['host_rental', 'travel_terms'];
        } else if (responseMode === 'restaurant_only') {
          categoriesToFetch = ['restaurant'];
        } else if (responseMode === 'shopping_only') {
          categoriesToFetch = ['shopping'];
        } else if (responseMode === 'activity_only') {
          categoriesToFetch = ['activity'];
        } else if (responseMode === 'trip_package') {
          categoriesToFetch = ['activity', 'restaurant', 'shopping'];
        } else if (contentCategory) {
          categoriesToFetch = [contentCategory];
        }

        let contentItems: any[] = [];

        for (const category of categoriesToFetch) {
          const destinationSlugForCategory =
            category === 'travel_terms' || category === 'host_rental'
              ? 'global'
              : destinationSlug;

          const items = await getTravelHelperContent({
            destinationSlug: destinationSlugForCategory,
            category,
            language: appLang,
            message: currentMessageText,
          });

          contentItems.push(...items);
        }

        const deduped = contentItems.filter(
          (item, index, arr) => arr.findIndex((x) => x?.slug === item?.slug) === index
        );

        let prioritizedItems: any[] = [];

        if (responseMode === 'host_only' || contentCategory === 'travel_terms') {
          prioritizedItems = prioritizeTravelTermItems(deduped, currentMessageText);
        } else {
          prioritizedItems = filterAndRankTravelContentForSeason(
            deduped,
            season,
            currentMessageText,
            safeHistory
          );
        }

        contentItemsForReply = prioritizedItems;
        contentItemsCount = prioritizedItems.length;

        if (prioritizedItems.length > 0) {
          contentContext = buildTravelContentContext(prioritizedItems.slice(0, 12));
        }
      } catch (contentError) {
        console.error('travel-helper content lookup failed', contentError);
      }
    }

    if (responseMode === 'flight_only' || responseMode === 'trip_package') {
      try {
        const flightParams = extractTravelFlightSearchParams(currentMessageText, safeHistory);
        const destinationArea = extractTripDestinationArea(currentMessageText, safeHistory);
        const inferredDestinationAirport = inferAirportFromTravelArea(destinationArea);

        let resolvedOrigin = flightParams.origin || null;
        let resolvedDestination = flightParams.destination || null;

        if (!resolvedDestination && inferredDestinationAirport) {
          resolvedDestination = inferredDestinationAirport;
        }

        if (
          resolvedOrigin &&
          resolvedDestination &&
          resolvedOrigin === resolvedDestination &&
          inferredDestinationAirport &&
          resolvedOrigin !== inferredDestinationAirport
        ) {
          resolvedDestination = inferredDestinationAirport;
        }

        if (resolvedOrigin && resolvedDestination && flightParams.departureDate) {
          const flightSearchResponse = await fetch(`http://127.0.0.1:${PORT}/api/flights/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              origin: resolvedOrigin,
              destination: resolvedDestination,
              departureDate: flightParams.departureDate,
              returnDate: flightParams.returnDate || undefined,
              adults: flightParams.adults,
              cabinClass: flightParams.cabinClass,
              directOnly: flightParams.directOnly,
            }),
          });

          const flightSearchJson: any = await flightSearchResponse.json();

          if (
            flightSearchResponse.ok &&
            flightSearchJson?.ok &&
            Array.isArray(flightSearchJson?.data?.offers)
          ) {
            latestFlightOffers = Array.isArray(flightSearchJson.data.offers)
              ? flightSearchJson.data.offers.slice(0, 5)
              : [];

            latestFlightSearch = {
              origin: resolvedOrigin,
              destination: resolvedDestination,
              departureDate: flightParams.departureDate,
              returnDate: flightParams.returnDate || null,
              adults: flightParams.adults,
              cabinClass: flightParams.cabinClass,
              directOnly: flightParams.directOnly,
            };

            flightContext = buildFlightContextText(latestFlightOffers, latestFlightSearch);
          } else {
            latestFlightOffers = [];
            latestFlightSearch = {
              origin: resolvedOrigin,
              destination: resolvedDestination,
              departureDate: flightParams.departureDate,
              returnDate: flightParams.returnDate || null,
              adults: flightParams.adults,
              cabinClass: flightParams.cabinClass,
              directOnly: flightParams.directOnly,
            };

            flightContext = buildFlightContextText([], latestFlightSearch);
          }
        } else if (responseMode === 'flight_only') {
          const missing: string[] = [];
          if (!resolvedOrigin) missing.push('avreiseflyplass');
          if (!resolvedDestination) missing.push('destinasjon/ankomstflyplass');
          if (!flightParams.departureDate) missing.push('utreisedato');

          flightContext = [
            'BNO_FLIGHT_CONTEXT',
            'Flysøk ble ikke kjørt ennå.',
            `Mangler: ${missing.join(', ')}`,
            '',
            'INSTRUKS:',
            '- Still ett kort oppfølgingsspørsmål hvis det trengs',
            '- Be om avreiseflyplass, destinasjon og dato hvis dette mangler',
            '- Ikke dikt opp flyavganger',
          ].join('\n');
        }
      } catch (flightError) {
        console.error('travel-helper flight lookup failed', flightError);

        flightContext = [
          'BNO_FLIGHT_CONTEXT',
          'Flyoppslaget feilet teknisk.',
          'Ikke dikt opp flyavganger.',
          'Forklar kort at flysøk ikke kunne fullføres akkurat nå.',
        ].join('\n');
      }
    }

    let tripProposal: TripProposal | null = null;

    if (tripPlanningIntent) {
      try {
        tripProposal = await buildTripProposal({
          message: currentMessageText,
          history: safeHistory,
          lang: appLang,
          includeAccommodation: includeAccommodationInTrip,
          availabilityRows: latestSearchRows,
          availabilityParams: latestSearchParams,
          flightOffers: latestFlightOffers,
          flightSearch: latestFlightSearch,
        });

        tripProposalContext = buildTripProposalContextText(tripProposal);
      } catch (proposalError) {
        console.error('travel-helper trip proposal failed', proposalError);
      }
    }

    const systemPrompt = [
      BNO_TRAVEL_HELPER_SYSTEM,
      '',
      `APP_LANG: ${appLang}`,
      'Svar helst på samme språk som brukeren skriver på.',
      `Hvis brukeren skriver på ${appLang}, bruk ${appLang} som hovedspråk med mindre brukeren tydelig velger et annet språk i samtalen.`,
    ].join('\n');

    const input = [
      { role: 'system', content: systemPrompt },
      ...(dynamicContext ? [{ role: 'system', content: dynamicContext }] : []),
      ...(contentContext ? [{ role: 'system', content: contentContext }] : []),
      ...(flightContext ? [{ role: 'system', content: flightContext }] : []),
      ...(tripProposalContext ? [{ role: 'system', content: tripProposalContext }] : []),
      ...safeHistory.map((item: any) => ({
        role: item?.role === 'assistant' ? 'assistant' : 'user',
        content: String(item?.text || ''),
      })),
      { role: 'user', content: String(message) },
    ];

    console.log('TRAVEL_HELPER context sizes', {
      dynamicContextLength: dynamicContext.length,
      contentContextLength: contentContext.length,
      flightContextLength: flightContext.length,
      tripProposalContextLength: tripProposalContext.length,
      inputCount: input.length,
      contentItemsCount,
      flightOffersCount: latestFlightOffers.length,
      tripPlanningIntent,
      hostRentalIntent,
      responseMode,
      includeAccommodationInTrip,
    });

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input,
      }),
    });

    const rawResponseText = await response.text();
    let data: any = null;

    try {
      data = rawResponseText ? JSON.parse(rawResponseText) : null;
    } catch {
      return res.status(500).json({ ok: false, error: 'openai_non_json_response' });
    }

    if (!response.ok) {
      return res.status(500).json({
        ok: false,
        error: data?.error?.message || 'openai_request_failed',
      });
    }

    const reply =
      data?.output_text ||
      data?.output?.find?.((item: any) => item?.type === 'message')
        ?.content?.find?.((part: any) => part?.type === 'output_text')
        ?.text ||
      '';

    let bookingAction: any = null;
    let flightAction: FlightAction | null = null;

    if (
      isTravelHelperBookingIntent(currentMessageText) &&
      latestSearchRows.length > 0 &&
      latestSearchParams
    ) {
      const matchedRoom = findRequestedRoomFromMessage(
        currentMessageText,
        latestSearchRows,
        latestSearchParams?.adults || null
      );

      const resolvedRoom =
        matchedRoom ||
        rankTravelHelperAvailabilityRows(
          latestSearchRows,
          latestSearchParams?.adults || null,
          currentMessageText
        )[0] ||
        null;

      if (resolvedRoom) {
        bookingAction = {
          type: 'book_accommodation',
          label: `Fullfør booking av ${resolvedRoom?.Name || resolvedRoom?.name || 'overnatting'}`,
          room: {
            ResourceCategoryId: resolvedRoom?.ResourceCategoryId ?? resolvedRoom?.categoryId ?? null,
            RoomCategoryId:
              resolvedRoom?.RoomCategoryId ??
              resolvedRoom?.ResourceCategoryId ??
              resolvedRoom?.categoryId ??
              null,
            BookingUrl: resolvedRoom?.BookingUrl ?? null,
            Name: resolvedRoom?.Name ?? resolvedRoom?.name ?? null,
            Description: resolvedRoom?.Description ?? resolvedRoom?.description ?? null,
            Capacity: resolvedRoom?.Capacity ?? resolvedRoom?.capacity ?? null,
            Image: resolvedRoom?.Image ?? resolvedRoom?.image ?? null,
            Images: resolvedRoom?.Images ?? resolvedRoom?.images ?? null,
            PriceTotal: resolvedRoom?.PriceTotal ?? resolvedRoom?.priceTotal ?? null,
            PriceCurrency: resolvedRoom?.PriceCurrency ?? resolvedRoom?.priceCurrency ?? null,
            AvailableUnits: resolvedRoom?.AvailableUnits ?? resolvedRoom?.availableUnits ?? null,
            ServiceId: resolvedRoom?.ServiceId ?? resolvedRoom?.serviceId ?? null,
            ServiceName: resolvedRoom?.ServiceName ?? resolvedRoom?.serviceName ?? null,
          },
          search: {
            from: latestSearchParams.from,
            to: latestSearchParams.to,
            adults: latestSearchParams.adults,
            area: latestSearchParams.area,
            promo: latestSearchParams.promo,
            lang: latestSearchParams.lang,
          },
        };
      }
    }

    if (latestFlightOffers.length > 0 && latestFlightSearch) {
      if (isTravelHelperFlightBookingIntent(currentMessageText)) {
        const resolvedOffer =
          findRequestedFlightOfferFromMessage(currentMessageText, latestFlightOffers) ||
          latestFlightOffers[0] ||
          null;

        if (resolvedOffer) {
          const outbound = getFlightSliceSummary(resolvedOffer?.slices?.[0]);

          flightAction = {
            type: 'book_flight',
            label: `Fullfør flybestilling med ${resolvedOffer?.owner?.name || outbound.airline || 'flyselskap'}`,
            offer: resolvedOffer,
            search: {
              origin: latestFlightSearch.origin,
              destination: latestFlightSearch.destination,
              departureDate: latestFlightSearch.departureDate,
              returnDate: latestFlightSearch.returnDate || null,
              adults: latestFlightSearch.adults,
              cabinClass: latestFlightSearch.cabinClass,
              directOnly: latestFlightSearch.directOnly,
            },
          };
        }
      }
    }

    const shouldForceDeterministicAccommodationReply =
      responseMode === 'accommodation_only' &&
      latestSearchRows.length > 0 &&
      latestSearchParams &&
      !hostRentalIntent;

    const shouldForceDeterministicRestaurantReply =
      responseMode === 'restaurant_only' &&
      contentItemsForReply.length > 0;

    const shouldForceDeterministicShoppingReply =
      responseMode === 'shopping_only' &&
      contentItemsForReply.length > 0;

    const shouldForceDeterministicActivityReply =
      responseMode === 'activity_only' &&
      contentItemsForReply.length > 0;

    const shouldForceDeterministicTripReply =
      responseMode === 'trip_package' &&
      !!tripProposal;

    const safeReply =
      shouldForceDeterministicAccommodationReply
        ? buildDeterministicAccommodationReply(latestSearchRows, latestSearchParams)
        : shouldForceDeterministicRestaurantReply
          ? buildDeterministicRestaurantReply(contentItemsForReply, currentMessageText, safeHistory)
          : shouldForceDeterministicShoppingReply
            ? buildDeterministicShoppingReply(contentItemsForReply, currentMessageText, safeHistory)
            : shouldForceDeterministicActivityReply
              ? buildDeterministicActivityReply(contentItemsForReply, currentMessageText, safeHistory)
              : shouldForceDeterministicTripReply
                ? buildDeterministicTripPackageReply({
                    tripProposal,
                    includeAccommodation: includeAccommodationInTrip,
                  })
                : (reply || 'Beklager, jeg fikk ikke laget et svar akkurat nå.');

    return res.json({
      ok: true,
      reply: safeReply,
      bookingAction,
      flightAction,
      tripProposal,
      searchContext:
        latestSearchRows.length > 0 && latestSearchParams
          ? { rows: latestSearchRows, params: latestSearchParams }
          : null,
      flightSearchContext:
        latestFlightOffers.length > 0 && latestFlightSearch
          ? { offers: latestFlightOffers.slice(0, 5), search: latestFlightSearch }
          : null,
      meta: {
        intent,
        responseMode,
        contentIntent,
        contentCategory,
        flightIntent,
        tripPlanningIntent,
        hostRentalIntent,
        includeAccommodationInTrip,
        usedDynamicContext: Boolean(dynamicContext),
        usedContentContext: Boolean(contentContext),
        usedFlightContext: Boolean(flightContext),
        usedTripProposalContext: Boolean(tripProposalContext),
        contentItemsCount,
        flightOffersCount: latestFlightOffers.length,
        appLang,
        searchRowsCount: latestSearchRows.length,
        tripProposalBuilt: Boolean(tripProposal),
        forcedDeterministicAccommodationReply: Boolean(shouldForceDeterministicAccommodationReply),
        forcedDeterministicRestaurantReply: Boolean(shouldForceDeterministicRestaurantReply),
        forcedDeterministicShoppingReply: Boolean(shouldForceDeterministicShoppingReply),
        forcedDeterministicActivityReply: Boolean(shouldForceDeterministicActivityReply),
        forcedDeterministicTripReply: Boolean(shouldForceDeterministicTripReply),
      },
    });
  } catch (e: any) {
    console.error('POST /api/travel-helper failed', e);
    return res.status(500).json({
      ok: false,
      error: e?.message || 'travel_helper_failed',
    });
  }
});
// 404
app.use((req, res) => {
  console.warn(`404 ${req.method} ${req.url}`);
  res.status(404).json({ ok: false, error: 'not_found' });
});
// =============================================================
// Pre-warm (liten win på første /api/search)
// =============================================================
async function prewarmResourceCategories() {
  try {
    const unique = MEWS_SERVICES_ALL.map((s) => ({ id: s.id, credsKey: (s.credsKey || CREDS_DEFAULT) as MewsCredKey })).filter((x) => !!x.id);
    await mapLimit(unique, 2, async (x) => {
      await getResourceCategoriesForServiceCached(x.credsKey, x.id, LOCALE);
    });
    console.log('[BOOT] prewarmResourceCategories done', { count: unique.length });
  } catch (e: any) {
    console.warn('[BOOT] prewarmResourceCategories failed (non-fatal)', e?.message || e);
  }
}

app.listen(PORT, HOST, () => {
  const hostShown = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`✅ Server running at http://${hostShown}:${PORT}`);
console.log(
  `MEWS_DISTRIBUTOR_BASE=${MEWS_DISTRIBUTOR_BASE} MEWS_DISTRIBUTION_CONFIGURATION_ID_DEFAULT=${MEWS_DISTRIBUTION_CONFIGURATION_ID_DEFAULT || '(missing)'}`
);
console.log(`MEWS_CONNECTOR_CONFIGURATION_ID=${MEWS_CONNECTOR_CONFIGURATION_ID || '(missing)'}`);  console.log(`ENABLE_SERVER_RESERVATION=${ENABLE_SERVER_RESERVATION ? '1' : '0'}`);
  console.log(`PRICE_FALLBACK_MAX_PER_SERVICE=${PRICE_FALLBACK_MAX_PER_SERVICE}`);

  const routes = listRegisteredRoutes();
  console.log(`[BOOT] ${BOOT_TAG} route count=${routes.length} has /mews/reservations=${routes.some((r) => r.path.includes('/mews/reservations'))}`);

  // kickoff prewarm (ikke blokker start)
  void prewarmResourceCategories();
});
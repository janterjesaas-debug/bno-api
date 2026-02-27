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

import { getImagesForResourceCategory } from './lib/imageMap';
import { pickLocalizedText } from './lib/mewsLocalization';

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

function pickRateIdByServiceId(id: string): string | null {
  if (id === MEWS_SERVICE_ID_TRYSIL_TURISTSENTER) return MEWS_RATE_ID_TRYSIL_TURISTSENTER || null;
  if (id === MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER) return MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER || null;
  if (id === MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE) return MEWS_RATE_ID_TRYSILFJELL_HYTTEOMRADE || null;
  if (id === MEWS_SERVICE_ID_TRYSIL_SENTRUM) return MEWS_RATE_ID_TRYSIL_SENTRUM || null;
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

  if (slug === 'stranda') {
    return { services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_STRANDA), areaKey: 'STRANDA' };
  }
  if (slug === 'trysil-sentrum' || slug === 'trysil_sentrum') {
    return { services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_TRYSIL_SENTRUM), areaKey: 'TRYSIL_SENTRUM' };
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
    return { services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_TANDADALEN_SALEN), areaKey: 'TANDADALEN_SALEN' };
  }
  if (slug === 'hogfjallet-salen' || slug === 'högfjället-sälen' || slug === 'hogfjallet_salen') {
    return { services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_HOGFJALLET_SALEN), areaKey: 'HOGFJALLET_SALEN' };
  }
  if (slug === 'lindvallen-salen' || slug === 'lindvallen-sälen' || slug === 'lindvallen_salen') {
    return { services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_LINDVALLEN_SALEN), areaKey: 'LINDVALLEN_SALEN' };
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
    const positives = vals.filter((v) => v > 0);
    return positives.length > 0 ? Math.min(...positives) : Math.min(...vals);
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
  if (!opts.serviceId || !opts.adultAgeCategoryId) return { total: null, currency: null };

  const url = `${creds.baseUrl}/api/connector/v1/reservations/price`;

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

  if (opts.rateId && String(opts.rateId).trim().length > 0) {
    reservation.RateId = String(opts.rateId).trim();
  }

  const payload = {
    ClientToken: creds.clientToken,
    AccessToken: creds.accessToken,
    Client: creds.clientName,
    ServiceId: opts.serviceId,
    Reservations: [reservation],
  };

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
}

// =======================
// Express app + middleware
// =======================
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

registerHousekeepingRoutes(app);
registerStripeRoutes(app);

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
      const roomId = md.roomId || '';

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

    const localizedName = pickLocalizedText(rc.Names, requestedLang, [LOCALE]) || rc.Name || rc.ExternalIdentifier || 'Rom';
    const cap = typeof rc.Capacity === 'number' ? (rc.Capacity as number) : null;
    const description = pickLocalizedText(rc.Descriptions, requestedLang, [LOCALE]) || rc.Description || null;

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
            credsKey: svcCredsKey,
            rawTop: {
              AvailableRoomCount: ca?.AvailableRoomCount ?? null,
              TotalAvailableUnitsCount: ca?.TotalAvailableUnitsCount ?? null,
            },
          });
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

    const filteredRooms = includeAll ? allRooms : allRooms.filter((r) => typeof r.availableUnits === 'number' && r.availableUnits > 0);

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
              const chosenRateId = (svc.rateId && svc.rateId.trim().length ? svc.rateId : null) || null;
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

              priceFallbackUsed++;
              if (rp.total != null) {
                priceTotal = rp.total;
                priceCurrency = rp.currency || priceCurrency;
              }
            } catch {
              // non-fatal
            }
          }

          const outItem: any = {
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
            credsKey: svcCredsKey,
          };

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

    const rcList = includeAll ? allRooms : allRooms.filter((r) => typeof r.AvailableUnits === 'number' && r.AvailableUnits > 0);

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
// (Valgfritt) server-side create reservation (bak feature flag)
// =============================================================
if (ENABLE_SERVER_RESERVATION) {
  app.post('/api/mews/reservation', async (_req, res) => {
    try {
      return res.status(501).json({
        ok: false,
        error: 'not_implemented',
        detail: 'ENABLE_SERVER_RESERVATION=1 men endpoint er ikke implementert ennå',
      });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: 'server_error', detail: e?.message || String(e) });
    }
  });
}

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
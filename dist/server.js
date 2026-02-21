"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * server.ts
 *
 * Viktig:
 * - Denne filen laster .env før vi importerer moduler som kan lese process.env.
 * - Støtter å velge env-fil via:
 *      DOTENV_FILE=.env.prod
 *   eller fallback til ".env".
 *
 * Anbefalt i prod på Render:
 *   - bygg til dist/ (tsc)
 *   - start med: node dist/server.js
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function resolveProjectRoot() {
    return process.cwd();
}
function pickEnvFile() {
    const root = resolveProjectRoot();
    const preferred = (process.env.DOTENV_FILE || '').trim(); // f.eks ".env.prod"
    const candidate = preferred || '.env';
    const full = path.resolve(root, candidate);
    if (fs.existsSync(full))
        return { file: candidate, fullPath: full };
    // fallback: hvis DOTENV_FILE er satt men fila ikke finnes → bruk .env
    const fallback = path.resolve(root, '.env');
    return { file: '.env', fullPath: fallback };
}
const envPick = pickEnvFile();
// Last inn env (override: true gjør at .env kan overstyre Windows env)
dotenv.config({ path: envPick.fullPath, override: true });
console.log('[BOOT] dotenv loaded', {
    envFile: envPick.file,
    envPath: envPick.fullPath,
    cwd: process.cwd(),
    node: process.version,
    portEnv: process.env.PORT,
    hasMEWS_BASE_URL: !!process.env.MEWS_BASE_URL,
    MEWS_DISTRIBUTION_CONFIGURATION_ID: process.env.MEWS_DISTRIBUTION_CONFIGURATION_ID || null,
});
// ======================
// Imports etter dotenv
// ======================
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const axios_1 = __importDefault(require("axios"));
const body_parser_1 = __importDefault(require("body-parser"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const mews_1 = __importDefault(require("./lib/mews"));
const prices_1 = require("./lib/prices");
const mews_webhook_1 = require("./mews-webhook");
const siteminder_1 = require("./lib/siteminder");
const housekeepingRoutes_1 = __importDefault(require("./lib/housekeepingRoutes"));
const imageMap_1 = require("./lib/imageMap");
const mewsLocalization_1 = require("./lib/mewsLocalization");
// =============================================================
// BOOT DIAGNOSTIKK
// =============================================================
const BOOT_TAG = 'BNO-API-BOOT-2026-02-12T00:00Z';
console.log(`[BOOT] ${BOOT_TAG} server.ts loaded`, {
    cwd: process.cwd(),
    node: process.version,
    portEnv: process.env.PORT,
});
// =============================================================
// Axios keep-alive (bedrer “første kall” og generell stabilitet)
// =============================================================
const httpAgent = new http_1.default.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https_1.default.Agent({ keepAlive: true, maxSockets: 50 });
axios_1.default.defaults.httpAgent = httpAgent;
axios_1.default.defaults.httpsAgent = httpsAgent;
function parseCredKey(v) {
    const s = String(v || '').trim().toUpperCase();
    if (s === 'STRANDA')
        return 'STRANDA';
    return 'DEFAULT';
}
function maskToken(t) {
    const s = (t || '').trim();
    if (!s)
        return '';
    if (s.length <= 10)
        return `${s.slice(0, 2)}...${s.slice(-2)}`;
    return `${s.slice(0, 6)}...${s.slice(-4)}`;
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
const MEWS_BASE_STRANDA = (process.env.MEWS_BASE_URL_STRANDA ||
    process.env.MEWS_STRANDA_BASE_URL ||
    MEWS_BASE_DEFAULT ||
    '')
    .trim()
    .replace(/\/$/, '');
const MEWS_CLIENT_TOKEN_STRANDA = (process.env.MEWS_CLIENT_TOKEN_STRANDA ||
    process.env.MEWS_STRANDA_CLIENT_TOKEN ||
    MEWS_CLIENT_TOKEN_DEFAULT ||
    '').trim();
const MEWS_ACCESS_TOKEN_STRANDA = (process.env.MEWS_ACCESS_TOKEN_STRANDA ||
    process.env.MEWS_STRANDA_ACCESS_TOKEN ||
    '').trim();
const MEWS_ENTERPRISE_ID_STRANDA = (process.env.MEWS_ENTERPRISE_ID_STRANDA ||
    process.env.MEWS_STRANDA_ENTERPRISE_ID ||
    process.env.MEWS_STRANDA_ENTERPRISE ||
    'b8a51d13-de66-49de-9e6b-b15a007ee173').trim();
const MEWS_SERVICE_ID_STRANDA = (process.env.MEWS_SERVICE_ID_STRANDA ||
    process.env.MEWS_STRANDA_SERVICE_ID ||
    '11f4b043-fefc-496f-9680-b15a007eea68').trim();
const MEWS_ADULT_AGE_CATEGORY_ID_STRANDA = (process.env.MEWS_ADULT_AGE_CATEGORY_ID_STRANDA ||
    process.env.MEWS_STRANDA_ADULT_AGE_CATEGORY_ID ||
    '5298b07f-60ce-4a0d-b8f1-b15a007eeb06').trim();
const MEWS_DISTRIBUTOR_BASE = (process.env.MEWS_DISTRIBUTOR_BASE || 'https://app.mews.com/distributor')
    .trim()
    .replace(/\/$/, '');
const MEWS_SERVICE_ID = (process.env.MEWS_SERVICE_ID || '').trim(); // global fallback
const MEWS_CONFIGURATION_ID = (process.env.MEWS_DISTRIBUTION_CONFIGURATION_ID ||
    process.env.MEWS_CONFIGURATION_ID ||
    '').trim();
// NB: beholdt for bakoverkomp (men brukes ikke som global fallback i pricing/create)
const MEWS_RATE_ID = (process.env.MEWS_RATE_ID || '').trim();
const ENABLE_SERVER_RESERVATION = String(process.env.ENABLE_SERVER_RESERVATION || '0') === '1';
// cap på fallback-prising for å unngå eksplosjon
const PRICE_FALLBACK_MAX_PER_SERVICE = Number(process.env.PRICE_FALLBACK_MAX_PER_SERVICE || 20);
function getCreds(key) {
    if (key === 'STRANDA') {
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
function hasCreds(c) {
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
const CREDS_DEFAULT = 'DEFAULT';
const CREDS_STRANDA = 'STRANDA';
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
/** Liste over alle områder */
const MEWS_SERVICES_ALL = [
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
console.log('MEWS_SERVICES_ALL =', MEWS_SERVICES_ALL);
// =============================================================
// Booking / Distributor helpers (per område)
// =============================================================
function normAreaKey(areaKey) {
    if (!areaKey)
        return null;
    return String(areaKey).trim().toUpperCase().replace(/[\s-]+/g, '_');
}
function getDistributionConfigIdForArea(areaKey) {
    const fallback = (MEWS_CONFIGURATION_ID || '').trim();
    const k = normAreaKey(areaKey);
    if (!k)
        return fallback;
    const envKey = `MEWS_DISTRIBUTION_CONFIGURATION_ID_${k}`;
    const v = (process.env[envKey] || '').trim();
    return v || fallback;
}
function getBookingUrlOverrideForArea(areaKey) {
    const k = normAreaKey(areaKey);
    if (!k)
        return null;
    const envKey = `MEWS_BOOKING_URL_${k}`;
    const v = (process.env[envKey] || '').trim();
    return v || null;
}
function buildMewsDistributorUrl(opts) {
    const base = (opts.base || '').replace(/\/$/, '');
    const configId = (opts.configId || '').trim();
    if (!base || !configId)
        return '';
    const params = new URLSearchParams();
    if (opts.from)
        params.set('from', opts.from);
    if (opts.to)
        params.set('to', opts.to);
    if (opts.adults != null)
        params.set('adults', String(opts.adults));
    const qs = params.toString();
    return `${base}/${configId}${qs ? `?${qs}` : ''}`;
}
const RATE_ID_BY_SERVICE_AND_NIGHTS = {};
function addRateMap(serviceId, map) {
    if (!serviceId)
        return;
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
function pickRateIdForServiceAndNights(serviceId, nights) {
    const m = RATE_ID_BY_SERVICE_AND_NIGHTS[serviceId];
    if (!m)
        return null;
    return m[nights] || null;
}
function resolveServicesForArea(areaSlugRaw) {
    const slug = (areaSlugRaw || '').toLowerCase().trim();
    if (!slug)
        return { services: MEWS_SERVICES_ALL, areaKey: null };
    if (slug === 'stranda') {
        return { services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_STRANDA), areaKey: 'STRANDA' };
    }
    if (slug === 'trysil-sentrum' || slug === 'trysil_sentrum') {
        return { services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_TRYSIL_SENTRUM), areaKey: 'TRYSIL_SENTRUM' };
    }
    if (slug === 'trysil-turistsenter' || slug === 'trysil_turistsenter') {
        return { services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_TRYSIL_TURISTSENTER), areaKey: 'TRYSIL_TURISTSENTER' };
    }
    if (slug === 'trysil-hoyfjellssenter' || slug === 'trysil-høyfjellssenter' || slug === 'trysil_hoyfjellssenter') {
        return { services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER), areaKey: 'TRYSIL_HOYFJELLSSENTER' };
    }
    if (slug === 'trysilfjell-hytteomrade' || slug === 'trysilfjell-hytteområde' || slug === 'trysilfjell_hytteomrade') {
        return { services: MEWS_SERVICES_ALL.filter((s) => s.id === MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE), areaKey: 'TRYSILFJELL_HYTTEOMRADE' };
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
// ===== Simple in-memory cache (TTL) =====
const cache = {};
function setCache(key, data, ttlSec = 120) {
    cache[key] = { expires: Date.now() + ttlSec * 1000, data };
}
function getCache(key) {
    const v = cache[key];
    if (!v)
        return null;
    if (Date.now() > v.expires) {
        delete cache[key];
        return null;
    }
    return v.data;
}
function setSearchCache(key, data, ttlSec = 45) {
    setCache(key, data, ttlSec);
}
function getSearchCache(key) {
    return getCache(key);
}
// ===== Axios wrapper med retry/backoff som respekterer Retry-After =====
async function axiosWithRetry(config, maxRetries = 3, initialDelayMs = 500, respectRetryAfter = true) {
    let attempt = 0;
    let delay = initialDelayMs;
    while (true) {
        try {
            const resp = await (0, axios_1.default)(config);
            return resp.data;
        }
        catch (err) {
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
                    }
                    else {
                        const parsed = Date.parse(retryAfterRaw);
                        if (!Number.isNaN(parsed)) {
                            const now = Date.now();
                            const until = parsed - now;
                            waitMs = until > 0 ? until : delay;
                        }
                    }
                }
                const maxCap = 10 * 60 * 1000;
                if (waitMs > maxCap)
                    waitMs = maxCap;
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
                headers,
            });
            throw err;
        }
    }
}
// ===== Concurrency helper (kontrollert parallellisering) =====
async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let i = 0;
    const workers = Array.from({ length: Math.max(1, limit) }).map(async () => {
        while (true) {
            const idx = i++;
            if (idx >= items.length)
                break;
            out[idx] = await fn(items[idx], idx);
        }
    });
    await Promise.all(workers);
    return out;
}
// ===== HELPERS =====
function daysBetween(ymdFrom, ymdTo) {
    const a = new Date(`${ymdFrom}T00:00:00Z`);
    const b = new Date(`${ymdTo}T00:00:00Z`);
    return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}
function addDaysYmd(ymd, delta) {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + delta);
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}
function buildTimeUnitRange(fromYmd, toYmd) {
    const firstUtc = mews_1.default.toTimeUnitUtc(fromYmd);
    const lastDayYmd = addDaysYmd(toYmd, -1);
    const lastUtc = mews_1.default.toTimeUnitUtc(lastDayYmd);
    return { firstUtc, lastUtc };
}
function firstLang(obj, locale) {
    if (!obj)
        return '';
    if (obj[locale])
        return obj[locale];
    const keys = Object.keys(obj || {});
    return keys.length ? obj[keys[0]] ?? '' : '';
}
function safeNum(v) {
    if (v == null)
        return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}
function sumNumbersSafe(list) {
    let acc = 0;
    for (const v of list || [])
        acc += Number(v || 0);
    return acc;
}
function extractPriceValueCurrency(priceObj) {
    if (priceObj == null)
        return { value: null, currency: null };
    if (typeof priceObj === 'number')
        return { value: safeNum(priceObj), currency: null };
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
function toNumMaybe(v) {
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    if (typeof v === 'string' && v.trim() !== '') {
        const n = Number(v);
        if (Number.isFinite(n))
            return n;
    }
    return null;
}
function avToCount(x) {
    if (x == null)
        return 0;
    if (typeof x === 'number')
        return Number.isFinite(x) ? x : 0;
    const candidates = [
        x.TotalAvailableUnitsCount,
        x.AvailableRoomCount,
        x.AvailableUnitsCount,
        x.AvailableUnitCount,
        x.Count,
    ];
    for (const c of candidates) {
        const n = toNumMaybe(c);
        if (n != null)
            return n;
    }
    return 0;
}
/** Viktig: For å unngå “falsk ledighet”, bruk MIN over alle netter (inkl. 0). */
function computeAvailableUnits(item) {
    if (Array.isArray(item?.Availabilities) && item.Availabilities.length > 0) {
        const vals = item.Availabilities.map(avToCount).filter((v) => Number.isFinite(v));
        if (vals.length > 0)
            return Math.min(...vals);
    }
    const ar = toNumMaybe(item?.AvailableRoomCount);
    if (ar != null && ar >= 0)
        return ar;
    const tu = toNumMaybe(item?.TotalAvailableUnitsCount);
    if (tu != null && tu >= 0)
        return tu;
    return 0;
}
function computePricesFromAvailabilities(item) {
    if (!Array.isArray(item.Availabilities) || item.Availabilities.length === 0) {
        if (Array.isArray(item.PriceNightly) && item.PriceNightly.length > 0) {
            const nightly = item.PriceNightly.map((vv) => safeNum(vv));
            const total = sumNumbersSafe(nightly);
            return { nightly, total: nightly.length ? total : null, currency: item.PriceCurrency || null };
        }
        if (item.PriceTotal != null)
            return { nightly: [], total: safeNum(item.PriceTotal), currency: item.PriceCurrency ?? null };
        if (item.Price) {
            const ex = extractPriceValueCurrency(item.Price);
            return { nightly: [], total: ex.value, currency: ex.currency };
        }
        return { nightly: [], total: null, currency: null };
    }
    const nightly = [];
    let detectedCurrency = null;
    for (const aRaw of item.Availabilities) {
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
        let foundVal = null;
        let foundCur = null;
        for (const c of candidates) {
            if (!c)
                continue;
            if (Array.isArray(c) && c.length) {
                const ex = extractPriceValueCurrency(c[0]);
                if (ex.value != null) {
                    foundVal = ex.value;
                    foundCur = ex.currency;
                    break;
                }
            }
            else {
                const ex = extractPriceValueCurrency(c);
                if (ex.value != null) {
                    foundVal = ex.value;
                    foundCur = ex.currency;
                    break;
                }
            }
        }
        nightly.push(foundVal ?? null);
        if (!detectedCurrency && foundCur)
            detectedCurrency = foundCur;
    }
    const anyPrice = nightly.some((v) => v != null);
    const total = anyPrice ? sumNumbersSafe(nightly) : null;
    return { nightly, total, currency: detectedCurrency };
}
/**
 * Hent totalpris for EN reservasjon (1 enhet) via reservations/price.
 * NB: vi sender KUN RateId hvis vi faktisk har en.
 */
async function priceReservationOnce(opts) {
    const creds = getCreds(opts.credsKey);
    if (!hasCreds(creds))
        return { total: null, currency: null };
    if (!opts.serviceId || !opts.adultAgeCategoryId)
        return { total: null, currency: null };
    const url = `${creds.baseUrl}/api/connector/v1/reservations/price`;
    const reservation = {
        Identifier: 'preview-1',
        StartUtc: mews_1.default.toTimeUnitUtc(opts.startYmd),
        EndUtc: mews_1.default.toTimeUnitUtc(opts.endYmd),
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
    const respData = await axiosWithRetry({
        method: 'post',
        url,
        data: payload,
        timeout: 15000,
    }, 2, 500, true);
    const item = respData?.ReservationPrices?.[0] || respData?.ReservationPrice || null;
    if (!item)
        return { total: null, currency: null };
    const amountObj = item.TotalAmount || item.Total || item.TotalPrice || item.Price || null;
    const ex = extractPriceValueCurrency(amountObj);
    return { total: ex.value, currency: ex.currency || DEF_CURRENCY };
}
// =======================
// Express app + middleware
// =======================
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json({ limit: '1mb' }));
(0, housekeepingRoutes_1.default)(app);
// =============================================================
// SUPABASE IMAGE PROXY
// - Supports:
//    GET/HEAD /api/img/<key>
//    GET/HEAD /api/img/<bucket>/<key>   (bucket is stripped if it matches env bucket)
// - Avoids double-encoding and double-bucket bugs
// =============================================================
const SUPABASE_IMAGES_URL = String(process.env.SUPABASE_IMAGES_URL || '').trim().replace(/\/$/, '');
const SUPABASE_IMAGES_BUCKET = String(process.env.SUPABASE_IMAGES_BUCKET || '').trim();
function normalizeImgKey(rawKey) {
    let k = String(rawKey || '').trim();
    // Express wildcard can include leading slash
    k = k.replace(/^\/+/, '');
    // Try decode once (if already decoded, decodeURIComponent might throw on stray %)
    let decoded = k;
    try {
        decoded = decodeURIComponent(k);
    }
    catch {
        decoded = k; // keep as-is
    }
    decoded = decoded.replace(/^\/+/, '');
    // If caller includes bucket as first path segment, strip it when it matches env bucket
    let hadBucketPrefix = false;
    if (SUPABASE_IMAGES_BUCKET) {
        const bucketPrefix = `${SUPABASE_IMAGES_BUCKET.replace(/^\/+|\/+$/g, '')}/`;
        if (decoded.toLowerCase().startsWith(bucketPrefix.toLowerCase())) {
            decoded = decoded.slice(bucketPrefix.length);
            hadBucketPrefix = true;
        }
    }
    // Re-encode safely segment-by-segment (prevents % becoming %25)
    const encoded = decoded
        .split('/')
        .filter(Boolean)
        .map((seg) => encodeURIComponent(seg))
        .join('/');
    return { key: encoded, hadBucketPrefix };
}
function buildSupabasePublicObjectUrl(encodedKey) {
    // https://<project>.supabase.co/storage/v1/object/public/<bucket>/<encodedKey>
    return `${SUPABASE_IMAGES_URL}/storage/v1/object/public/${encodeURIComponent(SUPABASE_IMAGES_BUCKET)}/${encodedKey}`;
}
async function handleImgProxy(req, res) {
    try {
        if (!SUPABASE_IMAGES_URL || !SUPABASE_IMAGES_BUCKET) {
            return res.status(500).json({
                ok: false,
                error: 'img_proxy_env_missing',
                detail: 'SUPABASE_IMAGES_URL eller SUPABASE_IMAGES_BUCKET mangler på server',
            });
        }
        const raw = req.params[0] || ''; // wildcard from /api/img/*
        if (!raw) {
            return res.status(400).json({ ok: false, error: 'img_missing_key', detail: 'Mangler filsti etter /api/img/' });
        }
        const { key: encodedKey, hadBucketPrefix } = normalizeImgKey(raw);
        if (!encodedKey) {
            return res.status(400).json({ ok: false, error: 'img_invalid_key', detail: 'Ugyldig filsti' });
        }
        const upstreamUrl = buildSupabasePublicObjectUrl(encodedKey);
        const upstream = await axios_1.default.get(upstreamUrl, {
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
        if (req.method === 'HEAD')
            return res.status(200).end();
        return res.status(200).send(Buffer.from(upstream.data));
    }
    catch (e) {
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
    const stack = (app?._router?.stack || []);
    const routes = [];
    for (const layer of stack) {
        if (layer?.route?.path && layer?.route?.methods) {
            const methods = Object.keys(layer.route.methods)
                .filter((k) => layer.route.methods[k])
                .map((m) => m.toUpperCase());
            for (const m of methods)
                routes.push({ method: m, path: String(layer.route.path) });
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
        hasServerReservation: routes.some((r) => r.path === '/api/mews/reservation'),
        routes,
    });
});
// ===== PING / HEALTH =====
app.get('/api/ping', (_req, res) => res.json({ ok: true, where: 'api', at: Date.now(), tz: HOTEL_TZ }));
app.get('/ping', (_req, res) => res.json({ ok: true, where: 'root', at: Date.now(), tz: HOTEL_TZ }));
app.get('/api/health', (_req, res) => res.json({
    ok: true,
    tz: HOTEL_TZ,
    creds: {
        DEFAULT: { ok: hasCreds(getCreds('DEFAULT')) },
        STRANDA: { ok: hasCreds(getCreds('STRANDA')) },
    },
    env: {
        envFile: envPick.file,
        MEWS_DISTRIBUTION_CONFIGURATION_ID: process.env.MEWS_DISTRIBUTION_CONFIGURATION_ID || '',
        MEWS_CONFIGURATION_ID: process.env.MEWS_CONFIGURATION_ID || '',
    },
}));
// =============================================================
// Booking-link endpoint (per område)
// GET /api/mews/booking-link?area=trysil-turistsenter&from=YYYY-MM-DD&to=YYYY-MM-DD&adults=2
// =============================================================
app.get('/api/mews/booking-link', (req, res) => {
    const areaSlugRaw = req.query.area ? String(req.query.area) : '';
    const from = req.query.from ? String(req.query.from).slice(0, 10) : '';
    const to = req.query.to ? String(req.query.to).slice(0, 10) : '';
    const adults = req.query.adults ? Number(req.query.adults) : 2;
    const { areaKey } = resolveServicesForArea(areaSlugRaw);
    const configId = getDistributionConfigIdForArea(areaKey);
    const overrideUrl = getBookingUrlOverrideForArea(areaKey);
    const url = overrideUrl ||
        buildMewsDistributorUrl({
            base: MEWS_DISTRIBUTOR_BASE,
            configId,
            from: from || undefined,
            to: to || undefined,
            adults: Number.isFinite(adults) ? adults : 2,
        });
    return res.json({
        ok: true,
        input: { area: areaSlugRaw, from: from || null, to: to || null, adults },
        resolved: {
            areaKey,
            normalizedAreaKey: normAreaKey(areaKey),
            distributionBase: MEWS_DISTRIBUTOR_BASE,
            envKey: areaKey ? `MEWS_DISTRIBUTION_CONFIGURATION_ID_${normAreaKey(areaKey)}` : null,
            configId: configId || null,
            overrideUrl: overrideUrl || null,
        },
        url: url || null,
    });
});
// =============================================================
// MEWS connector post helper (med credsKey)
// =============================================================
async function mewsConnectorPost(credsKey, p, data, timeoutMs = 20000) {
    const creds = getCreds(credsKey);
    if (!hasCreds(creds))
        throw new Error('mews_credentials_missing');
    const url = `${creds.baseUrl}/api/connector/v1/${p.replace(/^\//, '')}`;
    return axiosWithRetry({
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
        if (cached)
            return res.json({ ok: true, data: cached });
        const rData = await mewsConnectorPost(credsKey, 'services/getAll', { Limitation: { Count: 1000 } }, 20000);
        const services = rData?.Services || [];
        const out = services.map((svc) => ({
            Id: svc?.Id,
            Name: firstLang(svc?.Name, LOCALE) || svc?.Name || svc?.ExternalIdentifier,
            Type: svc?.Type || null,
            EnterpriseId: svc?.EnterpriseId || null,
        }));
        setCache(cacheKey, out, 300);
        return res.json({ ok: true, data: out });
    }
    catch (e) {
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
            : MEWS_SERVICES_ALL.filter((s) => (s.credsKey || 'DEFAULT') === credsKey)
                .map((s) => s.id)
                .filter(Boolean);
        const cacheKey = `mews_resources_getAll_v1:${credsKey}:${serviceIds.sort().join(',')}`;
        const cached = getCache(cacheKey);
        if (cached)
            return res.json({ ok: true, data: cached });
        const payload = { ServiceIds: serviceIds, Limitation: { Count: 1000 } };
        const rData = await mewsConnectorPost(credsKey, 'resources/getAll', payload, 25000);
        const resources = rData?.Resources || [];
        const out = resources.map((r) => ({
            Id: r?.Id,
            Name: firstLang(r?.Name, LOCALE) || firstLang(r?.Names, LOCALE) || r?.Name || r?.ExternalIdentifier || null,
            ServiceId: r?.ServiceId || null,
            Type: r?.Type || null,
            IsActive: r?.IsActive ?? null,
        }));
        setCache(cacheKey, out, 300);
        return res.json({ ok: true, data: out, meta: { serviceIds, credsKey } });
    }
    catch (e) {
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
            : MEWS_SERVICES_ALL.filter((s) => (s.credsKey || 'DEFAULT') === credsKey)
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
        const payload = {
            ServiceIds: serviceIds,
            Limitation: { Count: 1000 },
            StartUtc: mews_1.default.toTimeUnitUtc(from),
            EndUtc: mews_1.default.toTimeUnitUtc(to),
        };
        if (states && states.length)
            payload.ReservationStates = states;
        const rData = await mewsConnectorPost(credsKey, 'reservations/getAll/2023-06-06', payload, 30000);
        const reservations = rData?.Reservations || [];
        return res.json({
            ok: true,
            data: reservations,
            meta: { count: reservations.length, from, to, serviceIds, states: states || null, credsKey },
        });
    }
    catch (e) {
        return res.status(500).json({ ok: false, error: 'mews_reservations_failed', detail: e?.message || String(e) });
    }
});
// =============================================================
// ResourceCategories cache helper (stor win for første søk)
// =============================================================
async function getResourceCategoriesForServiceCached(credsKey, serviceId, requestedLang) {
    const cacheKey = `rc_lookup:${credsKey}:${serviceId}:lang:${requestedLang}`;
    const cached = getCache(cacheKey);
    if (cached)
        return cached;
    const creds = getCreds(credsKey);
    const rcPayload = {
        ClientToken: creds.clientToken,
        AccessToken: creds.accessToken,
        Client: creds.clientName,
        ServiceIds: [serviceId],
        ActivityStates: ['Active'],
        Limitation: { Count: 1000 },
    };
    if (creds.enterpriseId)
        rcPayload.EnterpriseIds = [creds.enterpriseId];
    const rcData = await axiosWithRetry({
        method: 'post',
        url: `${creds.baseUrl}/api/connector/v1/resourceCategories/getAll`,
        data: rcPayload,
        timeout: 20000,
    });
    const lookup = {};
    for (const rc of rcData?.ResourceCategories || []) {
        if (!rc?.Id)
            continue;
        const rcId = String(rc.Id);
        const localizedName = (0, mewsLocalization_1.pickLocalizedText)(rc.Names, requestedLang, [LOCALE]) || rc.Name || rc.ExternalIdentifier || 'Rom';
        const cap = typeof rc.Capacity === 'number' ? rc.Capacity : null;
        const description = (0, mewsLocalization_1.pickLocalizedText)(rc.Descriptions, requestedLang, [LOCALE]) || rc.Description || null;
        const mappedImages = (0, imageMap_1.getImagesForResourceCategory)(rcId);
        const primaryMappedImage = mappedImages[0] ?? null;
        const fallbackImageFromMews = Array.isArray(rc.ImageIds) && rc.ImageIds.length
            ? `https://cdn.mews-demo.com/Media/Image/${rc.ImageIds[0]}?Mode=Fit&Height=400&Width=600`
            : rc.Image || null;
        const image = primaryMappedImage || fallbackImageFromMews;
        const images = mappedImages.length > 0
            ? mappedImages
            : Array.isArray(rc.ImageIds)
                ? rc.ImageIds.map((id) => `https://cdn.mews-demo.com/Media/Image/${id}?Mode=Fit&Height=400&Width=600`)
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
        const credsKeyParam = parseCredKey(req.query.credsKey);
        const serviceIdParam = req.query.serviceId ? String(req.query.serviceId).trim() : '';
        const langParamRaw = req.query.lang ? String(req.query.lang) : '';
        const requestedLang = (langParamRaw || LOCALE).trim();
        if (!from || !to) {
            return res.status(400).json({ ok: false, error: 'missing_params', detail: 'from og to (YYYY-MM-DD) er påkrevd' });
        }
        const nights = daysBetween(from, to);
        // servicesToQuery
        let servicesToQuery = [];
        if (serviceIdParam) {
            const found = MEWS_SERVICES_ALL.find((s) => s.id === serviceIdParam);
            servicesToQuery = found ? [found] : [{ id: serviceIdParam, name: 'Ukjent område (fra serviceId)', credsKey: credsKeyParam }];
        }
        else {
            servicesToQuery = MEWS_SERVICES_ALL.filter((s) => (s.credsKey || 'DEFAULT') === credsKeyParam);
        }
        const allRooms = [];
        // parallel per service, kontrollert
        await mapLimit(servicesToQuery, 3, async (svc) => {
            if (!svc.id)
                return;
            const svcCredsKey = svc.credsKey || 'DEFAULT';
            const creds = getCreds(svcCredsKey);
            if (!hasCreds(creds)) {
                console.warn('mews_availability: missing creds for service', { serviceId: svc.id, name: svc.name, credsKey: svcCredsKey });
                return;
            }
            let pricingCurrency = DEF_CURRENCY;
            if (svcCredsKey === 'DEFAULT') {
                try {
                    const pricing = await (0, prices_1.fetchPrices)(from, to);
                    pricingCurrency = pricing?.Currency || DEF_CURRENCY;
                }
                catch (e) {
                    console.warn('mews_availability: rates/getPricing failed, fortsetter uten forhåndspriser', e?.message || e);
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
            const availData = await axiosWithRetry({
                method: 'post',
                url: `${creds.baseUrl}/api/connector/v1/services/getAvailability`,
                data: availPayload,
                timeout: 20000,
            });
            const cats = availData?.CategoryAvailabilities || [];
            if (!cats.length)
                return;
            const categoryLookup = await getResourceCategoriesForServiceCached(svcCredsKey, svc.id, requestedLang);
            // bygg rom og gjør price fallback med cap
            let priceFallbackUsed = 0;
            for (const ca of cats) {
                const catId = String(ca.CategoryId || '');
                if (!catId)
                    continue;
                const info = categoryLookup[catId] || { name: 'Ukjent kategori', capacity: null, description: null, image: null, images: null, raw: null };
                const availableUnits = computeAvailableUnits(ca);
                let priceNightly = [];
                let priceTotal = null;
                let priceCurrency = pricingCurrency;
                const est = computePricesFromAvailabilities(ca);
                if (est.total != null || est.nightly.length) {
                    priceNightly = est.nightly;
                    priceTotal = est.total;
                    priceCurrency = est.currency || priceCurrency;
                }
                // fallback: reservations/price (begrenset)
                if (priceTotal == null && availableUnits > 0 && svc.adultAgeCategoryId && priceFallbackUsed < PRICE_FALLBACK_MAX_PER_SERVICE) {
                    try {
                        const chosenRateId = pickRateIdForServiceAndNights(svc.id, nights) || (svc.rateId && svc.rateId.trim().length ? svc.rateId : null);
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
                    }
                    catch (err) {
                        console.warn('mews_availability_price_reservation_fallback', { serviceId: svc.id, categoryId: catId, message: err?.message });
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
                    credsKey: svcCredsKey,
                });
            }
        });
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
                credsKey: credsKeyParam,
                priceFallbackMaxPerService: PRICE_FALLBACK_MAX_PER_SERVICE,
            },
        });
    }
    catch (err) {
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
        const cacheKey = `search:${from}:${to}:a${adults}:area:${areaKey || 'ALL'}:lang:${requestedLang}`;
        const cached = getSearchCache(cacheKey);
        if (cached)
            return res.json({ ok: true, data: cached });
        if (!from || !to) {
            const resp = {
                availability: { ResourceCategoryAvailabilities: [] },
                params: { from, to, adults, area: areaKey, lang: requestedLang, warn: 'missing_params' },
            };
            setSearchCache(cacheKey, resp, 10);
            return res.json({ ok: true, data: resp });
        }
        const nights = daysBetween(from, to);
        const allRooms = [];
        await mapLimit(servicesToQuery, 3, async (svc) => {
            if (!svc.id)
                return;
            const svcCredsKey = svc.credsKey || 'DEFAULT';
            const creds = getCreds(svcCredsKey);
            if (!hasCreds(creds)) {
                console.warn('search: missing creds for service', { serviceId: svc.id, name: svc.name, credsKey: svcCredsKey });
                return;
            }
            let pricingCurrency = DEF_CURRENCY;
            if (svcCredsKey === 'DEFAULT') {
                try {
                    const pricing = await (0, prices_1.fetchPrices)(from, to);
                    pricingCurrency = pricing?.Currency || DEF_CURRENCY;
                }
                catch (e) {
                    console.warn('search: rates/getPricing failed, fortsetter uten forhåndspriser', e?.message || e);
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
            const availData = await axiosWithRetry({
                method: 'post',
                url: `${creds.baseUrl}/api/connector/v1/services/getAvailability`,
                data: availPayload,
                timeout: 20000,
            });
            const cats = availData?.CategoryAvailabilities || [];
            if (!cats.length)
                return;
            const categoryLookup = await getResourceCategoriesForServiceCached(svcCredsKey, svc.id, requestedLang);
            let priceFallbackUsed = 0;
            for (const ca of cats) {
                const catId = String(ca.CategoryId || '');
                if (!catId)
                    continue;
                const info = categoryLookup[catId] || { name: 'Ukjent kategori', capacity: null, description: null, image: null, images: null, raw: null };
                const availableUnits = computeAvailableUnits(ca);
                let priceNightly = [];
                let priceTotal = null;
                let priceCurrency = pricingCurrency;
                const est = computePricesFromAvailabilities(ca);
                if (est.total != null || est.nightly.length) {
                    priceNightly = est.nightly;
                    priceTotal = est.total;
                    priceCurrency = est.currency || priceCurrency;
                }
                if (priceTotal == null && availableUnits > 0 && svc.adultAgeCategoryId && priceFallbackUsed < PRICE_FALLBACK_MAX_PER_SERVICE) {
                    try {
                        const chosenRateId = pickRateIdForServiceAndNights(svc.id, nights) || (svc.rateId && svc.rateId.trim().length ? svc.rateId : null);
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
                    }
                    catch (err) {
                        console.warn('search_price_reservation_fallback', { serviceId: svc.id, categoryId: catId, message: err?.message });
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
                    credsKey: svcCredsKey,
                });
            }
        });
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
                src: 'mews_services_getAvailability+resourceCategories_getAll(cached)+reservations_price(capped)',
                priceFallbackMaxPerService: PRICE_FALLBACK_MAX_PER_SERVICE,
            },
        };
        setSearchCache(cacheKey, outResp, 45);
        return res.json({ ok: true, data: outResp });
    }
    catch (e) {
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
        const cacheKeyErr = `search:${from}:${to}:a${adults}:area:${areaKey || 'ALL'}:lang:${requestedLang}`;
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
        const result = await (0, siteminder_1.fetchSiteMinderAvailability)({ fromYmd: from, toYmd: to, adults });
        return res.json({
            ok: true,
            data: {
                availability: { ResourceCategoryAvailabilities: result.ResourceCategoryAvailabilities || [] },
                params: { from, to, adults, src: 'siteminder' },
                raw: result.raw ?? null,
            },
        });
    }
    catch (e) {
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
        const list = await mews_1.default.fetchProducts(MEWS_SERVICE_ID || '');
        const products = (list || []).map((p) => ({
            Id: p?.Id,
            Name: firstLang(p?.Name, LOCALE) || p?.Name || p?.ExternalIdentifier || 'Product',
            Description: firstLang(p?.Description, LOCALE) || '',
            Image: Array.isArray(p?.ImageIds) && p.ImageIds.length ? `https://cdn.mews-demo.com/Media/Image/${p.ImageIds[0]}?Mode=Fit&Height=400&Width=600` : null,
            Currency: DEF_CURRENCY,
            PriceGross: p?.Price?.Value ?? p?.PriceGross ?? null,
        }));
        res.json({ ok: true, data: products });
    }
    catch (e) {
        console.error('products_error', e?.response?.data || e?.message || e);
        res.json({ ok: true, data: [] });
    }
});
app.post('/webhooks/mews', mews_webhook_1.mewsWebhookHandler);
// =============================================================
// (Valgfritt) server-side create reservation (bak feature flag)
// =============================================================
if (ENABLE_SERVER_RESERVATION) {
    app.post('/api/mews/reservation', async (req, res) => {
        try {
            // Her kan du implementere create-reservation når du er klar,
            // uten å påvirke andre endepunkt. Foreløpig returnerer vi "not implemented".
            return res.status(501).json({ ok: false, error: 'not_implemented', detail: 'ENABLE_SERVER_RESERVATION=1 men endpoint er ikke implementert ennå' });
        }
        catch (e) {
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
// - Henter resourceCategories for alle services (per creds)
// =============================================================
async function prewarmResourceCategories() {
    try {
        const unique = MEWS_SERVICES_ALL.map((s) => ({ id: s.id, credsKey: (s.credsKey || 'DEFAULT') })).filter((x) => !!x.id);
        await mapLimit(unique, 2, async (x) => {
            await getResourceCategoriesForServiceCached(x.credsKey, x.id, LOCALE);
        });
        console.log('[BOOT] prewarmResourceCategories done', { count: unique.length });
    }
    catch (e) {
        console.warn('[BOOT] prewarmResourceCategories failed (non-fatal)', e?.message || e);
    }
}
app.listen(PORT, HOST, () => {
    const hostShown = HOST === '0.0.0.0' ? 'localhost' : HOST;
    console.log(`✅ Server running at http://${hostShown}:${PORT}`);
    console.log(`MEWS_DISTRIBUTOR_BASE=${MEWS_DISTRIBUTOR_BASE} MEWS_DISTRIBUTION_CONFIGURATION_ID=${MEWS_CONFIGURATION_ID}`);
    console.log(`ENABLE_SERVER_RESERVATION=${ENABLE_SERVER_RESERVATION ? '1' : '0'}`);
    console.log(`PRICE_FALLBACK_MAX_PER_SERVICE=${PRICE_FALLBACK_MAX_PER_SERVICE}`);
    const routes = listRegisteredRoutes();
    console.log(`[BOOT] ${BOOT_TAG} route count=${routes.length} has /mews/reservations=${routes.some((r) => r.path === '/mews/reservations')}`);
    // kickoff prewarm (ikke blokker start)
    void prewarmResourceCategories();
});

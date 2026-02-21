"use strict";
// lib/siteminder.ts
//
// Dette er et "skall" for SiteMinder SiteConnect-integrasjon.
// Det ødelegger ikke noe MEWS-logikk, og returnerer foreløpig kun
// tomme resultater / eksempeldata. Når du får API-detaljer fra
// SiteMinder fyller du inn de ekte kallene her.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSiteMinderConfigured = isSiteMinderConfigured;
exports.fetchSiteMinderAvailability = fetchSiteMinderAvailability;
exports.createSiteMinderBooking = createSiteMinderBooking;
const SITEMINDER_BASE = (process.env.SITEMINDER_BASE_URL || '').trim();
const SITEMINDER_PARTNER_ID = (process.env.SITEMINDER_PARTNER_ID || '').trim();
const SITEMINDER_USERNAME = (process.env.SITEMINDER_USERNAME || '').trim();
const SITEMINDER_PASSWORD = (process.env.SITEMINDER_PASSWORD || '').trim();
const SITEMINDER_CHANNEL_ID = (process.env.SITEMINDER_CHANNEL_ID || '').trim();
const SITEMINDER_HOTEL_ID = (process.env.SITEMINDER_HOTEL_ID || '').trim();
const SITEMINDER_CURRENCY = (process.env.SITEMINDER_CURRENCY || 'EUR').trim().toUpperCase();
const SITEMINDER_LOCALE = (process.env.SITEMINDER_DEFAULT_LOCALE || 'en-US').trim();
function isSiteMinderConfigured() {
    return !!(SITEMINDER_BASE &&
        SITEMINDER_PARTNER_ID &&
        SITEMINDER_USERNAME &&
        SITEMINDER_PASSWORD);
}
/**
 * Her kan du senere bygge ekte kall til SiteConnect availability/pricing.
 * Nå returnerer vi enten:
 *  - en tom liste, eller
 *  - litt dummy data (om du vil teste appen).
 */
async function fetchSiteMinderAvailability(opts) {
    const { fromYmd, toYmd } = opts;
    const adults = Number(opts.adults || 2);
    if (!isSiteMinderConfigured()) {
        console.warn('[SiteMinder] Not configured – returning empty availability');
        return { ResourceCategoryAvailabilities: [] };
    }
    console.log('[SiteMinder] fetchSiteMinderAvailability called with:', {
        fromYmd,
        toYmd,
        adults,
    });
    // TODO: Når du har SiteConnect-dokumentasjon + credentials:
    //
    // 1) Bygg payload i henhold til SiteMinder SiteConnect API.
    // 2) Kall riktig endpoint med axios:
    //
    //    const resp = await axios.post(
    //      `${SITEMINDER_BASE}/...`,
    //      payload,
    //      {
    //        auth: {
    //          username: SITEMINDER_USERNAME,
    //          password: SITEMINDER_PASSWORD,
    //        },
    //        timeout: 15000,
    //      }
    //    );
    //
    // 3) Map svaret til listen under:
    //    ResourceCategoryAvailabilities: SiteMinderRoomCategory[]
    // Foreløpig: returner en tom liste (trygt)
    return {
        ResourceCategoryAvailabilities: [],
        raw: null,
    };
}
/**
 * Skall for å sende booking/reservation til SiteMinder (når du trenger det).
 * Ikke brukt enda – kan fylles ut senere.
 */
async function createSiteMinderBooking(opts) {
    if (!isSiteMinderConfigured()) {
        console.warn('[SiteMinder] Not configured – skipping booking');
        return { ok: false, confirmationId: null };
    }
    console.log('[SiteMinder] createSiteMinderBooking called with:', opts);
    // TODO: Implementer ekte booking-kall mot SiteConnect her.
    // Bruk axios.post(...) tilsvarende som i fetchSiteMinderAvailability.
    // Foreløpig returnerer vi en "fake" bekreftelse:
    return {
        ok: true,
        confirmationId: `SM-DEMO-${Date.now()}`,
        raw: null,
    };
}

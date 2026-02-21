"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMewsReservationsRoute = registerMewsReservationsRoute;
const mews_1 = require("../../lib/mews");
// BOOT DIAGNOSTIKK
const BOOT_TAG = 'BNO-API-MEWS-RESERVATIONS-2025-12-18T21:30Z';
console.log(`[BOOT] ${BOOT_TAG} mewsReservations.ts loaded`);
/**
 * GET /mews/reservations?from=YYYY-MM-DD&to=YYYY-MM-DD[&serviceId=...][&debug=1]
 *
 * Auth:
 * - Forvent "x-api-key" fra admin
 * - Matcher mot process.env.SYNC_SECRET (evt. BNO_API_KEY fallback)
 */
function requireApiKey(req) {
    const expected = (process.env.SYNC_SECRET || process.env.BNO_API_KEY || '').trim();
    // Hvis ingen nøkkel er satt, kjør uten auth (ikke anbefalt i prod).
    if (!expected)
        return;
    const headerKey = (req.header('x-api-key') || '').trim();
    // Støtt også Authorization: Bearer <key> (valgfritt)
    const auth = (req.header('authorization') || '').trim();
    const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
    const incoming = headerKey || bearer;
    const authDebug = String(process.env.AUTH_DEBUG || '') === '1';
    if (authDebug) {
        const mask = (s) => s && s.length >= 10 ? `${s.slice(0, 6)}...${s.slice(-4)}` : s ? `[len=${s.length}]` : '';
        console.log('[AUTH DEBUG]', 'expectedLen=', expected.length, 'expected=', mask(expected), 'incomingLen=', incoming.length, 'incoming=', mask(incoming), 'hasHeader=', Boolean(headerKey), 'hasBearer=', Boolean(bearer));
    }
    if (!incoming || incoming !== expected) {
        const e = new Error(!incoming ? 'Mangler API-nøkkel.' : 'Ugyldig API-nøkkel.');
        e.status = 401;
        e.body = {
            ok: false,
            error: !incoming ? 'missing_api_key' : 'unauthorized',
            detail: e.message,
        };
        throw e;
    }
}
function parseServiceId(req) {
    // 1) query override
    const fromQuery = (req.query.serviceId ? String(req.query.serviceId) : '').trim();
    if (fromQuery)
        return fromQuery;
    // 2) env fallback
    const fromEnv = (process.env.MEWS_SERVICE_ID || '').trim();
    return fromEnv || null;
}
function isDateOnly(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function pickDateOnly(value) {
    const s = String(value || '').slice(0, 10);
    return s;
}
function toBool(v) {
    const s = String(v || '').trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}
function dedupeById(rows) {
    const seen = new Set();
    const out = [];
    for (const r of rows || []) {
        const id = r?.Id ? String(r.Id) : '';
        if (!id) {
            out.push(r);
            continue;
        }
        if (seen.has(id))
            continue;
        seen.add(id);
        out.push(r);
    }
    return out;
}
function sortByScheduledEndUtc(rows) {
    return (rows || []).slice().sort((a, b) => {
        const ta = Date.parse(String(a?.ScheduledEndUtc || a?.EndUtc || ''));
        const tb = Date.parse(String(b?.ScheduledEndUtc || b?.EndUtc || ''));
        if (!Number.isFinite(ta) && !Number.isFinite(tb))
            return 0;
        if (!Number.isFinite(ta))
            return 1;
        if (!Number.isFinite(tb))
            return -1;
        return ta - tb;
    });
}
async function handler(req, res) {
    try {
        requireApiKey(req);
        const from = pickDateOnly(req.query.from);
        const to = pickDateOnly(req.query.to);
        if (!from || !to || !isDateOnly(from) || !isDateOnly(to)) {
            return res.status(400).json({
                ok: false,
                error: 'missing_params',
                detail: 'from og to (YYYY-MM-DD) er påkrevd',
            });
        }
        const serviceId = parseServiceId(req);
        if (!serviceId) {
            return res.status(500).json({
                ok: false,
                error: 'missing_service_id',
                detail: 'MEWS_SERVICE_ID er ikke satt (og serviceId ble ikke sendt i query).',
            });
        }
        const debug = toBool(req.query.debug);
        const rowsRaw = await (0, mews_1.fetchReservationsForCleaningRange)(serviceId, from, to);
        // failsafe: dedupe + stabil sortering
        const rows = sortByScheduledEndUtc(dedupeById(Array.isArray(rowsRaw) ? rowsRaw : []));
        const payload = {
            ok: true,
            from,
            to,
            serviceId,
            count: rows.length,
            reservations: rows,
            data: rows, // fallback for klienter som forventer "data"
        };
        if (debug) {
            payload.debug = {
                bootTag: BOOT_TAG,
                hotelTimeZone: (process.env.HOTEL_TIMEZONE || 'Europe/Oslo').trim(),
                // nyttig for å verifisere range uten å logge hemmeligheter:
                sample: rows.slice(0, 5).map((r) => ({
                    Id: r?.Id,
                    Number: r?.Number,
                    State: r?.State,
                    ScheduledStartUtc: r?.ScheduledStartUtc,
                    ScheduledEndUtc: r?.ScheduledEndUtc,
                    StartUtc: r?.StartUtc,
                    EndUtc: r?.EndUtc,
                })),
            };
        }
        return res.json(payload);
    }
    catch (err) {
        const status = Number(err?.status || err?.response?.status || 500);
        // Hvis lib/mews.ts har lagt ved mewsResponse (som du viste i 400-feilen), send den videre
        const mews = err?.mewsResponse || err?.response?.data || null;
        if (err?.body)
            return res.status(status).json(err.body);
        const out = {
            ok: false,
            error: 'server_error',
            detail: err?.message || String(err),
        };
        if (mews)
            out.mews = mews;
        return res.status(status).json(out);
    }
}
function registerMewsReservationsRoute(app) {
    console.log(`[BOOT] ${BOOT_TAG} registering routes: GET /mews/reservations and GET /api/mews/reservations`);
    // Adminen din ser ut til å kalle denne uten "/api"
    app.get('/mews/reservations', handler);
    // Bonus-alias (skader ikke)
    app.get('/api/mews/reservations', handler);
}

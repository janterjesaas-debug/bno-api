"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_BASE = void 0;
exports.getProducts = getProducts;
exports.previewBooking = previewBooking;
exports.createBooking = createBooking;
exports.chooseDeepLink = chooseDeepLink;
// app/lib/api.ts
/* Enkel API-klient for bno-api */
exports.API_BASE = (process.env.EXPO_PUBLIC_API_BASE?.replace(/\/$/, '') ||
    'http://192.168.86.232:4000/api'); // <-- bytt til din IP eller bruk tunnel
function asJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return { ok: false, error: 'bad_json', detail: text };
    }
}
async function get(path) {
    const r = await fetch(`${exports.API_BASE}${path}`);
    const t = await r.text();
    return asJson(t);
}
async function post(path, body) {
    const r = await fetch(`${exports.API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const t = await r.text();
    return asJson(t);
}
async function getProducts() {
    const res = await get('/products');
    if (!res || res.ok === false)
        throw new Error(res?.error || 'Kunne ikke hente produkter');
    const data = res.data ?? res;
    const list = Array.isArray(data) ? data : data.products ?? data.Products ?? [];
    return list.map((p) => ({
        Id: p.Id ?? p.id ?? p.ProductId ?? p.productId,
        Name: p.Name ?? p.name,
        Description: p.Description ?? p.description,
        Image: p.Image ?? p.image ?? null,
        Currency: p.Currency ?? p.currency,
        PriceGross: p.PriceGross ?? p.priceGross ?? p.Price ?? p.price,
    }));
}
async function previewBooking(body) {
    const res = await post('/booking/preview', body);
    if (!res || res.ok === false)
        throw new Error(res?.error || res?.detail || 'Preview feilet');
    return res.data;
}
async function createBooking(body) {
    const res = await post('/booking/create', body);
    if (!res || res.ok === false)
        throw new Error(res?.detail || res?.error || 'Create feilet');
    return res; // har .data.nextUrl / bookingUrl*
}
/** Velger beste deeplink fra create-responsen */
function chooseDeepLink(result) {
    const d = (result && (result.data ?? result)) || {};
    return d.nextUrl || d.bookingUrlSummary || d.bookingUrlRates || d.bookingUrlCategories;
}

"use strict";
// scripts/mews-list-products.ts
//
// Lister produkter per MEWS_SERVICE_IDS og printer kandidater for sengetøy,
// samt alle produkter hvis du vil.
//
// Kjør:
//   npx ts-node scripts/mews-list-products.ts
//
// Forventer .env med Mews creds + MEWS_SERVICE_IDS
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const axios_1 = __importDefault(require("axios"));
function reqEnv(name) {
    const v = (process.env[name] || '').trim();
    if (!v)
        throw new Error(`Missing env var: ${name}`);
    return v;
}
function getServiceIds() {
    return (process.env.MEWS_SERVICE_IDS || process.env.MEWS_SERVICE_ID || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}
function looksLikeLinen(name) {
    const n = name.toLowerCase();
    return (n.includes('sengetøy') ||
        n.includes('sengetoy') ||
        n.includes('håndkl') ||
        n.includes('handkl') ||
        n.includes('bed linen') ||
        n.includes('linen'));
}
async function fetchProducts(serviceId) {
    const baseUrl = reqEnv('MEWS_BASE_URL').replace(/\/$/, '');
    const url = `${baseUrl}/api/connector/v1/products/getAll`;
    const body = {
        ClientToken: reqEnv('MEWS_CLIENT_TOKEN'),
        AccessToken: reqEnv('MEWS_ACCESS_TOKEN'),
        Client: (process.env.MEWS_CLIENT_NAME || 'bno-api').replace(/^"|"$/g, '').trim(),
        ServiceIds: [serviceId],
        Limitation: { Count: 1000 },
    };
    const resp = await axios_1.default.post(url, body, { headers: { 'Content-Type': 'application/json' }, timeout: 20000 });
    return resp.data?.Products || [];
}
async function main() {
    const serviceIds = getServiceIds();
    if (!serviceIds.length)
        throw new Error('Missing MEWS_SERVICE_IDS (or MEWS_SERVICE_ID)');
    console.log('== List products per service ==');
    console.log('Services:', serviceIds.join(', '));
    const linenProductIds = [];
    for (const serviceId of serviceIds) {
        console.log(`\n=== ServiceId: ${serviceId} ===`);
        const products = await fetchProducts(serviceId);
        console.log(`Total products: ${products.length}`);
        const candidates = products
            .map((p) => {
            const id = String(p.Id || '');
            const name = p.Name ||
                (p.Names && typeof p.Names === 'object'
                    ? (p.Names['nb-NO'] || p.Names['no-NO'] || p.Names['en-US'] || Object.values(p.Names)[0])
                    : '') ||
                '';
            return { id, name: String(name) };
        })
            .filter((x) => x.id && x.name && looksLikeLinen(x.name));
        if (!candidates.length) {
            console.log('Ingen åpenbare sengetøy-kandidater på navn i denne servicen.');
            continue;
        }
        console.log('Sengetøy-kandidater:');
        for (const c of candidates) {
            console.log(`  ProductId: ${c.id}`);
            console.log(`    Name: ${c.name}`);
            linenProductIds.push(c.id.toLowerCase());
        }
    }
    const unique = Array.from(new Set(linenProductIds));
    console.log('\nKopier til .env (kommaseparert):');
    console.log(`MEWS_LINEN_PRODUCT_IDS=${unique.join(',')}`);
}
main().catch((err) => {
    console.error('Feil i mews-list-products.ts:', err?.message || err);
    process.exitCode = 1;
});

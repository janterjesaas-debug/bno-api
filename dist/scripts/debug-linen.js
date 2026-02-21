"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// bno-api/scripts/debug-linen.ts
require("dotenv/config");
const mews_1 = require("../lib/mews");
function parseArgs() {
    const out = {};
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (!a.startsWith('--'))
            continue;
        const key = a.slice(2);
        const next = argv[i + 1];
        if (!next || next.startsWith('--')) {
            out[key] = true;
        }
        else {
            out[key] = next;
            i++;
        }
    }
    return out;
}
function pickName(p) {
    if (!p)
        return '';
    const n = p.Name;
    if (typeof n === 'string')
        return n;
    if (n && typeof n === 'object') {
        const k = Object.keys(n)[0];
        if (k)
            return String(n[k] || '');
    }
    return '';
}
function parsePersonsFromName(name) {
    const s = String(name || '').toLowerCase();
    const m = s.match(/(\d+)\s*(pers|personer|person|p\b)/);
    if (m) {
        const n = Number(m[1]);
        if (!Number.isNaN(n) && n > 0)
            return n;
    }
    return 1;
}
function buildServiceOrderToReservationIdMap(reservations) {
    const map = {};
    for (const r of reservations || []) {
        const rid = r?.Id ? String(r.Id) : null;
        if (!rid)
            continue;
        const add = (k) => {
            if (!k)
                return;
            const s = String(k);
            if (!map[s])
                map[s] = rid;
        };
        add(r.ServiceOrderId);
        add(r.OrderId);
        add(r.Order?.Id);
        add(r.Order?.OrderId);
        add(r.ServiceOrder?.Id);
    }
    return map;
}
async function main() {
    const args = parseArgs();
    const serviceId = String(args.service || args.serviceId || '');
    const start = String(args.start || '');
    const end = String(args.end || '');
    const unitFilter = args.unit ? String(args.unit).toLowerCase() : '';
    if (!serviceId)
        throw new Error('Missing --service <serviceId>');
    if (!start || !end)
        throw new Error('Missing --start YYYY-MM-DD and --end YYYY-MM-DD');
    console.log('DEBUG-LINEN params', { serviceId, start, end, unitFilter: unitFilter || null });
    const [reservations, orderItems, products, resources] = await Promise.all([
        (0, mews_1.fetchReservationsForCleaningRange)(serviceId, start, end),
        (0, mews_1.fetchOrderItemsForCleaningRange)(serviceId, start, end),
        (0, mews_1.fetchProducts)(serviceId),
        (0, mews_1.fetchResources)(serviceId),
    ]);
    console.log(`reservations=${reservations.length} orderItems=${orderItems.length} products=${products.length}`);
    // Build resource id -> name
    const resIdToName = {};
    for (const r of resources || []) {
        if (r?.Id && r?.Name)
            resIdToName[String(r.Id)] = String(r.Name);
    }
    // Build linenProducts from MEWS_LINEN_PRODUCT_IDS if present, else name-heuristic from products
    const envIds = String(process.env.MEWS_LINEN_PRODUCT_IDS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const linenProducts = {};
    if (envIds.length) {
        const byId = {};
        for (const p of products || []) {
            if (p?.Id)
                byId[String(p.Id).toLowerCase()] = p;
        }
        for (const id of envIds) {
            const p = byId[id.toLowerCase()];
            const name = pickName(p) || id;
            linenProducts[id.toLowerCase()] = { personsPerUnit: parsePersonsFromName(name), name };
        }
        console.log('linenProducts from env:', Object.keys(linenProducts).length);
    }
    else {
        for (const p of products || []) {
            const name = pickName(p);
            const lower = name.toLowerCase();
            if (!name)
                continue;
            if (/(sengetøy|sengetoy|håndkl|handkl|linen)/i.test(lower)) {
                linenProducts[String(p.Id).toLowerCase()] = {
                    personsPerUnit: parsePersonsFromName(name),
                    name,
                };
            }
        }
        console.log('linenProducts from name-heuristic:', Object.keys(linenProducts).length);
    }
    const soToRes = buildServiceOrderToReservationIdMap(reservations);
    // group orderItems by productId for quick sanity
    const prodCount = {};
    for (const it of orderItems || []) {
        const pid = it?.Data?.Product?.ProductId ? String(it.Data.Product.ProductId) : 'NO_PID';
        prodCount[pid] = (prodCount[pid] || 0) + 1;
    }
    const top = Object.entries(prodCount).sort((a, b) => b[1] - a[1]).slice(0, 20);
    console.log('Top productIds in orderItems:', top);
    const linenCountByReservationId = (0, mews_1.buildLinenCountMapFromOrderItems)(orderItems, linenProducts, soToRes);
    const rows = (reservations || []).map((r) => {
        const rid = String(r.Id);
        const assignedResourceId = r.AssignedResourceId ? String(r.AssignedResourceId) : '';
        const unitName = (r.AssignedResourceId && resIdToName[String(r.AssignedResourceId)]) ||
            (r.AssignedResourceName ? String(r.AssignedResourceName) : '') ||
            '';
        const count = linenCountByReservationId[rid] || 0;
        return {
            reservationId: rid,
            unitName: unitName || assignedResourceId || '',
            startUtc: r.StartUtc || r.ScheduledStartUtc || '',
            endUtc: r.EndUtc || r.ScheduledEndUtc || '',
            linenPersons: count,
        };
    });
    const filtered = unitFilter
        ? rows.filter((x) => String(x.unitName || '').toLowerCase().includes(unitFilter))
        : rows;
    const nonZero = filtered.filter((x) => x.linenPersons > 0).sort((a, b) => b.linenPersons - a.linenPersons);
    console.log('--- Reservations with linenPersons > 0 ---');
    for (const r of nonZero.slice(0, 50)) {
        console.log(r);
    }
    if (!nonZero.length) {
        console.log('No linen detected in this window. If you expect linen, widen date range and/or verify ServiceOrderId mapping.');
    }
}
main().catch((e) => {
    console.error('debug-linen failed:', e?.message || e);
    process.exit(1);
});

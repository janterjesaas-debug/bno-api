"use strict";
// scripts/mews-sync-units.ts
//
// Henter alle "spaces"/enheter fra Mews for ALLE services i MEWS_SERVICE_IDS
// og synker dem til Supabase-tabellen `units`.
// Forutsetter at units har unik constraint på mews_space_id.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMewsUnitsSync = runMewsUnitsSync;
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const supabase_1 = require("../lib/supabase");
const mews_1 = require("../lib/mews");
const serviceIds = (process.env.MEWS_SERVICE_IDS || process.env.MEWS_SERVICE_ID || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
if (!serviceIds.length) {
    throw new Error('Missing MEWS_SERVICE_IDS (or MEWS_SERVICE_ID) in environment (.env)');
}
function normalizeSpaceId(s) {
    return (s.Id || s.ExternalIdentifier || s.Number || s.ShortName || null);
}
async function runMewsUnitsSync() {
    console.log('== MEWS → Supabase units sync (ALL services) ==');
    console.log(`Services: ${serviceIds.join(', ')}`);
    const allSpaces = [];
    for (const serviceId of serviceIds) {
        console.log(`\n--- Fetch spaces for serviceId=${serviceId} ---`);
        const spaces = (await (0, mews_1.fetchSpaces)(serviceId));
        console.log(`Fikk ${spaces.length} enhet(er).`);
        allSpaces.push(...(spaces || []));
    }
    // Dedup på mews_space_id
    const byId = new Map();
    for (const s of allSpaces) {
        const id = normalizeSpaceId(s);
        if (!id)
            continue;
        if (!byId.has(id))
            byId.set(id, s);
    }
    const rows = Array.from(byId.entries())
        .map(([mewsId, s]) => {
        const name = s.Name || s.ShortName || s.ExternalIdentifier || s.Number || 'Uten navn';
        const code = s.Number || s.ExternalIdentifier || s.ShortName || null;
        return {
            mews_space_id: mewsId,
            name,
            code,
            capacity: s.Capacity ?? null,
            is_active: s.IsOutOfOrder ? false : true,
        };
    });
    console.log(`\nTotalt unike enheter: ${rows.length}`);
    console.log('Upserter til public.units...');
    const { error } = await supabase_1.supabase
        .from('units')
        .upsert(rows, { onConflict: 'mews_space_id' });
    if (error) {
        console.error('Feil ved upsert til units:', error);
        throw error;
    }
    console.log('Units-sync fullført uten feil.');
}
if (require.main === module) {
    runMewsUnitsSync().catch((err) => {
        console.error('Uventet feil i mews-sync-units.ts:', err);
        process.exitCode = 1;
    });
}

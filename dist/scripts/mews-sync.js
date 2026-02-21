"use strict";
// scripts/mews-sync.ts
//
// Leser availability-response.json (fra Mews) og lager oppdrag
// i service_assignments-tabellen i Supabase.
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
exports.runMewsSync = runMewsSync;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
// Viktig: sørg for at .env lastes INN før vi oppretter Supabase-klienten
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const supabase_1 = require("../lib/supabase");
/**
 * Liten helper for å parse datoer trygt.
 */
function parseDate(value) {
    if (!value)
        return null;
    const d = new Date(value);
    if (isNaN(d.getTime()))
        return null;
    return d;
}
/**
 * yyyy-mm-dd fra Date
 */
function toYmd(d) {
    return d.toISOString().slice(0, 10);
}
/**
 * Leser availability-response.json og prøver å finne et array med reservasjoner.
 *  - Enten er hele fila et array
 *  - Ellers bruker vi json.DatesUtc hvis det er et array
 */
function loadRawMewsDataFromFile() {
    const filePath = path.join(__dirname, '..', 'availability-response.json');
    if (!fs.existsSync(filePath)) {
        throw new Error(`Fant ikke availability-response.json på ${filePath}. ` +
            'Legg fila i rotmappa til bno-api og prøv igjen.');
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    // Fjern ev. BOM (Byte Order Mark) i starten av fila
    const cleaned = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    const json = JSON.parse(cleaned);
    if (Array.isArray(json)) {
        return json;
    }
    if (Array.isArray(json.DatesUtc)) {
        console.log('Fant et array under nøkkelen "DatesUtc" – bruker dette som reservasjoner.');
        return json.DatesUtc;
    }
    throw new Error('Fant ikke et JSON-array i availability-response.json. ' +
        'Forventer enten et toppnivå-array eller en nøkkel "DatesUtc" med array.');
}
/**
 * Mapper et Mews-objekt til en rad i service_assignments.
 *
 * VIKTIG: Vi bruker KUN kolonner som vi vet finnes i tabellen:
 *  - id
 *  - unit_name
 *  - title
 *  - type
 *  - status
 *  - date
 *  - comment
 *  - created_at
 */
function mapReservationToAssignment(r, today) {
    // 1) Finn dato – prøver flere felter fra Mews-responsen
    const dateFromRaw = r.DateFrom ?? r.StartUtc ?? r.Start ?? r.Date;
    const dateFrom = parseDate(dateFromRaw);
    const serviceDate = dateFrom ? toYmd(dateFrom) : toYmd(today);
    // 2) Finn enhetsnavn / hyttenummer
    const unitName = r.ResourceName ??
        r.Resource?.Name ??
        r.Space?.Name ??
        r.UnitName ??
        r.UnitNumber ??
        'Mews enhet';
    const nowIso = new Date().toISOString();
    return {
        id: (0, crypto_1.randomUUID)(),
        unit_name: unitName,
        title: 'Sluttrengjøring (Mews-import)',
        // Matcher typene i serviceAssignments-route og webadmin-filteret (vask = «Renhold»)
        type: 'vask',
        status: 'not_started',
        date: serviceDate,
        // Blir synlig i admin som "Kommentar"
        comment: 'Oppdrag importert fra Mews (availability-response.json)',
        created_at: nowIso,
    };
}
/**
 * Eksportert funksjon – brukes både:
 *  - direkte (npm run mews:sync)
 *  - fra cron-scriptet (sync-cron.ts)
 */
async function runMewsSync() {
    const today = new Date();
    console.log('== MEWS → Supabase sync ==');
    console.log(`Dato som brukes: ${toYmd(today)}`);
    const reservations = loadRawMewsDataFromFile();
    console.log(`Leste ${reservations.length} objekt(er) fra Mews-JSON-filen.`);
    if (reservations.length === 0) {
        console.log('Ingen reservasjoner å importere. Avslutter.');
        return;
    }
    const rows = reservations.map((r) => mapReservationToAssignment(r, today));
    console.log(`Forsøker å skrive ${rows.length} rad(er) til service_assignments...`);
    const { error } = await supabase_1.supabase.from('service_assignments').insert(rows);
    if (error) {
        console.error('Feil ved insert til service_assignments:', error);
        throw error;
    }
    console.log('Import fullført uten feil 👍');
}
/**
 * Hvis fila kjøres direkte via:
 *   npm run mews:sync
 * så kjører vi runMewsSync() her.
 */
if (require.main === module) {
    runMewsSync().catch((err) => {
        console.error('Uventet feil i mews-sync.ts:', err);
        process.exitCode = 1;
    });
}

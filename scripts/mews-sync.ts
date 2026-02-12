// scripts/mews-sync.ts
//
// Leser availability-response.json (fra Mews) og lager oppdrag
// i service_assignments-tabellen i Supabase.

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// Viktig: sørg for at .env lastes INN før vi oppretter Supabase-klienten
import * as dotenv from 'dotenv';
dotenv.config();

import { supabase } from '../lib/supabase';

type AnyJson = any;

/**
 * Liten helper for å parse datoer trygt.
 */
function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d;
}

/**
 * yyyy-mm-dd fra Date
 */
function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Leser availability-response.json og prøver å finne et array med reservasjoner.
 *  - Enten er hele fila et array
 *  - Ellers bruker vi json.DatesUtc hvis det er et array
 */
function loadRawMewsDataFromFile(): AnyJson[] {
  const filePath = path.join(__dirname, '..', 'availability-response.json');

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Fant ikke availability-response.json på ${filePath}. ` +
        'Legg fila i rotmappa til bno-api og prøv igjen.',
    );
  }

  const raw = fs.readFileSync(filePath, 'utf8');

  // Fjern ev. BOM (Byte Order Mark) i starten av fila
  const cleaned = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;

  const json = JSON.parse(cleaned);

  if (Array.isArray(json)) {
    return json;
  }

  if (Array.isArray(json.DatesUtc)) {
    console.log(
      'Fant et array under nøkkelen "DatesUtc" – bruker dette som reservasjoner.',
    );
    return json.DatesUtc;
  }

  throw new Error(
    'Fant ikke et JSON-array i availability-response.json. ' +
      'Forventer enten et toppnivå-array eller en nøkkel "DatesUtc" med array.',
  );
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
function mapReservationToAssignment(r: AnyJson, today: Date) {
  // 1) Finn dato – prøver flere felter fra Mews-responsen
  const dateFromRaw: string | undefined =
    r.DateFrom ?? r.StartUtc ?? r.Start ?? r.Date;

  const dateFrom = parseDate(dateFromRaw);
  const serviceDate = dateFrom ? toYmd(dateFrom) : toYmd(today);

  // 2) Finn enhetsnavn / hyttenummer
  const unitName: string =
    r.ResourceName ??
    r.Resource?.Name ??
    r.Space?.Name ??
    r.UnitName ??
    r.UnitNumber ??
    'Mews enhet';

  const nowIso = new Date().toISOString();

  return {
    id: randomUUID(),
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
export async function runMewsSync() {
  const today = new Date();

  console.log('== MEWS → Supabase sync ==');
  console.log(`Dato som brukes: ${toYmd(today)}`);

  const reservations = loadRawMewsDataFromFile();
  console.log(
    `Leste ${reservations.length} objekt(er) fra Mews-JSON-filen.`,
  );

  if (reservations.length === 0) {
    console.log('Ingen reservasjoner å importere. Avslutter.');
    return;
  }

  const rows = reservations.map((r) => mapReservationToAssignment(r, today));

  console.log(
    `Forsøker å skrive ${rows.length} rad(er) til service_assignments...`,
  );

  const { error } = await supabase.from('service_assignments').insert(rows);

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

// scripts/mews-sync-cleaning.ts
//
// Leser reservasjoner fra Mews (for alle MEWS_SERVICE_IDS / MEWS_SERVICE_ID)
// og lager:
//   - vaskeoppdrag ("Sluttrengjøring ...") på avreisedato (lokal dato)  -> type: vask
//   - egne sengetøy-oppdrag ("Sengetøy ...") på ankomstdag (lokal dato) -> type: sengetoy
//
// Viktig:
// - DB har unik constraint på (date, unit_key, type) (i hvert fall for "vask").
//   Derfor må vi være idempotente på DB-nøkkelen, ikke bare (mews_reservation_id + type).
// - Noen DB-oppsett har unit_key som GENERATED COLUMN. Da kan den ikke oppdateres/skrives.
//   Vi håndterer dette ved å retry uten unit_key ved feilcode 428C9.
//
// Env (valgfritt):
// - DRY_RUN=1                   -> skriver ikke til DB, bare logger
// - MEWS_SYNC_DAYS_BACK=7       -> hvor mange dager bakover vi synker (default 1)
// - MEWS_SYNC_DAYS_AHEAD=180    -> hvor mange dager fremover vi synker (default 30)
// - HOTEL_TIMEZONE=Europe/Oslo  -> tidssone for local day (default Europe/Oslo)
// - MEWS_LINEN_SERVICE_IDS      -> serviceIds hvor linen-produkter finnes (orderable services)
// - MEWS_LINEN_PRODUCT_IDS      -> eksplisitte product IDs som skal regnes som linen
//
import { supabase } from '../lib/supabase';
import {
  fetchReservationsForCleaningRange,
  fetchProducts,
  fetchOrderItemsForCleaningRange,
  buildLinenCountMapFromOrderItems,
} from '../lib/mews';

const reservableServiceIds =
  (process.env.MEWS_SERVICE_IDS || process.env.MEWS_SERVICE_ID || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

if (!reservableServiceIds.length) {
  console.error('Ingen MEWS_SERVICE_IDS / MEWS_SERVICE_ID satt i .env – kan ikke kjøre cleaning-sync.');
  process.exit(1);
}

// Services som inneholder linen-produktene (Orderable service(r))
const linenServiceIds =
  (process.env.MEWS_LINEN_SERVICE_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// Tidssone for hotellet – brukes når vi konverterer Mews-datoer til lokal dag
const hotelTimeZone = (process.env.HOTEL_TIMEZONE || 'Europe/Oslo').trim();

// Produkter som skal regnes som sengetøy (valgfritt – se .env)
const LINEN_PRODUCT_IDS: string[] = (process.env.MEWS_LINEN_PRODUCT_IDS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const DRY_RUN = String(process.env.DRY_RUN || '').trim() === '1';

const DAYS_BACK = (() => {
  const n = Number(String(process.env.MEWS_SYNC_DAYS_BACK || '').trim());
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 1;
})();

const DAYS_AHEAD = (() => {
  const n = Number(String(process.env.MEWS_SYNC_DAYS_AHEAD || '').trim());
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 30;
})();

type MewsReservation = any;

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toLocalDateYmd(raw: string | Date | null | undefined): string {
  const today = new Date();
  if (!raw) return toYmd(today);

  const d = typeof raw === 'string' ? new Date(raw) : raw instanceof Date ? raw : new Date(raw as any);
  if (Number.isNaN(d.getTime())) return toYmd(today);

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: hotelTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(d); // YYYY-MM-DD
}

function getDepartureLocalDate(r: MewsReservation): string {
  const raw = r.EndUtc || r.ScheduledEndUtc || r.End || r.DepartureUtc || r.Departure || null;
  return toLocalDateYmd(raw);
}

function getArrivalLocalDate(r: MewsReservation): string {
  const raw = r.StartUtc || r.ScheduledStartUtc || r.Start || r.ArrivalUtc || r.Arrival || null;
  return toLocalDateYmd(raw);
}

function getSpaceId(r: MewsReservation): string | null {
  return r.AssignedResourceId || r.ResourceId || r.Resource?.Id || r.SpaceId || null;
}

function isReservationRelevant(r: MewsReservation): boolean {
  const state = String(r.State || r.ReservationState || r.Status || '').toLowerCase();
  if (state.includes('cancel')) return false;
  if (!state) return true;
  return ['confirmed', 'started', 'processed', 'checkedout'].some((s) => state.includes(s));
}

function normalizeUnitKey(unitName: string): string {
  return String(unitName || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * DB krever cabin_no NOT NULL.
 * Vi har ikke units.cabin_no, så vi derivér:
 * - Hvis unitName starter med token som inneholder tall (f.eks "17A", "34B", "1173", "981D") -> bruk det tokenet.
 * - Ellers fallback til hele unitName.
 */
function deriveCabinNo(unitName: string): string {
  const s = String(unitName || '').trim();
  if (!s) return 'UNKNOWN';

  const firstToken = s.split(/\s+/).filter(Boolean)[0] || '';
  if (/\d/.test(firstToken)) {
    return firstToken.trim();
  }
  return s;
}

function buildLinenProductMap(products: any[]): Record<string, { personsPerUnit: number; name: string }> {
  const map: Record<string, { personsPerUnit: number; name: string }> = {};

  for (const p of products || []) {
    const id = String(p.Id || p.ProductId || '').toLowerCase();
    if (!id) continue;

    let nameRaw =
      p.Name ||
      (p.Names && typeof p.Names === 'object' ? p.Names[Object.keys(p.Names)[0]] : '') ||
      '';
    nameRaw = String(nameRaw || '');
    const nameLower = nameRaw.toLowerCase();

    const explicitInEnv = LINEN_PRODUCT_IDS.includes(id);

    const looksLikeLinen =
      nameLower.includes('sengetøy') ||
      nameLower.includes('sengetoy') ||
      nameLower.includes('håndkl') ||
      nameLower.includes('handkl') ||
      nameLower.includes('bed linen') ||
      nameLower.includes('linen');

    if (!explicitInEnv && !looksLikeLinen) continue;

    let personsPerUnit = 1;
    const personsMatch = nameLower.match(/(\d+)\s*(pers|personer|person|p\b)/);
    if (personsMatch) {
      const parsed = Number(personsMatch[1]);
      if (!Number.isNaN(parsed) && parsed > 0) personsPerUnit = parsed;
    }

    map[id] = { personsPerUnit, name: nameRaw || id };
  }

  return map;
}

function mergeLinenMaps(
  a: Record<string, { personsPerUnit: number; name: string }>,
  b: Record<string, { personsPerUnit: number; name: string }>
) {
  for (const [k, v] of Object.entries(b)) {
    if (!a[k]) a[k] = v;
  }
}

function buildServiceOrderToReservationMap(reservations: MewsReservation[]): Record<string, string> {
  const map: Record<string, string> = {};

  const add = (k: any, rid: string) => {
    if (!k) return;
    const key = String(k).trim();
    if (!key) return;
    if (!map[key]) map[key] = rid;
  };

  for (const r of reservations || []) {
    const rid = String(r.Id || r.ReservationId || '').trim();
    if (!rid) continue;

    add(r.ServiceOrderId, rid);
    add(r.OrderId, rid);
    add(r.Order?.Id, rid);
    add(r.Order?.OrderId, rid);

    const items = Array.isArray(r.Items) ? r.Items : Array.isArray(r.OrderItems) ? r.OrderItems : [];
    for (const it of items) {
      add(it?.ServiceOrderId, rid);
      add(it?.OrderId, rid);
      add(it?.Order?.Id, rid);
      add(it?.Order?.OrderId, rid);
    }
  }

  return map;
}

function buildSyncWindow(): { start: Date; end: Date; label: string } {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - DAYS_BACK);

  const end = new Date(today);
  end.setDate(end.getDate() + DAYS_AHEAD);

  return {
    start,
    end,
    label: `${toYmd(start)} → ${toYmd(end)} (basert på lokal dato / departure)`,
  };
}

function changed(a: any, b: any): boolean {
  return String(a ?? '') !== String(b ?? '');
}

export async function runMewsCleaningSync() {
  console.log('== MEWS → Supabase cleaning+linen assignments sync ==');
  console.log('Reservable services:', reservableServiceIds.join(', '));
  console.log('Linen product services:', linenServiceIds.length ? linenServiceIds.join(', ') : '(ikke satt)');
  console.log(`DRY_RUN: ${DRY_RUN ? 'ON (skriver ikke til DB)' : 'OFF'}`);

  const { start, end, label } = buildSyncWindow();
  console.log(`Periode: ${label}`);

  // 1) Les units for mapping spaceId -> unit name
  const { data: unitRows, error: unitsError } = await supabase
    .from('units')
    .select('mews_space_id, name');

  if (unitsError) throw unitsError;

  const unitNameBySpaceId = new Map<string, string>();
  (unitRows || []).forEach((u: any) => {
    if (u.mews_space_id) unitNameBySpaceId.set(u.mews_space_id, u.name || u.mews_space_id);
  });

  // 2) Bygg linenProducts fra MEWS_LINEN_SERVICE_IDS (Orderable)
  const linenProducts: Record<string, { personsPerUnit: number; name: string }> = {};
  if (linenServiceIds.length) {
    for (const sid of linenServiceIds) {
      try {
        const products = await fetchProducts(sid);
        const map = buildLinenProductMap(products);
        mergeLinenMaps(linenProducts, map);
      } catch (err: any) {
        console.error(`Feil ved fetchProducts for linen serviceId=${sid}:`, err?.response?.data || err?.message || err);
      }
    }
  }
  console.log(`Linen produkter identifisert: ${Object.keys(linenProducts).length}`);

  // 3) Prefetch eksisterende assignments i vinduet
  const { data: existingWindowRows, error: existingWindowErr } = await supabase
    .from('service_assignments')
    .select('id,type,date,unit_name,unit_key,cabin_no,title,status,mews_reservation_id,mews_space_id,mews_service_id')
    .gte('date', toYmd(start))
    .lte('date', toYmd(end))
    .in('type', ['vask', 'sengetoy']);

  if (existingWindowErr) throw existingWindowErr;

  const existingByUnitDayType = new Map<string, any>(); // date::unit_key::type
  const existingByReservationAndType = new Map<string, any>(); // resId::type

  for (const row of existingWindowRows || []) {
    const date = String(row.date || '').trim();
    const type = String(row.type || '').trim();
    const unitKey = String(row.unit_key || '').trim();

    if (date && type && unitKey) {
      existingByUnitDayType.set(`${date}::${unitKey}::${type}`, row);
    }

    const rid = String(row.mews_reservation_id || '').trim();
    if (rid && type) {
      existingByReservationAndType.set(`${rid}::${type}`, row);
    }
  }

  let totalReservations = 0;

  let createdCleaning = 0;
  let updatedCleaning = 0;

  let createdLinen = 0;
  let updatedLinen = 0;

  // Robust update: retry uten unit_key hvis DB sier "generated column" (428C9)
  const updateById = async (id: string, payload: any, kindLabel: string) => {
    if (DRY_RUN) {
      console.log(`DRY_RUN update ${kindLabel} ->`, payload.date, payload.cabin_no, payload.title);
      return { ok: true, row: null as any };
    }

    let { data, error } = await supabase
      .from('service_assignments')
      .update(payload)
      .eq('id', id)
      .select('id,type,date,unit_key,mews_reservation_id')
      .maybeSingle();

    if (error && String((error as any).code || '') === '428C9' && Object.prototype.hasOwnProperty.call(payload, 'unit_key')) {
      const { unit_key, ...rest } = payload;
      ({ data, error } = await supabase
        .from('service_assignments')
        .update(rest)
        .eq('id', id)
        .select('id,type,date,unit_key,mews_reservation_id')
        .maybeSingle());
    }

    if (error) {
      console.error(`Update ${kindLabel} feilet:`, error);
      return { ok: false, error, row: null as any };
    }
    return { ok: true, row: data };
  };

  // Robust insert: retry uten unit_key hvis 428C9
  const insertRow = async (payload: any, kindLabel: string) => {
    if (DRY_RUN) {
      console.log(`DRY_RUN insert ${kindLabel} ->`, payload.date, payload.cabin_no, payload.title);
      return { ok: true, row: null as any };
    }

    let { data, error } = await supabase
      .from('service_assignments')
      .insert(payload)
      .select('id,type,date,unit_key,mews_reservation_id')
      .maybeSingle();

    if (error && String((error as any).code || '') === '428C9' && Object.prototype.hasOwnProperty.call(payload, 'unit_key')) {
      const { unit_key, ...rest } = payload;
      ({ data, error } = await supabase
        .from('service_assignments')
        .insert(rest)
        .select('id,type,date,unit_key,mews_reservation_id')
        .maybeSingle());
    }

    return { data, error };
  };

  const safeInsert = async (payload: any, expectedUnitKey: string, kindLabel: string) => {
    const first = await insertRow(payload, kindLabel);

    if (!first.error) {
      return { ok: true, inserted: first.data };
    }

    // Unik constraint: fallback til å finne raden og oppdatere den
    if (String((first.error as any).code || '') === '23505' && payload.date && expectedUnitKey && payload.type) {
      const { data: found, error: findErr } = await supabase
        .from('service_assignments')
        .select('id,type,date,unit_key,mews_reservation_id')
        .eq('date', payload.date)
        .eq('type', payload.type)
        .eq('unit_key', expectedUnitKey)
        .limit(1);

      if (!findErr && found && found[0]?.id) {
        const id = found[0].id;
        const updPayload: any = {
          title: payload.title,
          unit_name: payload.unit_name,
          cabin_no: payload.cabin_no,
          unit_key: payload.unit_key, // kan bli strippet i updateById ved 428C9
          mews_reservation_id: payload.mews_reservation_id,
          mews_space_id: payload.mews_space_id,
          mews_service_id: payload.mews_service_id,
          date: payload.date,
        };

        const upd = await updateById(id, updPayload, `${kindLabel} (collision-fallback)`);
        if (upd.ok) {
          return { ok: true, inserted: upd.row || { id, ...payload, unit_key: expectedUnitKey } };
        }
      }
    }

    console.error(`Insert ${kindLabel} feilet:`, first.error);
    return { ok: false, error: first.error };
  };

  for (const serviceId of reservableServiceIds) {
    console.log(`\n=== Reservable ServiceId: ${serviceId} ===`);

    let reservations: MewsReservation[] = [];
    try {
      reservations = await fetchReservationsForCleaningRange(serviceId, start, end);
    } catch (err: any) {
      console.error(
        `Feil ved fetchReservationsForCleaningRange serviceId=${serviceId}:`,
        err?.response?.data || err?.message || err
      );
      continue;
    }

    console.log(`Fikk ${reservations.length} reservasjon(er).`);

    // Bygg mapping slik at OrderItems med ServiceOrderId blir koblet til riktig reservationId
    const soToRes = buildServiceOrderToReservationMap(reservations);

    // Linen-count per reservation
    let linenCountByReservation: Record<string, number> = {};
    try {
      const sourceServiceIdsForItems = linenServiceIds.length ? linenServiceIds : [serviceId];
      const orderItems = await fetchOrderItemsForCleaningRange(sourceServiceIdsForItems, start, end);

      linenCountByReservation = buildLinenCountMapFromOrderItems(orderItems, linenProducts, soToRes);

      const withLinen = Object.values(linenCountByReservation).filter((n) => n > 0).length;
      console.log(
        `OrderItems: ${Array.isArray(orderItems) ? orderItems.length : 0}, reservasjoner med linen: ${withLinen}`
      );
    } catch (err: any) {
      console.error(
        `Feil ved fetchOrderItemsForCleaningRange serviceId=${serviceId}:`,
        err?.response?.data || err?.message || err
      );
    }

    for (const r of reservations) {
      if (!isReservationRelevant(r)) continue;

      totalReservations++;

      const reservationId = String(r.Id || r.ReservationId || '').trim();
      if (!reservationId) continue;

      const spaceId = getSpaceId(r);
      const unitName =
        (spaceId && unitNameBySpaceId.get(spaceId)) ||
        r.ResourceName ||
        r.UnitName ||
        `Ukjent enhet (${spaceId || 'no-space'})`;

      const unitKey = normalizeUnitKey(unitName);
      const cabinNo = deriveCabinNo(unitName);

      const dep = getDepartureLocalDate(r);
      const arr = getArrivalLocalDate(r);

      const linenCount = linenCountByReservation[reservationId] || 0;

      // ===========================================================
      // 1) Sluttrengjøring (vask)
      // ===========================================================
      {
        const type = 'vask';
        const title = `Sluttrengjøring ${unitName}`;

        const desired: any = {
          date: dep,
          unit_name: unitName,
          unit_key: unitKey, // kan bli ignorert hvis DB har generated column (retry håndterer)
          cabin_no: cabinNo,
          title,
          type,
          status: 'not_started',
          comment: 'Oppdrag generert automatisk fra Mews-reservasjon (sluttrengjøring).',
          mews_reservation_id: reservationId,
          mews_space_id: spaceId,
          mews_service_id: serviceId,
        };

        const keyResType = `${reservationId}::${type}`;
        const keyUnitDayType = `${desired.date}::${unitKey}::${type}`;

        const existingResType = existingByReservationAndType.get(keyResType);
        const existingUnitDayType = existingByUnitDayType.get(keyUnitDayType);

        if (existingResType) {
          const needsUpdate =
            changed(existingResType.date, desired.date) ||
            changed(existingResType.unit_name, desired.unit_name) ||
            changed(existingResType.cabin_no, desired.cabin_no) ||
            changed(existingResType.title, desired.title) ||
            changed(existingResType.mews_space_id, desired.mews_space_id) ||
            changed(existingResType.mews_service_id, desired.mews_service_id);

          if (needsUpdate) {
            const updPayload: any = {
              date: desired.date,
              unit_name: desired.unit_name,
              unit_key: desired.unit_key,
              cabin_no: desired.cabin_no,
              title: desired.title,
              mews_space_id: desired.mews_space_id,
              mews_service_id: desired.mews_service_id,
            };

            const upd = await updateById(existingResType.id, updPayload, 'vask');
            if (upd.ok) updatedCleaning++;

            const merged = { ...existingResType, ...updPayload, ...(upd.row || {}) };
            existingByReservationAndType.set(keyResType, merged);

            if (merged.date && merged.unit_key) {
              existingByUnitDayType.set(`${merged.date}::${merged.unit_key}::${type}`, merged);
            }
          }
        } else if (existingUnitDayType) {
          const updPayload: any = {
            date: desired.date,
            unit_name: desired.unit_name,
            unit_key: desired.unit_key,
            cabin_no: desired.cabin_no,
            title: desired.title,
            mews_reservation_id: desired.mews_reservation_id,
            mews_space_id: desired.mews_space_id,
            mews_service_id: desired.mews_service_id,
          };

          const upd = await updateById(existingUnitDayType.id, updPayload, 'vask (unit/day/type match)');
          if (upd.ok) updatedCleaning++;

          const merged = { ...existingUnitDayType, ...updPayload, ...(upd.row || {}) };
          existingByUnitDayType.set(`${merged.date}::${merged.unit_key}::${type}`, merged);
          existingByReservationAndType.set(keyResType, merged);
        } else {
          const ins = await safeInsert(desired, unitKey, 'vask');
          if (ins.ok) {
            createdCleaning++;
            const inserted = (ins as any).inserted;
            const merged = { ...desired, ...(inserted || {}) };

            if (merged.date && merged.unit_key) {
              existingByUnitDayType.set(`${merged.date}::${merged.unit_key}::${type}`, merged);
            }
            existingByReservationAndType.set(keyResType, merged);
          }
        }
      }

      // ===========================================================
      // 2) Sengetøy (sengetoy) – kun hvis linenCount > 0
      // ===========================================================
      if (linenCount > 0) {
        const type = 'sengetoy';
        const linenTitle = linenCount > 1 ? `Sengetøy x${linenCount} – ${unitName}` : `Sengetøy – ${unitName}`;

        const desired: any = {
          date: arr,
          unit_name: unitName,
          unit_key: unitKey,
          cabin_no: cabinNo,
          title: linenTitle,
          type,
          status: 'not_started',
          comment: 'Oppdrag generert automatisk fra Mews-reservasjon (sengetøy).',
          mews_reservation_id: reservationId,
          mews_space_id: spaceId,
          mews_service_id: serviceId,
        };

        const keyResType = `${reservationId}::${type}`;
        const keyUnitDayType = `${desired.date}::${unitKey}::${type}`;

        const existingResType = existingByReservationAndType.get(keyResType);
        const existingUnitDayType = existingByUnitDayType.get(keyUnitDayType);

        if (existingResType) {
          const needsUpdate =
            changed(existingResType.date, desired.date) ||
            changed(existingResType.unit_name, desired.unit_name) ||
            changed(existingResType.cabin_no, desired.cabin_no) ||
            changed(existingResType.title, desired.title) ||
            changed(existingResType.mews_space_id, desired.mews_space_id) ||
            changed(existingResType.mews_service_id, desired.mews_service_id);

          if (needsUpdate) {
            const updPayload: any = {
              date: desired.date,
              unit_name: desired.unit_name,
              unit_key: desired.unit_key,
              cabin_no: desired.cabin_no,
              title: desired.title,
              mews_space_id: desired.mews_space_id,
              mews_service_id: desired.mews_service_id,
            };

            const upd = await updateById(existingResType.id, updPayload, 'sengetoy');
            if (upd.ok) updatedLinen++;

            const merged = { ...existingResType, ...updPayload, ...(upd.row || {}) };
            existingByReservationAndType.set(keyResType, merged);

            if (merged.date && merged.unit_key) {
              existingByUnitDayType.set(`${merged.date}::${merged.unit_key}::${type}`, merged);
            }
          }
        } else if (existingUnitDayType) {
          const updPayload: any = {
            date: desired.date,
            unit_name: desired.unit_name,
            unit_key: desired.unit_key,
            cabin_no: desired.cabin_no,
            title: desired.title,
            mews_reservation_id: desired.mews_reservation_id,
            mews_space_id: desired.mews_space_id,
            mews_service_id: desired.mews_service_id,
          };

          const upd = await updateById(existingUnitDayType.id, updPayload, 'sengetoy (unit/day/type match)');
          if (upd.ok) updatedLinen++;

          const merged = { ...existingUnitDayType, ...updPayload, ...(upd.row || {}) };
          existingByUnitDayType.set(`${merged.date}::${merged.unit_key}::${type}`, merged);
          existingByReservationAndType.set(keyResType, merged);
        } else {
          const ins = await safeInsert(desired, unitKey, 'sengetoy');
          if (ins.ok) {
            createdLinen++;
            const inserted = (ins as any).inserted;
            const merged = { ...desired, ...(inserted || {}) };

            if (merged.date && merged.unit_key) {
              existingByUnitDayType.set(`${merged.date}::${merged.unit_key}::${type}`, merged);
            }
            existingByReservationAndType.set(keyResType, merged);
          }
        }
      }
    }
  }

  console.log('\n=== Oppsummering ===');
  console.log(`Reservasjoner behandlet: ${totalReservations}`);
  console.log(`Nye vask-oppdrag:        ${createdCleaning}`);
  console.log(`Oppdaterte vask-oppdrag: ${updatedCleaning}`);
  console.log(`Nye sengetøy-oppdrag:    ${createdLinen}`);
  console.log(`Oppdaterte sengetøy:     ${updatedLinen}`);
}

if (require.main === module) {
  runMewsCleaningSync().catch((err) => {
    console.error('Uventet feil i mews-sync-cleaning.ts:', err);
    process.exitCode = 1;
  });
}

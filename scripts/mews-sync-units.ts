// scripts/mews-sync-units.ts
//
// Henter alle "spaces"/enheter fra Mews for ALLE services i MEWS_SERVICE_IDS
// og synker dem til Supabase-tabellen `units`.
// Forutsetter at units har unik constraint på mews_space_id.

import * as dotenv from 'dotenv';
dotenv.config();

import { supabase } from '../lib/supabase';
import { fetchSpaces } from '../lib/mews';

const serviceIds =
  (process.env.MEWS_SERVICE_IDS || process.env.MEWS_SERVICE_ID || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

if (!serviceIds.length) {
  throw new Error('Missing MEWS_SERVICE_IDS (or MEWS_SERVICE_ID) in environment (.env)');
}

type MewsSpace = {
  Id?: string;
  Name?: string;
  ShortName?: string;
  ExternalIdentifier?: string;
  Number?: string;
  Capacity?: number;
  IsOutOfOrder?: boolean;
};

function normalizeSpaceId(s: MewsSpace): string | null {
  return (s.Id || s.ExternalIdentifier || s.Number || s.ShortName || null) as any;
}

export async function runMewsUnitsSync() {
  console.log('== MEWS → Supabase units sync (ALL services) ==');
  console.log(`Services: ${serviceIds.join(', ')}`);

  const allSpaces: MewsSpace[] = [];

  for (const serviceId of serviceIds) {
    console.log(`\n--- Fetch spaces for serviceId=${serviceId} ---`);
    const spaces = (await fetchSpaces(serviceId)) as MewsSpace[];
    console.log(`Fikk ${spaces.length} enhet(er).`);
    allSpaces.push(...(spaces || []));
  }

  // Dedup på mews_space_id
  const byId = new Map<string, MewsSpace>();
  for (const s of allSpaces) {
    const id = normalizeSpaceId(s);
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, s);
  }

  const rows = Array.from(byId.entries())
    .map(([mewsId, s]) => {
      const name =
        s.Name || s.ShortName || s.ExternalIdentifier || s.Number || 'Uten navn';
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

  const { error } = await supabase
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

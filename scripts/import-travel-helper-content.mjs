import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
).trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Mangler SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const filePath = path.resolve(
    process.cwd(),
    'scripts',
    'travel-helper-content.json'
  );

  const raw = await fs.readFile(filePath, 'utf8');
  const items = JSON.parse(raw);

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Ingen elementer funnet i travel-helper-content.json');
  }

  const payload = items.map((item) => ({
    slug: item.slug,
    language: item.language || 'nb',
    destination_slug: item.destination_slug || 'global',
    category: item.category,
    title: item.title,
    summary: item.summary || null,
    body: item.body || null,
    tags: Array.isArray(item.tags) ? item.tags : [],
    source_type: item.source_type || 'bno',
    app_route: item.app_route || null,
    external_url: item.external_url || null,
    is_featured: Boolean(item.is_featured),
    is_active: item.is_active !== false,
    sort_order: Number(item.sort_order || 0),
  }));

  const { data, error } = await supabase
    .from('travel_helper_content')
    .upsert(payload, { onConflict: 'slug' })
    .select('id, slug, title');

  if (error) {
    throw error;
  }

  console.log('Import fullført:', data?.length || 0, 'rader');
  console.log(data);
}

main().catch((err) => {
  console.error('Import feilet:', err);
  process.exit(1);
});
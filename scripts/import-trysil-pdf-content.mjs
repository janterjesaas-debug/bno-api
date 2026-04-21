import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { createClient } from '@supabase/supabase-js';

function normalizeRow(row, fallbackSource = 'pdf_curation') {
  return {
    slug: String(row?.slug || '').trim(),
    language: String(row?.language || 'nb').trim().toLowerCase(),
    destination_slug: String(row?.destination_slug || 'global').trim().toLowerCase(),
    category: String(row?.category || '').trim().toLowerCase(),
    title: String(row?.title || '').trim(),
    summary: String(row?.summary || '').trim(),
    body: String(row?.body || '').trim(),
    tags: Array.isArray(row?.tags) ? row.tags : [],
    source_type: String(row?.source_type || fallbackSource).trim().toLowerCase(),
    app_route: row?.app_route ?? null,
    external_url: row?.external_url ?? null,
    is_featured: Boolean(row?.is_featured ?? false),
    is_active: Boolean(row?.is_active ?? true),
    sort_order: Number(row?.sort_order ?? 0),
  };
}

function validateRow(row, fileName, index) {
  const missing = [];

  if (!row.slug) missing.push('slug');
  if (!row.language) missing.push('language');
  if (!row.destination_slug) missing.push('destination_slug');
  if (!row.category) missing.push('category');
  if (!row.title) missing.push('title');
  if (!row.summary) missing.push('summary');
  if (!row.body) missing.push('body');

  if (missing.length) {
    throw new Error(
      `${fileName} rad ${index + 1} mangler: ${missing.join(', ')}\n${JSON.stringify(row, null, 2)}`
    );
  }
}

async function readJsonArray(filePath, fallbackSource = 'pdf_curation') {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`Filen er ikke en array: ${filePath}`);
  }

  return parsed.map((row, index) => {
    const normalized = normalizeRow(row, fallbackSource);
    validateRow(normalized, path.basename(filePath), index);
    return normalized;
  });
}

async function main() {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const supabaseKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Mangler SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i .env');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const inputPath = path.resolve(process.cwd(), 'scripts', 'trysil_content_from_pdf.json');
  const rows = await readJsonArray(inputPath, 'pdf_curation');

  if (!rows.length) {
    throw new Error('Ingen rader å importere.');
  }

  const slugSet = new Set();
  for (const row of rows) {
    if (slugSet.has(row.slug)) {
      throw new Error(`Duplikat slug funnet i importfilen: ${row.slug}`);
    }
    slugSet.add(row.slug);
  }

  const { data, error } = await supabase
    .from('travel_helper_content')
    .upsert(rows, { onConflict: 'slug' })
    .select('id, slug, title, source_type, is_active');

  if (error) {
    throw error;
  }

  console.log(`Import fullført: ${data?.length || 0} rader`);
  console.log(data);
}

main().catch((error) => {
  console.error('\nImport feilet:\n');
  console.error(error);
  process.exit(1);
});
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_INPUT_DIR = path.resolve(
  process.cwd(),
  'scripts',
  'travel-helper-content-import'
);

const BATCH_SIZE = Number(process.env.TRAVEL_HELPER_IMPORT_BATCH_SIZE || 200);

function normalizeText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function normalizeKey(value, fallback = '') {
  return normalizeText(value, fallback).toLowerCase();
}

function parseBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value == null || value === '') return fallback;

  const text = String(value).trim().toLowerCase();

  if (['1', 'true', 'yes', 'ja'].includes(text)) return true;
  if (['0', 'false', 'no', 'nei'].includes(text)) return false;

  return fallback;
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((tag) => String(tag || '').trim())
    .filter(Boolean);
}

function normalizeRow(row, fallbackSource = 'curated') {
  return {
    slug: normalizeKey(row?.slug),
    language: normalizeKey(row?.language, 'nb'),
    destination_slug: normalizeKey(row?.destination_slug, 'global'),
    category: normalizeKey(row?.category),
    title: normalizeText(row?.title),
    summary: normalizeText(row?.summary),
    body: normalizeText(row?.body),
    tags: normalizeTags(row?.tags),
    source_type: normalizeKey(row?.source_type, fallbackSource),
    app_route: row?.app_route == null ? null : normalizeText(row.app_route),
    external_url:
      row?.external_url == null ? null : normalizeText(row.external_url),
    is_featured: parseBoolean(row?.is_featured, false),
    is_active: parseBoolean(row?.is_active, true),
    sort_order: Number.isFinite(Number(row?.sort_order))
      ? Number(row.sort_order)
      : 0,
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
      `${fileName} rad ${index + 1} mangler: ${missing.join(', ')}\n${JSON.stringify(
        row,
        null,
        2
      )}`
    );
  }
}

async function readJsonArray(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`Filen må være en JSON-array: ${filePath}`);
  }

  const fileName = path.basename(filePath);

  return parsed.map((row, index) => {
    const normalized = normalizeRow(row, 'curated');
    validateRow(normalized, fileName, index);
    return normalized;
  });
}

async function findJsonFiles(inputDir) {
  const entries = await fs.readdir(inputDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .sort((a, b) => a.localeCompare(b, 'nb'))
    .map((name) => path.join(inputDir, name));
}

function assertUniqueSlugs(rows) {
  const seen = new Map();

  for (const row of rows) {
    if (seen.has(row.slug)) {
      throw new Error(
        `Duplikat slug funnet: ${row.slug}\nFørste: ${seen.get(
          row.slug
        )}\nNy: ${row.title}`
      );
    }

    seen.set(row.slug, row.title);
  }
}

function chunkRows(rows, size) {
  const chunks = [];

  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }

  return chunks;
}

async function main() {
  const supabaseUrl = normalizeText(process.env.SUPABASE_URL);
  const supabaseKey = normalizeText(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  );

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Mangler SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY'
    );
  }

  const inputDir = path.resolve(process.argv[2] || DEFAULT_INPUT_DIR);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });

  const files = await findJsonFiles(inputDir);

  if (!files.length) {
    throw new Error(`Fant ingen .json-filer i ${inputDir}`);
  }

  console.log('Importerer Travel Helper content fra:');
  for (const file of files) {
    console.log(`- ${path.relative(process.cwd(), file)}`);
  }

  const rowsByFile = await Promise.all(
    files.map(async (file) => {
      const rows = await readJsonArray(file);
      console.log(`${path.basename(file)}: ${rows.length} rader`);
      return rows;
    })
  );

  const rows = rowsByFile.flat();

  if (!rows.length) {
    throw new Error('Ingen rader å importere.');
  }

  assertUniqueSlugs(rows);

  const batches = chunkRows(rows, BATCH_SIZE);
  let imported = 0;

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];

    const { error } = await supabase
      .from('travel_helper_content')
      .upsert(batch, { onConflict: 'slug' });

    if (error) {
      throw new Error(
        `Import feilet i batch ${i + 1}/${batches.length}: ${
          error.message || JSON.stringify(error)
        }`
      );
    }

    imported += batch.length;
    console.log(`Batch ${i + 1}/${batches.length}: ${imported}/${rows.length}`);
  }

  console.log(`Import fullført: ${imported} rader`);
}

main().catch((error) => {
  console.error('\nImport feilet:\n');
  console.error(error);
  process.exit(1);
});
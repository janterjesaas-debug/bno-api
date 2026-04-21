"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabaseDescriptionForResourceCategory = getSupabaseDescriptionForResourceCategory;

const supabase_js_1 = require("@supabase/supabase-js");

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

function normalizeLocale(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
}

function buildLocaleCandidates(lang) {
  const raw = normalizeLocale(lang || 'en');
  const base = raw.split('-')[0] || '';

  const out = [];

  function add(v) {
    const s = normalizeLocale(v);
    if (!s) return;
    if (out.indexOf(s) === -1) out.push(s);
  }

  // Requested locale first
  add(raw);

  // Base language next
  add(base);

  // Norwegian aliases
  if (base === 'no') {
    add('nb');
    add('nb-no');
  }
  if (base === 'nb') {
    add('no');
    add('nb-no');
  }

  // Common safe fallbacks
  add('en');
  add('en-gb');
  add('nb');
  add('nb-no');

  return out;
}

async function getSupabaseDescriptionForResourceCategory(rcId, lang) {
  try {
    const id = String(rcId || '').trim().toLowerCase();
    const requested = normalizeLocale(lang || 'en');

    if (!id) return null;
    if (!supabase) return null;

    const client = supabase;

    const { data: rows, error } = await client
      .from('resource_category_translations')
      .select('resource_category_id, locale, title, short_description')
      .eq('resource_category_id', id);

    if (error) {
      console.error('[SUPABASE CONTENT] query error', {
        rcId: id,
        lang: requested,
        error,
      });
      return null;
    }

    if (!rows || rows.length === 0) {
      console.warn('[SUPABASE CONTENT] no rows found', {
        rcId: id,
        lang: requested,
      });
      return null;
    }

    const normalizedRows = rows.map((r) => ({
      resource_category_id: String(r.resource_category_id || '').trim().toLowerCase(),
      locale: normalizeLocale(r.locale || ''),
      title: r.title == null ? '' : String(r.title),
      short_description: r.short_description == null ? '' : String(r.short_description),
    }));

    const candidates = buildLocaleCandidates(requested);

    let row = null;

    for (let i = 0; i < candidates.length; i++) {
      const wanted = candidates[i];
      row = normalizedRows.find((r) => r.locale === wanted);
      if (row) break;
    }

    if (!row) {
      row = normalizedRows[0] || null;
    }

    if (!row) return null;

    return {
      title: row.title || '',
      description: row.short_description || '',
      localeUsed: row.locale,
    };
  } catch (e) {
    console.error('[SUPABASE CONTENT] unexpected error', e);
    return null;
  }
}
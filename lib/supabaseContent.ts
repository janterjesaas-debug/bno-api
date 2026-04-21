import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

function normalizeLocale(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
}

function buildLocaleCandidates(lang: string): string[] {
  const raw = normalizeLocale(lang || 'en');
  const base = raw.split('-')[0] || '';

  const out: string[] = [];

  function add(v: string) {
    const s = normalizeLocale(v);
    if (!s) return;
    if (!out.includes(s)) out.push(s);
  }

  add(raw);
  add(base);

  if (base === 'no') {
    add('nb');
    add('nb-no');
  }
  if (base === 'nb') {
    add('no');
    add('nb-no');
  }

  add('en');
  add('en-gb');
  add('nb');
  add('nb-no');

  return out;
}

export async function getSupabaseDescriptionForResourceCategory(
  rcId: string,
  lang: string
): Promise<{ title: string; description: string; localeUsed: string } | null> {
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

    const normalizedRows = rows.map((r: any) => ({
      resource_category_id: String(r.resource_category_id || '').trim().toLowerCase(),
      locale: normalizeLocale(r.locale || ''),
      title: r.title == null ? '' : String(r.title),
      short_description: r.short_description == null ? '' : String(r.short_description),
    }));

    const candidates = buildLocaleCandidates(requested);

    let row =
      candidates
        .map((wanted) => normalizedRows.find((r) => r.locale === wanted))
        .find(Boolean) || normalizedRows[0];

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
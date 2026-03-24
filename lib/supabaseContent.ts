import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

export async function getSupabaseDescriptionForResourceCategory(
  rcId: string,
  lang: string
): Promise<{ title: string; description: string; localeUsed: string } | null> {
  try {
    const id = String(rcId || '').trim().toLowerCase();
    const requested = String(lang || 'en').trim().toLowerCase();

    if (!id) return null;
    if (!supabase) return null;

    const client = supabase;

    // 1) Hent alle rader for denne resource_category_id
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
      locale: String(r.locale || '').trim().toLowerCase(),
      title: r.title == null ? '' : String(r.title),
      short_description: r.short_description == null ? '' : String(r.short_description),
    }));

    // 2) Prøv eksakt språk
    let row =
      normalizedRows.find((r) => r.locale === requested) ||
      normalizedRows.find((r) => r.locale === 'en') ||
      normalizedRows.find((r) => r.locale === 'nb') ||
      normalizedRows[0];

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
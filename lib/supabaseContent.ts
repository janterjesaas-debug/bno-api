import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

type ResourceTranslationRow = {
  resource_category_id: string;
  locale: string;
  unit_name?: string | null;
  area_slug?: string | null;
  area_name?: string | null;
  municipality?: string | null;
  title?: string | null;
  short_description?: string | null;
};

function normalizeLocale(input: string): string {
  const s = String(input || '').trim().toLowerCase();

  if (!s) return 'nb';
  if (s === 'nb-no' || s === 'no-no' || s === 'no') return 'nb';
  if (s === 'en-us' || s === 'en-gb') return 'en';
  if (s === 'de-de') return 'de';
  if (s === 'fr-fr') return 'fr';
  if (s === 'es-es') return 'es';
  if (s === 'pt-pt' || s === 'pt-br') return 'pt';
  if (s === 'nl-nl') return 'nl';
  if (s === 'pl-pl') return 'pl';
  if (s === 'fi-fi') return 'fi';
  if (s === 'sv-se') return 'sv';
  if (s === 'da-dk') return 'da';
  if (s === 'is-is') return 'is';
  if (s === 'zh-cn' || s === 'zh-hans' || s === 'zh-hant') return 'zh';

  return s;
}

function localeFallbacks(requestedLang: string): string[] {
  const primary = normalizeLocale(requestedLang);
  const out = [primary];

  if (!out.includes('en')) out.push('en');
  if (!out.includes('nb')) out.push('nb');

  return out;
}

const localCache: Record<string, { expires: number; data: any }> = {};

function getLocalCache(key: string) {
  const hit = localCache[key];
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    delete localCache[key];
    return null;
  }
  return hit.data;
}

function setLocalCache(key: string, data: any, ttlSec = 300) {
  localCache[key] = {
    expires: Date.now() + ttlSec * 1000,
    data,
  };
}

export async function getSupabaseDescriptionForResourceCategory(
  resourceCategoryId: string,
  requestedLang: string
): Promise<{
  title: string | null;
  description: string | null;
  localeUsed: string | null;
} | null> {
  const rcId = String(resourceCategoryId || '').trim();
  if (!rcId || !supabase) return null;

  const langs = localeFallbacks(requestedLang);
  const cacheKey = `supabase_rc_desc:${rcId}:${langs.join('|')}`;
  const cached = getLocalCache(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('resource_category_translations')
    .select('resource_category_id, locale, title, short_description')
    .eq('resource_category_id', rcId)
    .in('locale', langs);

  if (error || !data || !data.length) {
    setLocalCache(cacheKey, null, 120);
    return null;
  }

  const rows = data as ResourceTranslationRow[];

  for (const lang of langs) {
    const row = rows.find((r) => normalizeLocale(r.locale) === lang);
    if (row && (row.short_description || row.title)) {
      const result = {
        title: row.title ?? null,
        description: row.short_description ?? null,
        localeUsed: row.locale ?? null,
      };
      setLocalCache(cacheKey, result, 300);
      return result;
    }
  }

  setLocalCache(cacheKey, null, 120);
  return null;
}
import { supabase } from './supabase';

export type TravelHelperContentItem = {
  slug: string;
  language: string;
  destination_slug: string;
  category: string;
  title: string;
  summary: string | null;
  body: string | null;
  tags: string[];
  source_type: string;
  app_route: string | null;
  external_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ListTravelHelperContentOptions = {
  language?: string;
  destinationSlug?: string;
  category?: string;
  sourceType?: string;
  featuredOnly?: boolean;
  activeOnly?: boolean;
  search?: string;
  limit?: number;
};

const SELECT_FIELDS = [
  'slug',
  'language',
  'destination_slug',
  'category',
  'title',
  'summary',
  'body',
  'tags',
  'source_type',
  'app_route',
  'external_url',
  'is_featured',
  'is_active',
  'sort_order',
  'created_at',
  'updated_at',
].join(', ');

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function normalizeKey(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizeLanguage(value: unknown): string {
  const raw = normalizeKey(value || 'nb').replace(/_/g, '-');

  if (!raw) return 'nb';
  if (raw === 'no' || raw === 'nb-no') return 'nb';

  return raw;
}

function languageCandidates(value: unknown): string[] {
  const primary = normalizeLanguage(value || 'nb');
  const candidates = [primary];

  if (primary === 'nb') {
    candidates.push('no', 'nb-no');
  }

  if (primary === 'en') {
    candidates.push('en-gb', 'en-us');
  }

  return [...new Set(candidates)];
}

function clampLimit(value: unknown, fallback = 200, max = 1000): number {
  const n = Number(value);

  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(n), max);
}

function sanitizeSearch(value: unknown): string {
  return normalizeText(value)
    .replace(/[%(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapRow(row: any): TravelHelperContentItem {
  return {
    slug: String(row?.slug || ''),
    language: String(row?.language || 'nb'),
    destination_slug: String(row?.destination_slug || ''),
    category: String(row?.category || ''),
    title: String(row?.title || ''),
    summary: row?.summary == null ? null : String(row.summary),
    body: row?.body == null ? null : String(row.body),
    tags: Array.isArray(row?.tags)
      ? row.tags.map((tag: any) => String(tag))
      : [],
    source_type: String(row?.source_type || 'curated'),
    app_route: row?.app_route == null ? null : String(row.app_route),
    external_url: row?.external_url == null ? null : String(row.external_url),
    is_featured: Boolean(row?.is_featured),
    is_active: Boolean(row?.is_active),
    sort_order: Number(row?.sort_order || 0),
    created_at: row?.created_at == null ? null : String(row.created_at),
    updated_at: row?.updated_at == null ? null : String(row.updated_at),
  };
}

export async function listTravelHelperContent(
  opts: ListTravelHelperContentOptions = {}
): Promise<TravelHelperContentItem[]> {
  const language = normalizeLanguage(opts.language || 'nb');
  const destinationSlug = normalizeKey(opts.destinationSlug);
  const category = normalizeKey(opts.category);
  const sourceType = normalizeKey(opts.sourceType);
  const search = sanitizeSearch(opts.search);
  const limit = clampLimit(opts.limit);

  let query = supabase
    .from('travel_helper_content')
    .select(SELECT_FIELDS)
    .in('language', languageCandidates(language))
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })
    .limit(limit);

  if (opts.activeOnly !== false) {
    query = query.eq('is_active', true);
  }

  if (destinationSlug) {
    query = query.eq('destination_slug', destinationSlug);
  }

  if (category) {
    query = query.eq('category', category);
  }

  if (sourceType) {
    query = query.eq('source_type', sourceType);
  }

  if (opts.featuredOnly === true) {
    query = query.eq('is_featured', true);
  }

  if (search) {
    query = query.or(
      `title.ilike.%${search}%,summary.ilike.%${search}%,body.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error('[TRAVEL HELPER CONTENT] list failed', {
      error,
      opts,
    });

    throw new Error(error.message || 'Kunne ikke hente Travel Helper-innhold');
  }

  return Array.isArray(data) ? data.map(mapRow) : [];
}

export async function getTravelHelperContentBySlug(
  slugRaw: unknown,
  opts: {
    activeOnly?: boolean;
  } = {}
): Promise<TravelHelperContentItem | null> {
  const slug = normalizeKey(slugRaw);

  if (!slug) {
    return null;
  }

  let query = supabase
    .from('travel_helper_content')
    .select(SELECT_FIELDS)
    .eq('slug', slug)
    .limit(1);

  if (opts.activeOnly !== false) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('[TRAVEL HELPER CONTENT] get by slug failed', {
      slug,
      error,
    });

    throw new Error(error.message || 'Kunne ikke hente Travel Helper-innhold');
  }

  return data ? mapRow(data) : null;
}

export async function getTravelHelperContentStats(): Promise<{
  activeCount: number;
  totalCount: number;
}> {
  const activeResult = await supabase
    .from('travel_helper_content')
    .select('slug', { count: 'exact', head: true })
    .eq('is_active', true);

  if (activeResult.error) {
    throw new Error(activeResult.error.message);
  }

  const totalResult = await supabase
    .from('travel_helper_content')
    .select('slug', { count: 'exact', head: true });

  if (totalResult.error) {
    throw new Error(totalResult.error.message);
  }

  return {
    activeCount: activeResult.count || 0,
    totalCount: totalResult.count || 0,
  };
}
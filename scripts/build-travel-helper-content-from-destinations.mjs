import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import process from 'process';

const ROOT = process.cwd();
const DEST_DIR = path.resolve(ROOT, 'api', 'content', 'destinations');
const OUT_GENERATED = path.resolve(ROOT, 'scripts', 'travel-helper-content.generated.json');
const OUT_CITIES = path.resolve(ROOT, 'scripts', 'travel-helper-content.cities.json');

const CATEGORY_MAP = {
  restaurants: 'restaurant',
  activities: 'activity',
  gyms: 'fitness',
  spa_wellness: 'spa',
  shopping: 'shopping',
};

function normalizeLanguage(locale) {
  const value = String(locale || 'en-GB').toLowerCase();
  if (value.startsWith('nb') || value.startsWith('no')) return 'nb';
  return 'en';
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function toTags(item) {
  const tagKeys = ensureArray(item?.tags).map((t) => t?.key || t?.label).filter(Boolean);
  const recommendedFor = ensureArray(item?.recommendation?.recommended_for);
  const seasonality = ensureArray(item?.recommendation?.seasonality);
  return uniq([...tagKeys, ...recommendedFor, ...seasonality]);
}

function buildBody(item) {
  const parts = [
    item?.content?.long_description || '',
    '',
    ensureArray(item?.content?.highlights).length
      ? 'Highlights:\n' + ensureArray(item.content.highlights).map((x) => `- ${x}`).join('\n')
      : '',
    '',
    ensureArray(item?.content?.insider_tips).length
      ? 'Insider tips:\n' + ensureArray(item.content.insider_tips).map((x) => `- ${x}`).join('\n')
      : '',
  ].filter((x) => x !== '');
  return parts.join('\n');
}

function buildExternalUrl(item) {
  return (
    item?.source?.google_places?.website ||
    item?.source?.google_places?.maps_url ||
    item?.source?.google_places?.url ||
    null
  );
}

function buildGeneratedRows(master) {
  const rows = [];
  const destinationSlug = String(master?.slug || '').trim().toLowerCase();
  const language = normalizeLanguage(master?.locale);

  const categories = master?.categories || {};

  for (const [sourceCategory, block] of Object.entries(categories)) {
    const mappedCategory = CATEGORY_MAP[sourceCategory];
    if (!mappedCategory) continue;

    const items = ensureArray(block?.items);

    for (const item of items) {
      const slug = `${destinationSlug}-${mappedCategory}-${String(item?.slug || item?.id || '').trim()}`;

      rows.push({
        slug,
        language,
        destination_slug: destinationSlug,
        category: mappedCategory,
        title: String(item?.name || item?.content?.title || '').trim(),
        summary: String(item?.content?.short_description || '').trim(),
        body: buildBody(item),
        tags: toTags(item),
        source_type: item?.source?.type ? String(item.source.type).toLowerCase() : 'editorial',
        app_route: `/destinations/${destinationSlug}/${mappedCategory}/${String(item?.slug || '').trim()}`,
        external_url: buildExternalUrl(item),
        is_featured: Boolean(item?.recommendation?.is_featured),
        is_active: String(item?.status || 'active').toLowerCase() === 'active',
        sort_order: Number(item?.sort_order || 0),
      });
    }
  }

  return rows;
}

function buildCityRow(master) {
  const destinationSlug = String(master?.slug || '').trim().toLowerCase();
  const language = normalizeLanguage(master?.locale);
  const editorial = master?.editorial || {};

  const neighborhoodTips = ensureArray(editorial?.neighborhood_tips)
    .map((x) => `- ${x?.name}: ${x?.tip}`)
    .join('\n');

  const whyVisit = ensureArray(editorial?.why_visit)
    .map((x) => `- ${x}`)
    .join('\n');

  const transportTips = ensureArray(editorial?.transport_tips)
    .map((x) => `- ${x}`)
    .join('\n');

  const highlights = ensureArray(editorial?.highlights)
    .map((x) => `- ${x}`)
    .join('\n');

  return {
    slug: `${destinationSlug}-destination-guide`,
    language,
    destination_slug: destinationSlug,
    category: 'destination_guide',
    title: String(editorial?.headline || master?.city?.name || destinationSlug).trim(),
    summary: String(editorial?.intro || '').trim(),
    body: [
      editorial?.intro || '',
      '',
      whyVisit ? `Why visit:\n${whyVisit}` : '',
      '',
      highlights ? `Highlights:\n${highlights}` : '',
      '',
      transportTips ? `Transport tips:\n${transportTips}` : '',
      '',
      neighborhoodTips ? `Neighborhood tips:\n${neighborhoodTips}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    tags: uniq([
      destinationSlug,
      master?.country?.slug,
      master?.country?.code,
      master?.city?.name,
      'destination',
      'guide',
    ]),
    source_type: 'editorial',
    app_route: `/destinations/${destinationSlug}`,
    external_url: null,
    is_featured: true,
    is_active: true,
    sort_order: 0,
  };
}

async function main() {
  const files = (await fs.readdir(DEST_DIR))
    .filter((name) => name.toLowerCase().endsWith('.json'));

  if (!files.length) {
    throw new Error(`Fant ingen JSON-filer i ${DEST_DIR}`);
  }

  const generatedRows = [];
  const cityRows = [];

  for (const fileName of files) {
    const fullPath = path.join(DEST_DIR, fileName);
    const raw = await fs.readFile(fullPath, 'utf8');
    const parsed = JSON.parse(raw);

    generatedRows.push(...buildGeneratedRows(parsed));
    cityRows.push(buildCityRow(parsed));
  }

  await fs.writeFile(OUT_GENERATED, JSON.stringify(generatedRows, null, 2), 'utf8');
  await fs.writeFile(OUT_CITIES, JSON.stringify(cityRows, null, 2), 'utf8');

  console.log(`Skrev ${generatedRows.length} generated-rader til ${OUT_GENERATED}`);
  console.log(`Skrev ${cityRows.length} city-rader til ${OUT_CITIES}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
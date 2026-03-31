import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import * as cheerio from 'cheerio';

/**
 * KONFIGURASJON
 *
 * Bytt ut URL-ene under med de faktiske BNO-sidene dine.
 * Start gjerne med 1-2 sider først.
 */
const SOURCES = [
  {
    url: 'https://bno-travel.com/reisevilkar-bno-travel/',
    language: 'nb',
    destination_slug: 'global',
    category: 'travel_terms',
    mode: 'split_travel_terms',
  },
  {
    url: 'https://bno-travel.com/opplev-trysil-1-av-norges-storste-skidestinasjoner/',
    language: 'nb',
    destination_slug: 'trysil',
    category: 'activity',
    mode: 'single_page',
    title: 'Aktiviteter i Trysil',
    tags: ['trysil', 'aktivitet', 'opplevelser'],
    is_featured: true,
    sort_order: 100,
  },
  {
    url: 'https://bno-travel.com/alpint-i-trysil-norges-storste-skianlegg/',
    language: 'nb',
    destination_slug: 'trysil',
    category: 'activity',
    mode: 'single_page',
    title: 'Alpint i Trysil',
    tags: ['alpinløyper', 'heiser og nedfarter', 'gondol', 'skiskole'],
    is_featured: true,
    sort_order: 110,
  },
  {
    url: 'https://bno-travel.com/langrenn-i-trysil-med-over-100-km-loyper/',
    language: 'nb',
    destination_slug: 'trysil',
    category: 'activity',
    mode: 'single_page',
    title: 'Langrenn i Trysil',
    tags: ['løyper', 'langrenn', 'trysilfjellet', 'skiutstyr'],
    is_featured: true,
    sort_order: 120,
  },
];

/**
 * Hjelpefunksjoner
 */
function cleanText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanInline(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^\w\s-]/g, '')
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (cleanInline(value)) return cleanInline(value);
  }
  return '';
}

function makeSummary(text, maxLength = 220) {
  const cleaned = cleanInline(text);
  if (!cleaned) return '';
  if (cleaned.length <= maxLength) return cleaned;

  const cut = cleaned.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > 80) {
    return `${cut.slice(0, lastSpace).trim()}...`;
  }
  return `${cut.trim()}...`;
}

function splitParagraphs(text) {
  return cleanText(text)
    .split(/\n{2,}/)
    .map((part) => cleanText(part))
    .filter(Boolean);
}

function dedupeTags(tags) {
  const seen = new Set();
  const result = [];

  for (const tag of ensureArray(tags)) {
    const cleaned = cleanInline(tag).toLowerCase();
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    result.push(cleaned);
  }

  return result;
}

function validateRow(row, index) {
  const missing = [];

  if (!row.slug) missing.push('slug');
  if (!row.language) missing.push('language');
  if (!row.destination_slug) missing.push('destination_slug');
  if (!row.category) missing.push('category');
  if (!row.title) missing.push('title');
  if (!row.summary) missing.push('summary');
  if (!row.body) missing.push('body');

  if (missing.length > 0) {
    throw new Error(
      `Rad ${index + 1} mangler felter: ${missing.join(', ')}\n${JSON.stringify(row, null, 2)}`
    );
  }
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'BNO-Travel-Helper-Content-Builder/1.0',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ved henting av ${url}`);
  }

  return await res.text();
}

function removeNoise($) {
  $(
    [
      'script',
      'style',
      'noscript',
      'svg',
      'iframe',
      'header',
      'footer',
      'nav',
      'form',
      'button',
      'aside',
      '.cookie',
      '.cookies',
      '.cookie-banner',
      '.newsletter',
      '.site-header',
      '.site-footer',
      '.menu',
      '.nav',
      '.navigation',
      '.breadcrumb',
      '.breadcrumbs',
    ].join(', ')
  ).remove();
}

function extractMainContent(html) {
  const $ = cheerio.load(html);
  removeNoise($);

  const title = firstNonEmpty(
    $('main h1').first().text(),
    $('article h1').first().text(),
    $('h1').first().text(),
    $('title').first().text()
  );

  const candidates = [
    'main',
    'article',
    '.entry-content',
    '.post-content',
    '.page-content',
    '.content',
    '.container',
    'body',
  ];

  let bestText = '';
  let bestSelector = '';

  for (const selector of candidates) {
    const node = $(selector).first();
    if (!node || node.length === 0) continue;

    const text = cleanText(node.text());
    if (text.length > bestText.length) {
      bestText = text;
      bestSelector = selector;
    }
  }

  return {
    title,
    text: bestText,
    selector: bestSelector,
  };
}

function buildDefaultRow(source, partial) {
  const title = cleanInline(partial.title);
  const body = cleanText(partial.body);
  const summary = cleanInline(partial.summary || makeSummary(body));

  return {
    slug: cleanInline(partial.slug),
    language: cleanInline(partial.language || source.language || 'nb'),
    destination_slug: cleanInline(partial.destination_slug || source.destination_slug || 'global'),
    category: cleanInline(partial.category || source.category),
    title,
    summary,
    body,
    tags: dedupeTags(partial.tags || source.tags || []),
    source_type: cleanInline(partial.source_type || 'bno'),
    app_route: partial.app_route ?? source.app_route ?? null,
    external_url: partial.external_url ?? source.url ?? null,
    is_featured: Boolean(partial.is_featured ?? source.is_featured ?? false),
    is_active: Boolean(partial.is_active ?? true),
    sort_order: Number(partial.sort_order ?? source.sort_order ?? 0),
  };
}

function pageToSingleRow(extracted, source) {
  const title = firstNonEmpty(source.title, extracted.title, 'Uten tittel');
  const body = cleanText(extracted.text);

  const slug =
    cleanInline(source.slug) ||
    slugify(`${source.destination_slug}-${source.category}-${source.language}-${title}`);

  return buildDefaultRow(source, {
    slug,
    title,
    summary: makeSummary(body),
    body,
    tags: source.tags || [],
    sort_order: source.sort_order ?? 0,
    is_featured: source.is_featured ?? false,
  });
}

function extractSection(text, startHeading, endHeading) {
  const source = cleanText(text);

  const startIndex = source.indexOf(startHeading);
  if (startIndex === -1) return '';

  const fromStart = source.slice(startIndex);

  if (!endHeading) {
    return cleanText(fromStart);
  }

  const endIndex = fromStart.indexOf(endHeading, startHeading.length);
  if (endIndex === -1) {
    return cleanText(fromStart);
  }

  return cleanText(fromStart.slice(0, endIndex));
}

function splitTravelTermsToRows(extracted, source) {
  const text = cleanText(extracted.text);

  const sections = [
    {
      heading: 'Utleiers ansvar',
      nextHeading: 'Leietakers ansvar',
      slug: 'travel-terms-landlord-responsibility-nb',
      title: 'Utleiers ansvar',
      tags: ['utleiers ansvar', 'ansvar', 'reisevilkår'],
      is_featured: true,
      sort_order: 10,
    },
    {
      heading: 'Leietakers ansvar',
      nextHeading: 'Bestilling og betaling',
      slug: 'travel-terms-tenant-responsibility-nb',
      title: 'Leietakers ansvar og husregler',
      tags: ['leietakers ansvar', 'husregler', 'opphold', 'reisevilkår'],
      is_featured: true,
      sort_order: 20,
    },
    {
      heading: 'Bestilling og betaling',
      nextHeading: 'Avbestillings- og endringsforsikring',
      slug: 'travel-terms-booking-payment-nb',
      title: 'Bestilling og betaling',
      tags: ['bestilling', 'betaling', 'restbeløp', 'reisevilkår'],
      is_featured: true,
      sort_order: 30,
    },
    {
      heading: 'Avbestillings- og endringsforsikring',
      nextHeading: 'Vilkår uten avbestillings- og endringsforsikring:',
      slug: 'travel-terms-cancellation-insurance-nb',
      title: 'Avbestilling og endring med forsikring',
      tags: ['avbestilling', 'endring', 'forsikring', 'reisevilkår'],
      is_featured: true,
      sort_order: 40,
    },
    {
      heading: 'Vilkår uten avbestillings- og endringsforsikring:',
      nextHeading: 'Snøgaranti',
      slug: 'travel-terms-without-insurance-nb',
      title: 'Avbestilling og endring uten forsikring',
      tags: ['uten forsikring', 'avbestilling', 'endring', 'reisevilkår'],
      is_featured: true,
      sort_order: 50,
    },
    {
      heading: 'Snøgaranti',
      nextHeading: 'Priser',
      slug: 'travel-terms-snow-guarantee-nb',
      title: 'Snøgaranti',
      tags: ['snøgaranti', 'trysilfjellet', 'bakker', 'reisevilkår'],
      is_featured: false,
      sort_order: 60,
    },
    {
      heading: 'Priser',
      nextHeading: 'Forbehold',
      slug: 'travel-terms-prices-nb',
      title: 'Priser og prisforbehold',
      tags: ['priser', 'avgifter', 'prisforbehold', 'reisevilkår'],
      is_featured: false,
      sort_order: 70,
    },
    {
      heading: 'Forbehold',
      nextHeading: 'Klage',
      slug: 'travel-terms-reservations-nb',
      title: 'Forbehold',
      tags: ['forbehold', 'snøforhold', 'fasiliteter', 'reisevilkår'],
      is_featured: false,
      sort_order: 80,
    },
    {
      heading: 'Klage',
      nextHeading: 'Depositum',
      slug: 'travel-terms-complaints-nb',
      title: 'Klage',
      tags: ['klage', 'reklamasjon', 'reisevilkår'],
      is_featured: true,
      sort_order: 90,
    },
    {
      heading: 'Depositum',
      nextHeading: 'Innsjekk- og utsjekkstider',
      slug: 'travel-terms-deposit-nb',
      title: 'Depositum',
      tags: ['depositum', 'skader', 'innsjekk', 'reisevilkår'],
      is_featured: true,
      sort_order: 100,
    },
    {
      heading: 'Innsjekk- og utsjekkstider',
      nextHeading: 'Tvister',
      slug: 'travel-terms-check-in-out-nb',
      title: 'Innsjekk og utsjekk',
      tags: ['innsjekk', 'utsjekk', 'check-in', 'check-out', 'reisevilkår'],
      is_featured: true,
      sort_order: 110,
    },
    {
      heading: 'Tvister',
      nextHeading: 'Force majeuer',
      slug: 'travel-terms-disputes-nb',
      title: 'Tvister',
      tags: ['tvister', 'norsk rett', 'reisevilkår'],
      is_featured: false,
      sort_order: 120,
    },
    {
      heading: 'Force majeuer',
      nextHeading: 'Personvern',
      slug: 'travel-terms-force-majeure-nb',
      title: 'Force majeure',
      tags: ['force majeure', 'naturkatastrofer', 'streik', 'reisevilkår'],
      is_featured: false,
      sort_order: 130,
    },
    {
      heading: 'Personvern',
      nextHeading: 'Annet',
      slug: 'travel-terms-privacy-nb',
      title: 'Personvern',
      tags: ['personvern', 'personopplysninger', 'reisevilkår'],
      is_featured: false,
      sort_order: 140,
    },
    {
      heading: 'Annet',
      nextHeading: 'Eventuell turistskatt/besøksbidrag',
      slug: 'travel-terms-other-nb',
      title: 'Annet',
      tags: ['husdyr', 'hittegods', 'barneseng', 'reisevilkår'],
      is_featured: false,
      sort_order: 150,
    },
    {
      heading: 'Eventuell turistskatt/besøksbidrag',
      nextHeading: null,
      slug: 'travel-terms-tourist-tax-nb',
      title: 'Turistskatt og besøksbidrag',
      tags: ['turistskatt', 'besøksbidrag', 'trysil', 'reisevilkår'],
      is_featured: false,
      sort_order: 160,
    },
  ];

  const rows = [];

  for (const section of sections) {
    const chunk = extractSection(text, section.heading, section.nextHeading);

    if (!chunk) {
      console.warn(`Fant ikke seksjon: ${section.heading}`);
      continue;
    }

    rows.push(
      buildDefaultRow(source, {
        slug: section.slug,
        title: section.title,
        summary: makeSummary(chunk),
        body: chunk,
        tags: section.tags,
        is_featured: section.is_featured,
        sort_order: section.sort_order,
      })
    );
  }

  return rows;
}

function validateAllRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Ingen rader ble generert.');
  }

  const slugSet = new Set();

  rows.forEach((row, index) => {
    validateRow(row, index);

    if (slugSet.has(row.slug)) {
      throw new Error(`Duplikat slug funnet: ${row.slug}`);
    }

    slugSet.add(row.slug);
  });
}

async function buildRows() {
  const rows = [];

  for (const source of SOURCES) {
    console.log(`Henter: ${source.url}`);
    const html = await fetchHtml(source.url);
    const extracted = extractMainContent(html);

    console.log(
      `Lest side: title="${extracted.title}" selector="${extracted.selector}" textLength=${extracted.text.length}`
    );

    if (!extracted.text || extracted.text.length < 80) {
      throw new Error(`For lite tekst hentet fra ${source.url}. Siden kan være JS-rendered eller parseren traff feil.`);
    }

    if (source.mode === 'split_travel_terms') {
      const splitRows = splitTravelTermsToRows(extracted, source);
      rows.push(...splitRows);
      continue;
    }

    if (source.mode === 'single_page') {
      rows.push(pageToSingleRow(extracted, source));
      continue;
    }

    throw new Error(`Ukjent mode "${source.mode}" for ${source.url}`);
  }

  validateAllRows(rows);
  return rows;
}

async function main() {
  const rows = await buildRows();

  const outputPath = path.resolve(
    process.cwd(),
    'scripts',
    'travel-helper-content.generated.json'
  );

  await fs.writeFile(outputPath, JSON.stringify(rows, null, 2), 'utf8');

  console.log(`\nOK: Skrev ${rows.length} rader til:`);
  console.log(outputPath);
}

main().catch((error) => {
  console.error('\nBygging feilet:\n');
  console.error(error);
  process.exit(1);
});
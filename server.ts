/* dotenv må konfigureres FØR vi importerer moduler som leser process.env */
import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import bodyParser from 'body-parser';
import mews from './lib/mews';
import { fetchPrices as fetchConnectorPrices } from './lib/prices';
import { mewsWebhookHandler } from './mews-webhook'; // Webhook for Mews
import { fetchSiteMinderAvailability } from './lib/siteminder'; // <-- NY IMPORT (SiteMinder)

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

// ===== ENV =====
const PORT = Number(process.env.PORT || 4000);
const HOST = String(process.env.HOST || '0.0.0.0');
const HOTEL_TZ = String(process.env.HOTEL_TIMEZONE || 'Europe/Oslo');

const MEWS_BASE = (process.env.MEWS_BASE_URL || '').trim();
const MEWS_CLIENT_TOKEN = (process.env.MEWS_CLIENT_TOKEN || '').trim();
const MEWS_ACCESS_TOKEN = (process.env.MEWS_ACCESS_TOKEN || '').trim();
const MEWS_CLIENT_NAME = (process.env.MEWS_CLIENT_NAME || 'bno-api').trim();

const MEWS_SERVICE_ID = (process.env.MEWS_SERVICE_ID || '').trim();
const MEWS_CONFIGURATION_ID =
  (process.env.MEWS_DISTRIBUTION_CONFIGURATION_ID ||
    process.env.MEWS_CONFIGURATION_ID ||
    '').trim();
const MEWS_DISTRIBUTOR_BASE = (process.env.MEWS_DISTRIBUTOR_BASE ||
  'https://app.mews-demo.com/distributor').replace(/\/$/, '');
const LOCALE = (process.env.MEWS_LOCALE || 'nb-NO').trim();
const DEF_CURRENCY = (process.env.MEWS_CURRENCY || 'NOK').trim();
const MEWS_ENTERPRISE_ID = (process.env.MEWS_ENTERPRISE_ID || '').trim();
const MEWS_ADULT_AGE_CATEGORY_ID = (
  process.env.MEWS_ADULT_AGE_CATEGORY_ID || ''
).trim();
const MEWS_RATE_ID = (process.env.MEWS_RATE_ID || '').trim();

/** slå av/på server-side reservasjon + produktordre */
const ENABLE_SERVER_RESERVATION =
  String(process.env.ENABLE_SERVER_RESERVATION || '0') === '1';

// ===== HELPERS =====
function daysBetween(ymdFrom: string, ymdTo: string) {
  const a = new Date(`${ymdFrom}T00:00:00Z`);
  const b = new Date(`${ymdTo}T00:00:00Z`);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

function firstLang(obj: any, locale: string) {
  if (!obj) return '';
  if (obj[locale]) return obj[locale];
  const keys = Object.keys(obj || {});
  return keys.length ? obj[keys[0]] ?? '' : '';
}

function safeNum(v: any): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function sumNumbersSafe(list: Array<number | null | undefined>): number {
  let acc = 0;
  for (const v of list || []) acc += Number(v || 0);
  return acc;
}

function extractPriceValueCurrency(priceObj: any): {
  value: number | null;
  currency: string | null;
} {
  if (priceObj == null) return { value: null, currency: null };
  if (typeof priceObj === 'number')
    return { value: safeNum(priceObj), currency: null };

  if (priceObj.TotalAmount && typeof priceObj.TotalAmount === 'object') {
    const keys = Object.keys(priceObj.TotalAmount || {});
    if (keys.length > 0) {
      const k = keys[0];
      const v =
        priceObj.TotalAmount[k]?.GrossValue ??
        priceObj.TotalAmount[k]?.Value ??
        priceObj.TotalAmount[k]?.Total ??
        null;
      return { value: safeNum(v), currency: String(k) };
    }
  }

  const val =
    priceObj.GrossValue ??
    priceObj.Value ??
    priceObj.Total ??
    priceObj.Amount ??
    null;
  const cur = priceObj.Currency ?? priceObj.CurrencyCode ?? null;
  return { value: safeNum(val), currency: cur ? String(cur) : null };
}

type AvItem =
  | number
  | {
      TotalAvailableUnitsCount?: unknown;
      AvailableRoomCount?: unknown;
      AvailableUnitsCount?: unknown;
      Count?: unknown;
    }
  | null
  | undefined;

function avToCount(x: AvItem): number {
  if (x == null) return 0;
  if (typeof x === 'number') return x;
  const pick =
    (typeof (x as any).TotalAvailableUnitsCount === 'number' &&
      (x as any).TotalAvailableUnitsCount) ||
    (typeof (x as any).AvailableRoomCount === 'number' &&
      (x as any).AvailableRoomCount) ||
    (typeof (x as any).AvailableUnitsCount === 'number' &&
      (x as any).AvailableUnitsCount) ||
    (typeof (x as any).Count === 'number' && (x as any).Count) ||
    0;
  const n = Number(pick || 0);
  return Number.isFinite(n) ? n : 0;
}

function computeAvailableUnits(item: any): number {
  if (
    typeof item.AvailableRoomCount === 'number' &&
    item.AvailableRoomCount >= 0
  )
    return item.AvailableRoomCount;
  if (
    typeof item.TotalAvailableUnitsCount === 'number' &&
    item.TotalAvailableUnitsCount >= 0
  )
    return item.TotalAvailableUnitsCount;

  if (Array.isArray(item.Availabilities) && item.Availabilities.length > 0) {
    const vals = (item.Availabilities as AvItem[])
      .map(avToCount)
      .filter((v: number) => Number.isFinite(v));
    if (vals.length > 0) {
      const positives = vals.filter((v) => v > 0);
      return positives.length > 0 ? Math.min(...positives) : Math.min(...vals);
    }
  }
  return 0;
}

function computePricesFromAvailabilities(item: any): {
  nightly: (number | null)[];
  total: number | null;
  currency: string | null;
} {
  if (!Array.isArray(item.Availabilities) || item.Availabilities.length === 0) {
    if (Array.isArray(item.PriceNightly) && item.PriceNightly.length > 0) {
      const nightly = (item.PriceNightly as any[]).map((vv: any) => safeNum(vv));
      const total = sumNumbersSafe(nightly);
      return {
        nightly,
        total: nightly.length ? total : null,
        currency: item.PriceCurrency || null,
      };
    }
    if (item.PriceTotal != null)
      return {
        nightly: [],
        total: safeNum(item.PriceTotal),
        currency: item.PriceCurrency ?? null,
      };
    if (item.Price) {
      const ex = extractPriceValueCurrency(item.Price);
      return { nightly: [], total: ex.value, currency: ex.currency };
    }
    return { nightly: [], total: null, currency: null };
  }

  const nightly: (number | null)[] = [];
  let detectedCurrency: string | null = null;

  for (const aRaw of item.Availabilities as any[]) {
    if (!aRaw) {
      nightly.push(null);
      continue;
    }

    const candidates = [
      aRaw.Price,
      aRaw.PricePerUnit,
      aRaw.PriceTotal,
      aRaw.TimeUnitPrice,
      aRaw.TimeUnitPrices,
      aRaw.PriceAmount,
      aRaw.PriceInfo,
    ];
    let foundVal: number | null = null;
    let foundCur: string | null = null;

    for (const c of candidates) {
      if (!c) continue;
      if (Array.isArray(c) && c.length) {
        const ex = extractPriceValueCurrency(c[0]);
        if (ex.value != null) {
          foundVal = ex.value;
          foundCur = ex.currency;
          break;
        }
      } else {
        const ex = extractPriceValueCurrency(c);
        if (ex.value != null) {
          foundVal = ex.value;
          foundCur = ex.currency;
          break;
        }
      }
    }

    if (foundVal == null && aRaw.Price && typeof aRaw.Price === 'object') {
      const ex = extractPriceValueCurrency(aRaw.Price);
      foundVal = ex.value;
      foundCur = ex.currency;
    }
    if (foundVal == null && aRaw.TimeUnitPrice) {
      const ex = extractPriceValueCurrency(aRaw.TimeUnitPrice);
      foundVal = ex.value;
      foundCur = ex.currency;
    }

    nightly.push(foundVal ?? null);
    if (!detectedCurrency && foundCur) detectedCurrency = foundCur;
  }

  const anyPrice = nightly.some((v) => v != null);
  const total = anyPrice ? sumNumbersSafe(nightly) : null;
  return { nightly, total, currency: detectedCurrency };
}

function pricesFromCategoryPricing(
  catPrices: any[],
  categoryId: string | undefined | null,
  fallbackCurrency: string | null
): { nightly: (number | null)[]; total: number | null; currency: string | null } {
  if (!categoryId)
    return { nightly: [], total: null, currency: fallbackCurrency || null };

  const found = (catPrices || []).find(
    (cp: any) =>
      cp?.CategoryId === categoryId ||
      cp?.ResourceCategoryId === categoryId ||
      cp?.RoomCategoryId === categoryId ||
      cp?.Id === categoryId
  );
  if (!found)
    return { nightly: [], total: null, currency: fallbackCurrency || null };

  let nightly: (number | null)[] = [];
  if (Array.isArray(found.TimeUnitPrices) && found.TimeUnitPrices.length) {
    nightly = found.TimeUnitPrices.map(
      (p: any) => extractPriceValueCurrency(p).value
    );
  } else if (Array.isArray(found.Prices) && found.Prices.length) {
    nightly = found.Prices.map((p: any) => extractPriceValueCurrency(p).value);
  }

  let currency: string | null = fallbackCurrency || null;
  const curProbe = extractPriceValueCurrency(
    (Array.isArray(found.TimeUnitPrices) && found.TimeUnitPrices[0]) ||
      (Array.isArray(found.Prices) && found.Prices[0]) ||
      found.TotalPrice ||
      found.PriceTotal
  );
  if (curProbe.currency) currency = curProbe.currency;

  const total = nightly.length
    ? sumNumbersSafe(nightly)
    : extractPriceValueCurrency(
        found.TotalPrice || found.PriceTotal || found.BaseAmountPrice
      ).value;

  return { nightly, total, currency };
}

/**
 * Hent totalpris for EN reservasjon (1 enhet) via reservations/price,
 * slik at vi matcher Mews Distributor 100 %.
 */
async function priceReservationOnce(opts: {
  startYmd: string;
  endYmd: string;
  categoryId: string;
  rateId?: string | null;
  adults: number;
}): Promise<{ total: number | null; currency: string | null }> {
  if (
    !MEWS_BASE ||
    !MEWS_CLIENT_TOKEN ||
    !MEWS_ACCESS_TOKEN ||
    !MEWS_SERVICE_ID ||
    !MEWS_ADULT_AGE_CATEGORY_ID
  ) {
    return { total: null, currency: null };
  }

  const url = `${MEWS_BASE}/api/connector/v1/reservations/price`;

  const reservation: any = {
    Identifier: 'preview-1',
    StartUtc: mews.toTimeUnitUtc(opts.startYmd),
    EndUtc: mews.toTimeUnitUtc(opts.endYmd),
    RequestedCategoryId: opts.categoryId,
    RateId: opts.rateId || MEWS_RATE_ID || undefined,
    AdultCount: Math.max(1, Number(opts.adults || 1)),
    PersonCounts: [
      {
        AgeCategoryId: MEWS_ADULT_AGE_CATEGORY_ID,
        Count: Math.max(1, Number(opts.adults || 1)),
      },
    ],
  };

  const payload = {
    ClientToken: MEWS_CLIENT_TOKEN,
    AccessToken: MEWS_ACCESS_TOKEN,
    Client: MEWS_CLIENT_NAME,
    ServiceId: MEWS_SERVICE_ID,
    Reservations: [reservation],
  };

  const resp = await axios.post(url, payload, { timeout: 15000 });
  const item =
    resp.data?.ReservationPrices?.[0] || resp.data?.ReservationPrice || null;
  if (!item) return { total: null, currency: null };

  const amountObj =
    item.TotalAmount || item.Total || item.TotalPrice || item.Price || null;
  const ex = extractPriceValueCurrency(amountObj);
  return { total: ex.value, currency: ex.currency || DEF_CURRENCY };
}

// ===== PING / HEALTH =====
app.get('/api/ping', (_req, res) =>
  res.json({ ok: true, where: 'api', at: Date.now(), tz: HOTEL_TZ })
);
app.get('/ping', (_req, res) =>
  res.json({ ok: true, where: 'root', at: Date.now(), tz: HOTEL_TZ })
);
app.get('/api/health', (_req, res) =>
  res.json({
    ok: true,
    serviceId: MEWS_SERVICE_ID || null,
    enterpriseId: MEWS_ENTERPRISE_ID || null,
    tz: HOTEL_TZ,
    hasTokens: !!(MEWS_BASE && MEWS_CLIENT_TOKEN && MEWS_ACCESS_TOKEN),
  })
);

// ===== SERVICES (diagnostic) =====
app.get('/api/services', async (_req, res) => {
  try {
    if (!MEWS_BASE || !MEWS_CLIENT_TOKEN || !MEWS_ACCESS_TOKEN) {
      return res.json({ ok: false, error: 'credentials_missing' });
    }
    const url = `${MEWS_BASE}/api/connector/v1/services/getAll`;
    const payload = {
      ClientToken: MEWS_CLIENT_TOKEN,
      AccessToken: MEWS_ACCESS_TOKEN,
      Client: MEWS_CLIENT_NAME,
      Limitation: { Count: 1000 },
    };
    const r = await axios.post(url, payload, { timeout: 15000 });
    const services: any[] = r.data?.Services || [];
    const out = services.map((svc: any) => ({
      Id: svc?.Id,
      Name:
        firstLang(svc?.Name, LOCALE) ||
        svc?.Name ||
        svc?.ExternalIdentifier,
      Type: svc?.Type || null,
      EnterpriseId: svc?.EnterpriseId || null,
    }));
    res.json({ ok: true, data: out });
  } catch (e: any) {
    console.error('services_error', e?.response?.data || e?.message || e);
    res.json({
      ok: false,
      error: 'services_failed',
      detail: e?.message || String(e),
    });
  }
});

// ===== SEARCH / AVAILABILITY (MEWS) =====
app.get(
  ['/api/search', '/search', '/api/availability', '/availability'],
  async (req, res) => {
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    const adults = Number(req.query.adults || 1);

    if (!MEWS_BASE || !MEWS_CLIENT_TOKEN || !MEWS_ACCESS_TOKEN) {
      return res.json({
        ok: true,
        data: {
          availability: { ResourceCategoryAvailabilities: [] },
          params: { from, to, adults, warn: 'mews_credentials_missing' },
        },
      });
    }

    try {
      if (MEWS_SERVICE_ID) {
        const avail = await mews.fetchAvailabilityNamed(
          MEWS_SERVICE_ID,
          from,
          to
        );

        let pricing: any = null;
        try {
          pricing = await fetchConnectorPrices(from, to); // bruker MEWS_RATE_ID fra .env
        } catch (err) {
          console.warn(
            'search: rates/getPricing failed',
            (err as any)?.message || err
          );
        }
        const catPrices: any[] = Array.isArray(pricing?.CategoryPrices)
          ? pricing.CategoryPrices
          : [];
        const prCurrency: string | null = pricing?.Currency || DEF_CURRENCY;

        const rcList: any[] =
          avail?.ResourceCategoryAvailabilities || [];

        const list = await Promise.all(
          rcList.map(async (rc: any) => {
            const mapped: any = {
              ResourceCategoryId: rc?.ResourceCategoryId ?? rc?.Id,
              RoomCategoryId:
                rc?.RoomCategoryId ?? rc?.ResourceCategoryId ?? rc?.Id,
              Name:
                rc?.Name ??
                (rc?.Names && Object.values(rc.Names)[0]) ??
                rc?.ExternalIdentifier ??
                'Room',
              Description:
                rc?.Description ??
                (rc?.Descriptions && Object.values(rc.Descriptions)[0]) ??
                '',
              Capacity: rc?.Capacity ?? rc?.DefaultAdultCount ?? null,
              Image: rc?.Image ?? null,
              Images: rc?.Images ?? null,
              Raw: rc,
            };

            const availableUnits = computeAvailableUnits(rc);
            mapped.AvailableUnits = availableUnits;
            mapped.TotalAvailableUnitsCount = availableUnits;
            mapped.AvailableRoomCount = availableUnits;

            let priceTotal: number | null = null;
            let priceNightly: (number | null)[] = [];
            let currency: string | null = prCurrency;

            // 1) Prøv reservations/price (samme som Distributor)
            try {
              const rp = await priceReservationOnce({
                startYmd: from,
                endYmd: to,
                categoryId: mapped.ResourceCategoryId,
                rateId: MEWS_RATE_ID || undefined,
                adults,
              });
              priceTotal = rp.total;
              currency = rp.currency || prCurrency;
              if (priceTotal != null) {
                const nights = daysBetween(from, to);
                const nightlyValue =
                  nights > 0 ? priceTotal / nights : priceTotal;
                priceNightly =
                  nights > 0
                    ? Array(nights).fill(nightlyValue)
                    : [nightlyValue];
              }
            } catch (err) {
              console.warn(
                'search: reservations/price failed, falling back',
                (err as any)?.message || err
              );
            }

            // 2) Fallback til rates/getPricing / availability hvis noe feiler
            if (priceTotal == null) {
              const pr = pricesFromCategoryPricing(
                catPrices,
                mapped.ResourceCategoryId,
                prCurrency
              );
              if (pr.total != null || pr.nightly.length) {
                priceNightly = pr.nightly;
                priceTotal = pr.total;
                currency = pr.currency || prCurrency;
              } else {
                const est = computePricesFromAvailabilities(rc);
                priceNightly = est.nightly;
                priceTotal = est.total;
                currency = est.currency || prCurrency;
              }
            }

            mapped.PriceNightly = priceNightly;
            mapped.PriceTotal = priceTotal;
            mapped.PriceCurrency = (currency || DEF_CURRENCY).toUpperCase();

            return mapped;
          })
        );

        return res.json({
          ok: true,
          data: {
            availability: { ResourceCategoryAvailabilities: list },
            params: {
              from,
              to,
              adults,
              src: 'reservations/price+rates+availability',
            },
          },
        });
      }
    } catch (e: any) {
      // 🔴 VIKTIG NY LOGGING HER
      console.error('search_error FULL', {
        params: { from, to, adults },
        message: e?.message,
        status: e?.response?.status,
        data: e?.response?.data,
      });
    }


    return res.json({
      ok: true,
      data: {
        availability: { ResourceCategoryAvailabilities: [] },
        params: { from, to, adults, warn: 'mews_search_failed' },
      },
    });
  }
);

// ===== SITEMINDER SEARCH (egen endpoint – påvirker ikke MEWS) =====
app.get('/api/siteminder/search', async (req, res) => {
  const from = String(req.query.from || '');
  const to = String(req.query.to || '');
  const adults = Number(req.query.adults || 1);

  try {
    const result = await fetchSiteMinderAvailability({
      fromYmd: from,
      toYmd: to,
      adults,
    });

    return res.json({
      ok: true,
      data: {
        availability: {
          ResourceCategoryAvailabilities:
            result.ResourceCategoryAvailabilities || [],
        },
        params: {
          from,
          to,
          adults,
          src: 'siteminder',
        },
        raw: result.raw ?? null,
      },
    });
  } catch (e: any) {
    console.error(
      'siteminder_search_error',
      e?.response?.data || e?.message || e
    );
    return res.json({
      ok: false,
      error: 'siteminder_search_failed',
      detail: e?.message || String(e),
    });
  }
});

// ===== PRODUCTS =====
app.get(['/api/products', '/products'], async (_req, res) => {
  try {
    if (!MEWS_BASE || !MEWS_CLIENT_TOKEN || !MEWS_ACCESS_TOKEN) {
      return res.json({
        ok: true,
        data: [
          {
            Id: 'demo-breakfast',
            Name: 'Breakfast tip',
            Description: 'Serveres hver morgen',
            Image:
              'https://images.unsplash.com/photo-1516685018646-549198525c1b?q=80&w=1200&auto=format&fit=crop',
            Currency: DEF_CURRENCY,
            PriceGross: null,
          },
          {
            Id: 'demo-taxi',
            Name: 'Taxi',
            Description: 'Fastpris fra flyplass',
            Image:
              'https://images.unsplash.com/photo-1502877338535-766e1452684a?q=80&w=1200&auto=format&fit=crop',
            Currency: DEF_CURRENCY,
            PriceGross: 50,
          },
        ],
      });
    }
    const list = await mews.fetchProducts(MEWS_SERVICE_ID || '');
    const products = (list || []).map((p: any) => ({
      Id: p?.Id,
      Name:
        firstLang(p?.Name, LOCALE) ||
        p?.Name ||
        p?.ExternalIdentifier ||
        'Product',
      Description: firstLang(p?.Description, LOCALE) || '',
      Image:
        Array.isArray(p?.ImageIds) && p.ImageIds.length
          ? `https://cdn.mews-demo.com/Media/Image/${p.ImageIds[0]}?Mode=Fit&Height=400&Width=600`
          : null,
      Currency: DEF_CURRENCY,
      PriceGross: p?.Price?.Value ?? p?.PriceGross ?? null,
    }));
    res.json({ ok: true, data: products });
  } catch (e: any) {
    console.error('products_error', e?.response?.data || e?.message || e);
    res.json({ ok: true, data: [] });
  }
});

// ===== PREVIEW =====
app.post(['/api/booking/preview', '/booking/preview'], async (req, res) => {
  try {
    const {
      startYmd,
      endYmd,
      roomCategoryId,
      rateId,
      adults,
      currency,
      products,
      selectedUnits,
    } = req.body || {};

    let roomPriceTotal: number | null = null;
    let roomCurrency: string | null = (currency || DEF_CURRENCY).toUpperCase();

    // 1) Forsøk reservations/price (eksakt samme som Distributor)
    try {
      if (roomCategoryId) {
        const rp = await priceReservationOnce({
          startYmd,
          endYmd,
          categoryId: roomCategoryId,
          rateId: rateId || MEWS_RATE_ID || undefined,
          adults: Number(adults || 1),
        });
        roomPriceTotal = rp.total;
        roomCurrency = rp.currency || roomCurrency;
      }
    } catch (err) {
      console.warn(
        'preview: reservations/price failed, falling back',
        (err as any)?.message || err
      );
    }

    // 2) Fallback via rates/getPricing + availability
    if (roomPriceTotal == null) {
      try {
        const px = await fetchConnectorPrices(startYmd, endYmd);
        const pr = pricesFromCategoryPricing(
          px?.CategoryPrices || [],
          roomCategoryId,
          px?.Currency || roomCurrency
        );
        roomPriceTotal = pr.total;
        roomCurrency = pr.currency || roomCurrency;
      } catch (err) {
        console.warn(
          'preview: rates/getPricing failed, falling back',
          (err as any)?.message || err
        );
      }
    }

    if (roomPriceTotal == null && MEWS_SERVICE_ID && roomCategoryId) {
      try {
        const avail = await mews.fetchAvailabilityNamed(
          MEWS_SERVICE_ID,
          startYmd,
          endYmd
        );
        const found = (avail?.ResourceCategoryAvailabilities || []).find(
          (rc: any) =>
            rc?.ResourceCategoryId === roomCategoryId ||
            rc?.RoomCategoryId === roomCategoryId ||
            rc?.Id === roomCategoryId
        );
        if (found) {
          const prices = computePricesFromAvailabilities(found);
          roomPriceTotal = prices.total;
          roomCurrency = prices.currency || roomCurrency;
        }
      } catch (err) {
        console.warn(
          'preview: availability fallback failed',
          (err as any)?.message || err
        );
      }
    }

    const units = Math.max(1, Number(selectedUnits || 1));
    const totalRoomPrice = Number(roomPriceTotal ?? 0) * units;

    const productsTotal = Array.isArray(products)
      ? products.reduce(
          (acc: number, p: any) =>
            acc +
            Number(p.quantity || p.count || 0) * Number(p.price || 0),
          0
        )
      : 0;

    const grandTotal = totalRoomPrice + productsTotal;

    res.json({
      ok: true,
      data: {
        room: {
          roomCategoryId,
          rateId,
          nights: daysBetween(startYmd, endYmd),
          priceNightly: [], // vi viser ikke detaljert pr natt her
          priceTotal: totalRoomPrice,
          currency: (roomCurrency || DEF_CURRENCY).toUpperCase(),
          selectedUnits: units,
        },
        products: Array.isArray(products) ? products : [],
        productsTotal,
        grandTotal,
      },
    });
  } catch (e: any) {
    res.json({
      ok: false,
      error: 'preview_failed',
      detail: e?.message || String(e),
    });
  }
});

// ===== CREATE =====
app.post(['/api/booking/create', '/booking/create'], async (req, res) => {
  const {
    startYmd,
    endYmd,
    roomCategoryId,
    rateId,
    adults,
    currency,
    products,
    selectedUnits,
  } = req.body || {};

  // Åpne Distributor i steg 3 (Rates). Hvis ENABLE_SERVER_RESERVATION=1, forsøker vi å
  // opprette reservasjon og legge til produkter før vi åpner Distributor.
  let reservationId: string | null = null;

  if (ENABLE_SERVER_RESERVATION) {
    try {
      let customerId: string | undefined;
      try {
        customerId = await mews.findOrCreateCustomer({
          firstName: 'Guest',
          lastName: 'BNO',
          email: `guest+${Date.now()}@example.invalid`,
        });
      } catch (e) {
        console.warn(
          'findOrCreateCustomer failed (continuing without)',
          (e as any)?.message || e
        );
      }

      const rooms = [
        {
          RoomCategoryId: roomCategoryId,
          RateId: rateId || MEWS_RATE_ID || undefined,
          StartUtc: mews.toTimeUnitUtc(startYmd),
          EndUtc: mews.toTimeUnitUtc(endYmd),
          Occupancy: [
            {
              AgeCategoryId: MEWS_ADULT_AGE_CATEGORY_ID || undefined,
              PersonCount: Number(adults || 1),
            },
          ],
          Quantity: Number(selectedUnits || 1),
        },
      ];

      try {
        const createResp = await mews.createReservation({
          ClientReference: `bno-${Date.now()}`,
          ServiceId: MEWS_SERVICE_ID || undefined,
          Rooms: rooms,
          // Viktig: ikke send CustomerId om vi ikke har en gyldig verdi
          CustomerId:
            customerId && customerId.length > 10 ? customerId : undefined,
          SendConfirmationEmail: false,
        });
        reservationId =
          createResp?.Reservations?.[0]?.Id ||
          createResp?.ReservationId ||
          createResp?.Reservation?.Id ||
          null;
      } catch (e: any) {
        console.error(
          'createReservation failed (continuing):',
          e?.mewsResponse || e?.response?.data || e?.message || e
        );
        reservationId = null;
      }

      if (reservationId && Array.isArray(products) && products.length > 0) {
        const orders = products
          .map((p: any) => ({
            ProductId: p.productId || p.ProductId || p.Id,
            Quantity: Number(p.quantity || p.count || 0),
            Price: p.price != null ? Number(p.price) : undefined,
            Currency: currency || DEF_CURRENCY,
          }))
          .filter((o: any) => o.ProductId && o.Quantity > 0);

        if (orders.length > 0) {
          try {
            await mews.createProductServiceOrders(
              MEWS_SERVICE_ID || '',
              reservationId,
              orders
            );
          } catch (err: any) {
            console.error(
              'createProductServiceOrders failed',
              err?.mewsResponse ||
                err?.response?.data ||
                err?.message ||
                err
            );
          }
        }
      }
    } catch (e) {
      console.warn(
        'server-side create skipped due to error',
        (e as any)?.message || e
      );
    }
  }

  function buildDistributorUrl(opts: {
    fromYmd: string;
    toYmd: string;
    adults: number;
    roomCategoryId?: string;
    rateId?: string;
    currency?: string;
    locale?: string;
  }) {
    const cur = opts.currency || DEF_CURRENCY;
    const locale = opts.locale || LOCALE;
    const route = 'rates'; // steg 3
    const qp: string[] = [
      `mewsStart=${encodeURIComponent(opts.fromYmd)}`,
      `mewsEnd=${encodeURIComponent(opts.toYmd)}`,
      `mewsAdultCount=${encodeURIComponent(String(opts.adults || 1))}`,
      `currency=${encodeURIComponent(cur)}`,
      `locale=${encodeURIComponent(locale)}`,
      `mewsRoute=${route}`,
    ];
    if (opts.roomCategoryId)
      qp.push(`mewsRoom=${encodeURIComponent(opts.roomCategoryId)}`);
    if (opts.rateId) {
      qp.push(`mewsRateId=${encodeURIComponent(opts.rateId)}`);
      qp.push(`rateId=${encodeURIComponent(opts.rateId)}`);
    }
    const base = `${MEWS_DISTRIBUTOR_BASE}/${MEWS_CONFIGURATION_ID}`;
    return `${base}?${qp.join('&')}#${route}`;
  }

  let nextUrl = buildDistributorUrl({
    fromYmd: startYmd,
    toYmd: endYmd,
    adults: Number(adults || 1),
    roomCategoryId,
    rateId,
    currency,
    locale: LOCALE,
  });

  if (reservationId) {
    nextUrl +=
      (nextUrl.includes('?') ? '&' : '?') +
      `mewsReservation=${encodeURIComponent(reservationId)}`;
  }

  res.json({
    ok: true,
    data: {
      mode: reservationId ? 'distributor_with_reservation' : 'distributor',
      bookingUrlRates: nextUrl,
      bookingUrlSummary: nextUrl,
      nextUrl,
      reservationId,
      echo: {
        roomCategoryId,
        rateId,
        adults,
        currency: (currency || DEF_CURRENCY).toUpperCase(),
        products: Array.isArray(products) ? products : [],
        selectedUnits: Number(selectedUnits || 1),
      },
    },
  });
});

// ===== MEWS WEBHOOK =====
app.post('/webhooks/mews', mewsWebhookHandler);

// ===== 404 =====
app.use((req, res) => {
  console.warn(`404 ${req.method} ${req.url}`);
  res.status(404).json({ ok: false, error: 'not_found' });
});

// start
app.listen(PORT, HOST, () => {
  const hostShown = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`✅ Server running at http://${hostShown}:${PORT}`);
  console.log(
    `MEWS_DISTRIBUTOR_BASE=${MEWS_DISTRIBUTOR_BASE} MEWS_DISTRIBUTION_CONFIGURATION_ID=${MEWS_CONFIGURATION_ID}`
  );
  console.log(
    `ENABLE_SERVER_RESERVATION=${ENABLE_SERVER_RESERVATION ? '1' : '0'}`
  );
});

import express from 'express';
import { duffel } from '../lib/duffel';

const router = express.Router();

type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';

function getDuffelErrorMessage(e: any): string {
  return (
    e?.errors?.[0]?.message ||
    e?.errors?.[0]?.title ||
    e?.message ||
    'Duffel request failed'
  );
}

function isDuffelOfferGoneMessage(message: string): boolean {
  const m = String(message || '').toLowerCase();

  return (
    m.includes('offer no longer available') ||
    m.includes('offer is no longer available') ||
    m.includes('offer has expired') ||
    m.includes('expired') ||
    m.includes('not found') ||
    m.includes('invalid offer')
  );
}

function getServiceFee(amount: number, currency: string) {
  if (currency === 'EUR') {
    if (amount >= 400) return 25;
    if (amount >= 200) return 20;
    return 15;
  }

  if (currency === 'GBP') {
    if (amount >= 350) return 20;
    if (amount >= 180) return 15;
    return 10;
  }

  if (amount >= 5000) return 149;
  if (amount >= 2500) return 99;
  return 69;
}

function buildOfferPayload(offer: any) {
  const totalAmount = Number(offer?.total_amount || 0);
  const totalCurrency = String(offer?.total_currency || 'EUR').toUpperCase();
  const serviceFee = getServiceFee(totalAmount, totalCurrency);
  const totalWithFee = totalAmount + serviceFee;

  return {
    ...offer,
    service_fee_amount: serviceFee,
    total_with_fee: totalWithFee,
  };
}

function normalizeCabinClass(value: any): CabinClass {
  const allowed: CabinClass[] = [
    'economy',
    'premium_economy',
    'business',
    'first',
  ];

  const normalized = String(value || 'economy').trim().toLowerCase() as CabinClass;

  if (allowed.includes(normalized)) {
    return normalized;
  }

  return 'economy';
}

function toPositiveInt(value: any, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function buildPassengers(adultsRaw: any) {
  const adults = Math.max(1, toPositiveInt(adultsRaw, 1));

  return Array.from({ length: adults }).map(() => ({
    type: 'adult' as const,
  }));
}

/**
 * POST /api/flights/search
 */
router.post('/search', async (req, res) => {
  try {
    const {
      origin,
      destination,
      departureDate,
      returnDate,
      adults,
      cabinClass,
      directOnly,
    } = req.body || {};

    if (!origin || !destination || !departureDate) {
      return res.status(400).json({
        ok: false,
        error: 'missing_params',
        detail: 'origin, destination og departureDate er påkrevd',
      });
    }

    const normalizedOrigin = String(origin).trim().toUpperCase();
    const normalizedDestination = String(destination).trim().toUpperCase();
    const normalizedCabinClass = normalizeCabinClass(cabinClass);
    const normalizedDirectOnly =
      directOnly === true || directOnly === 'true' || directOnly === 1 || directOnly === '1';

    const passengers = buildPassengers(adults);

    const slices: any[] = [
      {
        origin: normalizedOrigin,
        destination: normalizedDestination,
        departure_date: String(departureDate).slice(0, 10),
      },
    ];

    if (returnDate) {
      slices.push({
        origin: normalizedDestination,
        destination: normalizedOrigin,
        departure_date: String(returnDate).slice(0, 10),
      });
    }

    console.log('[DUFFEL] search request', {
      origin: normalizedOrigin,
      destination: normalizedDestination,
      departureDate: String(departureDate).slice(0, 10),
      returnDate: returnDate ? String(returnDate).slice(0, 10) : null,
      adults: passengers.length,
      cabinClass: normalizedCabinClass,
      directOnly: normalizedDirectOnly,
    });

    const result = await duffel.offerRequests.create({
      slices,
      passengers,
      cabin_class: normalizedCabinClass,
      max_connections: normalizedDirectOnly ? 0 : undefined,
      return_offers: true,
    } as any);

    const offerRequest = result.data;
    const offers =
      'offers' in offerRequest
        ? (offerRequest.offers || []).map(buildOfferPayload)
        : [];

    console.log('[DUFFEL] search success', {
      offerRequestId: offerRequest?.id || null,
      offerCount: offers.length,
    });

    return res.json({
      ok: true,
      data: {
        offerRequestId: offerRequest.id,
        offers,
      },
    });
  } catch (e: any) {
    console.error('[DUFFEL] search failed', {
      message: getDuffelErrorMessage(e),
      errors: e?.errors || null,
    });

    return res.status(400).json({
      ok: false,
      error: 'duffel_search_failed',
      detail: getDuffelErrorMessage(e),
      errors: e?.errors || null,
    });
  }
});

/**
 * GET /api/flights/offers/:offerId
 */
router.get('/offers/:offerId', async (req, res) => {
  try {
    const { offerId } = req.params;

    if (!offerId) {
      return res.status(400).json({
        ok: false,
        error: 'missing_offer_id',
      });
    }

    console.log('[DUFFEL] get offer', { offerId });

    const result = await duffel.offers.get(offerId as string);
    const offer = result?.data;

    if (!offer) {
      return res.status(404).json({
        ok: false,
        error: 'offer_no_longer_available',
        detail: 'Fant ikke offer hos Duffel',
      });
    }

    const payload = buildOfferPayload(offer);

    console.log('[DUFFEL] get offer success', {
      offerId,
      total_amount: payload?.total_amount || null,
      total_currency: payload?.total_currency || null,
    });

    return res.json({
      ok: true,
      offer: payload,
    });
  } catch (e: any) {
    const message = getDuffelErrorMessage(e);

    console.error('[DUFFEL] get offer failed', {
      offerId: req.params?.offerId || null,
      message,
      errors: e?.errors || null,
    });

    if (isDuffelOfferGoneMessage(message)) {
      return res.status(404).json({
        ok: false,
        error: 'offer_no_longer_available',
        detail: message,
        errors: e?.errors || null,
      });
    }

    return res.status(500).json({
      ok: false,
      error: 'duffel_offer_fetch_failed',
      detail: message,
      errors: e?.errors || null,
    });
  }
});

export default router;
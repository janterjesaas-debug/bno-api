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

function buildOfferPayload(offer: any, offerRequestId?: string | null) {
  const totalAmount = Number(offer?.total_amount || 0);
  const totalCurrency = String(offer?.total_currency || 'EUR').toUpperCase();
  const serviceFee = getServiceFee(totalAmount, totalCurrency);
  const totalWithFee = totalAmount + serviceFee;

  return {
    ...offer,
    offer_request_id: offerRequestId || offer?.offer_request_id || null,
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

async function runDuffelSearch(params: {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null;
  passengers: Array<{ type: 'adult' }>;
  cabinClass: CabinClass;
  directOnly: boolean;
  attemptLabel: string;
}) {
  const {
    origin,
    destination,
    departureDate,
    returnDate,
    passengers,
    cabinClass,
    directOnly,
    attemptLabel,
  } = params;

  const slices: any[] = [
    {
      origin,
      destination,
      departure_date: departureDate,
    },
  ];

  if (returnDate) {
    slices.push({
      origin: destination,
      destination: origin,
      departure_date: returnDate,
    });
  }

  console.log('[DUFFEL] search attempt', {
    attemptLabel,
    origin,
    destination,
    departureDate,
    returnDate: returnDate || null,
    adults: passengers.length,
    cabinClass,
    directOnly,
  });

  const result = await duffel.offerRequests.create({
    slices,
    passengers,
    cabin_class: cabinClass,
    max_connections: directOnly ? 0 : undefined,
    return_offers: true,
  } as any);

  const offerRequest = result.data;
  const offers =
    offerRequest && 'offers' in offerRequest
      ? (offerRequest.offers || []).map((offer: any) =>
          buildOfferPayload(offer, offerRequest?.id || null)
        )
      : [];

  console.log('[DUFFEL] search attempt success', {
    attemptLabel,
    offerRequestId: offerRequest?.id || null,
    offerCount: offers.length,
  });

  return {
    offerRequest,
    offers,
  };
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
    const normalizedDepartureDate = String(departureDate).slice(0, 10);
    const normalizedReturnDate = returnDate ? String(returnDate).slice(0, 10) : null;
    const normalizedCabinClass = normalizeCabinClass(cabinClass);
    const normalizedDirectOnly =
      directOnly === true ||
      directOnly === 'true' ||
      directOnly === 1 ||
      directOnly === '1';

    const passengers = buildPassengers(adults);

    console.log('[DUFFEL] search request', {
      origin: normalizedOrigin,
      destination: normalizedDestination,
      departureDate: normalizedDepartureDate,
      returnDate: normalizedReturnDate,
      adults: passengers.length,
      cabinClass: normalizedCabinClass,
      directOnly: normalizedDirectOnly,
    });

    let finalOfferRequest: any = null;
    let finalOffers: any[] = [];
    let fallbackUsed: 'retry_same_search' | 'retry_without_direct_only' | null = null;
    let effectiveDirectOnly = normalizedDirectOnly;

    const primaryResult = await runDuffelSearch({
      origin: normalizedOrigin,
      destination: normalizedDestination,
      departureDate: normalizedDepartureDate,
      returnDate: normalizedReturnDate,
      passengers,
      cabinClass: normalizedCabinClass,
      directOnly: normalizedDirectOnly,
      attemptLabel: 'primary',
    });

    finalOfferRequest = primaryResult.offerRequest;
    finalOffers = primaryResult.offers;

    if (finalOffers.length === 0) {
      try {
        const retrySameResult = await runDuffelSearch({
          origin: normalizedOrigin,
          destination: normalizedDestination,
          departureDate: normalizedDepartureDate,
          returnDate: normalizedReturnDate,
          passengers,
          cabinClass: normalizedCabinClass,
          directOnly: normalizedDirectOnly,
          attemptLabel: 'retry_same_search',
        });

        if (retrySameResult.offers.length > 0) {
          finalOfferRequest = retrySameResult.offerRequest;
          finalOffers = retrySameResult.offers;
          fallbackUsed = 'retry_same_search';
        }
      } catch (retryError: any) {
        console.warn('[DUFFEL] retry_same_search failed', {
          message: getDuffelErrorMessage(retryError),
          errors: retryError?.errors || null,
        });
      }
    }

    if (finalOffers.length === 0 && normalizedDirectOnly) {
      try {
        const relaxedResult = await runDuffelSearch({
          origin: normalizedOrigin,
          destination: normalizedDestination,
          departureDate: normalizedDepartureDate,
          returnDate: normalizedReturnDate,
          passengers,
          cabinClass: normalizedCabinClass,
          directOnly: false,
          attemptLabel: 'retry_without_direct_only',
        });

        if (relaxedResult.offers.length > 0) {
          finalOfferRequest = relaxedResult.offerRequest;
          finalOffers = relaxedResult.offers;
          fallbackUsed = 'retry_without_direct_only';
          effectiveDirectOnly = false;
        }
      } catch (relaxedError: any) {
        console.warn('[DUFFEL] retry_without_direct_only failed', {
          message: getDuffelErrorMessage(relaxedError),
          errors: relaxedError?.errors || null,
        });
      }
    }

    console.log('[DUFFEL] final search result', {
      offerRequestId: finalOfferRequest?.id || null,
      offerCount: finalOffers.length,
      fallbackUsed,
      effectiveDirectOnly,
    });

    return res.json({
      ok: true,
      data: {
        offerRequestId: finalOfferRequest?.id || null,
        offers: finalOffers,
        fallbackUsed,
        searchUsed: {
          origin: normalizedOrigin,
          destination: normalizedDestination,
          departureDate: normalizedDepartureDate,
          returnDate: normalizedReturnDate,
          adults: passengers.length,
          cabinClass: normalizedCabinClass,
          directOnly: effectiveDirectOnly,
        },
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
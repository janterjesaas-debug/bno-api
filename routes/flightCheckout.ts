import express from 'express';
import Stripe from 'stripe';
import { duffel } from '../lib/duffel';
import {
  createFlightBooking,
  markFlightBookingCaptureFailed,
  markFlightBookingConfirmed,
} from '../lib/flightBookings';
import { sendFlightBookingConfirmationEmail } from '../lib/flightEmails';

const router = express.Router();

type PassengerInput = {
  id?: string;
  given_name: string;
  family_name: string;
  born_on: string;
  email: string;
  phone_number: string;
  gender: string;
  title: string;
  locale?: string;
};

type DuffelAvailableService = {
  id?: string;
  type?: string;
  total_amount?: string | number;
  total_currency?: string;
  passenger_ids?: string[];
  segment_ids?: string[];
  maximum_quantity?: number;
  metadata?: any;
  name?: string;
  title?: string;
  description?: string;
  [key: string]: any;
};

type OfferSnapshot = {
  id?: string;
  total_amount?: string | number;
  total_currency?: string;
  passengers?: Array<{
    id?: string;
    passenger_id?: string;
  }>;
  owner?: any;
  slices?: any[];
  available_services?: any[];
  conditions?: any;
  payment_requirements?: any;
  offer_request_id?: string;
  fare_brand_name?: string;
  brand_name?: string;
  fare_name?: string;
  fare_brand?: string;
  [key: string]: any;
};

type SelectedService = {
  id: string;
  type: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  raw: DuffelAvailableService;
};

type BookingDraft = {
  offerId: string;
  offerAmount: number;
  servicesAmount: number;
  duffelPaymentAmount: number;
  offerCurrency: string;
  serviceFee: number;
  totalAmount: number;
  selectedServiceIds: string[];
  selectedServices: SelectedService[];
  passengers: PassengerInput[];
  paymentIntentId: string;
  createdAt: number;
  offerSnapshot?: OfferSnapshot | any;
  offerWasLive?: boolean;
};

type ReplacementOfferResult = {
  offer: any;
  wasLive: boolean;
  usedClientSnapshot: boolean;
  replacedOfferId?: string | null;
};

const bookingDrafts = new Map<string, BookingDraft>();

const DUFFEL_API_BASE = 'https://api.duffel.com';
const DUFFEL_VERSION = 'v2';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDuffelErrorMessage(e: any): string {
  const firstError =
    e?.errors?.[0] ||
    e?.duffel?.errors?.[0] ||
    e?.response?.data?.errors?.[0] ||
    null;

  return (
    firstError?.message ||
    firstError?.title ||
    e?.message ||
    'Duffel request failed'
  );
}

function getDuffelErrorPayload(e: any) {
  return e?.duffel || e?.errors || e?.response?.data || null;
}

function getPublicErrorDetail(e: any) {
  const payload = getDuffelErrorPayload(e);
  const firstError = Array.isArray(payload?.errors)
    ? payload.errors[0]
    : Array.isArray(payload)
    ? payload[0]
    : null;

  return (
    firstError?.message ||
    firstError?.title ||
    getDuffelErrorMessage(e) ||
    'Kunne ikke fullføre booking'
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
    m.includes('invalid offer') ||
    m.includes('please select another offer') ||
    m.includes('select another offer') ||
    m.includes('create a new offer request') ||
    m.includes('latest availability')
  );
}

function isDuffelInternalAirlineError(message: string): boolean {
  const m = String(message || '').toLowerCase();

  return (
    m.includes('internal_error') ||
    m.includes('internal error') ||
    m.includes('airline responded') ||
    m.includes('airline has responded') ||
    m.includes('please try again')
  );
}

function stringifyForSearch(value: any) {
  try {
    return JSON.stringify(value || {}).toLowerCase();
  } catch {
    return '';
  }
}

function isNorwegianLikeOffer(offer: any) {
  const text = stringifyForSearch(offer);

  return (
    text.includes('norwegian air shuttle') ||
    text.includes('norwegian air sweden') ||
    text.includes('norwegian air') ||
    text.includes('norwegian') ||
    text.includes('"dy"') ||
    text.includes('"d8"')
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

function toMinorUnits(amount: number) {
  return Math.round(Number(amount || 0) * 100);
}

function toMoneyNumber(value: any) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

function getStripe() {
  const stripeSecretKey = String(process.env.STRIPE_SECRET_KEY || '').trim();

  console.log('[FLIGHT PAY] STRIPE_SECRET_KEY status', {
    exists: !!stripeSecretKey,
    prefix: stripeSecretKey ? stripeSecretKey.slice(0, 7) : null,
    length: stripeSecretKey ? stripeSecretKey.length : 0,
  });

  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY mangler på serveren');
  }

  return new Stripe(stripeSecretKey);
}

function getDuffelToken() {
  const token = String(process.env.DUFFEL_ACCESS_TOKEN || '').trim();

  if (!token) {
    throw new Error('DUFFEL_ACCESS_TOKEN mangler på serveren');
  }

  return token;
}

function getOfferPassengerIds(offer: any): string[] {
  const ids = Array.isArray(offer?.passengers)
    ? offer.passengers
        .map((p: any) => String(p?.id || p?.passenger_id || '').trim())
        .filter(Boolean)
    : [];

  if (!ids.length) {
    throw new Error('Mangler Duffel passenger ids på offeret');
  }

  return ids;
}

function normalizePassengersFromBody(body: any): PassengerInput[] {
  if (Array.isArray(body?.passengers) && body.passengers.length > 0) {
    return body.passengers;
  }

  if (body?.passenger && typeof body.passenger === 'object') {
    return [body.passenger];
  }

  return [];
}

function normalizeSelectedServiceIds(body: any): string[] {
  if (!Array.isArray(body?.selectedServiceIds)) {
    return [];
  }

  const ids = body.selectedServiceIds
    .map((id: any) => String(id || '').trim())
    .filter(Boolean);

  return Array.from(new Set(ids));
}

function normalizePassengerNameForAirline(value: any) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Æ/g, 'AE')
    .replace(/æ/g, 'ae')
    .replace(/Ø/g, 'O')
    .replace(/ø/g, 'o')
    .replace(/Å/g, 'A')
    .replace(/å/g, 'a')
    .replace(/[^A-Za-z '\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitleForDuffel(value: any) {
  const raw = String(value || '').toLowerCase().trim();

  if (
    raw === 'mr' ||
    raw === 'mrs' ||
    raw === 'ms' ||
    raw === 'miss' ||
    raw === 'mx'
  ) {
    return raw;
  }

  return raw === 'm' ? 'mr' : 'ms';
}

function normalizeGenderForDuffel(value: any) {
  const raw = String(value || '').toLowerCase().trim();

  if (raw === 'm' || raw === 'male') return 'm';
  if (raw === 'f' || raw === 'female') return 'f';

  return raw;
}

function normalizePhoneForDuffel(value: any) {
  const raw = String(value || '').trim();

  if (!raw) return raw;

  return raw.startsWith('+')
    ? `+${raw.slice(1).replace(/[^\d]/g, '')}`
    : raw.replace(/[^\d]/g, '');
}

function normalizePassengerForDuffel(passenger: PassengerInput) {
  const givenName = normalizePassengerNameForAirline(passenger.given_name);
  const familyName = normalizePassengerNameForAirline(passenger.family_name);

  if (!givenName || !familyName) {
    throw new Error(
      'Passasjernavn inneholder tegn som ikke kan sendes til flyselskapet. Bruk vanlige latinske bokstaver.'
    );
  }

  return {
    id: passenger.id,
    title: normalizeTitleForDuffel(passenger.title),
    gender: normalizeGenderForDuffel(passenger.gender),
    given_name: givenName,
    family_name: familyName,
    born_on: passenger.born_on,
    email: String(passenger.email || '').trim().toLowerCase(),
    phone_number: normalizePhoneForDuffel(passenger.phone_number),
  };
}

function getServiceTitle(service: DuffelAvailableService) {
  return (
    service?.metadata?.title ||
    service?.title ||
    service?.name ||
    service?.description ||
    service?.metadata?.description ||
    service?.type ||
    'Extra service'
  );
}

function getServiceDescription(service: DuffelAvailableService) {
  return (
    service?.metadata?.description ||
    service?.description ||
    service?.metadata?.title ||
    service?.title ||
    service?.name ||
    ''
  );
}

function isBaggageLikeService(service: DuffelAvailableService) {
  const text = stringifyForSearch(service);

  return (
    text.includes('baggage') ||
    text.includes('bag ') ||
    text.includes('bag_') ||
    text.includes('checked') ||
    text.includes('hold luggage') ||
    text.includes('luggage') ||
    text.includes('bagasje')
  );
}

function getAvailableServices(offer: any): DuffelAvailableService[] {
  if (!Array.isArray(offer?.available_services)) {
    return [];
  }

  return offer.available_services
    .filter((service: any) => service && typeof service === 'object' && service.id)
    .map((service: any) => service as DuffelAvailableService);
}

function resolveSelectedServices(input: {
  offer: any;
  selectedServiceIds: string[];
  currency: string;
}) {
  const selectedServiceIds = input.selectedServiceIds;
  const offerCurrency = String(input.currency || '').toUpperCase();
  const availableServices = getAvailableServices(input.offer);

  if (!selectedServiceIds.length) {
    return {
      selectedServices: [] as SelectedService[],
      servicesAmount: 0,
    };
  }

  if (!availableServices.length) {
    throw new Error(
      'Valgt bagasje/tillegg finnes ikke lenger på offeret. Søk på nytt.'
    );
  }

  const servicesById = new Map(
    availableServices.map((service) => [String(service.id), service])
  );

  const selectedServices = selectedServiceIds.map((serviceId) => {
    const service = servicesById.get(serviceId);

    if (!service) {
      throw new Error(
        `Valgt bagasje/tillegg er ikke tilgjengelig lenger: ${serviceId}`
      );
    }

    const serviceCurrency = String(
      service.total_currency || offerCurrency || ''
    ).toUpperCase();

    if (!serviceCurrency || serviceCurrency !== offerCurrency) {
      throw new Error(
        `Valgt tillegg har annen valuta (${serviceCurrency}) enn flytilbudet (${offerCurrency})`
      );
    }

    if (!isBaggageLikeService(service)) {
      console.warn('[FLIGHT PAY] selected service is not clearly baggage-like', {
        serviceId,
        serviceType: service.type || null,
        serviceTitle: getServiceTitle(service),
      });
    }

    return {
      id: String(service.id),
      type: String(service.type || service.metadata?.type || 'service'),
      title: String(getServiceTitle(service)),
      description: String(getServiceDescription(service)),
      amount: toMoneyNumber(service.total_amount || 0),
      currency: serviceCurrency,
      raw: service,
    };
  });

  const servicesAmount = selectedServices.reduce(
    (sum, service) => sum + toMoneyNumber(service.amount),
    0
  );

  return {
    selectedServices,
    servicesAmount: toMoneyNumber(servicesAmount),
  };
}

async function fetchLiveOfferOrThrow(offerId: string) {
  const offerResult = await duffel.offers.get(String(offerId));

  if (!offerResult?.data?.id) {
    throw new Error('Duffel returned missing offer data');
  }

  return offerResult.data;
}

function getSegmentsFromSource(source: any, sliceIndex: number) {
  const segments = source?.slices?.[sliceIndex]?.segments;
  return Array.isArray(segments) ? segments : [];
}

function getFirstSegment(source: any, sliceIndex: number) {
  const segments = getSegmentsFromSource(source, sliceIndex);
  return segments[0] || null;
}

function getLastSegment(source: any, sliceIndex: number) {
  const segments = getSegmentsFromSource(source, sliceIndex);
  return segments.length ? segments[segments.length - 1] : null;
}

function getAirlineFromOrderOrOffer(order: any, offer: any) {
  return (
    getFirstSegment(order, 0)?.marketing_carrier?.name ||
    getFirstSegment(order, 0)?.operating_carrier?.name ||
    order?.owner?.name ||
    getFirstSegment(offer, 0)?.marketing_carrier?.name ||
    getFirstSegment(offer, 0)?.operating_carrier?.name ||
    offer?.owner?.name ||
    null
  );
}

function getAirportCode(airport: any) {
  return String(airport?.iata_code || airport?.id || '').trim();
}

function getDateFromIso(value: any) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.slice(0, 10);
}

function getTimeFromIso(value: any) {
  const raw = String(value || '').trim();
  if (!raw || raw.length < 16) return '';
  return raw.slice(11, 16);
}

function getMarketingCarrierCode(segment: any) {
  return String(
    segment?.marketing_carrier?.iata_code ||
      segment?.marketing_carrier?.iata_code_display ||
      ''
  )
    .trim()
    .toUpperCase();
}

function getOperatingCarrierCode(segment: any) {
  return String(
    segment?.operating_carrier?.iata_code ||
      segment?.operating_carrier?.iata_code_display ||
      ''
  )
    .trim()
    .toUpperCase();
}

function getFlightNumber(segment: any) {
  return String(
    segment?.marketing_carrier_flight_number ||
      segment?.flight_number ||
      segment?.aircraft?.flight_number ||
      ''
  )
    .trim()
    .toUpperCase();
}

function normalizeFareBrand(value: any) {
  const raw = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ');

  if (!raw) return '';

  if (
    raw.includes('lowfare+') ||
    raw.includes('low fare plus') ||
    raw.includes('lowfare plus') ||
    raw.includes('lowfare+')
  ) {
    return 'lowfare_plus';
  }

  if (raw.includes('low fare') || raw.includes('lowfare')) {
    return 'lowfare';
  }

  if (raw.includes('flex')) {
    return 'flex';
  }

  if (raw.includes('plus')) {
    return 'lowfare_plus';
  }

  if (raw.includes('standard')) {
    return 'standard';
  }

  if (raw.includes('basic')) {
    return 'basic';
  }

  return raw;
}

function getFareBrandText(offer: any) {
  const direct =
    offer?.fare_brand_name ||
    offer?.brand_name ||
    offer?.fare_name ||
    offer?.fare_brand ||
    offer?.conditions?.fare_brand_name ||
    offer?.conditions?.fare_brand ||
    offer?.slices?.[0]?.fare_brand_name ||
    offer?.slices?.[0]?.fare_brand ||
    '';

  if (String(direct || '').trim()) {
    return String(direct).trim();
  }

  const passengers = Array.isArray(offer?.passengers) ? offer.passengers : [];
  for (const passenger of passengers) {
    const baggageText =
      passenger?.fare_brand_name ||
      passenger?.brand_name ||
      passenger?.fare_name ||
      passenger?.fare_brand ||
      '';
    if (String(baggageText || '').trim()) return String(baggageText).trim();
  }

  const slices = Array.isArray(offer?.slices) ? offer.slices : [];
  for (const slice of slices) {
    const segments = Array.isArray(slice?.segments) ? slice.segments : [];
    for (const segment of segments) {
      const segmentPassengers = Array.isArray(segment?.passengers)
        ? segment.passengers
        : [];

      for (const passenger of segmentPassengers) {
        const text =
          passenger?.fare_brand_name ||
          passenger?.brand_name ||
          passenger?.fare_name ||
          passenger?.fare_brand ||
          passenger?.cabin_class_marketing_name ||
          passenger?.fare_basis_code ||
          '';
        if (String(text || '').trim()) return String(text).trim();
      }
    }
  }

  const text = stringifyForSearch(offer);
  if (text.includes('lowfare plus') || text.includes('lowfare+')) return 'LowFare Plus';
  if (text.includes('low fare plus') || text.includes('plus')) return 'LowFare Plus';
  if (text.includes('lowfare') || text.includes('low fare')) return 'LowFare';
  if (text.includes('flex')) return 'Flex';

  return '';
}

function extractSearchSlicesFromOffer(offer: any) {
  const slices = Array.isArray(offer?.slices) ? offer.slices : [];

  return slices
    .map((slice: any) => {
      const segments = Array.isArray(slice?.segments) ? slice.segments : [];
      const first = segments[0];
      const last = segments[segments.length - 1];

      const origin = getAirportCode(first?.origin);
      const destination = getAirportCode(last?.destination);
      const departureDate = getDateFromIso(first?.departing_at);

      if (!origin || !destination || !departureDate) {
        return null;
      }

      return {
        origin,
        destination,
        departure_date: departureDate,
      };
    })
    .filter((slice: any): slice is { origin: string; destination: string; departure_date: string } => !!slice);
}

function getMaxConnectionsFromOffer(offer: any) {
  const slices = Array.isArray(offer?.slices) ? offer.slices : [];
  let maxConnections = 0;

  for (const slice of slices) {
    const segments = Array.isArray(slice?.segments) ? slice.segments : [];
    maxConnections = Math.max(maxConnections, Math.max(0, segments.length - 1));
  }

  return maxConnections;
}

function getCabinClassFromOffer(offer: any) {
  const text = stringifyForSearch(offer);

  if (text.includes('premium_economy')) return 'premium_economy';
  if (text.includes('"business"')) return 'business';
  if (text.includes('"first"')) return 'first';

  return 'economy';
}

function buildOfferRequestBodyFromOffer(input: {
  originalOffer: any;
  passengerCount: number;
}) {
  const slices = extractSearchSlicesFromOffer(input.originalOffer);

  if (!slices.length) {
    throw new Error('Kunne ikke bygge nytt Duffel offer request fra valgt tilbud');
  }

  return {
    data: {
      slices,
      passengers: Array.from({ length: input.passengerCount }, () => ({
        type: 'adult',
      })),
      cabin_class: getCabinClassFromOffer(input.originalOffer),
      max_connections: getMaxConnectionsFromOffer(input.originalOffer),
    },
  };
}

async function createFreshOfferRequestOffers(input: {
  originalOffer: any;
  passengerCount: number;
}) {
  const token = getDuffelToken();
  const body = buildOfferRequestBodyFromOffer(input);

  console.log('[FLIGHT PAY] creating replacement Duffel offer request', {
    slices: body.data.slices,
    passengerCount: input.passengerCount,
    cabinClass: body.data.cabin_class,
    maxConnections: body.data.max_connections,
    originalOfferId: input.originalOffer?.id || null,
    originalFareBrand: getFareBrandText(input.originalOffer),
    isNorwegianLike: isNorwegianLikeOffer(input.originalOffer),
  });

  const res = await fetch(
    `${DUFFEL_API_BASE}/air/offer_requests?return_offers=true&supplier_timeout=30000`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Duffel-Version': DUFFEL_VERSION,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
      },
      body: JSON.stringify(body),
    }
  );

  const text = await res.text();

  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Duffel returnerte ikke JSON fra offer request: ${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    const firstError = Array.isArray(data?.errors) ? data.errors[0] : null;
    const message =
      firstError?.message ||
      firstError?.title ||
      data?.error ||
      'Duffel offer request failed';

    const err: any = new Error(message);
    err.duffel = data;
    throw err;
  }

  const offers = Array.isArray(data?.data?.offers) ? data.data.offers : [];

  console.log('[FLIGHT PAY] replacement Duffel offer request returned', {
    offerRequestId: data?.data?.id || null,
    offerCount: offers.length,
  });

  return offers;
}

function getComparableSegmentSignature(segment: any) {
  return [
    getAirportCode(segment?.origin),
    getAirportCode(segment?.destination),
    getDateFromIso(segment?.departing_at),
    getTimeFromIso(segment?.departing_at),
    getDateFromIso(segment?.arriving_at),
    getTimeFromIso(segment?.arriving_at),
    getMarketingCarrierCode(segment),
    getOperatingCarrierCode(segment),
    getFlightNumber(segment),
  ].join('|');
}

function getComparableRouteSignature(offer: any) {
  const slices = Array.isArray(offer?.slices) ? offer.slices : [];

  return slices
    .map((slice: any) => {
      const segments = Array.isArray(slice?.segments) ? slice.segments : [];
      return segments.map(getComparableSegmentSignature).join('>');
    })
    .join('||');
}

function getRelaxedRouteSignature(offer: any) {
  const slices = Array.isArray(offer?.slices) ? offer.slices : [];

  return slices
    .map((slice: any) => {
      const segments = Array.isArray(slice?.segments) ? slice.segments : [];
      return segments
        .map((segment: any) =>
          [
            getAirportCode(segment?.origin),
            getAirportCode(segment?.destination),
            getDateFromIso(segment?.departing_at),
            getTimeFromIso(segment?.departing_at),
            getTimeFromIso(segment?.arriving_at),
            getMarketingCarrierCode(segment) || getOperatingCarrierCode(segment),
          ].join('|')
        )
        .join('>');
    })
    .join('||');
}

function offerHasSameRouteAsOriginal(candidate: any, original: any) {
  const exactOriginal = getComparableRouteSignature(original);
  const exactCandidate = getComparableRouteSignature(candidate);

  if (exactOriginal && exactCandidate && exactOriginal === exactCandidate) {
    return true;
  }

  const relaxedOriginal = getRelaxedRouteSignature(original);
  const relaxedCandidate = getRelaxedRouteSignature(candidate);

  return !!relaxedOriginal && !!relaxedCandidate && relaxedOriginal === relaxedCandidate;
}

function getFareRankFromBrand(brand: string) {
  const normalized = normalizeFareBrand(brand);

  if (normalized === 'lowfare') return 10;
  if (normalized === 'lowfare_plus') return 20;
  if (normalized === 'flex') return 30;
  if (normalized === 'basic') return 40;
  if (normalized === 'standard') return 50;

  return 100;
}

function scoreReplacementOffer(input: {
  candidate: any;
  originalOffer: any;
  expectedCurrency: string;
  expectedFareBrand: string;
  expectedAmount: number;
}) {
  const candidate = input.candidate;
  let score = 0;

  const candidateCurrency = String(candidate?.total_currency || '').toUpperCase();
  const candidateAmount = toMoneyNumber(candidate?.total_amount || 0);
  const candidateFareBrand = normalizeFareBrand(getFareBrandText(candidate));
  const expectedFareBrand = normalizeFareBrand(input.expectedFareBrand);

  if (candidateCurrency !== input.expectedCurrency) score += 100000;
  if (!offerHasSameRouteAsOriginal(candidate, input.originalOffer)) score += 50000;
  if (!isNorwegianLikeOffer(candidate) && isNorwegianLikeOffer(input.originalOffer)) score += 30000;

  if (expectedFareBrand && candidateFareBrand === expectedFareBrand) {
    score -= 5000;
  } else if (expectedFareBrand && candidateFareBrand) {
    score += Math.abs(
      getFareRankFromBrand(candidateFareBrand) - getFareRankFromBrand(expectedFareBrand)
    ) * 300;
  } else if (expectedFareBrand && !candidateFareBrand) {
    score += 1000;
  }

  if (Number.isFinite(input.expectedAmount) && input.expectedAmount > 0) {
    score += Math.abs(candidateAmount - input.expectedAmount) * 10;
  }

  return score;
}

function selectBestReplacementOffer(input: {
  offers: any[];
  originalOffer: any;
  passengerCount: number;
  expectedCurrency: string;
  expectedAmount?: number;
}) {
  const expectedAmount = toMoneyNumber(input.expectedAmount || input.originalOffer?.total_amount || 0);
  const expectedFareBrand = getFareBrandText(input.originalOffer);

  const candidates = input.offers.filter((offer: any) => {
    if (!offer?.id) return false;

    const currency = String(offer?.total_currency || '').toUpperCase();
    if (currency !== input.expectedCurrency) return false;

    try {
      const passengerIds = getOfferPassengerIds(offer);
      if (passengerIds.length !== input.passengerCount) return false;
    } catch {
      return false;
    }

    if (!offerHasSameRouteAsOriginal(offer, input.originalOffer)) return false;

    if (isNorwegianLikeOffer(input.originalOffer) && !isNorwegianLikeOffer(offer)) {
      return false;
    }

    return true;
  });

  const sorted = candidates.sort((a: any, b: any) => {
    const scoreA = scoreReplacementOffer({
      candidate: a,
      originalOffer: input.originalOffer,
      expectedCurrency: input.expectedCurrency,
      expectedFareBrand,
      expectedAmount,
    });

    const scoreB = scoreReplacementOffer({
      candidate: b,
      originalOffer: input.originalOffer,
      expectedCurrency: input.expectedCurrency,
      expectedFareBrand,
      expectedAmount,
    });

    if (scoreA !== scoreB) return scoreA - scoreB;

    return toMoneyNumber(a?.total_amount || 0) - toMoneyNumber(b?.total_amount || 0);
  });

  const selected = sorted[0] || null;

  console.log('[FLIGHT PAY] replacement candidate selection', {
    originalOfferId: input.originalOffer?.id || null,
    expectedFareBrand,
    expectedAmount,
    expectedCurrency: input.expectedCurrency,
    offerCount: input.offers.length,
    candidateCount: candidates.length,
    selectedOfferId: selected?.id || null,
    selectedAmount: selected?.total_amount || null,
    selectedCurrency: selected?.total_currency || null,
    selectedFareBrand: selected ? getFareBrandText(selected) : null,
  });

  return selected;
}

async function findFreshReplacementOffer(input: {
  originalOffer: any;
  passengerCount: number;
  expectedAmount?: number;
}) {
  const expectedCurrency = String(
    input.originalOffer?.total_currency || 'EUR'
  ).toUpperCase();

  const freshOffers = await createFreshOfferRequestOffers({
    originalOffer: input.originalOffer,
    passengerCount: input.passengerCount,
  });

  return selectBestReplacementOffer({
    offers: freshOffers,
    originalOffer: input.originalOffer,
    passengerCount: input.passengerCount,
    expectedCurrency,
    expectedAmount: input.expectedAmount,
  });
}

async function resolveLiveOfferForCheckout(input: {
  offerId: string;
  clientOfferSnapshot?: any;
  passengerCount: number;
}): Promise<ReplacementOfferResult> {
  console.log('[FLIGHT PAY] fetching live offer for checkout', {
    offerId: input.offerId,
  });

  try {
    const offer = await fetchLiveOfferOrThrow(input.offerId);
    const passengerIds = getOfferPassengerIds(offer);

    if (passengerIds.length !== input.passengerCount) {
      throw new Error(
        `Offeret forventer ${passengerIds.length} passasjer(er), men fikk ${input.passengerCount}`
      );
    }

    return {
      offer,
      wasLive: true,
      usedClientSnapshot: false,
      replacedOfferId: null,
    };
  } catch (e: any) {
    const message = getDuffelErrorMessage(e);
    const detail = getPublicErrorDetail(e);
    const payload = getDuffelErrorPayload(e);
    const hasSnapshot = !!input.clientOfferSnapshot;
    const isNorwegian = isNorwegianLikeOffer(input.clientOfferSnapshot);

    console.error('[FLIGHT PAY] live offer refresh failed', {
      offerId: input.offerId,
      message,
      detail,
      duffel: payload,
      hasClientOfferSnapshot: hasSnapshot,
      isNorwegianLike: isNorwegian,
      fareBrand: getFareBrandText(input.clientOfferSnapshot),
    });

    if (hasSnapshot && isNorwegian) {
      try {
        const replacement = await findFreshReplacementOffer({
          originalOffer: input.clientOfferSnapshot,
          passengerCount: input.passengerCount,
          expectedAmount: toMoneyNumber(input.clientOfferSnapshot?.total_amount || 0),
        });

        if (replacement?.id) {
          console.log('[FLIGHT PAY] using fresh replacement offer before Stripe', {
            originalOfferId: input.offerId,
            replacementOfferId: replacement.id,
            originalAmount: input.clientOfferSnapshot?.total_amount || null,
            replacementAmount: replacement.total_amount || null,
            replacementCurrency: replacement.total_currency || null,
            originalFareBrand: getFareBrandText(input.clientOfferSnapshot),
            replacementFareBrand: getFareBrandText(replacement),
          });

          return {
            offer: replacement,
            wasLive: true,
            usedClientSnapshot: false,
            replacedOfferId: input.offerId,
          };
        }
      } catch (replacementError: any) {
        console.error('[FLIGHT PAY] fresh replacement offer failed before Stripe', {
          originalOfferId: input.offerId,
          message: getDuffelErrorMessage(replacementError),
          detail: getPublicErrorDetail(replacementError),
          duffel: getDuffelErrorPayload(replacementError),
        });
      }
    }

    const publicMessage =
      isDuffelOfferGoneMessage(message) || isDuffelOfferGoneMessage(detail)
        ? 'Dette flytilbudet er ikke lenger tilgjengelig. Søk på nytt for oppdaterte priser og billettyper.'
        : 'Kunne ikke verifisere flytilbudet hos flyleverandøren. Søk på nytt eller velg et annet tilbud.';

    const err: any = new Error(publicMessage);
    err.duffel = payload;
    err.originalMessage = message;
    throw err;
  }
}

async function createDuffelOrderRaw(input: {
  offerId: string;
  duffelPaymentAmount: number;
  offerCurrency: string;
  passengers: PassengerInput[];
  selectedServices: SelectedService[];
}) {
  const token = getDuffelToken();

  if (!Array.isArray(input.passengers) || !input.passengers.length) {
    throw new Error('Mangler passasjerer for ordreopprettelse');
  }

  for (const passenger of input.passengers) {
    if (!passenger.id) {
      throw new Error('Mangler Duffel passenger id for en passasjer');
    }
  }

  const normalizedPassengers = input.passengers.map(normalizePassengerForDuffel);

  const selectedServicesPayload = input.selectedServices.map((service) => ({
    id: service.id,
    quantity: 1,
  }));

  const orderBody: any = {
    data: {
      type: 'instant',
      selected_offers: [input.offerId],
      payments: [
        {
          type: 'balance',
          amount: String(Number(input.duffelPaymentAmount).toFixed(2)),
          currency: input.offerCurrency,
        },
      ],
      passengers: normalizedPassengers,
    },
  };

  if (selectedServicesPayload.length) {
    orderBody.data.services = selectedServicesPayload;
  }

  console.log('[FLIGHT PAY] createDuffelOrder payload', {
    offerId: input.offerId,
    passengerCount: normalizedPassengers.length,
    passengerIds: normalizedPassengers.map((p) => p.id || null),
    passengerNames: normalizedPassengers.map((p) => ({
      given_name: p.given_name,
      family_name: p.family_name,
      title: p.title,
      gender: p.gender,
    })),
    selectedServiceIds: input.selectedServices.map((service) => service.id),
    duffelPaymentAmount: input.duffelPaymentAmount,
    currency: input.offerCurrency,
  });

  const res = await fetch(`${DUFFEL_API_BASE}/air/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Duffel-Version': DUFFEL_VERSION,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
    },
    body: JSON.stringify(orderBody),
  });

  const text = await res.text();

  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Duffel returnerte ikke JSON: ${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    const firstError = Array.isArray(data?.errors) ? data.errors[0] : null;

    console.error('[FLIGHT PAY] Duffel order failed raw response', {
      status: res.status,
      statusText: res.statusText,
      request: {
        offerId: input.offerId,
        amount: String(Number(input.duffelPaymentAmount).toFixed(2)),
        currency: input.offerCurrency,
        passengerCount: normalizedPassengers.length,
        selectedServiceIds: input.selectedServices.map((service) => service.id),
      },
      duffel: data,
    });

    const message =
      firstError?.message ||
      firstError?.title ||
      data?.error ||
      'Duffel order creation failed';

    const err: any = new Error(message);
    err.duffel = data;
    throw err;
  }

  return data?.data || null;
}

async function createDuffelOrderWithRetry(input: {
  offerId: string;
  duffelPaymentAmount: number;
  offerCurrency: string;
  passengers: PassengerInput[];
  selectedServices: SelectedService[];
  offerSnapshot?: any;
}) {
  try {
    return await createDuffelOrderRaw(input);
  } catch (firstError: any) {
    const message = getDuffelErrorMessage(firstError);
    const detail = getPublicErrorDetail(firstError);
    const shouldRetry =
      isNorwegianLikeOffer(input.offerSnapshot) &&
      (isDuffelInternalAirlineError(message) ||
        isDuffelInternalAirlineError(detail) ||
        isDuffelOfferGoneMessage(message) ||
        isDuffelOfferGoneMessage(detail));

    if (!shouldRetry) {
      throw firstError;
    }

    console.warn('[FLIGHT PAY] Duffel order failed, trying fresh same-price replacement once', {
      offerId: input.offerId,
      message,
      detail,
      isNorwegianLike: isNorwegianLikeOffer(input.offerSnapshot),
      amount: input.duffelPaymentAmount,
      currency: input.offerCurrency,
    });

    await sleep(1200);

    const replacement = await findFreshReplacementOffer({
      originalOffer: input.offerSnapshot,
      passengerCount: input.passengers.length,
      expectedAmount: input.duffelPaymentAmount,
    });

    if (!replacement?.id) {
      throw firstError;
    }

    const replacementAmount = toMoneyNumber(replacement.total_amount || 0);
    const replacementCurrency = String(replacement.total_currency || '').toUpperCase();

    if (replacementCurrency !== input.offerCurrency) {
      console.warn('[FLIGHT PAY] replacement order retry rejected - currency differs', {
        originalCurrency: input.offerCurrency,
        replacementCurrency,
      });
      throw firstError;
    }

    if (Math.abs(replacementAmount - input.duffelPaymentAmount) > 0.01) {
      console.warn('[FLIGHT PAY] replacement order retry rejected - amount differs', {
        originalAmount: input.duffelPaymentAmount,
        replacementAmount,
        currency: replacementCurrency,
      });
      throw firstError;
    }

    const replacementPassengerIds = getOfferPassengerIds(replacement);

    if (replacementPassengerIds.length !== input.passengers.length) {
      console.warn('[FLIGHT PAY] replacement order retry rejected - passenger count differs', {
        originalPassengerCount: input.passengers.length,
        replacementPassengerCount: replacementPassengerIds.length,
      });
      throw firstError;
    }

    const passengersWithFreshIds = input.passengers.map((passenger, index) => ({
      ...passenger,
      id: replacementPassengerIds[index],
    }));

    console.log('[FLIGHT PAY] retrying Duffel order with fresh same-price replacement', {
      originalOfferId: input.offerId,
      replacementOfferId: replacement.id,
      amount: replacementAmount,
      currency: replacementCurrency,
      fareBrand: getFareBrandText(replacement),
    });

    return await createDuffelOrderRaw({
      offerId: String(replacement.id),
      duffelPaymentAmount: replacementAmount,
      offerCurrency: replacementCurrency,
      passengers: passengersWithFreshIds,
      selectedServices: input.selectedServices,
    });
  }
}

router.post('/api/payments/create-intent', async (req, res) => {
  try {
    const stripe = getStripe();

    const { offerId } = req.body || {};
    const clientOfferSnapshot = req.body?.offer || null;
    const passengers = normalizePassengersFromBody(req.body);
    const selectedServiceIds = normalizeSelectedServiceIds(req.body);

    if (!offerId) {
      return res.status(400).json({
        ok: false,
        error: 'offerId mangler',
      });
    }

    if (!Array.isArray(passengers) || passengers.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Passasjerinformasjon mangler',
      });
    }

    for (const passenger of passengers) {
      if (
        !passenger?.given_name ||
        !passenger?.family_name ||
        !passenger?.born_on ||
        !passenger?.email ||
        !passenger?.phone_number ||
        !passenger?.gender ||
        !passenger?.title
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Passasjerinformasjon mangler for en eller flere passasjerer',
        });
      }
    }

    console.log('[FLIGHT PAY] create-intent start', {
      offerId,
      passengerCount: passengers.length,
      contactEmail: passengers[0]?.email || null,
      selectedServiceIds,
      hasClientOfferSnapshot: !!clientOfferSnapshot,
      isNorwegianLike: isNorwegianLikeOffer(clientOfferSnapshot),
      fareBrand: getFareBrandText(clientOfferSnapshot),
    });

    const resolvedOfferResult = await resolveLiveOfferForCheckout({
      offerId: String(offerId),
      clientOfferSnapshot,
      passengerCount: passengers.length,
    });

    const resolvedOffer = resolvedOfferResult.offer;

    if (!resolvedOffer) {
      return res.status(404).json({
        ok: false,
        error: 'offer_no_longer_available',
        detail:
          'Dette flytilbudet er ikke lenger tilgjengelig. Søk på nytt for oppdaterte priser og billettyper.',
      });
    }

    const offerPassengerIds = getOfferPassengerIds(resolvedOffer);

    if (offerPassengerIds.length !== passengers.length) {
      return res.status(400).json({
        ok: false,
        error: `Offeret forventer ${offerPassengerIds.length} passasjer(er), men fikk ${passengers.length}`,
      });
    }

    const flightAmount = toMoneyNumber(resolvedOffer.total_amount || 0);
    const currencyUpper = String(resolvedOffer.total_currency || 'EUR').toUpperCase();
    const currencyLower = currencyUpper.toLowerCase();

    const { selectedServices, servicesAmount } = resolveSelectedServices({
      offer: resolvedOffer,
      selectedServiceIds,
      currency: currencyUpper,
    });

    const serviceFee = getServiceFee(flightAmount + servicesAmount, currencyUpper);
    const duffelPaymentAmount = toMoneyNumber(flightAmount + servicesAmount);
    const totalAmount = toMoneyNumber(duffelPaymentAmount + serviceFee);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: toMinorUnits(totalAmount),
      currency: currencyLower,
      capture_method: 'manual',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        offerId: String(resolvedOffer.id || offerId),
        originalOfferId: String(offerId),
        contactEmail: String(passengers[0]?.email || ''),
        passengerCount: String(passengers.length),
        selectedServiceIds: selectedServiceIds.join(','),
        servicesAmount: String(servicesAmount),
        serviceFee: String(serviceFee),
        totalAmount: String(totalAmount),
        offerWasLive: String(resolvedOfferResult.wasLive),
        usedClientSnapshot: String(resolvedOfferResult.usedClientSnapshot),
        replacedOfferId: String(resolvedOfferResult.replacedOfferId || ''),
        fareBrand: String(getFareBrandText(resolvedOffer) || ''),
      },
    });

    const bookingDraftId = `draft_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;

    bookingDrafts.set(bookingDraftId, {
      offerId: String(resolvedOffer.id || offerId),
      offerAmount: flightAmount,
      servicesAmount,
      duffelPaymentAmount,
      offerCurrency: currencyUpper,
      serviceFee,
      totalAmount,
      selectedServiceIds,
      selectedServices,
      passengers: passengers.map((passenger: any, idx: number) => ({
        ...passenger,
        id: offerPassengerIds[idx],
        locale: String(passenger?.locale || 'nb').trim(),
      })),
      paymentIntentId: paymentIntent.id,
      createdAt: Date.now(),
      offerSnapshot: resolvedOffer,
      offerWasLive: resolvedOfferResult.wasLive,
    });

    console.log('[FLIGHT PAY] create-intent success', {
      originalOfferId: String(offerId),
      offerId: String(resolvedOffer.id || offerId),
      bookingDraftId,
      flightAmount,
      servicesAmount,
      serviceFee,
      totalAmount,
      duffelPaymentAmount,
      currency: currencyUpper,
      passengerCount: passengers.length,
      offerPassengerIds,
      selectedServiceIds,
      offerWasLive: resolvedOfferResult.wasLive,
      usedClientSnapshot: resolvedOfferResult.usedClientSnapshot,
      replacedOfferId: resolvedOfferResult.replacedOfferId || null,
      isNorwegianLike: isNorwegianLikeOffer(resolvedOffer),
      fareBrand: getFareBrandText(resolvedOffer),
    });

    return res.json({
      ok: true,
      bookingDraftId,
      paymentIntentClientSecret: paymentIntent.client_secret,
      amount: totalAmount,
      currency: currencyUpper,
      flightAmount,
      servicesAmount,
      serviceFee,
      offerId: String(resolvedOffer.id || offerId),
      originalOfferId: String(offerId),
      offerWasLive: resolvedOfferResult.wasLive,
      usedClientSnapshot: resolvedOfferResult.usedClientSnapshot,
      replacedOfferId: resolvedOfferResult.replacedOfferId || null,
      selectedServices: selectedServices.map((service) => ({
        id: service.id,
        type: service.type,
        title: service.title,
        description: service.description,
        amount: service.amount,
        currency: service.currency,
      })),
    });
  } catch (e: any) {
    const message = getDuffelErrorMessage(e);
    const detail = getPublicErrorDetail(e);

    console.error('[FLIGHT PAY] create-intent failed', {
      message,
      detail,
      errors: getDuffelErrorPayload(e),
    });

    if (isDuffelOfferGoneMessage(message) || isDuffelOfferGoneMessage(detail)) {
      return res.status(409).json({
        ok: false,
        error:
          'Dette flytilbudet er ikke lenger tilgjengelig. Søk på nytt for oppdaterte priser og billettyper.',
        detail,
      });
    }

    if (isDuffelInternalAirlineError(message) || isDuffelInternalAirlineError(detail)) {
      return res.status(502).json({
        ok: false,
        error:
          'Flyselskapet kunne ikke bekrefte denne billettypen akkurat nå. Betalingen er ikke startet. Søk på nytt eller velg en annen billettype.',
        detail,
      });
    }

    return res.status(500).json({
      ok: false,
      error: 'Kunne ikke opprette betaling',
      detail,
    });
  }
});

router.post('/api/bookings/confirm', async (req, res) => {
  let bookingId = '';

  try {
    console.log('[FLIGHT PAY] confirm request body', {
      bookingDraftId: req.body?.bookingDraftId || null,
      userId: req.body?.userId || null,
    });

    const stripe = getStripe();
    const { bookingDraftId, userId } = req.body || {};

    if (!bookingDraftId) {
      return res.status(400).json({
        ok: false,
        error: 'bookingDraftId mangler',
      });
    }

    const draft = bookingDrafts.get(String(bookingDraftId));

    if (!draft) {
      return res.status(404).json({
        ok: false,
        error: 'Fant ikke bookingutkast',
      });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(draft.paymentIntentId);

    if (
      paymentIntent.status !== 'requires_capture' &&
      paymentIntent.status !== 'succeeded'
    ) {
      return res.status(400).json({
        ok: false,
        error: `Betalingen er ikke klar. Stripe-status: ${paymentIntent.status}`,
      });
    }

    console.log('[FLIGHT PAY] confirm start', {
      bookingDraftId,
      offerId: draft.offerId,
      paymentIntentStatus: paymentIntent.status,
      passengerCount: draft.passengers.length,
      userId: userId || null,
      selectedServiceIds: draft.selectedServiceIds,
      duffelPaymentAmount: draft.duffelPaymentAmount,
      totalAmount: draft.totalAmount,
      offerWasLive: draft.offerWasLive,
      isNorwegianLike: isNorwegianLikeOffer(draft.offerSnapshot),
      fareBrand: getFareBrandText(draft.offerSnapshot),
    });

    const order = await createDuffelOrderWithRetry({
      offerId: draft.offerId,
      duffelPaymentAmount: draft.duffelPaymentAmount,
      offerCurrency: draft.offerCurrency,
      passengers: draft.passengers,
      selectedServices: draft.selectedServices,
      offerSnapshot: draft.offerSnapshot,
    });

    const contactPassenger = draft.passengers[0];

    if (!contactPassenger) {
      throw new Error('Fant ingen kontaktpassasjer i bookingutkastet');
    }

    const booking = await createFlightBooking({
      bookingDraftId: String(bookingDraftId),
      paymentIntentId: draft.paymentIntentId,
      paymentStatus: paymentIntent.status,
      offerId: draft.offerId,
      flightAmount: draft.offerAmount,
      serviceFee: draft.serviceFee,
      totalAmount: draft.totalAmount,
      currency: draft.offerCurrency,
      passengers: draft.passengers,
      order,
      userId: userId ? String(userId) : null,
    });

    bookingId = String(booking.id || '');

    if (paymentIntent.status === 'requires_capture') {
      try {
        await stripe.paymentIntents.capture(paymentIntent.id);
      } catch (captureError: any) {
        await markFlightBookingCaptureFailed({
          bookingId: String(bookingId),
          note: captureError?.message || 'Capture failed',
        });

        throw new Error(
          `Duffel order opprettet, men Stripe capture feilet: ${
            captureError?.message || 'ukjent feil'
          }`
        );
      }
    }

    const confirmedBooking = await markFlightBookingConfirmed({
      bookingId: String(bookingId),
      paymentIntentId: paymentIntent.id,
    });

    try {
      const outboundFirst =
        getFirstSegment(order, 0) || getFirstSegment(draft.offerSnapshot, 0);
      const outboundLast =
        getLastSegment(order, 0) || getLastSegment(draft.offerSnapshot, 0);
      const returnFirst =
        getFirstSegment(order, 1) || getFirstSegment(draft.offerSnapshot, 1);
      const returnLast =
        getLastSegment(order, 1) || getLastSegment(draft.offerSnapshot, 1);

      await sendFlightBookingConfirmationEmail({
        to: String(contactPassenger.email || '').trim().toLowerCase(),
        locale: contactPassenger.locale || 'nb',
        givenName: contactPassenger.given_name,
        bnoBookingRef:
          confirmedBooking?.bno_booking_ref ||
          booking?.bno_booking_ref ||
          String(confirmedBooking?.id || bookingId || ''),
        orderId: order?.id || null,
        order,
        offer: draft.offerSnapshot,
        passengers: draft.passengers,
        airline: getAirlineFromOrderOrOffer(order, draft.offerSnapshot),
        origin:
          outboundFirst?.origin?.iata_code ||
          outboundFirst?.origin?.city_name ||
          null,
        destination:
          outboundLast?.destination?.iata_code ||
          outboundLast?.destination?.city_name ||
          null,
        outboundDeparture: outboundFirst?.departing_at || null,
        outboundArrival: outboundLast?.arriving_at || null,
        returnDeparture: returnFirst?.departing_at || null,
        returnArrival: returnLast?.arriving_at || null,
        totalAmount: draft.totalAmount,
        currency: draft.offerCurrency,
        serviceFee: draft.serviceFee,
      } as any);
    } catch (emailError: any) {
      console.error('[FLIGHT PAY] confirmation email failed', {
        message: emailError?.message || String(emailError),
      });
    }

    bookingDrafts.delete(String(bookingDraftId));

    console.log('[FLIGHT PAY] confirm success', {
      bookingDraftId,
      orderId: order?.id || null,
      bookingId: confirmedBooking?.id || null,
      bnoBookingRef: confirmedBooking?.bno_booking_ref || null,
      userId: userId || null,
      passengerCount: draft.passengers.length,
      selectedServiceIds: draft.selectedServiceIds,
    });

    return res.json({
      ok: true,
      orderId: order?.id || null,
      order,
      bookingId: confirmedBooking?.id || null,
      bnoBookingRef: confirmedBooking?.bno_booking_ref || null,
      selectedServices: draft.selectedServices.map((service) => ({
        id: service.id,
        type: service.type,
        title: service.title,
        description: service.description,
        amount: service.amount,
        currency: service.currency,
      })),
    });
  } catch (e: any) {
    const message = getDuffelErrorMessage(e);
    const duffelPayload = getDuffelErrorPayload(e);
    const publicDetail = getPublicErrorDetail(e);

    console.error('[FLIGHT PAY] confirm failed', {
      message,
      publicDetail,
      duffel: duffelPayload,
      bookingId,
    });

    try {
      const stripe = getStripe();
      const { bookingDraftId } = req.body || {};
      const draft = bookingDrafts.get(String(bookingDraftId));

      if (draft?.paymentIntentId) {
        const pi = await stripe.paymentIntents.retrieve(draft.paymentIntentId);

        if (pi.status === 'requires_capture') {
          await stripe.paymentIntents.cancel(pi.id);
          console.log('[FLIGHT PAY] cancelled uncaptured payment intent after booking failure', {
            paymentIntentId: pi.id,
            bookingDraftId,
          });
        }
      }
    } catch (cancelError: any) {
      console.error('[FLIGHT PAY] failed to cancel payment intent', {
        message: cancelError?.message || String(cancelError),
      });
    }

    if (isDuffelOfferGoneMessage(message) || isDuffelOfferGoneMessage(publicDetail)) {
      return res.status(409).json({
        ok: false,
        error:
          'Dette flytilbudet er ikke lenger tilgjengelig. Betalingen er ikke belastet. Søk på nytt for oppdaterte priser og billettyper.',
        detail: publicDetail,
      });
    }

    if (isDuffelInternalAirlineError(message) || isDuffelInternalAirlineError(publicDetail)) {
      return res.status(502).json({
        ok: false,
        error:
          'Flyselskapet kunne ikke bekrefte denne billettypen akkurat nå. Betalingen er ikke belastet. Søk på nytt, prøv en annen billettype, eller velg en annen avgang.',
        detail: publicDetail,
      });
    }

    return res.status(500).json({
      ok: false,
      error: message || 'Kunne ikke fullføre booking',
      detail: publicDetail,
    });
  }
});

export default router;
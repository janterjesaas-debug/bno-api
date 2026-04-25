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
    type?: string;
  }>;
  owner?: any;
  slices?: any[];
  available_services?: any[];
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
  usedClientSnapshot?: boolean;
  requiresFreshOfferAtConfirm?: boolean;
};

type ResolvedOfferForCheckout = {
  offer: any;
  wasLive: boolean;
  usedClientSnapshot: boolean;
  requiresFreshOfferAtConfirm: boolean;
};

type FreshCandidate = {
  offer: any;
  score: number;
  amount: number;
  currency: string;
  fareBrand: string;
};

type CreatedDuffelOrderResult = {
  order: any;
  offer: any;
  offerId: string;
  duffelPaymentAmount: number;
  offerCurrency: string;
  selectedServices: SelectedService[];
  usedFreshReplacement: boolean;
};

const bookingDrafts = new Map<string, BookingDraft>();

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
    m.includes('airline_internal') ||
    m.includes('please try again')
  );
}

function isRetryableDuffelOfferProblem(message: string): boolean {
  return isDuffelOfferGoneMessage(message) || isDuffelInternalAirlineError(message);
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
    text.includes('"d8"') ||
    text.includes('iata_code":"dy') ||
    text.includes('iata_code":"d8')
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

function getMaxReplacementPriceIncrease() {
  const raw = Number(process.env.FLIGHT_MAX_REPLACEMENT_PRICE_INCREASE || 0);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function getMaxReplacementPriceDrop() {
  const raw = Number(process.env.FLIGHT_MAX_REPLACEMENT_PRICE_DROP || 100);
  return Number.isFinite(raw) && raw >= 0 ? raw : 100;
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

function getFareBrandText(offer: any) {
  const raw =
    offer?.fare_brand_name ||
    offer?.brand_name ||
    offer?.fare_name ||
    offer?.fare_brand ||
    offer?.conditions?.fare_brand_name ||
    offer?.conditions?.fare_brand ||
    offer?.slices?.[0]?.fare_brand_name ||
    offer?.slices?.[0]?.fare_brand ||
    '';

  if (String(raw || '').trim()) return String(raw).trim().toLowerCase();

  const text = stringifyForSearch(offer);

  if (text.includes('lowfare plus') || text.includes('lowfare+')) {
    return 'low fare plus';
  }

  if (text.includes('low fare plus')) return 'low fare plus';
  if (text.includes('lowfare')) return 'low fare';
  if (text.includes('low fare')) return 'low fare';
  if (text.includes('flex')) return 'flex';
  if (text.includes('plus')) return 'low fare plus';

  return '';
}

function normalizeFareBrand(value: any) {
  const raw = String(value || '').toLowerCase().trim();

  if (!raw) return '';

  if (
    raw.includes('lowfare plus') ||
    raw.includes('lowfare+') ||
    raw.includes('low fare plus') ||
    raw.includes('plus')
  ) {
    return 'lowfare_plus';
  }

  if (raw.includes('lowfare') || raw.includes('low fare')) {
    return 'lowfare';
  }

  if (raw.includes('flex')) return 'flex';

  return raw.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function getCarrierCodeFromSegment(segment: any) {
  return String(
    segment?.marketing_carrier?.iata_code ||
      segment?.operating_carrier?.iata_code ||
      segment?.marketing_carrier?.id ||
      segment?.operating_carrier?.id ||
      ''
  ).toUpperCase();
}

function getRouteSignature(offer: any) {
  const outboundFirst = getFirstSegment(offer, 0);
  const outboundLast = getLastSegment(offer, 0);
  const returnFirst = getFirstSegment(offer, 1);
  const returnLast = getLastSegment(offer, 1);

  return {
    outboundOrigin: outboundFirst?.origin?.iata_code || '',
    outboundDestination: outboundLast?.destination?.iata_code || '',
    outboundDepartureDate: String(outboundFirst?.departing_at || '').slice(0, 10),
    outboundDepartureTime: String(outboundFirst?.departing_at || '').slice(11, 16),
    outboundArrivalTime: String(outboundLast?.arriving_at || '').slice(11, 16),
    returnOrigin: returnFirst?.origin?.iata_code || '',
    returnDestination: returnLast?.destination?.iata_code || '',
    returnDepartureDate: String(returnFirst?.departing_at || '').slice(0, 10),
    returnDepartureTime: String(returnFirst?.departing_at || '').slice(11, 16),
    returnArrivalTime: String(returnLast?.arriving_at || '').slice(11, 16),
    outboundCarrier: getCarrierCodeFromSegment(outboundFirst),
    returnCarrier: getCarrierCodeFromSegment(returnFirst),
  };
}

function minutesFromTime(value: string) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})/);
  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
}

function timeDistanceMinutes(a: string, b: string) {
  const am = minutesFromTime(a);
  const bm = minutesFromTime(b);

  if (am === null || bm === null) return 9999;

  return Math.abs(am - bm);
}

function sameRouteCandidate(originalOffer: any, candidate: any) {
  const original = getRouteSignature(originalOffer);
  const next = getRouteSignature(candidate);

  if (!original.outboundOrigin || !original.outboundDestination) return false;

  if (original.outboundOrigin !== next.outboundOrigin) return false;
  if (original.outboundDestination !== next.outboundDestination) return false;
  if (original.outboundDepartureDate !== next.outboundDepartureDate) return false;

  if (original.returnOrigin || original.returnDestination || original.returnDepartureDate) {
    if (original.returnOrigin !== next.returnOrigin) return false;
    if (original.returnDestination !== next.returnDestination) return false;
    if (original.returnDepartureDate !== next.returnDepartureDate) return false;
  }

  return true;
}

function scoreReplacementOffer(input: {
  originalOffer: any;
  candidate: any;
  expectedAmount: number;
  expectedFareBrand: string;
}) {
  const original = getRouteSignature(input.originalOffer);
  const next = getRouteSignature(input.candidate);

  const candidateAmount = toMoneyNumber(input.candidate?.total_amount || 0);
  const amountDistance = Math.abs(candidateAmount - input.expectedAmount);

  const candidateFareBrand = normalizeFareBrand(getFareBrandText(input.candidate));
  const farePenalty =
    input.expectedFareBrand && candidateFareBrand === input.expectedFareBrand
      ? 0
      : 100000;

  const outboundDeparturePenalty = timeDistanceMinutes(
    original.outboundDepartureTime,
    next.outboundDepartureTime
  );

  const outboundArrivalPenalty = timeDistanceMinutes(
    original.outboundArrivalTime,
    next.outboundArrivalTime
  );

  const returnDeparturePenalty = original.returnDepartureTime
    ? timeDistanceMinutes(original.returnDepartureTime, next.returnDepartureTime)
    : 0;

  const returnArrivalPenalty = original.returnArrivalTime
    ? timeDistanceMinutes(original.returnArrivalTime, next.returnArrivalTime)
    : 0;

  const carrierPenalty =
    original.outboundCarrier &&
    next.outboundCarrier &&
    original.outboundCarrier !== next.outboundCarrier
      ? 5000
      : 0;

  return (
    farePenalty +
    carrierPenalty +
    amountDistance * 100 +
    outboundDeparturePenalty +
    outboundArrivalPenalty +
    returnDeparturePenalty +
    returnArrivalPenalty
  );
}

function isUsableClientOfferSnapshot(input: {
  offerId: string;
  offer: any;
  passengerCount: number;
}) {
  const offer = input.offer;
  if (!offer || typeof offer !== 'object') return false;

  const id = String(offer?.id || '').trim();
  if (!id || id !== String(input.offerId || '').trim()) return false;

  const amount = toMoneyNumber(offer?.total_amount || 0);
  const currency = String(offer?.total_currency || '').trim();

  if (!amount || amount <= 0) return false;
  if (!currency) return false;

  const passengerIds = Array.isArray(offer?.passengers)
    ? offer.passengers
        .map((p: any) => String(p?.id || p?.passenger_id || '').trim())
        .filter(Boolean)
    : [];

  if (passengerIds.length !== input.passengerCount) return false;

  return true;
}

function buildOfferRequestBodyFromOffer(input: {
  originalOffer: any;
  passengerCount: number;
}) {
  const originalOffer = input.originalOffer;
  const outboundFirst = getFirstSegment(originalOffer, 0);
  const outboundLast = getLastSegment(originalOffer, 0);
  const returnFirst = getFirstSegment(originalOffer, 1);
  const returnLast = getLastSegment(originalOffer, 1);

  if (!outboundFirst?.origin?.iata_code || !outboundLast?.destination?.iata_code) {
    throw new Error('Kan ikke lage nytt offer request: mangler utreise-rute');
  }

  if (!outboundFirst?.departing_at) {
    throw new Error('Kan ikke lage nytt offer request: mangler utreisedato');
  }

  const originalPassengers = Array.isArray(originalOffer?.passengers)
    ? originalOffer.passengers
    : [];

  const passengerTypes =
    originalPassengers.length > 0
      ? originalPassengers.map((p: any) => String(p?.type || 'adult').toLowerCase())
      : Array.from({ length: input.passengerCount }, () => 'adult');

  while (passengerTypes.length < input.passengerCount) {
    passengerTypes.push('adult');
  }

  const slices: any[] = [
    {
      origin: outboundFirst.origin.iata_code,
      destination: outboundLast.destination.iata_code,
      departure_date: String(outboundFirst.departing_at).slice(0, 10),
    },
  ];

  if (
    returnFirst?.origin?.iata_code &&
    returnLast?.destination?.iata_code &&
    returnFirst?.departing_at
  ) {
    slices.push({
      origin: returnFirst.origin.iata_code,
      destination: returnLast.destination.iata_code,
      departure_date: String(returnFirst.departing_at).slice(0, 10),
    });
  }

  const cabinClass =
    originalOffer?.cabin_class ||
    originalOffer?.slices?.[0]?.segments?.[0]?.passengers?.[0]
      ?.cabin_class_marketing_name ||
    'economy';

  return {
    data: {
      slices,
      passengers: passengerTypes.slice(0, input.passengerCount).map((type: string) => ({
        type: type || 'adult',
      })),
      cabin_class: String(cabinClass || 'economy').toLowerCase().includes('business')
        ? 'business'
        : String(cabinClass || 'economy').toLowerCase().includes('first')
        ? 'first'
        : String(cabinClass || 'economy').toLowerCase().includes('premium')
        ? 'premium_economy'
        : 'economy',
    },
  };
}

async function createFreshOfferRequestFromOffer(input: {
  originalOffer: any;
  passengerCount: number;
}) {
  const token = getDuffelToken();
  const body = buildOfferRequestBodyFromOffer({
    originalOffer: input.originalOffer,
    passengerCount: input.passengerCount,
  });

  console.log('[FLIGHT PAY] creating fresh Duffel offer request for replacement', {
    slices: body.data.slices,
    passengerCount: body.data.passengers.length,
    cabinClass: body.data.cabin_class,
    originalOfferId: input.originalOffer?.id || null,
    fareBrand: getFareBrandText(input.originalOffer),
  });

  const res = await fetch('https://api.duffel.com/air/offer_requests', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Duffel-Version': 'v2',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Duffel offer request returnerte ikke JSON: ${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    const firstError = Array.isArray(data?.errors) ? data.errors[0] : null;

    console.error('[FLIGHT PAY] Duffel offer request failed raw response', {
      status: res.status,
      statusText: res.statusText,
      body,
      duffel: data,
      firstError: firstError ? JSON.stringify(firstError, null, 2) : null,
      allErrors: Array.isArray(data?.errors)
        ? JSON.stringify(data.errors, null, 2)
        : null,
    });

    const message =
      firstError?.message ||
      firstError?.title ||
      data?.error ||
      'Duffel offer request failed';

    const err: any = new Error(message);
    err.duffel = data;
    throw err;
  }

  return data?.data || null;
}

function extractOffersFromOfferRequest(offerRequest: any) {
  if (Array.isArray(offerRequest?.offers)) return offerRequest.offers;
  if (Array.isArray(offerRequest?.data?.offers)) return offerRequest.data.offers;
  return [];
}

async function findFreshReplacementOffers(input: {
  originalOffer: any;
  passengerCount: number;
  expectedAmount: number;
  expectedCurrency: string;
  maxCandidates?: number;
}) {
  const expectedFareBrand = normalizeFareBrand(getFareBrandText(input.originalOffer));
  const expectedCurrency = String(input.expectedCurrency || '').toUpperCase();
  const maxCandidates = input.maxCandidates || 10;

  const offerRequest = await createFreshOfferRequestFromOffer({
    originalOffer: input.originalOffer,
    passengerCount: input.passengerCount,
  });

  const allOffers = extractOffersFromOfferRequest(offerRequest);

  console.log('[FLIGHT PAY] fresh offer request returned offers', {
    offerRequestId: offerRequest?.id || null,
    totalOfferCount: allOffers.length,
    expectedFareBrand,
    expectedAmount: input.expectedAmount,
    expectedCurrency,
    offers: allOffers.map((offer: any) => ({
      id: offer?.id || null,
      total_amount: offer?.total_amount || null,
      total_currency: offer?.total_currency || null,
      fare_brand_text: getFareBrandText(offer),
      normalized_fare_brand: normalizeFareBrand(getFareBrandText(offer)),
      airline:
        getFirstSegment(offer, 0)?.marketing_carrier?.name ||
        getFirstSegment(offer, 0)?.operating_carrier?.name ||
        offer?.owner?.name ||
        null,
      carrier_code: getCarrierCodeFromSegment(getFirstSegment(offer, 0)) || null,
      outbound_departing_at: getFirstSegment(offer, 0)?.departing_at || null,
      outbound_arriving_at: getLastSegment(offer, 0)?.arriving_at || null,
      return_departing_at: getFirstSegment(offer, 1)?.departing_at || null,
      return_arriving_at: getLastSegment(offer, 1)?.arriving_at || null,
    })),
  });

  const scored: FreshCandidate[] = allOffers
    .filter((offer: any) => offer?.id)
    .filter((offer: any) => {
      const currency = String(offer?.total_currency || '').toUpperCase();
      return !expectedCurrency || currency === expectedCurrency;
    })
    .filter((offer: any) => sameRouteCandidate(input.originalOffer, offer))
    .map((offer: any) => ({
      offer,
      score: scoreReplacementOffer({
        originalOffer: input.originalOffer,
        candidate: offer,
        expectedAmount: input.expectedAmount,
        expectedFareBrand,
      }),
      amount: toMoneyNumber(offer?.total_amount || 0),
      currency: String(offer?.total_currency || '').toUpperCase(),
      fareBrand: normalizeFareBrand(getFareBrandText(offer)),
    }))
    .sort((a: FreshCandidate, b: FreshCandidate) => a.score - b.score);

  const sameFareCandidates = expectedFareBrand
    ? scored.filter((item) => item.fareBrand === expectedFareBrand)
    : scored;

  const candidates = (sameFareCandidates.length ? sameFareCandidates : scored).slice(
    0,
    maxCandidates
  );

  console.log('[FLIGHT PAY] fresh replacement offer search result', {
    originalOfferId: input.originalOffer?.id || null,
    offerRequestId: offerRequest?.id || null,
    expectedFareBrand,
    expectedAmount: input.expectedAmount,
    expectedCurrency,
    totalOfferCount: allOffers.length,
    candidateCount: candidates.length,
    candidates: candidates.map((item) => ({
      offerId: item.offer?.id,
      score: item.score,
      amount: item.amount,
      currency: item.currency,
      fareBrand: item.fareBrand,
      amountDiff: toMoneyNumber(item.amount - input.expectedAmount),
      carrier:
        getFirstSegment(item.offer, 0)?.marketing_carrier?.name ||
        getFirstSegment(item.offer, 0)?.operating_carrier?.name ||
        null,
      outbound: getFirstSegment(item.offer, 0)?.departing_at || null,
      inbound: getFirstSegment(item.offer, 1)?.departing_at || null,
    })),
  });

  return candidates;
}

async function fetchLiveOfferOrThrow(offerId: string) {
  const offerResult = await duffel.offers.get(String(offerId));

  if (!offerResult?.data?.id) {
    throw new Error('Duffel returned missing offer data');
  }

  return offerResult.data;
}

async function resolveLiveOfferForCheckout(input: {
  offerId: string;
  clientOfferSnapshot?: any;
  passengerCount: number;
}): Promise<ResolvedOfferForCheckout> {
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
      requiresFreshOfferAtConfirm: isNorwegianLikeOffer(offer),
    };
  } catch (e: any) {
    const message = getDuffelErrorMessage(e);
    const detail = getPublicErrorDetail(e);
    const payload = getDuffelErrorPayload(e);
    const snapshotIsUsable = isUsableClientOfferSnapshot({
      offerId: input.offerId,
      offer: input.clientOfferSnapshot,
      passengerCount: input.passengerCount,
    });
    const snapshotIsNorwegian = isNorwegianLikeOffer(input.clientOfferSnapshot);

    console.error('[FLIGHT PAY] live offer refresh failed', {
      offerId: input.offerId,
      message,
      detail,
      duffel: payload,
      hasClientOfferSnapshot: !!input.clientOfferSnapshot,
      snapshotIsUsable,
      snapshotIsNorwegian,
      fareBrand: getFareBrandText(input.clientOfferSnapshot),
    });

    if (
      snapshotIsUsable &&
      snapshotIsNorwegian &&
      (isRetryableDuffelOfferProblem(message) || isRetryableDuffelOfferProblem(detail))
    ) {
      console.warn(
        '[FLIGHT PAY] using Norwegian client snapshot for Stripe authorization only; fresh offer will be created at confirm',
        {
          offerId: input.offerId,
          fareBrand: getFareBrandText(input.clientOfferSnapshot),
          amount: toMoneyNumber(input.clientOfferSnapshot?.total_amount || 0),
          currency: String(input.clientOfferSnapshot?.total_currency || '').toUpperCase(),
        }
      );

      return {
        offer: input.clientOfferSnapshot,
        wasLive: false,
        usedClientSnapshot: true,
        requiresFreshOfferAtConfirm: true,
      };
    }

    const publicMessage =
      isRetryableDuffelOfferProblem(message) || isRetryableDuffelOfferProblem(detail)
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

  const res = await fetch('https://api.duffel.com/air/orders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Duffel-Version': 'v2',
      'Content-Type': 'application/json',
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
      firstError: firstError ? JSON.stringify(firstError, null, 2) : null,
      allErrors: Array.isArray(data?.errors)
        ? JSON.stringify(data.errors, null, 2)
        : null,
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

async function createDuffelOrderFromFreshCandidates(input: {
  originalOffer: any;
  expectedAmount: number;
  expectedCurrency: string;
  passengers: PassengerInput[];
  selectedServices: SelectedService[];
}) {
  if (input.selectedServices.length) {
    throw new Error(
      'Kan ikke bytte til ferskt Norwegian-tilbud når gamle tilleggstjenester er valgt. Søk på nytt og velg billettype uten separate tillegg.'
    );
  }

  const candidates = await findFreshReplacementOffers({
    originalOffer: input.originalOffer,
    passengerCount: input.passengers.length,
    expectedAmount: input.expectedAmount,
    expectedCurrency: input.expectedCurrency,
    maxCandidates: 10,
  });

  let lastError: any = null;
  const maxIncrease = getMaxReplacementPriceIncrease();
  const maxDrop = getMaxReplacementPriceDrop();

  for (const candidate of candidates) {
    const amountDiff = toMoneyNumber(candidate.amount - input.expectedAmount);

    if (candidate.currency !== input.expectedCurrency) {
      console.warn('[FLIGHT PAY] skipping fresh candidate - currency differs', {
        offerId: candidate.offer?.id || null,
        candidateCurrency: candidate.currency,
        expectedCurrency: input.expectedCurrency,
      });
      continue;
    }

    if (amountDiff > maxIncrease) {
      console.warn('[FLIGHT PAY] skipping fresh candidate - price increase not authorized', {
        offerId: candidate.offer?.id || null,
        candidateAmount: candidate.amount,
        expectedAmount: input.expectedAmount,
        amountDiff,
        maxIncrease,
      });
      continue;
    }

    if (amountDiff < 0 && Math.abs(amountDiff) > maxDrop) {
      console.warn('[FLIGHT PAY] skipping fresh candidate - price drop too large', {
        offerId: candidate.offer?.id || null,
        candidateAmount: candidate.amount,
        expectedAmount: input.expectedAmount,
        amountDiff,
        maxDrop,
      });
      continue;
    }

    try {
      const passengerIds = getOfferPassengerIds(candidate.offer);

      if (passengerIds.length !== input.passengers.length) {
        console.warn('[FLIGHT PAY] skipping fresh candidate - passenger count differs', {
          offerId: candidate.offer?.id || null,
          passengerIdCount: passengerIds.length,
          passengerCount: input.passengers.length,
        });
        continue;
      }

      const passengersWithFreshIds = input.passengers.map((passenger, index) => ({
        ...passenger,
        id: passengerIds[index],
      }));

      console.log('[FLIGHT PAY] trying fresh Duffel order candidate', {
        offerId: candidate.offer?.id || null,
        amount: candidate.amount,
        currency: candidate.currency,
        fareBrand: candidate.fareBrand,
        score: candidate.score,
        amountDiff,
      });

      const order = await createDuffelOrderRaw({
        offerId: String(candidate.offer.id),
        duffelPaymentAmount: candidate.amount,
        offerCurrency: candidate.currency,
        passengers: passengersWithFreshIds,
        selectedServices: [],
      });

      return {
        order,
        offer: candidate.offer,
        offerId: String(candidate.offer.id),
        duffelPaymentAmount: candidate.amount,
        offerCurrency: candidate.currency,
        selectedServices: [],
        usedFreshReplacement: true,
      } as CreatedDuffelOrderResult;
    } catch (candidateError: any) {
      lastError = candidateError;
      const candidateMessage = getDuffelErrorMessage(candidateError);
      const candidateDetail = getPublicErrorDetail(candidateError);

      console.warn('[FLIGHT PAY] fresh Duffel order candidate failed', {
        offerId: candidate.offer?.id || null,
        message: candidateMessage,
        detail: candidateDetail,
        duffel: getDuffelErrorPayload(candidateError),
      });

      continue;
    }
  }

  if (lastError) throw lastError;

  throw new Error(
    'Fant ikke et ferskt Norwegian-tilbud med samme rute, billettype og pris som kunne bookes. Betalingen er ikke belastet. Søk på nytt.'
  );
}

async function createDuffelOrderWithRetry(input: {
  offerId: string;
  duffelPaymentAmount: number;
  offerCurrency: string;
  passengers: PassengerInput[];
  selectedServices: SelectedService[];
  offerSnapshot?: any;
  preferFreshOfferFirst?: boolean;
}): Promise<CreatedDuffelOrderResult> {
  const canUseFreshCandidates = !!input.offerSnapshot?.id;

  if (input.preferFreshOfferFirst && canUseFreshCandidates) {
    try {
      console.log('[FLIGHT PAY] creating fresh offer at confirm before first order attempt', {
        originalOfferId: input.offerId,
        expectedAmount: input.duffelPaymentAmount,
        expectedCurrency: input.offerCurrency,
        fareBrand: getFareBrandText(input.offerSnapshot),
        isNorwegianLike: isNorwegianLikeOffer(input.offerSnapshot),
      });

      return await createDuffelOrderFromFreshCandidates({
        originalOffer: input.offerSnapshot,
        expectedAmount: input.duffelPaymentAmount,
        expectedCurrency: input.offerCurrency,
        passengers: input.passengers,
        selectedServices: input.selectedServices,
      });
    } catch (freshFirstError: any) {
      console.warn('[FLIGHT PAY] fresh offer before first order attempt failed; trying original offer once', {
        message: getDuffelErrorMessage(freshFirstError),
        detail: getPublicErrorDetail(freshFirstError),
      });
    }
  }

  try {
    const order = await createDuffelOrderRaw(input);

    return {
      order,
      offer: input.offerSnapshot || null,
      offerId: input.offerId,
      duffelPaymentAmount: input.duffelPaymentAmount,
      offerCurrency: input.offerCurrency,
      selectedServices: input.selectedServices,
      usedFreshReplacement: false,
    };
  } catch (firstError: any) {
    const message = getDuffelErrorMessage(firstError);
    const detail = getPublicErrorDetail(firstError);

    const shouldTryFreshReplacement =
      canUseFreshCandidates &&
      (input.preferFreshOfferFirst ||
        isNorwegianLikeOffer(input.offerSnapshot) ||
        isRetryableDuffelOfferProblem(message) ||
        isRetryableDuffelOfferProblem(detail));

    if (!shouldTryFreshReplacement) {
      throw firstError;
    }

    console.warn('[FLIGHT PAY] original Duffel order failed, trying fresh replacement candidates', {
      offerId: input.offerId,
      message,
      detail,
      fareBrand: getFareBrandText(input.offerSnapshot),
      amount: input.duffelPaymentAmount,
      currency: input.offerCurrency,
      isNorwegianLike: isNorwegianLikeOffer(input.offerSnapshot),
    });

    await sleep(700);

    try {
      return await createDuffelOrderFromFreshCandidates({
        originalOffer: input.offerSnapshot,
        expectedAmount: input.duffelPaymentAmount,
        expectedCurrency: input.offerCurrency,
        passengers: input.passengers,
        selectedServices: input.selectedServices,
      });
    } catch (replacementError: any) {
      console.error('[FLIGHT PAY] all fresh replacement candidates failed', {
        originalMessage: message,
        replacementMessage: getDuffelErrorMessage(replacementError),
        replacementDetail: getPublicErrorDetail(replacementError),
      });

      throw replacementError || firstError;
    }
  }
}

async function cancelPaymentIntentIfPossible(paymentIntentId?: string | null) {
  if (!paymentIntentId) return;

  try {
    const stripe = getStripe();
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (pi.status === 'requires_capture') {
      await stripe.paymentIntents.cancel(pi.id);
      console.log('[FLIGHT PAY] cancelled uncaptured payment intent', {
        paymentIntentId: pi.id,
      });
    }
  } catch (error: any) {
    console.error('[FLIGHT PAY] failed to cancel payment intent', {
      message: error?.message || String(error),
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
        requiresFreshOfferAtConfirm: String(
          resolvedOfferResult.requiresFreshOfferAtConfirm
        ),
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
      usedClientSnapshot: resolvedOfferResult.usedClientSnapshot,
      requiresFreshOfferAtConfirm: resolvedOfferResult.requiresFreshOfferAtConfirm,
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
      requiresFreshOfferAtConfirm: resolvedOfferResult.requiresFreshOfferAtConfirm,
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
      offerWasLive: resolvedOfferResult.wasLive,
      usedClientSnapshot: resolvedOfferResult.usedClientSnapshot,
      requiresFreshOfferAtConfirm: resolvedOfferResult.requiresFreshOfferAtConfirm,
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
        error: 'offer_no_longer_available',
        detail:
          'Dette flytilbudet er ikke lenger tilgjengelig. Søk på nytt for oppdaterte priser og billettyper.',
      });
    }

    if (isDuffelInternalAirlineError(message) || isDuffelInternalAirlineError(detail)) {
      return res.status(502).json({
        ok: false,
        error:
          'Flyselskapet kunne ikke verifisere denne billettypen akkurat nå. Søk på nytt, prøv en annen billettype eller velg en annen avgang.',
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

    const preferFreshOfferFirst =
      draft.requiresFreshOfferAtConfirm || isNorwegianLikeOffer(draft.offerSnapshot);

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
      usedClientSnapshot: draft.usedClientSnapshot || false,
      requiresFreshOfferAtConfirm: draft.requiresFreshOfferAtConfirm || false,
      preferFreshOfferFirst,
      isNorwegianLike: isNorwegianLikeOffer(draft.offerSnapshot),
      fareBrand: getFareBrandText(draft.offerSnapshot),
    });

    const orderResult = await createDuffelOrderWithRetry({
      offerId: draft.offerId,
      duffelPaymentAmount: draft.duffelPaymentAmount,
      offerCurrency: draft.offerCurrency,
      passengers: draft.passengers,
      selectedServices: draft.selectedServices,
      offerSnapshot: draft.offerSnapshot,
      preferFreshOfferFirst,
    });

    const order = orderResult.order;
    const contactPassenger = draft.passengers[0];

    if (!contactPassenger) {
      throw new Error('Fant ingen kontaktpassasjer i bookingutkastet');
    }

    const actualDuffelPaymentAmount = toMoneyNumber(orderResult.duffelPaymentAmount);
    const actualServiceFee = draft.serviceFee;
    const actualTotalAmount = toMoneyNumber(actualDuffelPaymentAmount + actualServiceFee);
    const actualCaptureMinor = toMinorUnits(actualTotalAmount);

    if (actualCaptureMinor > paymentIntent.amount) {
      await cancelPaymentIntentIfPossible(paymentIntent.id);

      return res.status(409).json({
        ok: false,
        error:
          'Prisen på flytilbudet har økt før bookingen kunne bekreftes. Betalingen er ikke belastet. Søk på nytt for oppdatert pris.',
        detail: {
          authorizedAmount: paymentIntent.amount,
          requiredAmount: actualCaptureMinor,
          currency: draft.offerCurrency,
        },
      });
    }

    const booking = await createFlightBooking({
      bookingDraftId: String(bookingDraftId),
      paymentIntentId: draft.paymentIntentId,
      paymentStatus: paymentIntent.status,
      offerId: orderResult.offerId || draft.offerId,
      flightAmount: actualDuffelPaymentAmount,
      serviceFee: actualServiceFee,
      totalAmount: actualTotalAmount,
      currency: orderResult.offerCurrency || draft.offerCurrency,
      passengers: draft.passengers,
      order,
      userId: userId ? String(userId) : null,
    });

    bookingId = String(booking.id || '');

    if (paymentIntent.status === 'requires_capture') {
      try {
        if (actualCaptureMinor < paymentIntent.amount) {
          await stripe.paymentIntents.capture(paymentIntent.id, {
            amount_to_capture: actualCaptureMinor,
          });
        } else {
          await stripe.paymentIntents.capture(paymentIntent.id);
        }
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
      const emailOfferSnapshot = orderResult.offer || draft.offerSnapshot;

      const outboundFirst =
        getFirstSegment(order, 0) || getFirstSegment(emailOfferSnapshot, 0);
      const outboundLast =
        getLastSegment(order, 0) || getLastSegment(emailOfferSnapshot, 0);
      const returnFirst =
        getFirstSegment(order, 1) || getFirstSegment(emailOfferSnapshot, 1);
      const returnLast =
        getLastSegment(order, 1) || getLastSegment(emailOfferSnapshot, 1);

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
        offer: emailOfferSnapshot,
        passengers: draft.passengers,
        airline: getAirlineFromOrderOrOffer(order, emailOfferSnapshot),
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
        totalAmount: actualTotalAmount,
        currency: orderResult.offerCurrency || draft.offerCurrency,
        serviceFee: actualServiceFee,
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
      usedFreshReplacement: orderResult.usedFreshReplacement,
      originalDuffelPaymentAmount: draft.duffelPaymentAmount,
      actualDuffelPaymentAmount,
      originalTotalAmount: draft.totalAmount,
      actualTotalAmount,
    });

    return res.json({
      ok: true,
      orderId: order?.id || null,
      order,
      bookingId: confirmedBooking?.id || null,
      bnoBookingRef: confirmedBooking?.bno_booking_ref || null,
      usedFreshReplacement: orderResult.usedFreshReplacement,
      originalAmount: draft.totalAmount,
      amount: actualTotalAmount,
      currency: orderResult.offerCurrency || draft.offerCurrency,
      selectedServices: orderResult.selectedServices.map((service) => ({
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

    const { bookingDraftId } = req.body || {};
    const draft = bookingDrafts.get(String(bookingDraftId));

    await cancelPaymentIntentIfPossible(draft?.paymentIntentId);

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
          'Flyselskapet kunne ikke bekrefte denne billettypen akkurat nå. Betalingen er ikke belastet. Prøv en annen billettype, søk på nytt, eller velg en annen avgang.',
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
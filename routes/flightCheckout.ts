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

type DuffelOrderResult = {
  order: any;
  offerId: string;
  offerSnapshot: any;
  duffelPaymentAmount: number;
  offerCurrency: string;
  passengers: PassengerInput[];
  replacedAtConfirm: boolean;
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

  const value =
    firstError?.message ||
    firstError?.title ||
    getDuffelErrorMessage(e) ||
    'Kunne ikke fullføre booking';

  return typeof value === 'string' ? value : String(value);
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

function getAirportCode(airport: any) {
  return String(airport?.iata_code || airport?.iata || airport?.code || '').trim();
}

function getSegmentOriginCode(segment: any) {
  return getAirportCode(segment?.origin);
}

function getSegmentDestinationCode(segment: any) {
  return getAirportCode(segment?.destination);
}

function getDatePart(value: any) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.slice(0, 10);
}

function getCarrierCodeFromSegment(segment: any) {
  return String(
    segment?.marketing_carrier?.iata_code ||
      segment?.operating_carrier?.iata_code ||
      ''
  )
    .trim()
    .toUpperCase();
}

function getCarrierNameFromSegment(segment: any) {
  return String(
    segment?.marketing_carrier?.name ||
      segment?.operating_carrier?.name ||
      ''
  ).trim();
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
    offer?.slices?.[0]?.segments?.[0]?.fare_brand_name ||
    offer?.slices?.[0]?.segments?.[0]?.fare_brand ||
    '';

  if (String(raw || '').trim()) return String(raw).trim().toLowerCase();

  const text = stringifyForSearch(offer);

  if (text.includes('lowfare plus') || text.includes('lowfare+')) {
    return 'lowfare plus';
  }

  if (text.includes('lowfare')) return 'lowfare';
  if (text.includes('flex')) return 'flex';
  if (text.includes('plus')) return 'plus';
  if (text.includes('standard')) return 'standard';
  if (text.includes('basic')) return 'basic';

  return '';
}

function fareBrandLooksSame(a: any, b: any) {
  const fa = getFareBrandText(a);
  const fb = getFareBrandText(b);

  if (!fa || !fb) return true;
  if (fa === fb) return true;

  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/\+/g, 'plus')
      .replace(/-/g, '');

  return normalize(fa) === normalize(fb);
}

function itinerarySignatureFromOffer(offer: any) {
  const outboundFirst = getFirstSegment(offer, 0);
  const outboundLast = getLastSegment(offer, 0);
  const returnFirst = getFirstSegment(offer, 1);
  const returnLast = getLastSegment(offer, 1);

  return {
    outboundOrigin: getSegmentOriginCode(outboundFirst),
    outboundDestination: getSegmentDestinationCode(outboundLast),
    outboundDate: getDatePart(outboundFirst?.departing_at),
    returnOrigin: getSegmentOriginCode(returnFirst),
    returnDestination: getSegmentDestinationCode(returnLast),
    returnDate: getDatePart(returnFirst?.departing_at),
    outboundCarrierCode: getCarrierCodeFromSegment(outboundFirst),
    returnCarrierCode: getCarrierCodeFromSegment(returnFirst),
    outboundCarrierName: getCarrierNameFromSegment(outboundFirst),
    returnCarrierName: getCarrierNameFromSegment(returnFirst),
  };
}

function candidateMatchesOriginalItinerary(candidate: any, original: any) {
  const a = itinerarySignatureFromOffer(original);
  const b = itinerarySignatureFromOffer(candidate);

  if (!a.outboundOrigin || !a.outboundDestination || !a.outboundDate) return false;

  const outboundMatches =
    a.outboundOrigin === b.outboundOrigin &&
    a.outboundDestination === b.outboundDestination &&
    a.outboundDate === b.outboundDate;

  if (!outboundMatches) return false;

  if (a.returnOrigin || a.returnDestination || a.returnDate) {
    const returnMatches =
      a.returnOrigin === b.returnOrigin &&
      a.returnDestination === b.returnDestination &&
      a.returnDate === b.returnDate;

    if (!returnMatches) return false;
  }

  const originalCarrier = a.outboundCarrierCode || a.outboundCarrierName;
  const candidateCarrier = b.outboundCarrierCode || b.outboundCarrierName;

  if (originalCarrier && candidateCarrier && originalCarrier !== candidateCarrier) {
    return false;
  }

  return true;
}

function buildOfferRequestBodyFromOriginal(input: {
  originalOffer: any;
  passengerCount: number;
}) {
  const original = input.originalOffer;
  const sig = itinerarySignatureFromOffer(original);

  if (!sig.outboundOrigin || !sig.outboundDestination || !sig.outboundDate) {
    throw new Error('Kan ikke lage nytt offer request: mangler utreiseinfo');
  }

  const slices: any[] = [
    {
      origin: sig.outboundOrigin,
      destination: sig.outboundDestination,
      departure_date: sig.outboundDate,
    },
  ];

  if (sig.returnOrigin && sig.returnDestination && sig.returnDate) {
    slices.push({
      origin: sig.returnOrigin,
      destination: sig.returnDestination,
      departure_date: sig.returnDate,
    });
  }

  const passengers = Array.from({
    length: Math.max(1, input.passengerCount || 1),
  }).map(() => ({
    type: 'adult',
  }));

  const cabinClass =
    original?.slices?.[0]?.segments?.[0]?.passengers?.[0]?.cabin_class ||
    original?.cabin_class ||
    'economy';

  return {
    data: {
      slices,
      passengers,
      cabin_class: cabinClass,
      return_offers: true,
    },
  };
}

async function createOfferRequestFromOriginal(input: {
  originalOffer: any;
  passengerCount: number;
}) {
  const token = getDuffelToken();
  const body = buildOfferRequestBodyFromOriginal(input);

  console.log('[FLIGHT PAY] creating fresh Duffel offer request for replacement', {
    slices: body.data.slices,
    passengerCount: body.data.passengers.length,
    cabinClass: body.data.cabin_class,
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

function getOffersFromOfferRequestResult(value: any): any[] {
  if (Array.isArray(value?.offers)) return value.offers;
  if (Array.isArray(value?.data?.offers)) return value.data.offers;
  return [];
}

async function findFreshReplacementOffer(input: {
  originalOffer: any;
  passengerCount: number;
  expectedAmount: number;
}) {
  const original = input.originalOffer;

  if (!original?.id) return null;

  const offerRequest = await createOfferRequestFromOriginal({
    originalOffer: original,
    passengerCount: input.passengerCount,
  });

  const offers = getOffersFromOfferRequestResult(offerRequest);

  if (!offers.length) {
    console.warn('[FLIGHT PAY] replacement offer request returned no offers');
    return null;
  }

  const originalAmount = toMoneyNumber(input.expectedAmount);
  const originalCurrency = String(original.total_currency || '').toUpperCase();

  const candidates = offers
    .filter((candidate: any) => candidate?.id)
    .filter((candidate: any) => {
      const candidateCurrency = String(candidate?.total_currency || '').toUpperCase();
      if (originalCurrency && candidateCurrency !== originalCurrency) return false;

      return candidateMatchesOriginalItinerary(candidate, original);
    })
    .filter((candidate: any) => fareBrandLooksSame(candidate, original))
    .sort((a: any, b: any) => {
      const aAmount = toMoneyNumber(a?.total_amount || 0);
      const bAmount = toMoneyNumber(b?.total_amount || 0);

      const aDelta = Math.abs(aAmount - originalAmount);
      const bDelta = Math.abs(bAmount - originalAmount);

      if (aDelta !== bDelta) return aDelta - bDelta;
      return aAmount - bAmount;
    });

  const chosen = candidates[0] || null;

  console.log('[FLIGHT PAY] fresh replacement offer search result', {
    originalOfferId: original.id,
    originalAmount,
    originalCurrency,
    originalFareBrand: getFareBrandText(original),
    returnedOffers: offers.length,
    matchingCandidates: candidates.length,
    chosenOfferId: chosen?.id || null,
    chosenAmount: chosen ? toMoneyNumber(chosen.total_amount || 0) : null,
    chosenFareBrand: chosen ? getFareBrandText(chosen) : null,
  });

  return chosen;
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
}) {
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
    };
  } catch (e: any) {
    const message = getDuffelErrorMessage(e);
    const payload = getDuffelErrorPayload(e);

    console.error('[FLIGHT PAY] live offer refresh failed - refusing cached fallback', {
      offerId: input.offerId,
      message,
      duffel: payload,
      hasClientOfferSnapshot: !!input.clientOfferSnapshot,
      isNorwegianLike: isNorwegianLikeOffer(input.clientOfferSnapshot),
    });

    const publicMessage = isDuffelOfferGoneMessage(message)
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
}): Promise<DuffelOrderResult> {
  try {
    const order = await createDuffelOrderRaw(input);

    return {
      order,
      offerId: input.offerId,
      offerSnapshot: input.offerSnapshot || null,
      duffelPaymentAmount: input.duffelPaymentAmount,
      offerCurrency: input.offerCurrency,
      passengers: input.passengers,
      replacedAtConfirm: false,
    };
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

    console.warn('[FLIGHT PAY] Duffel order failed for Norwegian, creating fresh replacement offer', {
      offerId: input.offerId,
      message,
      detail,
      amount: input.duffelPaymentAmount,
      currency: input.offerCurrency,
      fareBrand: getFareBrandText(input.offerSnapshot),
    });

    await sleep(1200);

    const replacement = await findFreshReplacementOffer({
      originalOffer: input.offerSnapshot,
      passengerCount: input.passengers.length,
      expectedAmount: input.duffelPaymentAmount,
    });

    if (!replacement?.id) {
      console.warn('[FLIGHT PAY] no replacement offer found for Norwegian retry', {
        originalOfferId: input.offerId,
      });

      throw firstError;
    }

    const replacementAmount = toMoneyNumber(replacement.total_amount || 0);
    const replacementCurrency = String(replacement.total_currency || '').toUpperCase();

    if (replacementCurrency !== input.offerCurrency) {
      console.warn('[FLIGHT PAY] replacement rejected - currency differs', {
        originalCurrency: input.offerCurrency,
        replacementCurrency,
      });

      throw firstError;
    }

    const replacementPassengerIds = getOfferPassengerIds(replacement);

    if (replacementPassengerIds.length !== input.passengers.length) {
      console.warn('[FLIGHT PAY] replacement rejected - passenger count differs', {
        originalPassengerCount: input.passengers.length,
        replacementPassengerCount: replacementPassengerIds.length,
      });

      throw firstError;
    }

    const originalAmount = toMoneyNumber(input.duffelPaymentAmount);
    const maxAllowedIncrease = 0.01;

    if (replacementAmount > originalAmount + maxAllowedIncrease) {
      const err: any = new Error(
        'Prisen på flytilbudet har endret seg hos Norwegian. Betalingen er ikke belastet. Søk på nytt for oppdatert pris.'
      );

      err.duffel = {
        errors: [
          {
            title: 'price_changed',
            message:
              'Replacement offer has a higher price than the authorized payment amount.',
            original_amount: originalAmount,
            replacement_amount: replacementAmount,
            currency: replacementCurrency,
          },
        ],
      };

      console.warn('[FLIGHT PAY] replacement rejected - price increased', {
        originalAmount,
        replacementAmount,
        currency: replacementCurrency,
      });

      throw err;
    }

    const passengersWithFreshIds = input.passengers.map((passenger, index) => ({
      ...passenger,
      id: replacementPassengerIds[index],
    }));

    console.log('[FLIGHT PAY] retrying Duffel order with fresh Norwegian replacement', {
      originalOfferId: input.offerId,
      replacementOfferId: replacement.id,
      originalAmount,
      replacementAmount,
      currency: replacementCurrency,
      originalFareBrand: getFareBrandText(input.offerSnapshot),
      replacementFareBrand: getFareBrandText(replacement),
    });

    const order = await createDuffelOrderRaw({
      offerId: String(replacement.id),
      duffelPaymentAmount: replacementAmount,
      offerCurrency: replacementCurrency,
      passengers: passengersWithFreshIds,
      selectedServices: input.selectedServices,
    });

    return {
      order,
      offerId: String(replacement.id),
      offerSnapshot: replacement,
      duffelPaymentAmount: replacementAmount,
      offerCurrency: replacementCurrency,
      passengers: passengersWithFreshIds,
      replacedAtConfirm: true,
    };
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
        contactEmail: String(passengers[0]?.email || ''),
        passengerCount: String(passengers.length),
        selectedServiceIds: selectedServiceIds.join(','),
        servicesAmount: String(servicesAmount),
        serviceFee: String(serviceFee),
        totalAmount: String(totalAmount),
        offerWasLive: String(resolvedOfferResult.wasLive),
        usedClientSnapshot: String(resolvedOfferResult.usedClientSnapshot),
        isNorwegianLike: String(isNorwegianLikeOffer(resolvedOffer)),
        fareBrand: getFareBrandText(resolvedOffer),
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

    const orderResult = await createDuffelOrderWithRetry({
      offerId: draft.offerId,
      duffelPaymentAmount: draft.duffelPaymentAmount,
      offerCurrency: draft.offerCurrency,
      passengers: draft.passengers,
      selectedServices: draft.selectedServices,
      offerSnapshot: draft.offerSnapshot,
    });

    const order = orderResult.order;
    const effectiveOfferId = orderResult.offerId;
    const effectiveOfferSnapshot = orderResult.offerSnapshot || draft.offerSnapshot;
    const effectiveDuffelPaymentAmount = toMoneyNumber(orderResult.duffelPaymentAmount);
    const effectiveCurrency = String(orderResult.offerCurrency || draft.offerCurrency).toUpperCase();
    const effectiveServiceFee = getServiceFee(
      effectiveDuffelPaymentAmount,
      effectiveCurrency
    );
    const effectiveTotalAmount = toMoneyNumber(
      effectiveDuffelPaymentAmount + effectiveServiceFee
    );

    const authorizedAmount =
      typeof paymentIntent.amount === 'number' ? paymentIntent.amount : 0;

    const effectiveMinorAmount = toMinorUnits(effectiveTotalAmount);

    if (
      paymentIntent.status === 'requires_capture' &&
      effectiveMinorAmount > authorizedAmount
    ) {
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id);
      } catch (cancelError: any) {
        console.error('[FLIGHT PAY] failed to cancel payment intent after price increase', {
          message: cancelError?.message || String(cancelError),
          paymentIntentId: paymentIntent.id,
        });
      }

      return res.status(409).json({
        ok: false,
        error:
          'Prisen hos flyselskapet har endret seg før bookingen kunne bekreftes. Betalingen er ikke belastet. Søk på nytt for oppdatert pris.',
        detail: {
          originalTotalAmount: draft.totalAmount,
          newTotalAmount: effectiveTotalAmount,
          currency: effectiveCurrency,
        },
      });
    }

    const contactPassenger = orderResult.passengers[0];

    if (!contactPassenger) {
      throw new Error('Fant ingen kontaktpassasjer i bookingutkastet');
    }

    const booking = await createFlightBooking({
      bookingDraftId: String(bookingDraftId),
      paymentIntentId: draft.paymentIntentId,
      paymentStatus: paymentIntent.status,
      offerId: effectiveOfferId,
      flightAmount: effectiveDuffelPaymentAmount,
      serviceFee: effectiveServiceFee,
      totalAmount: effectiveTotalAmount,
      currency: effectiveCurrency,
      passengers: orderResult.passengers,
      order,
      userId: userId ? String(userId) : null,
    });

    bookingId = String(booking.id || '');

    if (paymentIntent.status === 'requires_capture') {
      try {
        if (effectiveMinorAmount < authorizedAmount) {
          await stripe.paymentIntents.capture(paymentIntent.id, {
            amount_to_capture: effectiveMinorAmount,
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
      const outboundFirst =
        getFirstSegment(order, 0) || getFirstSegment(effectiveOfferSnapshot, 0);
      const outboundLast =
        getLastSegment(order, 0) || getLastSegment(effectiveOfferSnapshot, 0);
      const returnFirst =
        getFirstSegment(order, 1) || getFirstSegment(effectiveOfferSnapshot, 1);
      const returnLast =
        getLastSegment(order, 1) || getLastSegment(effectiveOfferSnapshot, 1);

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
        offer: effectiveOfferSnapshot,
        passengers: orderResult.passengers,
        airline: getAirlineFromOrderOrOffer(order, effectiveOfferSnapshot),
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
        totalAmount: effectiveTotalAmount,
        currency: effectiveCurrency,
        serviceFee: effectiveServiceFee,
      } as any);
    } catch (emailError: any) {
      console.error('[FLIGHT PAY] confirmation email failed', {
        message: emailError?.message || String(emailError),
      });
    }

    bookingDrafts.delete(String(bookingDraftId));

    console.log('[FLIGHT PAY] confirm success', {
      bookingDraftId,
      originalOfferId: draft.offerId,
      effectiveOfferId,
      replacedAtConfirm: orderResult.replacedAtConfirm,
      orderId: order?.id || null,
      bookingId: confirmedBooking?.id || null,
      bnoBookingRef: confirmedBooking?.bno_booking_ref || null,
      userId: userId || null,
      passengerCount: orderResult.passengers.length,
      selectedServiceIds: draft.selectedServiceIds,
      originalTotalAmount: draft.totalAmount,
      effectiveTotalAmount,
      currency: effectiveCurrency,
    });

    return res.json({
      ok: true,
      orderId: order?.id || null,
      order,
      bookingId: confirmedBooking?.id || null,
      bnoBookingRef: confirmedBooking?.bno_booking_ref || null,
      replacedAtConfirm: orderResult.replacedAtConfirm,
      originalOfferId: draft.offerId,
      effectiveOfferId,
      amount: effectiveTotalAmount,
      currency: effectiveCurrency,
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
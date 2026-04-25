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
    m.includes('latest availability') ||
    m.includes('offer_no_longer_available')
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

  if (
    text.includes('lowfare plus') ||
    text.includes('lowfare+') ||
    text.includes('low fare plus')
  ) {
    return 'low fare plus';
  }

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

function isTemporarilyBlockedNorwegianFare(offer: any) {
  if (!isNorwegianLikeOffer(offer)) return false;

  const fareBrand = normalizeFareBrand(getFareBrandText(offer));

  return fareBrand === 'lowfare_plus' || fareBrand === 'flex';
}

function getTemporarilyBlockedNorwegianFareMessage(offer: any) {
  const fareBrand = normalizeFareBrand(getFareBrandText(offer));

  if (fareBrand === 'flex') {
    return 'Norwegian Flex kan ikke bookes akkurat nå. Betalingen er ikke startet. Velg Norwegian LowFare, en annen billettype, eller et annet flyselskap.';
  }

  if (fareBrand === 'lowfare_plus') {
    return 'Norwegian LowFare+ kan ikke bookes akkurat nå. Betalingen er ikke startet. Velg Norwegian LowFare, en annen billettype, eller et annet flyselskap.';
  }

  return 'Denne Norwegian-billettypen kan ikke bookes akkurat nå. Betalingen er ikke startet. Velg Norwegian LowFare, en annen billettype, eller et annet flyselskap.';
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
      fareBrand: getFareBrandText(input.clientOfferSnapshot),
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
    const shouldRetry =
      isDuffelInternalAirlineError(message) || isNorwegianLikeOffer(input.offerSnapshot);

    if (!shouldRetry) {
      throw firstError;
    }

    console.warn('[FLIGHT PAY] Duffel order failed, retrying once with refetched live offer', {
      offerId: input.offerId,
      message,
      isNorwegianLike: isNorwegianLikeOffer(input.offerSnapshot),
      fareBrand: getFareBrandText(input.offerSnapshot),
    });

    await sleep(1200);

    const refreshedOffer = await fetchLiveOfferOrThrow(input.offerId);
    const refreshedPassengerIds = getOfferPassengerIds(refreshedOffer);
    const refreshedAmount = toMoneyNumber(refreshedOffer.total_amount || 0);
    const refreshedCurrency = String(refreshedOffer.total_currency || '').toUpperCase();

    if (refreshedPassengerIds.length !== input.passengers.length) {
      throw firstError;
    }

    if (refreshedCurrency !== input.offerCurrency) {
      throw firstError;
    }

    if (Math.abs(refreshedAmount - input.duffelPaymentAmount) > 0.01) {
      console.warn('[FLIGHT PAY] refreshed offer price differs, refusing retry', {
        originalAmount: input.duffelPaymentAmount,
        refreshedAmount,
        currency: refreshedCurrency,
      });

      throw firstError;
    }

    const passengersWithFreshIds = input.passengers.map((passenger, index) => ({
      ...passenger,
      id: refreshedPassengerIds[index],
    }));

    return await createDuffelOrderRaw({
      ...input,
      passengers: passengersWithFreshIds,
      offerId: String(refreshedOffer.id || input.offerId),
      duffelPaymentAmount: refreshedAmount,
      offerCurrency: refreshedCurrency,
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

    if (isTemporarilyBlockedNorwegianFare(clientOfferSnapshot)) {
      const detail = getTemporarilyBlockedNorwegianFareMessage(clientOfferSnapshot);

      console.warn('[FLIGHT PAY] temporarily blocked Norwegian fare before live offer refresh', {
        offerId: String(offerId),
        fareBrand: getFareBrandText(clientOfferSnapshot),
        normalizedFareBrand: normalizeFareBrand(getFareBrandText(clientOfferSnapshot)),
        airline: getAirlineFromOrderOrOffer(null, clientOfferSnapshot),
        amount: toMoneyNumber(clientOfferSnapshot?.total_amount || 0),
        currency: String(clientOfferSnapshot?.total_currency || '').toUpperCase(),
      });

      return res.status(409).json({
        ok: false,
        error: 'norwegian_fare_temporarily_unavailable',
        detail,
      });
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

    if (isTemporarilyBlockedNorwegianFare(resolvedOffer)) {
      const detail = getTemporarilyBlockedNorwegianFareMessage(resolvedOffer);

      console.warn('[FLIGHT PAY] temporarily blocked Norwegian fare before Stripe', {
        offerId: String(resolvedOffer.id || offerId),
        fareBrand: getFareBrandText(resolvedOffer),
        normalizedFareBrand: normalizeFareBrand(getFareBrandText(resolvedOffer)),
        airline: getAirlineFromOrderOrOffer(null, resolvedOffer),
        amount: flightAmount,
        currency: currencyUpper,
      });

      return res.status(409).json({
        ok: false,
        error: 'norwegian_fare_temporarily_unavailable',
        detail,
      });
    }

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

    if (isTemporarilyBlockedNorwegianFare(draft.offerSnapshot)) {
      const detail = getTemporarilyBlockedNorwegianFareMessage(draft.offerSnapshot);

      console.warn('[FLIGHT PAY] temporarily blocked Norwegian fare at confirm', {
        bookingDraftId,
        offerId: draft.offerId,
        fareBrand: getFareBrandText(draft.offerSnapshot),
        normalizedFareBrand: normalizeFareBrand(getFareBrandText(draft.offerSnapshot)),
        paymentIntentId: draft.paymentIntentId,
      });

      try {
        const pi = await stripe.paymentIntents.retrieve(draft.paymentIntentId);

        if (
          pi.status === 'requires_capture' ||
          pi.status === 'requires_payment_method'
        ) {
          await stripe.paymentIntents.cancel(pi.id);
          console.log('[FLIGHT PAY] cancelled blocked Norwegian fare payment intent', {
            paymentIntentId: pi.id,
            bookingDraftId,
          });
        }
      } catch (cancelError: any) {
        console.error('[FLIGHT PAY] failed to cancel blocked Norwegian fare payment intent', {
          message: cancelError?.message || String(cancelError),
        });
      }

      bookingDrafts.delete(String(bookingDraftId));

      return res.status(409).json({
        ok: false,
        error: 'norwegian_fare_temporarily_unavailable',
        detail,
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
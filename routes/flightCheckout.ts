import express from 'express';
import Stripe from 'stripe';
import { duffel } from '../lib/duffel';

const router = express.Router();

type PassengerInput = {
  given_name: string;
  family_name: string;
  born_on: string;
  email: string;
};

type BookingDraft = {
  offerId: string;
  offerAmount: number;
  offerCurrency: string;
  serviceFee: number;
  totalAmount: number;
  passenger: PassengerInput;
  paymentIntentId: string;
  createdAt: number;
};

const bookingDrafts = new Map<string, BookingDraft>();

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

function toMinorUnits(amount: number) {
  return Math.round(Number(amount || 0) * 100);
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

async function createDuffelOrder(input: {
  offerId: string;
  offerAmount: number;
  offerCurrency: string;
  passenger: PassengerInput;
}) {
  const token = getDuffelToken();

  const orderBody = {
    data: {
      type: 'instant',
      selected_offers: [input.offerId],
      payments: [
        {
          type: 'balance',
          amount: String(Number(input.offerAmount).toFixed(2)),
          currency: input.offerCurrency,
        },
      ],
      passengers: [
        {
          title: 'mr',
          given_name: input.passenger.given_name,
          family_name: input.passenger.family_name,
          born_on: input.passenger.born_on,
          email: input.passenger.email,
        },
      ],
    },
  };

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
    const message =
      data?.errors?.[0]?.message ||
      data?.errors?.[0]?.title ||
      data?.error ||
      'Duffel order creation failed';

    const err: any = new Error(message);
    err.duffel = data;
    throw err;
  }

  return data?.data || null;
}

router.post('/api/payments/create-intent', async (req, res) => {
  try {
    const stripe = getStripe();

    const { offerId, passenger } = req.body || {};

    if (!offerId) {
      return res.status(400).json({
        ok: false,
        error: 'offerId mangler',
      });
    }

    if (
      !passenger?.given_name ||
      !passenger?.family_name ||
      !passenger?.born_on ||
      !passenger?.email
    ) {
      return res.status(400).json({
        ok: false,
        error: 'Passasjerinformasjon mangler',
      });
    }

    console.log('[FLIGHT PAY] create-intent start', {
      offerId,
      email: passenger.email,
    });

    const offerResult = await duffel.offers.get(String(offerId));
    const offer = offerResult?.data;

    if (!offer) {
      return res.status(404).json({
        ok: false,
        error: 'offer_no_longer_available',
      });
    }

    const flightAmount = Number(offer.total_amount || 0);
    const currencyUpper = String(offer.total_currency || 'EUR').toUpperCase();
    const currencyLower = currencyUpper.toLowerCase();
    const serviceFee = getServiceFee(flightAmount, currencyUpper);
    const totalAmount = flightAmount + serviceFee;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: toMinorUnits(totalAmount),
      currency: currencyLower,
      capture_method: 'manual',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        offerId: String(offer.id || offerId),
        passengerEmail: String(passenger.email),
      },
    });

    const bookingDraftId = `draft_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;

    bookingDrafts.set(bookingDraftId, {
      offerId: String(offer.id || offerId),
      offerAmount: flightAmount,
      offerCurrency: currencyUpper,
      serviceFee,
      totalAmount,
      passenger,
      paymentIntentId: paymentIntent.id,
      createdAt: Date.now(),
    });

    console.log('[FLIGHT PAY] create-intent success', {
      offerId: String(offer.id || offerId),
      bookingDraftId,
      totalAmount,
      currency: currencyUpper,
    });

    return res.json({
      ok: true,
      bookingDraftId,
      paymentIntentClientSecret: paymentIntent.client_secret,
      amount: totalAmount,
      currency: currencyUpper,
      serviceFee,
    });
  } catch (e: any) {
    const message = getDuffelErrorMessage(e);

    console.error('[FLIGHT PAY] create-intent failed', {
      message,
      errors: e?.errors || e?.duffel || null,
    });

    if (isDuffelOfferGoneMessage(message)) {
      return res.status(404).json({
        ok: false,
        error: 'offer_no_longer_available',
        detail: message,
      });
    }

    return res.status(500).json({
      ok: false,
      error: 'Kunne ikke opprette betaling',
      detail: message,
    });
  }
});

router.post('/api/bookings/confirm', async (req, res) => {
  try {
    const stripe = getStripe();
    const { bookingDraftId } = req.body || {};

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
    });

    const order = await createDuffelOrder({
      offerId: draft.offerId,
      offerAmount: draft.offerAmount,
      offerCurrency: draft.offerCurrency,
      passenger: draft.passenger,
    });

    if (paymentIntent.status === 'requires_capture') {
      await stripe.paymentIntents.capture(paymentIntent.id);
    }

    bookingDrafts.delete(String(bookingDraftId));

    console.log('[FLIGHT PAY] confirm success', {
      bookingDraftId,
      orderId: order?.id || null,
    });

    return res.json({
      ok: true,
      orderId: order?.id || null,
      order,
    });
  } catch (e: any) {
    console.error('[FLIGHT PAY] confirm failed', {
      message: e?.message || String(e),
      duffel: e?.duffel || null,
    });

    try {
      const stripe = getStripe();
      const { bookingDraftId } = req.body || {};
      const draft = bookingDrafts.get(String(bookingDraftId));

      if (draft?.paymentIntentId) {
        const pi = await stripe.paymentIntents.retrieve(draft.paymentIntentId);
        if (pi.status === 'requires_capture') {
          await stripe.paymentIntents.cancel(pi.id);
        }
      }
    } catch (cancelError: any) {
      console.error('[FLIGHT PAY] failed to cancel payment intent', {
        message: cancelError?.message || String(cancelError),
      });
    }

    return res.status(500).json({
      ok: false,
      error: e?.message || 'Kunne ikke fullføre booking',
    });
  }
});

export default router;
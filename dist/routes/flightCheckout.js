"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const stripe_1 = __importDefault(require("stripe"));
const duffel_1 = require("../lib/duffel");
const flightBookings_1 = require("../lib/flightBookings");
const flightEmails_1 = require("../lib/flightEmails");
const router = express_1.default.Router();
const bookingDrafts = new Map();
function getDuffelErrorMessage(e) {
    return (e?.errors?.[0]?.message ||
        e?.errors?.[0]?.title ||
        e?.message ||
        'Duffel request failed');
}
function isDuffelOfferGoneMessage(message) {
    const m = String(message || '').toLowerCase();
    return (m.includes('offer no longer available') ||
        m.includes('offer is no longer available') ||
        m.includes('offer has expired') ||
        m.includes('expired') ||
        m.includes('not found') ||
        m.includes('invalid offer'));
}
function getServiceFee(amount, currency) {
    if (currency === 'EUR') {
        if (amount >= 400)
            return 25;
        if (amount >= 200)
            return 20;
        return 15;
    }
    if (currency === 'GBP') {
        if (amount >= 350)
            return 20;
        if (amount >= 180)
            return 15;
        return 10;
    }
    if (amount >= 5000)
        return 149;
    if (amount >= 2500)
        return 99;
    return 69;
}
function toMinorUnits(amount) {
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
    return new stripe_1.default(stripeSecretKey);
}
function getDuffelToken() {
    const token = String(process.env.DUFFEL_ACCESS_TOKEN || '').trim();
    if (!token) {
        throw new Error('DUFFEL_ACCESS_TOKEN mangler på serveren');
    }
    return token;
}
function getFirstOfferPassengerId(offer) {
    const offerPassengerId = offer?.passengers?.[0]?.id ||
        offer?.passengers?.[0]?.passenger_id ||
        '';
    if (!offerPassengerId) {
        throw new Error('Mangler Duffel passenger id på offeret');
    }
    return String(offerPassengerId);
}
function isUsableOfferSnapshot(offer, offerId) {
    if (!offer || typeof offer !== 'object')
        return false;
    const snapshotId = String(offer?.id || '').trim();
    const expectedId = String(offerId || '').trim();
    if (!snapshotId || !expectedId || snapshotId !== expectedId) {
        return false;
    }
    const totalAmount = Number(offer?.total_amount || 0);
    const totalCurrency = String(offer?.total_currency || '').trim();
    const passengerId = offer?.passengers?.[0]?.id ||
        offer?.passengers?.[0]?.passenger_id ||
        '';
    return totalAmount > 0 && !!totalCurrency && !!passengerId;
}
async function resolveOfferForCheckout(input) {
    if (isUsableOfferSnapshot(input.offer, input.offerId)) {
        console.log('[FLIGHT PAY] using offer snapshot for checkout', {
            offerId: input.offerId,
        });
        return input.offer;
    }
    console.log('[FLIGHT PAY] offer snapshot missing/invalid, fetching live offer', {
        offerId: input.offerId,
    });
    const offerResult = await duffel_1.duffel.offers.get(String(input.offerId));
    return offerResult?.data || null;
}
async function createDuffelOrder(input) {
    const token = getDuffelToken();
    if (!input.passenger.id) {
        throw new Error('Mangler Duffel passenger id for ordreopprettelse');
    }
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
                    id: input.passenger.id,
                    title: input.passenger.title,
                    gender: input.passenger.gender,
                    given_name: input.passenger.given_name,
                    family_name: input.passenger.family_name,
                    born_on: input.passenger.born_on,
                    email: input.passenger.email,
                    phone_number: input.passenger.phone_number,
                },
            ],
        },
    };
    console.log('[FLIGHT PAY] createDuffelOrder payload', {
        offerId: input.offerId,
        passengerId: input.passenger.id,
        title: input.passenger.title,
        gender: input.passenger.gender,
        email: input.passenger.email,
        hasPhone: !!input.passenger.phone_number,
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
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    }
    catch {
        throw new Error(`Duffel returnerte ikke JSON: ${text.slice(0, 300)}`);
    }
    if (!res.ok) {
        const message = data?.errors?.[0]?.message ||
            data?.errors?.[0]?.title ||
            data?.error ||
            'Duffel order creation failed';
        const err = new Error(message);
        err.duffel = data;
        throw err;
    }
    return data?.data || null;
}
router.post('/api/payments/create-intent', async (req, res) => {
    try {
        const stripe = getStripe();
        const { offerId, offer, passenger } = req.body || {};
        if (!offerId) {
            return res.status(400).json({
                ok: false,
                error: 'offerId mangler',
            });
        }
        if (!passenger?.given_name ||
            !passenger?.family_name ||
            !passenger?.born_on ||
            !passenger?.email ||
            !passenger?.phone_number ||
            !passenger?.gender ||
            !passenger?.title) {
            return res.status(400).json({
                ok: false,
                error: 'Passasjerinformasjon mangler',
            });
        }
        console.log('[FLIGHT PAY] create-intent start', {
            offerId,
            hasOfferSnapshot: !!offer,
            email: passenger.email,
            hasPhone: !!passenger.phone_number,
            gender: passenger.gender,
            title: passenger.title,
        });
        const resolvedOffer = await resolveOfferForCheckout({
            offerId: String(offerId),
            offer: offer || null,
        });
        if (!resolvedOffer) {
            return res.status(404).json({
                ok: false,
                error: 'offer_no_longer_available',
            });
        }
        const offerPassengerId = getFirstOfferPassengerId(resolvedOffer);
        const flightAmount = Number(resolvedOffer.total_amount || 0);
        const currencyUpper = String(resolvedOffer.total_currency || 'EUR').toUpperCase();
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
                offerId: String(resolvedOffer.id || offerId),
                passengerEmail: String(passenger.email),
                offerPassengerId,
            },
        });
        const bookingDraftId = `draft_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 10)}`;
        bookingDrafts.set(bookingDraftId, {
            offerId: String(resolvedOffer.id || offerId),
            offerAmount: flightAmount,
            offerCurrency: currencyUpper,
            serviceFee,
            totalAmount,
            passenger: {
                ...passenger,
                id: offerPassengerId,
                locale: String(passenger?.locale || 'nb').trim(),
            },
            paymentIntentId: paymentIntent.id,
            createdAt: Date.now(),
            offerSnapshot: resolvedOffer,
        });
        console.log('[FLIGHT PAY] create-intent success', {
            offerId: String(resolvedOffer.id || offerId),
            bookingDraftId,
            totalAmount,
            currency: currencyUpper,
            offerPassengerId,
        });
        return res.json({
            ok: true,
            bookingDraftId,
            paymentIntentClientSecret: paymentIntent.client_secret,
            amount: totalAmount,
            currency: currencyUpper,
            serviceFee,
        });
    }
    catch (e) {
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
        if (paymentIntent.status !== 'requires_capture' &&
            paymentIntent.status !== 'succeeded') {
            return res.status(400).json({
                ok: false,
                error: `Betalingen er ikke klar. Stripe-status: ${paymentIntent.status}`,
            });
        }
        console.log('[FLIGHT PAY] confirm start', {
            bookingDraftId,
            offerId: draft.offerId,
            paymentIntentStatus: paymentIntent.status,
            offerPassengerId: draft.passenger.id || null,
            userId: userId || null,
        });
        const order = await createDuffelOrder({
            offerId: draft.offerId,
            offerAmount: draft.offerAmount,
            offerCurrency: draft.offerCurrency,
            passenger: draft.passenger,
        });
        const booking = await (0, flightBookings_1.createFlightBooking)({
            bookingDraftId: String(bookingDraftId),
            paymentIntentId: draft.paymentIntentId,
            paymentStatus: paymentIntent.status,
            offerId: draft.offerId,
            flightAmount: draft.offerAmount,
            serviceFee: draft.serviceFee,
            totalAmount: draft.totalAmount,
            currency: draft.offerCurrency,
            passenger: draft.passenger,
            order,
            userId: userId ? String(userId) : null,
        });
        bookingId = String(booking.id || '');
        if (paymentIntent.status === 'requires_capture') {
            try {
                await stripe.paymentIntents.capture(paymentIntent.id);
            }
            catch (captureError) {
                await (0, flightBookings_1.markFlightBookingCaptureFailed)({
                    bookingId: String(bookingId),
                    note: captureError?.message || 'Capture failed',
                });
                throw new Error(`Duffel order opprettet, men Stripe capture feilet: ${captureError?.message || 'ukjent feil'}`);
            }
        }
        const confirmedBooking = await (0, flightBookings_1.markFlightBookingConfirmed)({
            bookingId: String(bookingId),
            paymentIntentId: paymentIntent.id,
        });
        try {
            await (0, flightEmails_1.sendFlightBookingConfirmationEmail)({
                to: draft.passenger.email,
                locale: draft.passenger.locale || 'nb',
                givenName: draft.passenger.given_name,
                bnoBookingRef: confirmedBooking?.bno_booking_ref || String(confirmedBooking?.id || ''),
                orderId: order?.id || null,
                airline: order?.slices?.[0]?.segments?.[0]?.marketing_carrier?.name || null,
                origin: order?.slices?.[0]?.segments?.[0]?.origin?.iata_code || null,
                destination: order?.slices?.[0]?.segments?.[order?.slices?.[0]?.segments?.length - 1]?.destination?.iata_code || null,
                outboundDeparture: order?.slices?.[0]?.segments?.[0]?.departing_at || null,
                outboundArrival: order?.slices?.[0]?.segments?.[order?.slices?.[0]?.segments?.length - 1]?.arriving_at || null,
                returnDeparture: order?.slices?.[1]?.segments?.[0]?.departing_at || null,
                returnArrival: order?.slices?.[1]?.segments?.[order?.slices?.[1]?.segments?.length - 1]?.arriving_at || null,
            });
        }
        catch (emailError) {
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
        });
        return res.json({
            ok: true,
            orderId: order?.id || null,
            order,
            bookingId: confirmedBooking?.id || null,
            bnoBookingRef: confirmedBooking?.bno_booking_ref || null,
        });
    }
    catch (e) {
        const message = e?.message || String(e);
        console.error('[FLIGHT PAY] confirm failed', {
            message,
            duffel: e?.duffel || null,
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
                }
            }
        }
        catch (cancelError) {
            console.error('[FLIGHT PAY] failed to cancel payment intent', {
                message: cancelError?.message || String(cancelError),
            });
        }
        if (isDuffelOfferGoneMessage(message)) {
            return res.status(409).json({
                ok: false,
                error: 'offer_no_longer_available',
                detail: message,
            });
        }
        return res.status(500).json({
            ok: false,
            error: message || 'Kunne ikke fullføre booking',
        });
    }
});
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFlightBooking = createFlightBooking;
exports.markFlightBookingConfirmed = markFlightBookingConfirmed;
exports.markFlightBookingCaptureFailed = markFlightBookingCaptureFailed;
const supabase_1 = require("./supabase");
function generateBnoBookingRef() {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `BNO-FLT-${yyyy}${mm}${dd}-${rand}`;
}
function getSliceSummary(slice) {
    const segments = Array.isArray(slice?.segments) ? slice.segments : [];
    const first = segments[0];
    const last = segments[segments.length - 1];
    return {
        origin: first?.origin?.iata_code || '',
        originCity: first?.origin?.city_name || first?.origin?.city?.name || '',
        originAirport: first?.origin?.name || '',
        destination: last?.destination?.iata_code || '',
        destinationCity: last?.destination?.city_name || last?.destination?.city?.name || '',
        destinationAirport: last?.destination?.name || '',
        departure: first?.departing_at || null,
        arrival: last?.arriving_at || null,
    };
}
function getDuffelBookingReference(order) {
    return (order?.booking_reference ||
        order?.pnr ||
        order?.booking_references?.[0]?.reference ||
        null);
}
async function createFlightBooking(input) {
    const outbound = getSliceSummary(input.order?.slices?.[0]);
    const ret = getSliceSummary(input.order?.slices?.[1]);
    console.log('[FLIGHT BOOKINGS] insert payload identity', {
        email: input.passenger.email,
        userId: input.userId || null,
        offerId: input.offerId,
    });
    const insertPayload = {
        bno_booking_ref: generateBnoBookingRef(),
        status: 'order_created',
        customer_email: input.passenger.email,
        given_name: input.passenger.given_name,
        family_name: input.passenger.family_name,
        born_on: input.passenger.born_on || null,
        phone_number: input.passenger.phone_number || null,
        gender: input.passenger.gender || null,
        title: input.passenger.title || null,
        user_id: input.userId || null,
        duffel_order_id: input.order?.id || null,
        duffel_offer_id: input.offerId,
        duffel_booking_reference: getDuffelBookingReference(input.order),
        stripe_payment_intent_id: input.paymentIntentId,
        stripe_payment_status: input.paymentStatus,
        booking_draft_id: input.bookingDraftId,
        currency: input.currency,
        flight_amount: input.flightAmount,
        service_fee: input.serviceFee,
        total_amount: input.totalAmount,
        airline_name: input.order?.owner?.name ||
            input.order?.slices?.[0]?.segments?.[0]?.marketing_carrier?.name ||
            null,
        outbound_origin: outbound.origin || null,
        outbound_origin_city: outbound.originCity || null,
        outbound_origin_airport: outbound.originAirport || null,
        outbound_destination: outbound.destination || null,
        outbound_destination_city: outbound.destinationCity || null,
        outbound_destination_airport: outbound.destinationAirport || null,
        outbound_departure_at: outbound.departure,
        outbound_arrival_at: outbound.arrival,
        return_origin: ret.origin || null,
        return_origin_city: ret.originCity || null,
        return_origin_airport: ret.originAirport || null,
        return_destination: ret.destination || null,
        return_destination_city: ret.destinationCity || null,
        return_destination_airport: ret.destinationAirport || null,
        return_departure_at: ret.departure,
        return_arrival_at: ret.arrival,
        duffel_order_json: input.order || null,
    };
    const { data, error } = await supabase_1.supabase
        .from('flight_bookings')
        .insert(insertPayload)
        .select()
        .single();
    if (error) {
        throw new Error(`Supabase insert failed: ${error.message}`);
    }
    return data;
}
async function markFlightBookingConfirmed(params) {
    const { data, error } = await supabase_1.supabase
        .from('flight_bookings')
        .update({
        status: 'confirmed',
        stripe_payment_status: 'captured',
        stripe_payment_intent_id: params.paymentIntentId,
        updated_at: new Date().toISOString(),
    })
        .eq('id', params.bookingId)
        .select()
        .single();
    if (error) {
        throw new Error(`Supabase update failed: ${error.message}`);
    }
    return data;
}
async function markFlightBookingCaptureFailed(params) {
    const { data, error } = await supabase_1.supabase
        .from('flight_bookings')
        .update({
        status: 'payment_capture_failed',
        notes: params.note || null,
        updated_at: new Date().toISOString(),
    })
        .eq('id', params.bookingId)
        .select()
        .single();
    if (error) {
        throw new Error(`Supabase capture-failed update failed: ${error.message}`);
    }
    return data;
}

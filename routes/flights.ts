import express from 'express';
import { duffel } from '../lib/duffel';

const router = express.Router();

router.post('/search', async (req, res) => {
  try {
    const {
      origin,
      destination,
      departureDate,
      returnDate,
      adults,
    } = req.body || {};

    if (!origin || !destination || !departureDate) {
      return res.status(400).json({
        ok: false,
        error: 'missing_params',
        detail: 'origin, destination og departureDate er påkrevd',
      });
    }

    const passengerCount = Math.max(1, Number(adults || 1));

    const passengers = Array.from({ length: passengerCount }).map(() => ({
      type: 'adult' as const,
    }));

    const slices: any[] = [
      {
        origin: String(origin).trim().toUpperCase(),
        destination: String(destination).trim().toUpperCase(),
        departure_date: String(departureDate).slice(0, 10),
      },
    ];

    if (returnDate) {
      slices.push({
        origin: String(destination).trim().toUpperCase(),
        destination: String(origin).trim().toUpperCase(),
        departure_date: String(returnDate).slice(0, 10),
      });
    }

    const result = await duffel.offerRequests.create({
      slices,
      passengers,
      cabin_class: 'economy',
      return_offers: true,
    } as any);

    const offerRequest = result.data;
    const offers = 'offers' in offerRequest ? offerRequest.offers || [] : [];

    return res.json({
      ok: true,
      data: {
        offerRequestId: offerRequest.id,
        offers,
      },
    });
  } catch (e: any) {
    console.error('[DUFFEL] search failed', e?.errors || e?.message || e);

    return res.status(500).json({
      ok: false,
      error: 'duffel_search_failed',
      detail: e?.message || 'Duffel search failed',
      errors: e?.errors || null,
    });
  }
});

export default router;
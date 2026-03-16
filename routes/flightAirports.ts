import { Router } from 'express';
import { duffel } from '../lib/duffel';

const router = Router();

router.get('/airports', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();

    if (!q || q.length < 2) {
      return res.json({
        ok: true,
        data: [],
      });
    }

    const result = await duffel.airports.list({
      limit: 10,
      name: q,
    } as any);

    const items = (result?.data || []).map((airport: any) => ({
      id: airport.id,
      iataCode: airport.iata_code || '',
      name: airport.name || '',
      cityName: airport.city_name || '',
      cityIataCode: airport.city?.iata_code || '',
      countryName: airport.country_name || '',
      displayName: [
        airport.city_name || '',
        airport.name || '',
        airport.iata_code ? `(${airport.iata_code})` : '',
      ]
        .filter(Boolean)
        .join(' – '),
    }));

    return res.json({
      ok: true,
      data: items,
    });
  } catch (e: any) {
    console.error('[DUFFEL] airport search failed', e?.errors || e?.message || e);

    return res.status(500).json({
      ok: false,
      error: 'duffel_airport_search_failed',
      detail: e?.message || 'Duffel airport search failed',
      errors: e?.errors || null,
    });
  }
});

export default router;
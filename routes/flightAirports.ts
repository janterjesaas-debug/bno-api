import express from 'express';

const router = express.Router();

type DuffelSuggestionResponse = {
  data?: any[];
  errors?: Array<{
    message?: string;
    title?: string;
  }>;
};

function getDuffelErrorMessage(e: any): string {
  return e?.message || 'Duffel place search failed';
}

router.get('/airports', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();

    if (q.length < 2) {
      return res.json({
        ok: true,
        data: [],
      });
    }

    const token = process.env.DUFFEL_ACCESS_TOKEN;

    if (!token) {
      return res.status(500).json({
        ok: false,
        error: 'missing_duffel_token',
        detail:
          'Fant ikke DUFFEL_ACCESS_TOKEN i environment variables. Sjekk .env-filen eller Render.',
      });
    }

    console.log('[DUFFEL] place search', { q });

    const response = await fetch(
      `https://api.duffel.com/places/suggestions?query=${encodeURIComponent(q)}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'Duffel-Version': 'v2',
        },
      }
    );

    const json: DuffelSuggestionResponse = (await response.json()) as DuffelSuggestionResponse;

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: 'airport_search_failed',
        detail:
          json?.errors?.[0]?.message ||
          json?.errors?.[0]?.title ||
          'Duffel place search failed',
        errors: json?.errors || null,
      });
    }

    const list = Array.isArray(json?.data) ? json.data : [];

    const data = list
      .map((item: any) => ({
        id: item.id || '',
        code: item.iata_code || item.iataCode || '',
        city: item.city_name || item.city?.name || item.name || '',
        airport: item.name || item.city_name || '',
        country:
          item.country_name ||
          item.city?.country_name ||
          item.iata_country_code ||
          '',
        cityCode: item.iata_city_code || item.city?.iata_code || '',
        type: item.type === 'city' ? 'city' : 'airport',
      }))
      .filter((item: any) => !!item.code && (!!item.airport || !!item.city));

    console.log('[DUFFEL] place search success', {
      q,
      count: data.length,
    });

    return res.json({
      ok: true,
      data,
    });
  } catch (e: any) {
    console.error('[DUFFEL] place search failed', {
      message: getDuffelErrorMessage(e),
    });

    return res.status(500).json({
      ok: false,
      error: 'airport_search_failed',
      detail: getDuffelErrorMessage(e),
    });
  }
});

export default router;
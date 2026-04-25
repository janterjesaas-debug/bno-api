import express from 'express';
import {
  getTravelHelperContentBySlug,
  getTravelHelperContentStats,
  listTravelHelperContent,
} from '../lib/travelHelperContent';

const router = express.Router();

function getQueryString(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const text = String(raw || '').trim();

  return text || undefined;
}

function getQueryBoolean(value: unknown): boolean | undefined {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw === true) {
    return true;
  }

  if (raw === false) {
    return false;
  }

  const text = String(raw || '').trim().toLowerCase();

  if (!text) {
    return undefined;
  }

  if (['1', 'true', 'yes', 'ja'].includes(text)) {
    return true;
  }

  if (['0', 'false', 'no', 'nei'].includes(text)) {
    return false;
  }

  return undefined;
}

function getQueryNumber(value: unknown): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);

  if (!Number.isFinite(n)) {
    return undefined;
  }

  return n;
}

/**
 * GET /api/travel-helper/health
 */
router.get('/health', async (_req, res) => {
  try {
    const stats = await getTravelHelperContentStats();

    return res.json({
      ok: true,
      data: stats,
    });
  } catch (e: any) {
    console.error('[TRAVEL HELPER CONTENT] health failed', e);

    return res.status(500).json({
      ok: false,
      error: 'travel_helper_content_health_failed',
      detail: e?.message || String(e),
    });
  }
});

/**
 * GET /api/travel-helper/content
 *
 * Eksempler:
 * /api/travel-helper/content?language=nb&limit=10
 * /api/travel-helper/content?destination=salen&language=nb
 * /api/travel-helper/content?destination=salen&category=activity&language=nb
 * /api/travel-helper/content?q=restaurant&language=nb
 */
router.get('/content', async (req, res) => {
  try {
    const data = await listTravelHelperContent({
      language: getQueryString(req.query.language) || 'nb',
      destinationSlug:
        getQueryString(req.query.destination) ||
        getQueryString(req.query.destination_slug),
      category: getQueryString(req.query.category),
      sourceType: getQueryString(req.query.source_type),
      featuredOnly: getQueryBoolean(req.query.featured),
      search: getQueryString(req.query.q),
      limit: getQueryNumber(req.query.limit),
    });

    return res.json({
      ok: true,
      data,
      meta: {
        count: data.length,
      },
    });
  } catch (e: any) {
    console.error('[TRAVEL HELPER CONTENT] list route failed', e);

    return res.status(500).json({
      ok: false,
      error: 'travel_helper_content_list_failed',
      detail: e?.message || String(e),
    });
  }
});

/**
 * GET /api/travel-helper/content/:slug
 *
 * Eksempel:
 * /api/travel-helper/content/salen-destinasjon
 */
router.get('/content/:slug', async (req, res) => {
  try {
    const item = await getTravelHelperContentBySlug(req.params.slug);

    if (!item) {
      return res.status(404).json({
        ok: false,
        error: 'travel_helper_content_not_found',
      });
    }

    return res.json({
      ok: true,
      data: item,
    });
  } catch (e: any) {
    console.error('[TRAVEL HELPER CONTENT] get route failed', e);

    return res.status(500).json({
      ok: false,
      error: 'travel_helper_content_get_failed',
      detail: e?.message || String(e),
    });
  }
});

/**
 * GET /api/travel-helper/destinations/:destinationSlug/content
 *
 * Eksempel:
 * /api/travel-helper/destinations/salen/content?language=nb
 */
router.get('/destinations/:destinationSlug/content', async (req, res) => {
  try {
    const data = await listTravelHelperContent({
      language: getQueryString(req.query.language) || 'nb',
      destinationSlug: req.params.destinationSlug,
      category: getQueryString(req.query.category),
      featuredOnly: getQueryBoolean(req.query.featured),
      search: getQueryString(req.query.q),
      limit: getQueryNumber(req.query.limit),
    });

    return res.json({
      ok: true,
      data,
      meta: {
        count: data.length,
        destinationSlug: req.params.destinationSlug,
      },
    });
  } catch (e: any) {
    console.error('[TRAVEL HELPER CONTENT] destination route failed', e);

    return res.status(500).json({
      ok: false,
      error: 'travel_helper_content_destination_failed',
      detail: e?.message || String(e),
    });
  }
});

export default router;
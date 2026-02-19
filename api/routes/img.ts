import express from 'express';
import axios from 'axios';

const router = express.Router();

const SUPABASE_IMAGES_URL = (process.env.SUPABASE_IMAGES_URL || '').trim().replace(/\/$/, '');
const DEFAULT_BUCKET = (process.env.SUPABASE_IMAGES_BUCKET || 'bno-images').trim();

function requireEnv(name: string, v: string) {
  if (!v) {
    const err: any = new Error(`missing_env_${name}`);
    err.status = 500;
    throw err;
  }
}

async function streamFromUrl(res: express.Response, targetUrl: string) {
  const r = await axios.get(targetUrl, {
    responseType: 'stream',
    timeout: 20000,
    // Ikke la axios følge redirects “for alltid” i loops
    maxRedirects: 3,
    validateStatus: (s) => s >= 200 && s < 400,
  });

  // viderefør type + cache
  const ct = r.headers['content-type'];
  if (ct) res.setHeader('Content-Type', ct);
  res.setHeader('Cache-Control', 'public, max-age=3600');

  if (r.status >= 300 && r.status < 400 && r.headers.location) {
    // Hvis Supabase gir redirect (f.eks signed url), følg den én gang til
    const r2 = await axios.get(r.headers.location, {
      responseType: 'stream',
      timeout: 20000,
      maxRedirects: 3,
    });
    const ct2 = r2.headers['content-type'];
    if (ct2) res.setHeader('Content-Type', ct2);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    r2.data.pipe(res);
    return;
  }

  r.data.pipe(res);
}

/**
 * GET /api/img?url=https://....
 * Proxyer en absolutt URL (brukes for eksterne bilder / Mews CDN osv)
 */
router.get('/', async (req, res) => {
  try {
    const url = String(req.query.url || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ ok: false, error: 'missing_or_invalid_url' });
    }
    await streamFromUrl(res, url);
  } catch (e: any) {
    const status = e?.status || 500;
    res.status(status).json({ ok: false, error: 'img_proxy_failed', detail: e?.message || String(e) });
  }
});

/**
 * GET /api/img/:bucket/<path>
 * Proxyer public supabase object:
 *   {SUPABASE_IMAGES_URL}/storage/v1/object/public/:bucket/<path>
 */
router.get('/:bucket/*', async (req, res) => {
  try {
    requireEnv('SUPABASE_IMAGES_URL', SUPABASE_IMAGES_URL);

    const bucket = String(req.params.bucket || DEFAULT_BUCKET).trim();
    const key = String((req.params as any)[0] || '').replace(/^\/+/, '');

    if (!bucket || !key) return res.status(400).json({ ok: false, error: 'missing_bucket_or_key' });

    const target = `${SUPABASE_IMAGES_URL}/storage/v1/object/public/${encodeURIComponent(bucket)}/${key}`;
    await streamFromUrl(res, target);
  } catch (e: any) {
    const status = e?.status || 500;
    res.status(status).json({ ok: false, error: 'img_supabase_proxy_failed', detail: e?.message || String(e) });
  }
});

export default router;
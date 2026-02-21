"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const router = express_1.default.Router();
const SUPABASE_IMAGES_URL = (process.env.SUPABASE_IMAGES_URL || '').trim().replace(/\/$/, '');
const DEFAULT_BUCKET = (process.env.SUPABASE_IMAGES_BUCKET || 'bno-images').trim();
function requireEnv(name, v) {
    if (!v) {
        const err = new Error(`missing_env_${name}`);
        err.status = 500;
        throw err;
    }
}
function encodePathPreserveSlashes(p) {
    // Encode hvert path-segment separat (beholder /)
    return p
        .split('/')
        .filter((seg) => seg.length > 0)
        .map((seg) => encodeURIComponent(seg))
        .join('/');
}
async function streamFromUrl(res, targetUrl) {
    const r = await axios_1.default.get(targetUrl, {
        responseType: 'stream',
        timeout: 20000,
        maxRedirects: 3,
        validateStatus: (s) => s >= 200 && s < 400,
    });
    const ct = r.headers['content-type'];
    if (ct)
        res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (r.status >= 300 && r.status < 400 && r.headers.location) {
        const r2 = await axios_1.default.get(r.headers.location, {
            responseType: 'stream',
            timeout: 20000,
            maxRedirects: 3,
            validateStatus: (s) => s >= 200 && s < 400,
        });
        const ct2 = r2.headers['content-type'];
        if (ct2)
            res.setHeader('Content-Type', ct2);
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
    }
    catch (e) {
        const status = e?.status || e?.response?.status || 500;
        res.status(status).json({
            ok: false,
            error: 'img_proxy_failed',
            detail: e?.response?.data || e?.message || String(e),
        });
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
        const bucketRaw = String(req.params.bucket || DEFAULT_BUCKET).trim();
        const keyRaw = String(req.params[0] || '').replace(/^\/+/, '').trim();
        if (!bucketRaw || !keyRaw) {
            return res.status(400).json({ ok: false, error: 'missing_bucket_or_key' });
        }
        // Bucket encoder vi som segment (ingen /)
        const bucket = encodeURIComponent(bucketRaw);
        // Key må encodes per segment (pga spaces, æøå, osv) men beholde / dersom mapper
        const encodedKey = encodePathPreserveSlashes(keyRaw);
        const target = `${SUPABASE_IMAGES_URL}/storage/v1/object/public/${bucket}/${encodedKey}`;
        await streamFromUrl(res, target);
    }
    catch (e) {
        const status = e?.status || e?.response?.status || 500;
        res.status(status).json({
            ok: false,
            error: 'img_supabase_proxy_failed',
            detail: e?.response?.data || e?.message || String(e),
        });
    }
});
exports.default = router;

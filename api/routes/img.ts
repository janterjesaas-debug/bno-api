import { Router } from "express";

const router = Router();

/**
 * img.ts PUBLIC-REDIRECT-ONLY v4
 * - Forces Supabase base to origin only (https://<ref>.supabase.co)
 * - Forces bucket to SUPABASE_IMAGES_BUCKET (default bno-images)
 * - /_debug returns JSON (never redirects)
 */

function supabaseOrigin(): string {
  const raw = (process.env.SUPABASE_IMAGES_URL || "").trim();
  if (!raw) return "";
  try {
    // Accept both "https://xxx.supabase.co" and accidental longer urls
    const u = new URL(raw);
    return u.origin; // <-- IMPORTANT: strips any /storage/v1/.../public/...
  } catch {
    return "";
  }
}

function bucketDefault(): string {
  return (process.env.SUPABASE_IMAGES_BUCKET || "bno-images").trim() || "bno-images";
}

function encodePathPreserveSlashes(p: string) {
  return p
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

router.get("/_debug", (_req, res) => {
  const origin = supabaseOrigin();
  res.json({
    ok: true,
    version: "img.ts PUBLIC-REDIRECT-ONLY v4",
    images: {
      hasUrl: Boolean(origin),
      origin,
      bucketDefault: bucketDefault(),
      urlHost: origin ? new URL(origin).host : null,
    },
  });
});

// /api/img?url=<absolute-url>
router.get("/", (req, res) => {
  const url = String(req.query.url || "").trim();
  if (!url) return res.status(400).json({ ok: false, error: "Missing url query param" });

  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.redirect(302, url);
});

// /api/img/:bucket/*  (we keep this for backwards compatibility)
router.get("/:bucket/*", (req, res) => {
  const origin = supabaseOrigin();
  if (!origin) return res.status(500).json({ ok: false, error: "Missing/invalid SUPABASE_IMAGES_URL" });

  const bucket = String(req.params.bucket || "").trim();
  const path = String((req.params as any)[0] || "").trim();
  if (!bucket || !path) return res.status(400).json({ ok: false, error: "Missing bucket/path", bucket, path });

  const encodedBucket = encodeURIComponent(bucket);
  const encodedPath = encodePathPreserveSlashes(path);

  const target = `${origin}/storage/v1/object/public/${encodedBucket}/${encodedPath}`;

  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.redirect(302, target);
});

// /api/img/*  (catch-all)  <-- THIS FIXES your current behavior
router.get("/*", (req, res) => {
  const origin = supabaseOrigin();
  if (!origin) return res.status(500).json({ ok: false, error: "Missing/invalid SUPABASE_IMAGES_URL" });

  // Everything after /api/img/ becomes a "path" inside the DEFAULT bucket
  const rest = String((req.params as any)[0] || "").trim();
  if (!rest) return res.status(400).json({ ok: false, error: "Missing path" });

  const bucket = bucketDefault();
  const encodedBucket = encodeURIComponent(bucket);
  const encodedPath = encodePathPreserveSlashes(rest);

  const target = `${origin}/storage/v1/object/public/${encodedBucket}/${encodedPath}`;

  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.redirect(302, target);
});

export default router;
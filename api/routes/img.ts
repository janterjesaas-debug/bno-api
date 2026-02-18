import { Router } from "express";

const router = Router();

/**
 * img.ts PUBLIC-REDIRECT-ONLY v3 (router default export)
 *
 * - Always redirects to Supabase public storage URL (no signing/proxy).
 * - Safe-encodes each path segment (preserves "/" separators).
 */

function imagesBaseUrl() {
  const raw = process.env.SUPABASE_IMAGES_URL || "";
  return raw.replace(/\/+$/, "");
}

function encodePathPreserveSlashes(p: string) {
  return p
    .split("/")
    .filter((seg) => seg.length > 0)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

router.get("/_debug", (_req, res) => {
  const base = imagesBaseUrl();
  const bucketDefault = process.env.SUPABASE_IMAGES_BUCKET || "bno-images";

  res.json({
    ok: true,
    version: "img.ts PUBLIC-REDIRECT-ONLY v3",
    images: {
      hasUrl: Boolean(base),
      bucketDefault,
      urlHost: base ? new URL(base).host : null,
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

// /api/img/:bucket/*  (wildcard captured in req.params[0])
router.get("/:bucket/*", (req, res) => {
  const base = imagesBaseUrl();
  const bucket = String(req.params.bucket || "").trim();
  const path = String((req.params as any)[0] || "").trim();

  if (!base) return res.status(500).json({ ok: false, error: "Missing SUPABASE_IMAGES_URL" });
  if (!bucket || !path) return res.status(400).json({ ok: false, error: "Missing bucket/path", bucket, path });

  const encodedBucket = encodeURIComponent(bucket);
  const encodedPath = encodePathPreserveSlashes(path);

  const target = `${base}/storage/v1/object/public/${encodedBucket}/${encodedPath}`;

  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.redirect(302, target);
});

export default router;
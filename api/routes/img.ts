import type { Request, Response } from "express";
import express from "express";

const router = express.Router();

/**
 * Express dekoder ofte URL-path (f.eks. "%20" -> " "),
 * men Location-header MÅ være en gyldig URL (med %20 osv).
 * Derfor: split på "/" og encode hvert segment.
 */
function encodePathPreserveSlashes(p: string): string {
  return p
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

function stripTrailingSlash(s: string) {
  return s.replace(/\/+$/, "");
}

function getImagesUrl(): string | null {
  const url = process.env.SUPABASE_IMAGES_URL || "";
  return url ? stripTrailingSlash(url) : null;
}

router.get("/api/img/_debug", (req: Request, res: Response) => {
  const imagesUrl = getImagesUrl();
  res.json({
    ok: true,
    version: "img.ts PUBLIC-REDIRECT-ONLY v2 (safe-encode)",
    images: {
      hasUrl: !!imagesUrl,
      bucketDefault: process.env.SUPABASE_IMAGES_BUCKET || "bno-images",
      urlHost: imagesUrl ? new URL(imagesUrl).host : null,
    },
  });
});

/**
 * Variant 1: /api/img?url=<FULL_URL>
 * (Brukes allerede i search-responsen din.)
 */
router.get("/api/img", (req: Request, res: Response) => {
  const url = String(req.query.url || "").trim();
  if (!url) {
    return res.status(400).json({ ok: false, error: "Missing url param" });
  }

  // Minimal safety: kun http/https
  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).json({ ok: false, error: "Invalid url param" });
  }

  res.setHeader("Cache-Control", "public, max-age=300");
  return res.redirect(302, url);
});

/**
 * Variant 2: /api/img/:bucket/<path>
 * Redirecter til Supabase public storage URL – med korrekt encoding.
 */
router.get("/api/img/:bucket/*", (req: Request, res: Response) => {
  const imagesUrl = getImagesUrl();
  if (!imagesUrl) {
    return res.status(500).json({ ok: false, error: "SUPABASE_IMAGES_URL missing" });
  }

  const bucket = req.params.bucket;
  const rawPath = (req.params[0] || "").toString(); // wildcard
  if (!rawPath) {
    return res.status(400).json({ ok: false, error: "Missing path" });
  }

  const safePath = encodePathPreserveSlashes(rawPath);

  const target =
    `${imagesUrl}/storage/v1/object/public/` +
    `${encodeURIComponent(bucket)}/` +
    `${safePath}`;

  res.setHeader("Cache-Control", "public, max-age=300");
  return res.redirect(302, target);
});

export default router;
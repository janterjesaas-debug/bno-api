// api/routes/img.ts
import express from "express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const router = express.Router();

// =========================
// ENV (bilder + renhold)
// =========================
const IMAGES_URL = (process.env.SUPABASE_IMAGES_URL || "").trim();
const IMAGES_KEY = (process.env.SUPABASE_IMAGES_SERVICE_ROLE_KEY || "").trim();
const IMAGES_BUCKET_DEFAULT = (process.env.SUPABASE_IMAGES_BUCKET || "bno-images").trim();

const HK_URL = (process.env.SUPABASE_HOUSEKEEPING_URL || "").trim();
const HK_KEY = (process.env.SUPABASE_HOUSEKEEPING_SERVICE_KEY || "").trim();

const TTL_SECONDS = Math.max(
  60,
  Number(process.env.SUPABASE_SIGNED_URL_TTL_SECONDS || 3600)
);

function makeClient(url: string, key: string): SupabaseClient | null {
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const supabaseImages = makeClient(IMAGES_URL, IMAGES_KEY);
const supabaseHousekeeping = makeClient(HK_URL, HK_KEY);

// Hvis du senere lager flere buckets kan du mappe dem her:
type ProjectKey = "images" | "housekeeping";
function pickClient(bucket: string): SupabaseClient | null {
  const b = (bucket || "").trim();

  // Standard: bno-images (og evt andre bildebuckets) -> images-prosjektet
  if (!b || b === IMAGES_BUCKET_DEFAULT) return supabaseImages;

  // Eksempel hvis du vil støtte renhold-bilder i eget bucket:
  // if (b === "housekeeping-images") return supabaseHousekeeping;

  // Default fallback:
  return supabaseImages;
}

function cleanPath(p: string) {
  const s = (p || "").trim();
  if (!s) return "";
  const noLead = s.replace(/^\/+/, "");
  try {
    return decodeURIComponent(noLead);
  } catch {
    return noLead;
  }
}

// =========================
// Debug: sjekk env på server
// =========================
router.get("/img/_debug", (_req, res) => {
  res.json({
    ok: true,
    images: {
      hasUrl: !!IMAGES_URL,
      hasKey: !!IMAGES_KEY,
      bucketDefault: IMAGES_BUCKET_DEFAULT,
    },
    housekeeping: {
      hasUrl: !!HK_URL,
      hasKey: !!HK_KEY,
    },
    ttlSeconds: TTL_SECONDS,
  });
});

// =========================
// 1) Primær: /api/img/:bucket/:path(*)
// Eksempel:
//   /api/img/bno-images/okslevegen%202.jpg
// =========================
router.get("/img/:bucket/:path(*)", async (req, res) => {
  try {
    const bucket = (req.params.bucket || "").trim();
    const pathRaw = (req.params.path || "").toString();
    const objectPath = cleanPath(pathRaw);

    if (!bucket || !objectPath) {
      return res.status(400).json({ ok: false, error: "Missing bucket or path" });
    }

    const client = pickClient(bucket);
    if (!client) {
      return res.status(500).json({
        ok: false,
        error: "Supabase client not configured",
        hint: "Check SUPABASE_IMAGES_URL and SUPABASE_IMAGES_SERVICE_ROLE_KEY in env",
      });
    }

    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(objectPath, TTL_SECONDS);

    if (error || !data?.signedUrl) {
      console.warn("[img] createSignedUrl failed", {
        bucket,
        objectPath,
        error: error?.message,
      });
      return res.status(404).json({
        ok: false,
        error: "Image not found (or could not sign URL)",
        bucket,
        path: objectPath,
      });
    }

    res.setHeader("Cache-Control", "public, max-age=300");
    return res.redirect(302, data.signedUrl);
  } catch (e: any) {
    console.error("[img] error", e?.message || e);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

// =========================
// 2) Fallback: /api/img?bucket=...&path=...
// =========================
router.get("/img", async (req, res) => {
  try {
    const bucket = (req.query.bucket || "").toString().trim();
    const objectPath = cleanPath((req.query.path || "").toString());

    if (!bucket || !objectPath) {
      return res.status(400).json({
        ok: false,
        error: "Missing bucket or path",
        example: "/api/img?bucket=bno-images&path=some-file.jpg",
      });
    }

    const client = pickClient(bucket);
    if (!client) {
      return res.status(500).json({
        ok: false,
        error: "Supabase client not configured",
      });
    }

    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(objectPath, TTL_SECONDS);

    if (error || !data?.signedUrl) {
      return res.status(404).json({
        ok: false,
        error: "Image not found (or could not sign URL)",
        bucket,
        path: objectPath,
      });
    }

    res.setHeader("Cache-Control", "public, max-age=300");
    return res.redirect(302, data.signedUrl);
  } catch (e: any) {
    console.error("[img] error (query)", e?.message || e);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

export default router;
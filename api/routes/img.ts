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

// --- JWT payload decode (uten verifisering) for debug ---
function base64UrlToUtf8(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, "base64").toString("utf8");
}
function getJwtRef(jwt: string): string | null {
  try {
    const parts = (jwt || "").split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(base64UrlToUtf8(parts[1]));
    return payload?.ref || null;
  } catch {
    return null;
  }
}
function hostFromUrl(u: string): string | null {
  try {
    return new URL(u).host;
  } catch {
    return null;
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
      urlHost: hostFromUrl(IMAGES_URL),
      keyRef: IMAGES_KEY ? getJwtRef(IMAGES_KEY) : null,
    },
    housekeeping: {
      hasUrl: !!HK_URL,
      hasKey: !!HK_KEY,
      urlHost: hostFromUrl(HK_URL),
      keyRef: HK_KEY ? getJwtRef(HK_KEY) : null,
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

    // 1) Forsøk signed URL
    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(objectPath, TTL_SECONDS);

    if (!error && data?.signedUrl) {
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.redirect(302, data.signedUrl);
    }

    // 2) Fallback: public URL (fungerer hvis bucket er public)
    const pub = client.storage.from(bucket).getPublicUrl(objectPath);
    const publicUrl = pub?.data?.publicUrl;

    if (publicUrl) {
      console.warn("[img] signed failed, fallback to publicUrl", {
        bucket,
        objectPath,
        signedError: error?.message,
      });
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.redirect(302, publicUrl);
    }

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
      signedError: error?.message || null,
    });
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

    if (!error && data?.signedUrl) {
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.redirect(302, data.signedUrl);
    }

    const pub = client.storage.from(bucket).getPublicUrl(objectPath);
    const publicUrl = pub?.data?.publicUrl;

    if (publicUrl) {
      console.warn("[img] (query) signed failed, fallback to publicUrl", {
        bucket,
        objectPath,
        signedError: error?.message,
      });
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.redirect(302, publicUrl);
    }

    return res.status(404).json({
      ok: false,
      error: "Image not found (or could not sign URL)",
      bucket,
      path: objectPath,
      signedError: error?.message || null,
    });
  } catch (e: any) {
    console.error("[img] error (query)", e?.message || e);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

export default router;
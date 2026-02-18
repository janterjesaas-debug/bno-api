import { Router, Request, Response } from "express";

const router = Router();

function safeEncodePath(path: string) {
  // Encode each segment (keeps "/" but encodes spaces etc.)
  return path
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

function getHost(url: string | undefined | null) {
  try {
    if (!url) return null;
    return new URL(url).host;
  } catch {
    return null;
  }
}

function pickContentType(headers: Headers) {
  return headers.get("content-type") || "application/octet-stream";
}

router.get("/img/_debug", (req: Request, res: Response) => {
  const imagesUrl = process.env.SUPABASE_IMAGES_URL || "";
  const imagesKey = process.env.SUPABASE_IMAGES_SERVICE_ROLE_KEY || "";
  const bucketDefault = process.env.SUPABASE_IMAGES_BUCKET || "bno-images";

  const urlHost = getHost(imagesUrl);

  // decode JWT payload ref if present (best effort)
  let keyRef: string | null = null;
  try {
    const p = imagesKey.split(".")[1];
    if (p) keyRef = JSON.parse(Buffer.from(p, "base64").toString("utf8")).ref || null;
  } catch {}

  res.json({
    ok: true,
    version: "img.ts AUTH-PROXY v1",
    images: {
      hasUrl: Boolean(imagesUrl),
      hasKey: Boolean(imagesKey),
      bucketDefault,
      urlHost,
      keyRef,
    },
  });
});

/**
 * 1) /api/img/:bucket/*path  -> proxy from Supabase Storage (authenticated if key exists)
 */
router.get("/img/:bucket/*", async (req: Request, res: Response) => {
  try {
    const supabaseUrl = process.env.SUPABASE_IMAGES_URL;
    const supabaseKey = process.env.SUPABASE_IMAGES_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      return res.status(500).json({ ok: false, error: "Missing SUPABASE_IMAGES_URL" });
    }

    const bucket = req.params.bucket;
    const rawPath = req.params[0] || "";
    const encodedPath = safeEncodePath(rawPath);

    // Authenticated download endpoint (works for private buckets)
    const upstream = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(
      bucket
    )}/${encodedPath}`;

    const headers: Record<string, string> = {};
    if (supabaseKey) {
      headers["apikey"] = supabaseKey;
      headers["authorization"] = `Bearer ${supabaseKey}`;
    }

    const r = await fetch(upstream, { method: "GET", headers });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return res.status(404).json({
        ok: false,
        error: "Image not found (or could not fetch from storage)",
        bucket,
        path: rawPath,
        upstreamStatus: r.status,
        upstreamBody: txt.slice(0, 300),
      });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Content-Type", pickContentType(r.headers));

    // stream body
    const buf = Buffer.from(await r.arrayBuffer());
    return res.status(200).send(buf);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Unknown error" });
  }
});

/**
 * 2) /api/img?url=<remote-url>  -> proxy (optionally authenticated if same Supabase project)
 */
router.get("/img", async (req: Request, res: Response) => {
  try {
    const url = String(req.query.url || "");
    if (!url) return res.status(400).json({ ok: false, error: "Missing url" });

    const supabaseUrl = process.env.SUPABASE_IMAGES_URL || "";
    const supabaseKey = process.env.SUPABASE_IMAGES_SERVICE_ROLE_KEY || "";

    const targetHost = getHost(url);
    const imagesHost = getHost(supabaseUrl);

    const headers: Record<string, string> = {};

    // If the URL points to our Supabase images project, attach auth headers (works for private buckets)
    if (imagesHost && targetHost === imagesHost && supabaseKey) {
      headers["apikey"] = supabaseKey;
      headers["authorization"] = `Bearer ${supabaseKey}`;
    }

    const r = await fetch(url, { method: "GET", headers });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return res.status(404).json({
        ok: false,
        error: "Image not found (or could not fetch url)",
        url,
        upstreamStatus: r.status,
        upstreamBody: txt.slice(0, 300),
      });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Content-Type", pickContentType(r.headers));

    const buf = Buffer.from(await r.arrayBuffer());
    return res.status(200).send(buf);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Unknown error" });
  }
});

export default router;
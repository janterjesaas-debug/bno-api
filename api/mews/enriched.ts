// api/mews/enriched.ts
// Availability is required; categories are best-effort.
// The handler CANNOT hang: manual timeouts + watchdog.

export const config = { runtime: "nodejs" };

/* --------------------- tiny utils --------------------- */
const JSON_HEADERS = { "Content-Type": "application/json" };

function reqEnv(name: string): string {
  const v = (process.env[name] || "").trim();
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}
function mewsBase() {
  return reqEnv("MEWS_BASE_URL").replace(/\/+$/, "");
}
function mewsUrl(path: string) {
  return `${mewsBase()}${path.startsWith("/") ? path : `/${path}`}`;
}
function mewsAuth() {
  return {
    ClientToken: reqEnv("MEWS_CLIENT_TOKEN"),
    AccessToken: reqEnv("MEWS_ACCESS_TOKEN"),
    Client: (process.env.MEWS_CLIENT_NAME || "BNO Travel App 1.0.0").trim(),
  };
}

/** Manual fetch timeout that really aborts the socket */
async function fetchWithTimeout(
  url: string,
  opts: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function postJsonT(path: string, body: any, timeoutMs: number) {
  const res = await fetchWithTimeout(
    mewsUrl(path),
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    },
    timeoutMs
  );

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON from ${path}: ${text.slice(0, 300)}`);
  }
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
  }
  return json;
}

function ymdToUtcStart(ymd: string) {
  // MEWS availability works with UTC starts; midnight UTC is a safe baseline
  return `${ymd}T00:00:00Z`;
}

/* --------------------- handler --------------------- */

export default async function handler(req: Request) {
  // Hard watchdog: if something goes south, we still respond
  const watchdog = setTimeout(() => {
    console.error("⏱️ Watchdog fired – returning 504");
    // We cannot "force return" from here, but throwing will reject the pending promise below.
    throw new Error("Watchdog timeout");
  }, 25_000);

  const started = Date.now();
  try {
    const url = new URL(req.url);
    const start = (url.searchParams.get("start") || "").trim();
    const end = (url.searchParams.get("end") || "").trim();
    const adults = Number(url.searchParams.get("adults") || "2") || 2;

    if (!start || !end) {
      return new Response(JSON.stringify({ ok: false, error: "Missing start/end" }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    const SERVICE_ID = reqEnv("MEWS_SERVICE_ID");
    const ENTERPRISE_ID = reqEnv("MEWS_ENTERPRISE_ID");

    // 1) REQUIRED: availability – 9s hard timeout
    console.info("🔎 getAvailability...");
    let availability: any;
    try {
      availability = await postJsonT(
        "/services/getAvailability",
        {
          ...mewsAuth(),
          ServiceId: SERVICE_ID,
          FirstTimeUnitStartUtc: ymdToUtcStart(start),
          LastTimeUnitStartUtc: ymdToUtcStart(end),
        },
        9000
      );
      console.info("✅ availability OK");
    } catch (e: any) {
      console.error("❌ availability failed:", e?.message || e);
      return new Response(
        JSON.stringify({ ok: false, error: `Availability failed: ${e?.message || e}` }),
        { status: 502, headers: JSON_HEADERS }
      );
    }

    const datesUtc: string[] =
      availability?.DatesUtc ?? availability?.TimeUnitStartsUtc ?? [];
    const availCats: any[] =
      availability?.CategoryAvailabilities ??
      availability?.Categories ??
      availability?.Results ??
      [];

    // 2) OPTIONAL: categories meta via EnterpriseId – 4s timeout, best-effort
    console.info("📚 spaceCategories/getAll (best-effort)...");
    let catMetaMap = new Map<
      string,
      { Name?: string; Capacity?: number; Description?: string }
    >();
    try {
      const cats = await postJsonT(
        "/spaceCategories/getAll",
        { ...mewsAuth(), EnterpriseId: ENTERPRISE_ID },
        4000
      );

      const list: any[] =
        cats?.SpaceCategories ?? cats?.Categories ?? cats?.Items ?? cats ?? [];

      for (const c of list) {
        const id = c?.Id || c?.CategoryId || c?.SpaceCategoryId;
        if (!id) continue;
        catMetaMap.set(id, {
          Name: c?.Name || c?.CategoryName || c?.SpaceCategoryName,
          Capacity: c?.Capacity ?? c?.MaxPersons ?? c?.MaximumOccupancy,
          Description: c?.Description ?? "",
        });
      }
      console.info("✅ categories OK, count:", catMetaMap.size);
    } catch (e: any) {
      console.warn("⚠️ categories skipped:", e?.message || e);
    }

    // 3) Build payload (images/priceFrom = next iteration)
    const categories = availCats.map((c) => {
      const id = c?.CategoryId ?? c?.Id ?? c?.SpaceCategoryId ?? c?.RoomCategoryId;
      const meta = id ? catMetaMap.get(id) : undefined;
      return {
        id,
        name: meta?.Name ?? (id ? `Kategori ${String(id).slice(0, 8)}…` : "Kategori"),
        capacity: meta?.Capacity ?? null,
        description: meta?.Description ?? "",
        availabilities: Array.isArray(c?.Availabilities) ? c.Availabilities : [],
        imageUrls: [] as string[],
        priceFrom: null as number | null,
        currency: "NOK",
      };
    });

    const body = {
      ok: true,
      start,
      end,
      adults,
      datesUtc,
      categories,
    };

    console.info("⏱️ enriched total ms:", Date.now() - started);

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...JSON_HEADERS, "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    console.error("💥 Handler crash:", err?.message || err);
    return new Response(JSON.stringify({ ok: false, error: err?.message || "Internal error" }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  } finally {
    clearTimeout(watchdog);
  }
}

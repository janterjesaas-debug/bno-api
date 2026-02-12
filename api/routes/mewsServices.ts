import type { Express, Request, Response } from "express";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getMewsConfig() {
  const MEWS_BASE_URL = process.env.MEWS_BASE_URL || "https://api.mews.com";
  const MEWS_API_VERSION = process.env.MEWS_API_VERSION || "2023-06-06";

  const ClientToken = requireEnv("MEWS_CLIENT_TOKEN");
  const AccessToken = requireEnv("MEWS_ACCESS_TOKEN");
  const EnterpriseId = requireEnv("MEWS_ENTERPRISE_ID");
  const Client = process.env.MEWS_CLIENT_NAME || "BNO Travel App 1.0";

  return { MEWS_BASE_URL, MEWS_API_VERSION, ClientToken, AccessToken, EnterpriseId, Client };
}

async function mewsPost<T>(path: string, body: any): Promise<T> {
  const { MEWS_BASE_URL, MEWS_API_VERSION, ClientToken, AccessToken, EnterpriseId, Client } = getMewsConfig();

  const url = `${MEWS_BASE_URL}/api/connector/v1/${path}/${MEWS_API_VERSION}`;

  const payload = {
    ClientToken,
    AccessToken,
    Client,
    EnterpriseId,
    ...body,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`MEWS ${path} ${res.status}: ${txt}`);
  }

  return (await res.json()) as T;
}

export function registerMewsServicesRoute(app: Express) {
  app.get(["/mews/services", "/api/mews/services"], async (req: Request, res: Response) => {
    try {
      // optional: activeOnly=true
      const activeOnly = String(req.query.activeOnly || "").toLowerCase() === "true";

      type MewsService = { Id: string; Name: string; IsActive?: boolean; Type?: string };
      type Resp = { Services?: MewsService[] };

      const data = await mewsPost<Resp>("services/getAll", {});
      const services = (data.Services || []).filter((s) => (activeOnly ? s.IsActive !== false : true));

      res.json({
        ok: true,
        count: services.length,
        services: services.map((s) => ({
          id: s.Id,
          name: s.Name,
          type: s.Type ?? null,
          isActive: s.IsActive ?? null,
        })),
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });
}

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

export function registerMewsSpacesRoute(app: Express) {
  app.get(["/mews/spaces", "/api/mews/spaces"], async (req: Request, res: Response) => {
    try {
      // optional filter: ?serviceIds=a,b,c  (komma-separert)
      const serviceIdsParam = String(req.query.serviceIds || "").trim();
      const envServiceIds = String(process.env.MEWS_SERVICE_IDS || "").trim();

      const serviceIds =
        serviceIdsParam
          ? serviceIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
          : envServiceIds
          ? envServiceIds.split(",").map((s) => s.trim()).filter(Boolean)
          : [];

      type MewsSpace = { Id: string; Name: string; ServiceId?: string; IsActive?: boolean };
      type Resp = { Spaces?: MewsSpace[] };

      // Mange Mews-kontoer returnerer Spaces på enterprise-nivå; filter gjør vi lokalt om vi har ServiceId-feltet.
      const data = await mewsPost<Resp>("spaces/getAll", {});
      let spaces = data.Spaces || [];

      if (serviceIds.length > 0) {
        spaces = spaces.filter((sp) => (sp.ServiceId ? serviceIds.includes(sp.ServiceId) : true));
      }

      res.json({
        ok: true,
        count: spaces.length,
        serviceIdsUsed: serviceIds,
        spaces: spaces.map((sp) => ({
          id: sp.Id,
          name: sp.Name,
          serviceId: sp.ServiceId ?? null,
          isActive: sp.IsActive ?? null,
        })),
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });
}

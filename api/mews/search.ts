// api/mews/search.ts
export const config = { runtime: 'edge' };

import { tryMewsAvailability, mapMewsToItems, buildDistributorUrl } from '../lib/mews.js';

function json(data: any, init?: number | ResponseInit) {
  const initObj: ResponseInit = typeof init === 'number' ? { status: init } : (init || {});
  return new Response(JSON.stringify(data), {
    ...initObj,
    headers: { 'content-type': 'application/json; charset=utf-8', ...(initObj.headers || {}) },
  });
}

type Attempt = { url: string; status?: number; statusText?: string; excerpt?: string };
type Ok = { ok: true; mews: any; usedUrl: string; attempts?: Attempt[] };
type Err = { ok: false; message?: string; attempts: Attempt[] };
function isErr(x: Ok | Err): x is Err { return !x.ok; }

export default async function handler(req: Request) {
  try {
    if (req.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);

    const body = await req.json().catch(() => ({} as any));
    const start = String(body?.start || '');
    const end = String(body?.end || '');
    const adults = Number(body?.adults || 2) || 2;

    if (!start || !end)
      return json({ ok: false, error: 'VALIDATION', message: 'Missing start/end' }, 400);

    const startUtc = `${start}T00:00:00.000Z`;
    const endUtc = `${end}T23:59:59.999Z`;

    const res = await tryMewsAvailability({ startUtc, endUtc, adults });

    if (isErr(res)) {
      return json({ ok: false, error: 'MEWS_ERROR', message: res.message }, 502);
    }

    const distributorUrl = () => buildDistributorUrl(start, end, adults);
    const items = mapMewsToItems(res.mews, distributorUrl);

    return json({ ok: true, items, usedUrl: res.usedUrl, distributor: distributorUrl() }, 200);
  } catch (e: any) {
    return json({ ok: false, error: 'SERVER_ERROR', message: e?.message || String(e) }, 500);
  }
}

// api/health.ts
export const config = { runtime: 'edge' };

function json(data: any, init?: number | ResponseInit) {
  const initObj: ResponseInit = typeof init === 'number' ? { status: init } : init || {};
  return new Response(JSON.stringify(data), {
    ...initObj,
    headers: { 'content-type': 'application/json; charset=utf-8', ...(initObj.headers || {}) },
  });
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('env') === '1') {
    const keys = [
      'MEWS_BASE_URL',
      'MEWS_CLIENT_TOKEN',
      'MEWS_ACCESS_TOKEN',
      'MEWS_CLIENT_NAME',
      'MEWS_ENTERPRISE_ID',
      'MEWS_SERVICE_ID',
      'MEWS_CONFIGURATION_ID',
      'MEWS_DISTRIBUTOR_BASE',
    ];
    const env = Object.fromEntries(
      keys.map((k) => [k, process.env[k] ? (k.includes('TOKEN') ? 'set' : String(process.env[k])) : '(missing)'])
    );
    return json({ ok: true, env });
  }
  return json({ ok: true, env: process.env.VERCEL_ENV, time: new Date().toISOString() });
}

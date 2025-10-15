// api/diag.ts
export const config = { runtime: 'edge' };

const KEYS = [
  'MEWS_BASE_URL',
  'MEWS_CLIENT_TOKEN',
  'MEWS_ACCESS_TOKEN',
  'MEWS_ENTERPRISE_ID',
  'MEWS_SERVICE_ID',
  'MEWS_CONFIGURATION_ID',
  'MEWS_DISTRIBUTOR_BASE',
  'MEWS_CLIENT_NAME',
];

export default function handler(_req: Request) {
  const present = Object.fromEntries(
    KEYS.map(k => [k, !!(process.env[k] && String(process.env[k]).trim())])
  );

  return new Response(JSON.stringify({
    ok: true,
    runtime: 'edge',
    env: process.env.NODE_ENV,
    present
  }, null, 2), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

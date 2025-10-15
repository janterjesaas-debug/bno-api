// api/mews/raw.ts

// Viktig: bruker Node.js-runtime for å få tilgang til process.env
export const config = { runtime: 'nodejs' };

async function mewsPost(endpoint: string, body: any) {
  const base = process.env.MEWS_BASE_URL;
  if (!base) throw new Error('Missing env var: MEWS_BASE_URL');

  const url = `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Mews ${res.status}: ${text}`);
  }

  return res.json();
}

export default async function handler(req: Request) {
  const requiredVars = [
    'MEWS_BASE_URL',
    'MEWS_CLIENT_TOKEN',
    'MEWS_ACCESS_TOKEN',
    'MEWS_SERVICE_ID',
    'MEWS_CLIENT_NAME',
    'MEWS_ENTERPRISE_ID' // nå kreves denne også
  ];
  const missing = requiredVars.filter(k => !process.env[k]);
  if (missing.length) {
    return new Response(
      JSON.stringify({ error: `Missing required env vars: ${missing.join(', ')}` }),
      { status: 500 }
    );
  }

  const params = new URL(req.url).searchParams;
  const start = params.get('start') || '2025-10-16';
  const end = params.get('end') || '2025-10-18';
  const adults = Number(params.get('adults') || 2);

  try {
    const data = await mewsPost('/services/getAvailability', {
      ClientToken: process.env.MEWS_CLIENT_TOKEN,
      AccessToken: process.env.MEWS_ACCESS_TOKEN,
      Client: process.env.MEWS_CLIENT_NAME,
      ServiceId: process.env.MEWS_SERVICE_ID,
      FirstTimeUnitStartUtc: `${start}T22:00:00Z`,
      LastTimeUnitStartUtc: `${end}T22:00:00Z`,
    });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 502 });
  }
}

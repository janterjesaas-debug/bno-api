// api/mews/raw.ts

// NB: Bruker Node.js-runtime for å få tilgang til process.env
export const config = { runtime: 'nodejs' };

async function mewsPost(endpoint: string, body: any) {
  const base = process.env.MEWS_BASE_URL;
  if (!base) throw new Error('Missing env var: MEWS_BASE_URL');

  const url = `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  console.log('📡 Poster til MEWS:', url);
  console.log('📦 Body:', JSON.stringify(body, null, 2));

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  if (!res.ok) {
    console.error('❌ MEWS-feil:', res.status, text.slice(0, 300));
    throw new Error(`Mews ${res.status}: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Non-JSON response from Mews: ${text.slice(0, 300)}`);
  }
}

export default async function handler(req: Request) {
  const requiredVars = [
    'MEWS_BASE_URL',
    'MEWS_CLIENT_TOKEN',
    'MEWS_ACCESS_TOKEN',
    'MEWS_SERVICE_ID',
    'MEWS_CLIENT_NAME',
    'MEWS_ENTERPRISE_ID',
  ];
  const missing = requiredVars.filter(k => !process.env[k]);
  if (missing.length) {
    return new Response(
      JSON.stringify({ error: `Missing required env vars: ${missing.join(', ')}` }),
      { status: 500 }
    );
  }

  let baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  try {
    const fullUrl = new URL(req.url, baseUrl);
    const params = fullUrl.searchParams;

    const start = params.get('start') || '2025-10-16';
    const end = params.get('end') || '2025-10-18';
    const adults = Number(params.get('adults') || 2);

    const data = await mewsPost('/services/getAvailability', {
      ClientToken: process.env.MEWS_CLIENT_TOKEN,
      AccessToken: process.env.MEWS_ACCESS_TOKEN,
      Client: process.env.MEWS_CLIENT_NAME,
      ServiceId: process.env.MEWS_SERVICE_ID,
      FirstTimeUnitStartUtc: `${start}T22:00:00Z`,
      LastTimeUnitStartUtc: `${end}T22:00:00Z`,
    });

    console.log('✅ MEWS-respons OK:', JSON.stringify(data).slice(0, 300));

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('❌ Kjøringsfeil i handler:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 502 });
  }
}

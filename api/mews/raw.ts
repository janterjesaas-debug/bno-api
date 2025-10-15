// api/mews/raw.ts

// Viktig: bruker Node.js-runtime for å få tilgang til process.env
export const config = { runtime: 'nodejs' };

// Fetch med timeout og feilbehandling
async function mewsPost(endpoint: string, body: any) {
  const base = process.env.MEWS_BASE_URL;
  if (!base) throw new Error('Missing env var: MEWS_BASE_URL');

  const url = `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000); // 10 sek timeout

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  clearTimeout(timeout);

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
    'MEWS_ENTERPRISE_ID'
  ];
  const missing = requiredVars.filter(k => !process.env[k]);
  if (missing.length) {
    return new Response(
      JSON.stringify({ error: `Missing required env vars: ${missing.join(', ')}` }),
      { status: 500 }
    );
  }

  // Bruker absolutt URL for å unngå "Invalid URL"-feil
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
  const urlObj = new URL(req.url, baseUrl);

  const start = urlObj.searchParams.get('start') || '2025-10-16';
  const end = urlObj.searchParams.get('end') || '2025-10-18';
  const adults = Number(urlObj.searchParams.get('adults') || 2);

  const payload = {
    ClientToken: process.env.MEWS_CLIENT_TOKEN,
    AccessToken: process.env.MEWS_ACCESS_TOKEN,
    Client: process.env.MEWS_CLIENT_NAME,
    ServiceId: process.env.MEWS_SERVICE_ID,
    EnterpriseId: process.env.MEWS_ENTERPRISE_ID,
    FirstTimeUnitStartUtc: `${start}T22:00:00Z`,
    LastTimeUnitStartUtc: `${end}T22:00:00Z`,
  };

  console.log('📡 Henter tilgjengelighet med:', payload);

  try {
    const data = await mewsPost('/services/getAvailability', payload);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { status: 502 }
    );
  }
}

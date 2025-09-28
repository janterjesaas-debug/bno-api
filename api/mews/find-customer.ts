import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed', allow: ['POST'] });
    return;
  }

  const baseUrl     = process.env.MEWS_BASE_URL || 'https://api.mews.com';
  const clientToken = process.env.MEWS_CLIENT_TOKEN;
  const accessToken = process.env.MEWS_ACCESS_TOKEN;
  const clientName  = process.env.MEWS_CLIENT_NAME || 'BNO Travel Booking 1.0.0';

  if (!clientToken || !accessToken) {
    res.status(500).json({ error: 'Missing MEWS credentials' });
    return;
  }

  const { email } = (req.body || {}) as { email?: string };
  if (!email) {
    res.status(400).json({ error: 'Missing email' });
    return;
  }

  // TODO: Bytt til faktisk MEWS-endepunkt når du har tokenene klart.
  // Denne versjonen gjør bare en "echo" slik at vi ser at API-et virker.
  res.status(200).json({
    ok: true,
    email,
    note: 'Serverless function is alive. Swap in real MEWS call when tokens are ready.',
  });

  // Eksempel på MEWS-kall (pseudo):
  // const r = await fetch(`${baseUrl}/api/connector/v1/customers/getAll`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ ClientToken: clientToken, AccessToken: accessToken, Client: clientName, Emails: [email] }),
  // });
  // const data = await r.json();
  // res.status(200).json(data);
}


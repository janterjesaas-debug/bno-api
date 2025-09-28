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

  const { customerId, email } = (req.body || {}) as { customerId?: string; email?: string };

  if (!customerId && !email) {
    res.status(400).json({ error: 'Provide customerId or email' });
    return;
  }

  // Stub-respons inntil vi kobler på MEWS:
  res.status(200).json({
    ok: true,
    customerId,
    email,
    note: 'Serverless function is alive. Hook up real MEWS fetch later.',
  });

  // Eksempel (pseudo) når du har token:
  // const r = await fetch(`${baseUrl}/api/connector/v1/reservations/getAll`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     ClientToken: clientToken,
  //     AccessToken: accessToken,
  //     Client: clientName,
  //     CustomerIds: customerId ? [customerId] : undefined,
  //     // eller filtrer på email via Customers først
  //   }),
  // });
  // const data = await r.json();
  // res.status(200).json(data);
}

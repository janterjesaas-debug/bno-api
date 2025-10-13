// api/mews/get-reservations.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_BASE = process.env.MEWS_API_BASE ?? 'https://api.mews-demo.com';
const CLIENT_TOKEN = process.env.MEWS_CLIENT_TOKEN!;
const ACCESS_TOKEN = process.env.MEWS_ACCESS_TOKEN!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!CLIENT_TOKEN || !ACCESS_TOKEN) {
    return res.status(500).json({ error: 'Missing MEWS tokens' });
  }

  try {
    // TODO: Sett riktig Connector-endepunkt + payload iht. Mews-dok
    const r = await fetch(`${API_BASE}/api/connector/v1/...`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        ClientToken: CLIENT_TOKEN,
        AccessToken: ACCESS_TOKEN,
        // ...resten av body fra req.body
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json(data);
    }
    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'Unknown error' });
  }
}

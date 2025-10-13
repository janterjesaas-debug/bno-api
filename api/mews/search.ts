// api/mews/search.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Enkel CORS slik at appen på telefon/Expo får lov å kalle Vercel
function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

type Payload = {
  start?: string;
  end?: string;
  area?: string;
  adults?: number;
  promo?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    // preflight
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', allow: ['POST'] });
  }

  // Body kan komme som string (edge) eller objekt – normaliser:
  const body: Payload =
    typeof req.body === 'string'
      ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })()
      : (req.body || {});

  const { start, end, area, adults = 2, promo } = body;

  if (!start || !end) {
    return res.status(400).json({ error: 'Missing start or end date (YYYY-MM-DD).' });
  }

  // Her kan du bytte til ekte Mews-kall senere. Nå returnerer vi dummy-data
  // i det samme fleksible formatet som frontenden din allerede støtter.
  const items = [
    {
      id: 'STD-APT',
      name: area ? `Leilighet – ${area}` : 'Leilighet – standard',
      capacity: Math.max(2, Math.min(8, adults)),
      refundable: true,
      currency: 'NOK',
      price: 2490,
      url: 'https://bno-travel.com/',
    },
    {
      id: 'DLX-LODGE',
      name: 'Hytte – deluxe',
      capacity: 6,
      refundable: false,
      currency: 'NOK',
      price: 3890,
      url: 'https://bno-travel.com/',
    },
  ];

  return res.status(200).json({ items, query: { start, end, area, adults, promo } });
}

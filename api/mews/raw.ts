// api/mews/raw.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = { runtime: 'nodejs' };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { start, end, adults } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'Missing required parameters: start or end' });
    }

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
      return res.status(500).json({ error: `Missing environment variables: ${missing.join(', ')}` });
    }

    const payload = {
      ClientToken: process.env.MEWS_CLIENT_TOKEN,
      AccessToken: process.env.MEWS_ACCESS_TOKEN,
      Client: process.env.MEWS_CLIENT_NAME,
      ServiceId: process.env.MEWS_SERVICE_ID,
      FirstTimeUnitStartUtc: `${start}T22:00:00Z`,
      LastTimeUnitStartUtc: `${end}T22:00:00Z`
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const url = `${process.env.MEWS_BASE_URL}/services/getAvailability`;
    console.log('📡 Poster til MEWS:', url);
    console.log('📦 Payload:', payload);

    const fetchRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!fetchRes.ok) {
      const text = await fetchRes.text();
      console.error(`❌ Mews-feil (${fetchRes.status}):`, text);
      return res.status(fetchRes.status).json({ error: text });
    }

    const data = await fetchRes.json();
    console.log('✅ Mews API respons OK');
    return res.status(200).json(data);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('⏱️ Mews-kall timet ut');
      return res.status(504).json({ error: 'Mews API timeout' });
    }

    console.error('💥 Uventet feil:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

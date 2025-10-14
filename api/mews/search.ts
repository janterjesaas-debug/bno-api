// api/mews/search.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import dayjs from 'dayjs';
import {
  buildDistributorUrl,
  fetchMewsAvailability,
  mapMewsToItems,
  required,
} from '../lib/mews.js'; // ← VIKTIG: .js i importstien

type Body = {
  start?: string; // "YYYY-MM-DD"
  end?: string;   // "YYYY-MM-DD"
  adults?: number;
  area?: string;
  promo?: string;
};

function toUtcStart(date: string) {
  return dayjs(date).startOf('day').toISOString();
}
function toUtcEnd(date: string) {
  return dayjs(date).endOf('day').toISOString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed', allow: ['POST'] });
  }

  try {
    const b: Body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
    if (!b.start || !b.end) {
      return res.status(400).json({ error: 'Missing "start" or "end" (YYYY-MM-DD)' });
    }

    const adults = Math.max(1, Number(b.adults ?? 2));
    const startUtc = toUtcStart(b.start);
    const endUtc = toUtcEnd(b.end);

    // 1) Kall Mews
    const mewsJson = await fetchMewsAvailability({
      startUtc,
      endUtc,
      adults,
    });

    // 2) Lag deeplink til Distributor for «Bestill»-knappen i appen
    const urlFactory = () => buildDistributorUrl(startUtc, endUtc, adults);

    // 3) Map til appens format
    const items = mapMewsToItems(mewsJson, urlFactory);

    return res.status(200).json({ items });
  } catch (err: any) {
    const msg = err?.message || String(err);
    return res.status(502).json({ error: 'MEWS_ERROR', message: msg });
  }
}

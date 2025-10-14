// api/mews/raw.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchMewsAvailability } from '../lib/mews.js'; // ← VIKTIG: .js i importstien
import dayjs from 'dayjs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const start = (req.query.start as string) || dayjs().format('YYYY-MM-DD');
  const end = (req.query.end as string) || dayjs().add(2, 'day').format('YYYY-MM-DD');
  const adults = Number(req.query.adults || 2);

  const startUtc = dayjs(start).startOf('day').toISOString();
  const endUtc = dayjs(end).endOf('day').toISOString();

  try {
    const raw = await fetchMewsAvailability({ startUtc, endUtc, adults });
    res.status(200).json(raw);
  } catch (e: any) {
    res.status(502).json({ error: e?.message || String(e) });
  }
}

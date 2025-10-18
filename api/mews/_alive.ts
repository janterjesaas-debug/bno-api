import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Bekrefter at /api/mews-* routes er montert. */
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    route: '/api/mews/_alive',
    now: new Date().toISOString(),
  });
}

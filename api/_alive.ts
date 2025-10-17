import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    route: '/api/_alive',
    now: new Date().toISOString(),
    url: req.url,
    query: req.query,
  });
}

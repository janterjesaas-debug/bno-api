// api/health.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, env: process.env.VERCEL_ENV ?? 'local', time: new Date().toISOString() });
}

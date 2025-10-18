import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Lettvekts ping-endepunkt for helsesjekk. */
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    now: new Date().toISOString(),
  });
}

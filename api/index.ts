import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Root API-route som svarer raskt og enkelt. */
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    message: 'Welcome to the BNO Travel API.',
    now: new Date().toISOString(),
  });
}

// api/mews/ping.ts
// Enkel helsesjekk – svarer alltid raskt

export const config = { runtime: 'nodejs18.x' as const };

export default async function handler(req: any, res: any) {
  try {
    res.status(200).json({
      ok: true,
      now: new Date().toISOString(),
      env: {
        MEWS_BASE_URL: !!process.env.MEWS_BASE_URL,
        MEWS_CLIENT_TOKEN: !!process.env.MEWS_CLIENT_TOKEN,
        MEWS_ACCESS_TOKEN: !!process.env.MEWS_ACCESS_TOKEN,
        MEWS_SERVICE_ID: !!process.env.MEWS_SERVICE_ID,
      },
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

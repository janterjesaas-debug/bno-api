// mews-webhook.ts
import { Request, Response } from 'express';

// Handler-funksjon for Mews-webhook
export function mewsWebhookHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  console.log('=== MEWS WEBHOOK (Vercel) ===');
  console.log(JSON.stringify(req.body, null, 2));
  console.log('==============================');

  // TODO: Her kan du senere:
  // - validere signatur (f.eks. sjekke secret/signature)
  // - lagre i database
  // - trigge annen logikk

  res.status(200).json({ ok: true });
}

// api/mews-webhook.js
// Enkel Vercel serverless-funksjon for Mews/Zapier-webhooks

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  console.log('=== MEWS WEBHOOK (Vercel serverless) ===');
  console.log(JSON.stringify(req.body, null, 2));
  console.log('========================================');

  // TODO: senere kan du validere signaturer, lagre i DB, osv.
  res.status(200).json({ ok: true });
}

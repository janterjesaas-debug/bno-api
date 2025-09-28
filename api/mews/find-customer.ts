export const config = { runtime: 'nodejs18.x' };

export default async function handler(req: Request) {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405 });
    }

    const { email, limit = 5 } = await req.json() as { email?: string; limit?: number };
    if (!email) {
      return new Response(JSON.stringify({ error: 'Missing email' }), { status: 400 });
    }

    const base = process.env.MEWS_BASE_URL!;
    const body = {
      ClientToken: process.env.MEWS_CLIENT_TOKEN,
      AccessToken: process.env.MEWS_ACCESS_TOKEN,
      Client: process.env.MEWS_CLIENT_NAME ?? 'BNO Travel Booking 1.0.0',
      Emails: [email],
      Extent: { Customers: true, Addresses: false },
      Limitation: { Count: limit }
    };

    const r = await fetch(`${base}/api/connector/v1/customers/getAll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      return new Response(JSON.stringify({ error: 'Mews error', details: await r.text() }), { status: 502 });
    }

    const json = await r.json() as any;
    const customers = (json.Customers ?? []).map((c: any) => ({
      id: c.Id,
      email: c.Email,
      firstName: c.FirstName,
      lastName: c.LastName,
      number: c.Number
    }));

    return new Response(JSON.stringify({ customers }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'Unexpected error' }), { status: 500 });
  }
}

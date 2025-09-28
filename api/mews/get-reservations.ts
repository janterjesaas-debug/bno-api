export const config = { runtime: 'nodejs18.x' };

export default async function handler(req: Request) {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405 });
    }

    const { customerId, confirmationNumber, limit = 50 } = await req.json() as {
      customerId?: string;
      confirmationNumber?: string;
      limit?: number;
    };

    if (!customerId && !confirmationNumber) {
      return new Response(JSON.stringify({ error: 'Provide customerId or confirmationNumber' }), { status: 400 });
    }

    const base = process.env.MEWS_BASE_URL!;
    const body: any = {
      ClientToken: process.env.MEWS_CLIENT_TOKEN,
      AccessToken: process.env.MEWS_ACCESS_TOKEN,
      Client: process.env.MEWS_CLIENT_NAME ?? 'BNO Travel Booking 1.0.0',
      Limitation: { Count: limit }
    };

    if (customerId) body.AccountIds = [customerId];
    if (confirmationNumber) body.Numbers = [confirmationNumber];

    const url = `${base}/api/connector/v1/reservations/getAll/2023-06-06`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      return new Response(JSON.stringify({ error: 'Mews error', details: await r.text() }), { status: 502 });
    }

    const json = await r.json() as any;
    const reservations = (json.Reservations ?? []).map((x: any) => ({
      id: x.Id,
      number: x.Number,
      state: x.State,
      startUtc: x.StartUtc,
      endUtc: x.EndUtc,
      serviceId: x.ServiceId,
      accountId: x.AccountId
    }));

    return new Response(JSON.stringify({ reservations }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'Unexpected error' }), { status: 500 });
  }
}

// api/mews/ping.ts
export const config = { runtime: 'edge' };

export default async function handler() {
  return new Response(JSON.stringify({ ok: true, now: new Date().toISOString() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// api/diag/env.ts
export const config = { runtime: 'edge' };

export default async function handler() {
  const vars = {
    MEWS_BASE_URL: process.env.MEWS_BASE_URL || 'missing',
    MEWS_CLIENT_TOKEN: process.env.MEWS_CLIENT_TOKEN || 'missing',
    MEWS_ACCESS_TOKEN: process.env.MEWS_ACCESS_TOKEN || 'missing',
    MEWS_ENTERPRISE_ID: process.env.MEWS_ENTERPRISE_ID || 'missing',
    MEWS_SERVICE_ID: process.env.MEWS_SERVICE_ID || 'missing',
    MEWS_CONFIGURATION_ID: process.env.MEWS_CONFIGURATION_ID || 'missing',
    MEWS_DISTRIBUTOR_BASE: process.env.MEWS_DISTRIBUTOR_BASE || 'missing',
    MEWS_CLIENT_NAME: process.env.MEWS_CLIENT_NAME || 'missing'
  };

  return new Response(JSON.stringify(vars, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
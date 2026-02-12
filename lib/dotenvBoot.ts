import * as dotenv from 'dotenv';

/**
 * Last inn .env (eller det du sender via dotenv-cli) uten å hardkode path.
 * Når du kjører:
 *   dotenv -e .env.prod -- ts-node server.ts
 * så er variablene allerede satt i process.env før denne kjører.
 * Denne config-linja sørger bare for at .env fungerer i vanlig "dev" også.
 */
dotenv.config({ override: true });

// Litt debug som viser om en "prod-only" verdi er satt:
console.log('[BOOT] dotenv loaded', {
  cwd: process.cwd(),
  node: process.version,
  portEnv: process.env.PORT,
  hasMEWS_BASE_URL: !!process.env.MEWS_BASE_URL,
  MEWS_DISTRIBUTION_CONFIGURATION_ID: process.env.MEWS_DISTRIBUTION_CONFIGURATION_ID || null,
});
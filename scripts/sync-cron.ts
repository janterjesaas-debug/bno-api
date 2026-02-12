// scripts/sync-cron.ts
//
// Kjører runMewsSync() hver 5. minutt via node-cron.

import 'dotenv/config';
import cron from 'node-cron';
import { runMewsSync } from './mews-sync';

console.log('🚀 Starter Mews-synk cron (hver 5. minutt)...');

// Kjør en gang ved oppstart
runMewsSync().catch((err) => {
  console.error('Første synk feilet:', err);
});

// Cron: hvert 5. minutt
cron.schedule('*/5 * * * *', async () => {
  console.log('⏰ Cron-trigger – kjører MEWS → Supabase sync …');
  try {
    await runMewsSync();
  } catch (err) {
    console.error('Feil i cron-synk:', err);
  }
});

console.log('Cron-job kjører. La dette vinduet stå åpent. Trykk Ctrl + C for å stoppe.');

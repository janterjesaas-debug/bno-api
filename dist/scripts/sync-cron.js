"use strict";
// scripts/sync-cron.ts
//
// Kjører runMewsSync() hver 5. minutt via node-cron.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const node_cron_1 = __importDefault(require("node-cron"));
const mews_sync_1 = require("./mews-sync");
console.log('🚀 Starter Mews-synk cron (hver 5. minutt)...');
// Kjør en gang ved oppstart
(0, mews_sync_1.runMewsSync)().catch((err) => {
    console.error('Første synk feilet:', err);
});
// Cron: hvert 5. minutt
node_cron_1.default.schedule('*/5 * * * *', async () => {
    console.log('⏰ Cron-trigger – kjører MEWS → Supabase sync …');
    try {
        await (0, mews_sync_1.runMewsSync)();
    }
    catch (err) {
        console.error('Feil i cron-synk:', err);
    }
});
console.log('Cron-job kjører. La dette vinduet stå åpent. Trykk Ctrl + C for å stoppe.');

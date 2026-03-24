"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
// lib/supabase.ts
require("dotenv/config");
const supabase_js_1 = require("@supabase/supabase-js");
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '').trim();
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY in environment');
    throw new Error('Supabase environment variables not set');
}
exports.supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        persistSession: false,
    },
});

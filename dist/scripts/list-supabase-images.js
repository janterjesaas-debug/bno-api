"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const supabase_js_1 = require("@supabase/supabase-js");
const url = (process.env.SUPABASE_IMAGES_URL || "").trim();
const key = (process.env.SUPABASE_IMAGES_SERVICE_ROLE_KEY || "").trim();
const bucket = (process.env.SUPABASE_IMAGES_BUCKET || "bno-images").trim();
if (!url || !key) {
    console.error("Missing SUPABASE_IMAGES_URL or SUPABASE_IMAGES_SERVICE_ROLE_KEY");
    process.exit(1);
}
const supabase = (0, supabase_js_1.createClient)(url, key, { auth: { persistSession: false } });
async function main() {
    // list root (prefix="")
    const { data, error } = await supabase.storage.from(bucket).list("", {
        limit: 1000,
        sortBy: { column: "name", order: "asc" },
    });
    if (error) {
        console.error("list() error:", error.message);
        process.exit(1);
    }
    console.log(`Bucket=${bucket} objects=${data?.length ?? 0}`);
    for (const o of data || [])
        console.log(o.name);
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});

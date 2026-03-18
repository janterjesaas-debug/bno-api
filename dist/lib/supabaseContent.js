"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabaseDescriptionForResourceCategory = getSupabaseDescriptionForResourceCategory;
const supabase_js_1 = require("@supabase/supabase-js");
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;
function normalizeLocale(input) {
    const s = String(input || '').trim().toLowerCase();
    if (!s)
        return 'nb';
    if (s === 'nb-no' || s === 'no-no' || s === 'no')
        return 'nb';
    if (s === 'en-us' || s === 'en-gb')
        return 'en';
    if (s === 'de-de')
        return 'de';
    if (s === 'fr-fr')
        return 'fr';
    if (s === 'es-es')
        return 'es';
    if (s === 'pt-pt' || s === 'pt-br')
        return 'pt';
    if (s === 'nl-nl')
        return 'nl';
    if (s === 'pl-pl')
        return 'pl';
    if (s === 'fi-fi')
        return 'fi';
    if (s === 'sv-se')
        return 'sv';
    if (s === 'da-dk')
        return 'da';
    if (s === 'is-is')
        return 'is';
    if (s === 'zh-cn' || s === 'zh-hans' || s === 'zh-hant')
        return 'zh';
    return s;
}
function localeFallbacks(requestedLang) {
    const primary = normalizeLocale(requestedLang);
    const out = [primary];
    if (!out.includes('en'))
        out.push('en');
    if (!out.includes('nb'))
        out.push('nb');
    return out;
}
const localCache = {};
function getLocalCache(key) {
    const hit = localCache[key];
    if (!hit)
        return null;
    if (Date.now() > hit.expires) {
        delete localCache[key];
        return null;
    }
    return hit.data;
}
function setLocalCache(key, data, ttlSec = 300) {
    localCache[key] = {
        expires: Date.now() + ttlSec * 1000,
        data,
    };
}
async function getSupabaseDescriptionForResourceCategory(rcId, lang) {
    try {
        if (!rcId)
            return null;
        if (!supabase)
            return null;
        const client = supabase;
        const locale = (lang || 'en').toLowerCase();
        let { data, error } = await client
            .from('resource_category_translations')
            .select('title, short_description, locale')
            .eq('resource_category_id', rcId)
            .eq('locale', locale)
            .limit(1)
            .maybeSingle();
        if (error) {
            console.error('Supabase error (locale):', error);
        }
        if (!data) {
            const res = await client
                .from('resource_category_translations')
                .select('title, short_description, locale')
                .eq('resource_category_id', rcId)
                .eq('locale', 'en')
                .limit(1)
                .maybeSingle();
            data = res.data;
        }
        if (!data) {
            const res = await client
                .from('resource_category_translations')
                .select('title, short_description, locale')
                .eq('resource_category_id', rcId)
                .limit(1)
                .maybeSingle();
            data = res.data;
        }
        if (!data)
            return null;
        return {
            title: data.title,
            description: data.short_description,
        };
    }
    catch (e) {
        console.error('Supabase fetch failed:', e);
        return null;
    }
}

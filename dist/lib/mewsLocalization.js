"use strict";
// lib/mewsLocalization.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickLocalizedText = pickLocalizedText;
// translations er f.eks. rc.Names eller rc.Descriptions fra Mews:
// { "en-GB": "Litunet 721B – a cosy apartment …", "nb-NO": "…" }
function pickLocalizedText(translations, requestedLang, fallbackLangs = []) {
    if (!translations)
        return null;
    const langs = Object.keys(translations);
    if (langs.length === 0)
        return null;
    // 1) Eksakt match (f.eks. "en-GB")
    if (translations[requestedLang]) {
        return translations[requestedLang];
    }
    // 2) Match på språk-prefix ("en" matcher "en-GB", "en-US")
    const langPrefix = requestedLang.split('-')[0];
    const prefixMatchKey = langs.find((k) => k.split('-')[0] === langPrefix);
    if (prefixMatchKey && translations[prefixMatchKey]) {
        return translations[prefixMatchKey];
    }
    // 3) Fallback-liste, f.eks. ['nb-NO']
    for (const fb of fallbackLangs) {
        if (translations[fb]) {
            return translations[fb];
        }
    }
    // 4) Siste utvei: ta første tilgjengelige språk
    const firstKey = langs[0];
    return translations[firstKey] ?? null;
}

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchPrices = fetchPrices;
// lib/prices.ts
const axios_1 = __importDefault(require("axios"));
const mews_1 = require("./mews");
function getPricingEnv() {
    const baseUrl = (process.env.MEWS_BASE_URL || '').trim().replace(/\/$/, '');
    const clientToken = (process.env.MEWS_CLIENT_TOKEN || '').trim();
    const accessToken = (process.env.MEWS_ACCESS_TOKEN || '').trim();
    const clientName = (process.env.MEWS_CLIENT_NAME || 'bno-api').trim();
    const envRateId = (process.env.MEWS_RATE_ID || '').trim() || undefined;
    // Valider her, ikke ved import
    if (!baseUrl)
        throw new Error('Missing MEWS_BASE_URL environment variable');
    if (!clientToken)
        throw new Error('Missing MEWS_CLIENT_TOKEN environment variable');
    if (!accessToken)
        throw new Error('Missing MEWS_ACCESS_TOKEN environment variable');
    return { baseUrl, clientToken, accessToken, clientName, envRateId };
}
async function fetchPrices(first, last, opts) {
    const { baseUrl, clientToken, accessToken, clientName, envRateId } = getPricingEnv();
    const rateId = opts?.rateId || envRateId;
    const requestBody = {
        ClientToken: clientToken,
        AccessToken: accessToken,
        Client: clientName,
        FirstTimeUnitStartUtc: (0, mews_1.toTimeUnitUtc)(first),
        LastTimeUnitStartUtc: (0, mews_1.toTimeUnitUtc)(last),
    };
    if (rateId)
        requestBody.RateId = rateId;
    const url = `${baseUrl}/api/connector/v1/rates/getPricing`;
    const resp = await axios_1.default.post(url, requestBody, { timeout: 20000 });
    return {
        Currency: resp.data?.Currency ?? null,
        BaseAmountPrices: resp.data?.BaseAmountPrices ?? null,
        CategoryAdjustments: resp.data?.CategoryAdjustments ?? null,
        CategoryPrices: resp.data?.CategoryPrices ?? null,
        _raw: resp.data,
    };
}

// lib/prices.ts
import axios from 'axios';
import { toTimeUnitUtc } from './mews';

export type PricingResponse = {
  Currency?: string | null;
  BaseAmountPrices?: any[] | null;
  CategoryAdjustments?: any[] | null;
  CategoryPrices?: any[] | null;
  _raw?: any;
};

function getPricingEnv() {
  const baseUrl = (process.env.MEWS_BASE_URL || '').trim().replace(/\/$/, '');
  const clientToken = (process.env.MEWS_CLIENT_TOKEN || '').trim();
  const accessToken = (process.env.MEWS_ACCESS_TOKEN || '').trim();
  const clientName = (process.env.MEWS_CLIENT_NAME || 'bno-api').trim();
  const envRateId = (process.env.MEWS_RATE_ID || '').trim() || undefined;

  // Valider her, ikke ved import
  if (!baseUrl) throw new Error('Missing MEWS_BASE_URL environment variable');
  if (!clientToken) throw new Error('Missing MEWS_CLIENT_TOKEN environment variable');
  if (!accessToken) throw new Error('Missing MEWS_ACCESS_TOKEN environment variable');

  return { baseUrl, clientToken, accessToken, clientName, envRateId };
}

export async function fetchPrices(
  first: string | Date,
  last: string | Date,
  opts?: { rateId?: string }
): Promise<PricingResponse> {
  const { baseUrl, clientToken, accessToken, clientName, envRateId } = getPricingEnv();
  const rateId = opts?.rateId || envRateId;

  const requestBody: any = {
    ClientToken: clientToken,
    AccessToken: accessToken,
    Client: clientName,
    FirstTimeUnitStartUtc: toTimeUnitUtc(first),
    LastTimeUnitStartUtc: toTimeUnitUtc(last),
  };

  if (rateId) requestBody.RateId = rateId;

  const url = `${baseUrl}/api/connector/v1/rates/getPricing`;
  const resp = await axios.post(url, requestBody, { timeout: 20000 });

  return {
    Currency: resp.data?.Currency ?? null,
    BaseAmountPrices: resp.data?.BaseAmountPrices ?? null,
    CategoryAdjustments: resp.data?.CategoryAdjustments ?? null,
    CategoryPrices: resp.data?.CategoryPrices ?? null,
    _raw: resp.data,
  };
}
// lib/fetch-mews-prod-ids.ts

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.prod' });

import fetch from 'node-fetch';

type MewsBaseRequest = {
  ClientToken: string;
  AccessToken: string;
  Client: string;
};

const baseUrl = process.env.MEWS_BASE_URL || 'https://api.mews.com';
const clientToken: string = process.env.MEWS_CLIENT_TOKEN ?? '';
const accessToken: string = process.env.MEWS_ACCESS_TOKEN ?? '';
const clientName: string = process.env.MEWS_CLIENT_NAME || 'BNO Travel App 1.0';

if (!clientToken || !accessToken) {
  console.error('Missing MEWS_CLIENT_TOKEN or MEWS_ACCESS_TOKEN in .env.prod');
  process.exit(1);
}

async function callMews<T>(path: string, extraBody: Record<string, any> = {}): Promise<T> {
  const url = `${baseUrl}${path}`;
  const payload: MewsBaseRequest & Record<string, any> = {
    ClientToken: clientToken,
    AccessToken: accessToken,
    Client: clientName,
    ...extraBody,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Mews error ${res.status}: ${text}`);
  }

  return JSON.parse(text) as T;
}

async function main() {
  // 1) Enterprise / basic config
  console.log('Calling configuration/get ...');
  const configuration = await callMews<any>('/api/connector/v1/configuration/get');

  const enterpriseId: string | undefined = configuration.Enterprise?.Id;
  const enterpriseName = configuration.Enterprise?.Name;
  const enterpriseTimeZone = configuration.Enterprise?.TimeZoneIdentifier;
  const enterpriseCurrency = configuration.Enterprise?.Currency;

  console.log('\n=== Enterprise ===');
  console.log('Enterprise name: ', enterpriseName);
  console.log('EnterpriseId:     ', enterpriseId);
  console.log('TimeZone:         ', enterpriseTimeZone);
  console.log('Currency:         ', enterpriseCurrency);

  if (!enterpriseId) {
    console.error('No EnterpriseId found in configuration/get response.');
    process.exit(1);
  }

  // 2) Services
  console.log('\nCalling services/getAll ...');
  const servicesResult = await callMews<any>('/api/connector/v1/services/getAll', {
    EnterpriseIds: [enterpriseId],
    Limitation: { Count: 50 },
  });

  const services = servicesResult.Services || [];
  console.log('\nServices:');
  for (const s of services) {
    console.log(`- ${s.Name} (Type=${s.Data?.Discriminator}) -> Id=${s.Id}`);
  }

  // Vi velger ikke serviceId automatisk her – du har allerede listen i output
  let serviceId: string | undefined = process.env.MEWS_SERVICE_ID;
  if (!serviceId) {
    // Hvis du vil, kan du la den automatisk velge første Bookable:
    const firstBookable = services.find((s: any) => s.Data?.Discriminator === 'Bookable');
    serviceId = firstBookable?.Id;
  }

  console.log('\nUsing serviceId for next calls: ', serviceId);

  // 3) Age categories (valgfritt – men vi håndterer 401)
  let adultCategoryId: string | undefined = undefined;

  if (serviceId) {
    console.log('\nCalling ageCategories/getAll ...');
    try {
      const ageCategoriesResult = await callMews<any>(
        '/api/connector/v1/ageCategories/getAll',
        {
          EnterpriseIds: [enterpriseId],
          ServiceIds: [serviceId],
          Limitation: { Count: 50 },
        },
      );

      const ageCategories = ageCategoriesResult.AgeCategories || [];
      console.log('\nAge categories:');
      for (const c of ageCategories) {
        console.log(`- ${c.Name} (MinAge=${c.MinAge}) -> Id=${c.Id}`);
        if (
          !adultCategoryId &&
          (c.Name?.toLowerCase().includes('adult') || c.MinAge >= 18)
        ) {
          adultCategoryId = c.Id;
        }
      }
    } catch (err: any) {
      console.warn(
        '\nKunne ikke hente ageCategories (sannsynligvis 401 permission). ' +
          'Du kan la MEWS_ADULT_AGE_CATEGORY_ID stå tom eller sette manuelt hvis du får ID fra Mews-support.',
      );
      console.warn(String(err));
    }
  } else {
    console.warn(
      '\nIngen serviceId satt – hopper over ageCategories/getAll og rates/getAll som bruker serviceId.',
    );
  }

  // 4) Rates
  let suggestedRateId: string | undefined = undefined;
  if (serviceId) {
    console.log('\nCalling rates/getAll ...');
    const ratesResult = await callMews<any>('/api/connector/v1/rates/getAll', {
      ServiceIds: [serviceId],
      EnterpriseIds: [enterpriseId],
      Limitation: { Count: 50 },
    });

    const rates = ratesResult.Rates || [];
    console.log('\nRates:');
    for (const r of rates) {
      console.log(`- ${r.Name} (Code=${r.Code}) -> Id=${r.Id}`);
    }

    const suggestedRate = rates[0];
    suggestedRateId = suggestedRate?.Id;
  }

  console.log('\n===== SUGGESTED .env VALUES (copy/paste) =====');
  console.log('MEWS_ENTERPRISE_ID=' + enterpriseId);
  console.log(
    'MEWS_SERVICE_ID=' +
      (serviceId ?? '<<VELG SERVICE-ID FRA SERVICES-LISTEN OVER (Bookable)>>'),
  );
  console.log(
    'MEWS_ADULT_AGE_CATEGORY_ID=' +
      (adultCategoryId ?? '<<KAN STÅ TOM ELLER SATT MANUELT OM KODEN DIN TRENGER DET>>'),
  );
  console.log(
    'MEWS_RATE_ID=' + (suggestedRateId ?? '<<VELG RATE-ID FRA LISTEN OVER (rates)>>'),
  );
  console.log('HOTEL_TIMEZONE=' + (enterpriseTimeZone ?? 'Europe/Oslo'));
  console.log('MEWS_CURRENCY=' + (enterpriseCurrency ?? 'NOK'));

  console.log(
    '\nMerk: MEWS_CONFIGURATION_ID må fortsatt hentes via det endepunktet ' +
      'koden din bruker i dag (samme som i demo-miljøet).',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

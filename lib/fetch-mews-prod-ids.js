"use strict";
// lib/fetch-mews-prod-ids.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: '.env.prod' });
const node_fetch_1 = __importDefault(require("node-fetch"));
const baseUrl = process.env.MEWS_BASE_URL || 'https://api.mews.com';
const clientToken = process.env.MEWS_CLIENT_TOKEN ?? '';
const accessToken = process.env.MEWS_ACCESS_TOKEN ?? '';
const clientName = process.env.MEWS_CLIENT_NAME || 'BNO Travel App 1.0';
if (!clientToken || !accessToken) {
    console.error('Missing MEWS_CLIENT_TOKEN or MEWS_ACCESS_TOKEN in .env.prod');
    process.exit(1);
}
async function callMews(path, extraBody = {}) {
    const url = `${baseUrl}${path}`;
    const payload = {
        ClientToken: clientToken,
        AccessToken: accessToken,
        Client: clientName,
        ...extraBody,
    };
    const res = await (0, node_fetch_1.default)(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Mews error ${res.status}: ${text}`);
    }
    return JSON.parse(text);
}
async function main() {
    // 1) Enterprise / basic config
    console.log('Calling configuration/get ...');
    const configuration = await callMews('/api/connector/v1/configuration/get');
    const enterpriseId = configuration.Enterprise?.Id;
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
    const servicesResult = await callMews('/api/connector/v1/services/getAll', {
        EnterpriseIds: [enterpriseId],
        Limitation: { Count: 50 },
    });
    const services = servicesResult.Services || [];
    console.log('\nServices:');
    for (const s of services) {
        console.log(`- ${s.Name} (Type=${s.Data?.Discriminator}) -> Id=${s.Id}`);
    }
    // Vi velger ikke serviceId automatisk her – du har allerede listen i output
    let serviceId = process.env.MEWS_SERVICE_ID;
    if (!serviceId) {
        // Hvis du vil, kan du la den automatisk velge første Bookable:
        const firstBookable = services.find((s) => s.Data?.Discriminator === 'Bookable');
        serviceId = firstBookable?.Id;
    }
    console.log('\nUsing serviceId for next calls: ', serviceId);
    // 3) Age categories (valgfritt – men vi håndterer 401)
    let adultCategoryId = undefined;
    if (serviceId) {
        console.log('\nCalling ageCategories/getAll ...');
        try {
            const ageCategoriesResult = await callMews('/api/connector/v1/ageCategories/getAll', {
                EnterpriseIds: [enterpriseId],
                ServiceIds: [serviceId],
                Limitation: { Count: 50 },
            });
            const ageCategories = ageCategoriesResult.AgeCategories || [];
            console.log('\nAge categories:');
            for (const c of ageCategories) {
                console.log(`- ${c.Name} (MinAge=${c.MinAge}) -> Id=${c.Id}`);
                if (!adultCategoryId &&
                    (c.Name?.toLowerCase().includes('adult') || c.MinAge >= 18)) {
                    adultCategoryId = c.Id;
                }
            }
        }
        catch (err) {
            console.warn('\nKunne ikke hente ageCategories (sannsynligvis 401 permission). ' +
                'Du kan la MEWS_ADULT_AGE_CATEGORY_ID stå tom eller sette manuelt hvis du får ID fra Mews-support.');
            console.warn(String(err));
        }
    }
    else {
        console.warn('\nIngen serviceId satt – hopper over ageCategories/getAll og rates/getAll som bruker serviceId.');
    }
    // 4) Rates
    let suggestedRateId = undefined;
    if (serviceId) {
        console.log('\nCalling rates/getAll ...');
        const ratesResult = await callMews('/api/connector/v1/rates/getAll', {
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
    console.log('MEWS_SERVICE_ID=' +
        (serviceId ?? '<<VELG SERVICE-ID FRA SERVICES-LISTEN OVER (Bookable)>>'));
    console.log('MEWS_ADULT_AGE_CATEGORY_ID=' +
        (adultCategoryId ?? '<<KAN STÅ TOM ELLER SATT MANUELT OM KODEN DIN TRENGER DET>>'));
    console.log('MEWS_RATE_ID=' + (suggestedRateId ?? '<<VELG RATE-ID FRA LISTEN OVER (rates)>>'));
    console.log('HOTEL_TIMEZONE=' + (enterpriseTimeZone ?? 'Europe/Oslo'));
    console.log('MEWS_CURRENCY=' + (enterpriseCurrency ?? 'NOK'));
    console.log('\nMerk: MEWS_CONFIGURATION_ID må fortsatt hentes via det endepunktet ' +
        'koden din bruker i dag (samme som i demo-miljøet).');
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});

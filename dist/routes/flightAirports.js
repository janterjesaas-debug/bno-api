"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const duffel_1 = require("../lib/duffel");
const router = (0, express_1.Router)();
const FALLBACK_AIRPORTS = [
    { iataCode: 'OSL', name: 'Gardermoen', cityName: 'Oslo', countryName: 'Norge' },
    { iataCode: 'TRD', name: 'Værnes', cityName: 'Trondheim', countryName: 'Norge' },
    { iataCode: 'BGO', name: 'Flesland', cityName: 'Bergen', countryName: 'Norge' },
    { iataCode: 'AES', name: 'Vigra', cityName: 'Ålesund', countryName: 'Norge' },
    { iataCode: 'SCR', name: 'Scandinavian Mountains Airport', cityName: 'Sälen', countryName: 'Sverige' },
    { iataCode: 'ARN', name: 'Arlanda', cityName: 'Stockholm', countryName: 'Sverige' },
    { iataCode: 'CPH', name: 'Kastrup', cityName: 'København', countryName: 'Danmark' },
    { iataCode: 'AMS', name: 'Schiphol', cityName: 'Amsterdam', countryName: 'Nederland' },
    { iataCode: 'LGW', name: 'Gatwick', cityName: 'London', countryName: 'Storbritannia' },
    { iataCode: 'LHR', name: 'Heathrow', cityName: 'London', countryName: 'Storbritannia' },
    { iataCode: 'HEL', name: 'Helsinki Airport', cityName: 'Helsinki', countryName: 'Finland' },
    { iataCode: 'TLL', name: 'Tallinn Airport', cityName: 'Tallinn', countryName: 'Estland' },
    { iataCode: 'RIX', name: 'Riga International', cityName: 'Riga', countryName: 'Latvia' },
    { iataCode: 'VNO', name: 'Vilnius Airport', cityName: 'Vilnius', countryName: 'Litauen' },
    { iataCode: 'WAW', name: 'Chopin Airport', cityName: 'Warszawa', countryName: 'Polen' },
    { iataCode: 'BER', name: 'Berlin Brandenburg', cityName: 'Berlin', countryName: 'Tyskland' },
    { iataCode: 'CDG', name: 'Charles de Gaulle', cityName: 'Paris', countryName: 'Frankrike' },
    { iataCode: 'FRA', name: 'Frankfurt Airport', cityName: 'Frankfurt', countryName: 'Tyskland' },
    { iataCode: 'JFK', name: 'John F. Kennedy', cityName: 'New York', countryName: 'USA' },
    { iataCode: 'LAX', name: 'Los Angeles International', cityName: 'Los Angeles', countryName: 'USA' },
    { iataCode: 'MIA', name: 'Miami International', cityName: 'Miami', countryName: 'USA' },
    { iataCode: 'BOS', name: 'Logan International', cityName: 'Boston', countryName: 'USA' },
];
function normalizeAirport(airport) {
    return {
        id: airport.id,
        iataCode: airport.iata_code || '',
        name: airport.name || '',
        cityName: airport.city_name || airport.city?.name || '',
        cityIataCode: airport.iata_city_code || airport.city?.iata_code || '',
        countryName: airport.iata_country_code || airport.country_name || '',
        displayName: [
            airport.city_name || airport.city?.name || '',
            airport.name || '',
            airport.iata_code ? `(${airport.iata_code})` : '',
        ]
            .filter(Boolean)
            .join(' – '),
    };
}
function fallbackSearch(query) {
    const q = query.trim().toLowerCase();
    return FALLBACK_AIRPORTS.filter((airport) => {
        const hay = `${airport.cityName} ${airport.name} ${airport.iataCode} ${airport.countryName || ''}`.toLowerCase();
        return hay.includes(q);
    }).map((airport) => ({
        id: `fallback_${airport.iataCode.toLowerCase()}`,
        iataCode: airport.iataCode,
        name: airport.name,
        cityName: airport.cityName,
        cityIataCode: '',
        countryName: airport.countryName,
        displayName: `${airport.cityName} – ${airport.name} (${airport.iataCode})`,
    }));
}
router.get('/airports', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        if (!q || q.length < 2) {
            return res.json({
                ok: true,
                data: [],
            });
        }
        let items = [];
        try {
            const result = await duffel_1.duffel.airports.list({
                limit: 20,
                name: q,
            });
            items = (result?.data || []).map(normalizeAirport);
        }
        catch (apiError) {
            console.error('[DUFFEL] airport search failed', apiError?.errors || apiError?.message || apiError);
        }
        const fallbackItems = fallbackSearch(q);
        const mergedMap = new Map();
        for (const item of [...items, ...fallbackItems]) {
            const key = String(item.iataCode || '').trim().toUpperCase();
            if (!key)
                continue;
            if (!mergedMap.has(key)) {
                mergedMap.set(key, item);
            }
        }
        const merged = Array.from(mergedMap.values());
        return res.json({
            ok: true,
            data: merged,
        });
    }
    catch (e) {
        console.error('[DUFFEL] airport search failed', e?.errors || e?.message || e);
        return res.status(500).json({
            ok: false,
            error: 'duffel_airport_search_failed',
            detail: e?.message || 'Duffel airport search failed',
            errors: e?.errors || null,
        });
    }
});
exports.default = router;

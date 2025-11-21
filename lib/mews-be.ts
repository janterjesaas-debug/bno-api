// lib/mews-be.ts
import axios from 'axios';

type LocaleString = Record<string, string>;

export type RoomCategory = {
  Id: string;
  Name: LocaleString;
  Description?: LocaleString;
  SpaceType?: string;
  NormalBedCount?: number;
  ExtraBedCount?: number;
};

export type Rate = {
  Id: string;
  Name?: LocaleString;
};

export type AvailabilityPricing = {
  RateId: string;
  Price: Record<string, { GrossValue: number; NetValue?: number }>;
};

export type RoomOccupancyAvailability = {
  AdultCount: number;
  ChildCount: number;
  Pricing: AvailabilityPricing[];
};

export type RoomCategoryAvailability = {
  RoomCategoryId: string;
  AvailableRoomCount: number;
  RoomOccupancyAvailabilities: RoomOccupancyAvailability[];
};

function required(name: string): string {
  const v = (process.env[name] || '').trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const BE_BASE = required('MEWS_BE_BASE_URL');

export async function beGetHotel() {
  const HotelId = required('MEWS_HOTEL_ID');
  const Client = process.env.MEWS_CLIENT_NAME || 'BNO Travel Booking 1.0.0';

  const url = `${BE_BASE}/api/distributor/v1/hotels/get`;
  const { data } = await axios.post(url, { Client, HotelId }, {
    headers: { 'Content-Type': 'application/json' },
  });

  // Viktige felter vi bruker videre
  return {
    hotel: {
      Id: data?.Id,
      Name: data?.Name as LocaleString | undefined,
      Description: data?.Description as LocaleString | undefined,
    },
    roomCategories: (data?.RoomCategories || []) as RoomCategory[],
    rates: (data?.Rates || []) as Rate[],
  };
}

export async function beGetAvailability(startYmd: string, endYmd: string, adults: number) {
  const HotelId = required('MEWS_HOTEL_ID');
  const ConfigurationId = required('MEWS_CONFIGURATION_ID');
  const AdultAgeId = required('MEWS_ADULT_AGE_CATEGORY_ID');

  const Client = process.env.MEWS_CLIENT_NAME || 'BNO Travel Booking 1.0.0';
  const CurrencyCode = (process.env.MEWS_CURRENCY || 'GBP').toUpperCase();

  // Booking Engine krever StartUtc/EndUtc i ISO UTC.
  // Vi bruker T00:00:00Z for enkelhet; BE gjør hotell-tidsone-håndtering server-side.
  const StartUtc = `${startYmd}T00:00:00Z`;
  const EndUtc = `${endYmd}T00:00:00Z`;

  const url = `${BE_BASE}/api/distributor/v1/hotels/getAvailability`;

  const payload = {
    Client,
    ConfigurationId,
    HotelId,
    StartUtc,
    EndUtc,
    CurrencyCode,
    // Minste sett for 2 voksne (ingen barn). Du kan utvide for flere kombinasjoner.
    OccupancyData: [
      { AgeCategoryId: AdultAgeId, PersonCount: adults },
    ],
  };

  const { data } = await axios.post(url, payload, {
    headers: { 'Content-Type': 'application/json' },
    validateStatus: () => true, // vi håndterer 4xx manuelt under
  });

  if (data?.Message) {
    // Typisk BE-feil kommer i dette formatet
    const err = new Error(data.Message) as any;
    err.mewsBody = data;
    throw err;
  }

  return {
    datesUtc: data?.DatesUtc as string[] | undefined,
    categoryAvail: (data?.RoomCategoryAvailabilities || []) as RoomCategoryAvailability[],
    rates: (data?.Rates || []) as Rate[],
  };
}

/**
 * Slår sammen kategorigrunndata + BE-tilgjengelighet/priser.
 * Returnerer et "visningsvennlig" array der hver entry tilsvarer en kategori,
 * med navn/beskrivelse/type/kapasitet, antall ledige og priser.
 */
export function mergeCategoriesAndAvailability(
  roomCategories: RoomCategory[],
  avail: RoomCategoryAvailability[],
  rates: Rate[],
  currency: string
) {
  const rateNameById = new Map<string, string>();
  for (const r of rates) {
    // Velg "en-US" først, ellers første tilgjengelige locale
    const name =
      (r.Name && (r.Name['en-US'] || Object.values(r.Name)[0])) ||
      '';
    rateNameById.set(r.Id, name);
  }

  return avail.map((a) => {
    const cat = roomCategories.find(c => c.Id === a.RoomCategoryId);

    // Finn første pricing-blokk for den etterspurte "adults"-kombinasjonen
    const firstOcc = a.RoomOccupancyAvailabilities?.[0];
    const prices =
      (firstOcc?.Pricing || []).map(p => {
        const priceObj = p.Price?.[currency] || p.Price?.[Object.keys(p.Price || {})[0]];
        return {
          rateId: p.RateId,
          rateName: rateNameById.get(p.RateId) || '',
          gross: priceObj?.GrossValue ?? null,
          net: priceObj?.NetValue ?? null,
        };
      });

    const capacity = (cat?.NormalBedCount || 0) + (cat?.ExtraBedCount || 0);

    return {
      categoryId: a.RoomCategoryId,
      name: (cat?.Name && (cat.Name['en-US'] || Object.values(cat.Name)[0])) || '',
      description:
        (cat?.Description && (cat.Description['en-US'] || Object.values(cat.Description)[0])) || '',
      spaceType: cat?.SpaceType || '',
      capacity,
      availableCount: a.AvailableRoomCount,
      prices, // [{rateId, rateName, gross, net}]
    };
  });
}

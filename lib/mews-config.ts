// lib/mews-config.ts
//
// Mapping fra "område" (slug) til riktige Mews-IDer.
// Vi leser verdier fra .env (.env.prod i prod).

export type MewsAreaSlug =
  | "TRYSIL_TURISTSENTER"
  | "TRYSIL_HOYFJELLSSENTER"
  | "TRYSILFJELL_HYTTEOMRADE"
  | "TANDADALEN_SALEN"
  | "HOGFJALLET_SALEN"
  | "LINDVALLEN_SALEN";

export interface MewsAreaConfig {
  slug: MewsAreaSlug;
  name: string;
  serviceId: string;
  rateId: string;
  adultAgeCategoryId: string;
  distributionConfigurationId: string;
}

// Enkel helper som kaster om env mangler
function env(name: string): string {
  const value = (process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

// Default-område når frontend ikke sender noe / sender ukjent verdi
export const DEFAULT_MEWS_AREA: MewsAreaSlug = "TRYSIL_TURISTSENTER";

// Alle områder vi støtter i appen
const AREAS: Record<MewsAreaSlug, MewsAreaConfig> = {
  TRYSIL_TURISTSENTER: {
    slug: "TRYSIL_TURISTSENTER",
    name: "Trysil Turistsenter",
    serviceId: env("MEWS_SERVICE_ID_TRYSIL_TURISTSENTER"),
    rateId: env("MEWS_RATE_ID_TRYSIL_TURISTSENTER"),
    adultAgeCategoryId: env("MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_TURISTSENTER"),
    distributionConfigurationId: env(
      "MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSIL_TURISTSENTER"
    ),
  },
  TRYSIL_HOYFJELLSSENTER: {
    slug: "TRYSIL_HOYFJELLSSENTER",
    name: "Trysil Høyfjellssenter",
    serviceId: env("MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER"),
    rateId: env("MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER"),
    adultAgeCategoryId: env(
      "MEWS_ADULT_AGE_CATEGORY_ID_TRYSIL_HOYFJELLSSENTER"
    ),
    distributionConfigurationId: env(
      "MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSIL_HOYFJELLSSENTER"
    ),
  },
  TRYSILFJELL_HYTTEOMRADE: {
    slug: "TRYSILFJELL_HYTTEOMRADE",
    name: "Trysilfjell Hytteområde",
    serviceId: env("MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE"),
    rateId: env("MEWS_RATE_ID_TRYSILFJELL_HYTTEOMRADE"),
    adultAgeCategoryId: env(
      "MEWS_ADULT_AGE_CATEGORY_ID_TRYSILFJELL_HYTTEOMRADE"
    ),
    distributionConfigurationId: env(
      "MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSILFJELL_HYTTEOMRADE"
    ),
  },
  TANDADALEN_SALEN: {
    slug: "TANDADALEN_SALEN",
    name: "Tandådalen Sälen",
    serviceId: env("MEWS_SERVICE_ID_TANDADALEN_SALEN"),
    rateId: env("MEWS_RATE_ID_TANDADALEN_SALEN"),
    adultAgeCategoryId: env(
      "MEWS_ADULT_AGE_CATEGORY_ID_TANDADALEN_SALEN"
    ),
    distributionConfigurationId: env(
      "MEWS_DISTRIBUTION_CONFIGURATION_ID_TANDADALEN_SALEN"
    ),
  },
  HOGFJALLET_SALEN: {
    slug: "HOGFJALLET_SALEN",
    name: "Högfjället Sälen",
    serviceId: env("MEWS_SERVICE_ID_HOGFJALLET_SALEN"),
    rateId: env("MEWS_RATE_ID_HOGFJALLET_SALEN"),
    adultAgeCategoryId: env(
      "MEWS_ADULT_AGE_CATEGORY_ID_HOGFJALLET_SALEN"
    ),
    distributionConfigurationId: env(
      "MEWS_DISTRIBUTION_CONFIGURATION_ID_HOGFJALLET_SALEN"
    ),
  },
  LINDVALLEN_SALEN: {
    slug: "LINDVALLEN_SALEN",
    name: "Lindvallen Sälen",
    serviceId: env("MEWS_SERVICE_ID_LINDVALLEN_SALEN"),
    rateId: env("MEWS_RATE_ID_LINDVALLEN_SALEN"),
    adultAgeCategoryId: env(
      "MEWS_ADULT_AGE_CATEGORY_ID_LINDVALLEN_SALEN"
    ),
    distributionConfigurationId: env(
      "MEWS_DISTRIBUTION_CONFIGURATION_ID_LINDVALLEN_SALEN"
    ),
  },
};

/**
 * Finn config for valgt område.
 * Tar imot f.eks. "trysil_turistsenter" eller "TRYSIL_TURISTSENTER".
 * Ukjent/verdi mangler → default (Trysil Turistsenter).
 */
export function getMewsConfigForArea(
  slug?: string | null
): MewsAreaConfig {
  const normalized = (slug || "").toUpperCase() as MewsAreaSlug;

  if (normalized && (normalized as MewsAreaSlug) in AREAS) {
    return AREAS[normalized];
  }

  return AREAS[DEFAULT_MEWS_AREA];
}

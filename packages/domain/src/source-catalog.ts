import type {
  ProcurementSource,
  SourceCatalogItem,
  SupportedCountry,
  SupportedCountryCode
} from "./types.js";

export const DEFAULT_SELECTED_COUNTRY_CODES: SupportedCountryCode[] = ["BG"];

export const SUPPORTED_COUNTRIES: SupportedCountry[] = [
  { code: "BG", name: "Bulgaria", region: "home" },
  { code: "RO", name: "Romania", region: "balkans" },
  { code: "GR", name: "Greece", region: "balkans" },
  { code: "RS", name: "Serbia", region: "balkans" },
  { code: "MK", name: "North Macedonia", region: "balkans" },
  { code: "HR", name: "Croatia", region: "balkans" },
  { code: "SI", name: "Slovenia", region: "balkans" },
  { code: "AL", name: "Albania", region: "balkans" },
  { code: "BA", name: "Bosnia and Herzegovina", region: "balkans" },
  { code: "ME", name: "Montenegro", region: "balkans" },
  { code: "GB", name: "United Kingdom", region: "global" },
  { code: "US", name: "United States", region: "global" },
  { code: "CA", name: "Canada", region: "global" },
  { code: "AU", name: "Australia", region: "global" }
];

export const SOURCE_CATALOG: SourceCatalogItem[] = [
  {
    id: "bg-cais-eop",
    displayName: "CAIS EOP / AOP Bulgaria",
    family: "national-portal",
    baseUrl: "https://app.eop.bg",
    countryCode: "BG",
    legacySource: "cais-eop",
    isInternational: false,
    supportsDocuments: true,
    supportsAwards: true,
    supportsChanges: true,
    requiresApiKey: false,
    requiresRegistration: false,
    defaultEnabled: true
  },
  {
    id: "eu-ted",
    displayName: "TED",
    family: "eu",
    baseUrl: "https://ted.europa.eu",
    legacySource: "ted",
    isInternational: true,
    supportsDocuments: true,
    supportsAwards: true,
    supportsChanges: true,
    requiresApiKey: false,
    requiresRegistration: false,
    defaultEnabled: true
  },
  {
    id: "eu-sedia",
    displayName: "EU Funding & Tenders",
    family: "eu",
    baseUrl: "https://ec.europa.eu/info/funding-tenders/opportunities/portal/",
    legacySource: "sedia",
    isInternational: true,
    supportsDocuments: true,
    supportsAwards: false,
    supportsChanges: true,
    requiresApiKey: false,
    requiresRegistration: false,
    defaultEnabled: true
  },
  {
    id: "opentender-ocds",
    displayName: "OpenTender / OCDS",
    family: "ocds",
    baseUrl: "https://data.open-contracting.org",
    isInternational: true,
    supportsDocuments: false,
    supportsAwards: true,
    supportsChanges: true,
    requiresApiKey: false,
    requiresRegistration: false,
    defaultEnabled: false
  },
  {
    id: "worldbank",
    displayName: "World Bank Procurement",
    family: "ifis",
    baseUrl: "https://projects.worldbank.org/en/projects-operations/procurement",
    isInternational: true,
    supportsDocuments: true,
    supportsAwards: true,
    supportsChanges: true,
    requiresApiKey: false,
    requiresRegistration: false,
    defaultEnabled: false
  },
  {
    id: "ungm",
    displayName: "UNGM",
    family: "ifis",
    baseUrl: "https://www.ungm.org/public/notice",
    isInternational: true,
    supportsDocuments: true,
    supportsAwards: true,
    supportsChanges: true,
    requiresApiKey: false,
    requiresRegistration: false,
    defaultEnabled: false
  },
  {
    id: "ebrd-ecepp",
    displayName: "EBRD / ECEPP",
    family: "ifis",
    baseUrl: "https://ecepp.ebrd.com",
    isInternational: true,
    supportsDocuments: true,
    supportsAwards: true,
    supportsChanges: true,
    requiresApiKey: false,
    requiresRegistration: true,
    defaultEnabled: false
  },
  {
    id: "nato-procurement",
    displayName: "NATO Procurement",
    family: "defence",
    baseUrl:
      "https://www.nato.int/en/work-with-us/business-and-project-opportunities/procurement-opportunities",
    isInternational: true,
    supportsDocuments: true,
    supportsAwards: true,
    supportsChanges: true,
    requiresApiKey: false,
    requiresRegistration: true,
    defaultEnabled: false
  },
  nationalSource("ro-seap", "Romania SEAP/SICAP", "RO", "https://www.e-licitatie.ro/"),
  nationalSource("gr-esidis", "Greece ESIDIS", "GR", "https://www.eprocurement.gov.gr/"),
  nationalSource(
    "rs-jnportal",
    "Serbia Public Procurement Portal",
    "RS",
    "https://jnportal.ujn.gov.rs/"
  ),
  nationalSource(
    "mk-enabavki",
    "North Macedonia e-Nabavki",
    "MK",
    "https://e-nabavki.gov.mk/"
  ),
  nationalSource("hr-eojn", "Croatia EOJN RH", "HR", "https://eojn.nn.hr/"),
  nationalSource("si-ejn", "Slovenia e-JN", "SI", "https://ejn.gov.si/en/"),
  nationalSource(
    "al-app",
    "Albania Public Procurement Agency",
    "AL",
    "https://app.gov.al/home/"
  ),
  nationalSource("ba-ejn", "Bosnia and Herzegovina eJN", "BA", "https://www.ejn.gov.ba/"),
  nationalSource("me-cejn", "Montenegro CeJN", "ME", "https://cejn.gov.me/"),
  nationalSource(
    "uk-contracts-finder",
    "UK Contracts Finder",
    "GB",
    "https://www.contractsfinder.service.gov.uk/"
  ),
  nationalSource(
    "sam-gov",
    "SAM.gov Opportunities",
    "US",
    "https://sam.gov/opportunities"
  ),
  nationalSource("canadabuys", "CanadaBuys", "CA", "https://canadabuys.canada.ca/en"),
  nationalSource("austender", "AusTender", "AU", "https://www.tenders.gov.au/"),
  {
    id: "grants-gov",
    displayName: "Grants.gov",
    family: "grant",
    baseUrl: "https://grants.gov",
    countryCode: "US",
    isInternational: false,
    supportsDocuments: true,
    supportsAwards: false,
    supportsChanges: true,
    requiresApiKey: true,
    requiresRegistration: false,
    defaultEnabled: false
  }
];

export const INTERNATIONAL_SOURCE_IDS = SOURCE_CATALOG.filter(
  (source) => source.isInternational
).map((source) => source.id);

export function isSupportedCountryCode(value: string): value is SupportedCountryCode {
  return SUPPORTED_COUNTRIES.some((country) => country.code === value);
}

export function normalizeCountryCode(value: string): SupportedCountryCode | undefined {
  const normalized = value.trim().toUpperCase();
  const mapped = COUNTRY_CODE_ALIASES[normalized] ?? normalized;

  return isSupportedCountryCode(mapped) ? mapped : undefined;
}

export function normalizeCountryCodes(values: readonly string[]): SupportedCountryCode[] {
  const countryCodes: SupportedCountryCode[] = [];

  for (const value of values) {
    const countryCode = normalizeCountryCode(value);
    if (countryCode && !countryCodes.includes(countryCode)) {
      countryCodes.push(countryCode);
    }
  }

  return countryCodes.length > 0 ? countryCodes : DEFAULT_SELECTED_COUNTRY_CODES;
}

export function getSourceCatalogItem(sourceId: string): SourceCatalogItem | undefined {
  return SOURCE_CATALOG.find((source) => source.id === sourceId);
}

export function getSourceIdForLegacySource(source: ProcurementSource): string {
  return (
    SOURCE_CATALOG.find((entry) => entry.legacySource === source)?.id ??
    `legacy-${source}`
  );
}

export function getSourceDisplayName(sourceId: string | undefined): string | undefined {
  return sourceId ? getSourceCatalogItem(sourceId)?.displayName : undefined;
}

export function getSourceCountryCodeForLegacySource(
  source: ProcurementSource
): SupportedCountryCode | undefined {
  return SOURCE_CATALOG.find((entry) => entry.legacySource === source)?.countryCode;
}

export function normalizeSourceIds(values: readonly string[]): string[] {
  const sourceIds: string[] = [];

  for (const value of values) {
    const sourceId = value.trim();
    if (sourceId && SOURCE_CATALOG.some((source) => source.id === sourceId)) {
      sourceIds.push(sourceId);
    }
  }

  return [...new Set(sourceIds)];
}

function nationalSource(
  id: string,
  displayName: string,
  countryCode: SupportedCountryCode,
  baseUrl: string
): SourceCatalogItem {
  return {
    id,
    displayName,
    family: "national-portal",
    baseUrl,
    countryCode,
    isInternational: false,
    supportsDocuments: true,
    supportsAwards: true,
    supportsChanges: true,
    requiresApiKey: false,
    requiresRegistration: false,
    defaultEnabled: false
  };
}

const COUNTRY_CODE_ALIASES: Record<string, SupportedCountryCode> = {
  ALB: "AL",
  AUS: "AU",
  BIH: "BA",
  BGR: "BG",
  CAN: "CA",
  GBR: "GB",
  UK: "GB",
  EL: "GR",
  GRC: "GR",
  HRV: "HR",
  MNE: "ME",
  MKD: "MK",
  ROU: "RO",
  RSR: "RS",
  SRB: "RS",
  SVN: "SI",
  USA: "US"
};

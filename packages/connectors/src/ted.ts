import { z } from "zod";

import { defaultFetcher, fetchJson, type Fetcher } from "./http.js";

export interface TedClientOptions {
  baseUrl?: string;
  fetcher?: Fetcher;
}

export interface TedSearchRequest {
  query: string;
  fields: string[];
  limit?: number;
  page?: number;
  scope?: "ACTIVE" | "ALL";
  onlyLatestVersions?: boolean;
  paginationMode?: "PAGE_NUMBER" | "ITERATION";
  iterationNextToken?: string;
}

export type TedNotice = Record<string, unknown>;

export interface TedSearchResponse {
  totalNoticeCount?: number;
  notices: TedNotice[];
  iterationNextToken?: string;
}

const TedSearchResponseSchema = z
  .object({
    totalNoticeCount: z.number().optional(),
    notices: z.array(z.record(z.string(), z.unknown())).default([]),
    iterationNextToken: z.string().optional()
  })
  .passthrough();

export const TED_SOFTWARE_FIELDS = [
  "publication-number",
  "notice-title",
  "title-glo",
  "title-proc",
  "title-lot",
  "announcement-title",
  "contract-title",
  "description-glo",
  "description-proc",
  "description-lot",
  "additional-info-glo",
  "additional-info-proc",
  "additional-information-lot",
  "selection-criterion-description-lot",
  "contract-conditions-description-lot",
  "guarantee-required-description-lot",
  "document-url-lot",
  "document-url-part",
  "document-restricted-url-lot",
  "document-restricted-url-part",
  "submission-url-lot",
  "eu-funds-name",
  "eu-funds-programme-lot",
  "eu-funds-details-lot",
  "buyer-name",
  "buyer-country",
  "classification-cpv",
  "publication-date",
  "deadline-receipt-tender-date-lot",
  "deadline-receipt-request",
  "notice-type",
  "procedure-type",
  "contract-nature",
  "estimated-value-proc",
  "estimated-value-cur-proc",
  "estimated-value-lot",
  "estimated-value-cur-lot",
  "links"
] as const;

export const TED_SOFTWARE_CPV_PREFIXES = [
  "72",
  "48",
  "723",
  "724",
  "726",
  "727",
  "728",
  "729",
  "793",
  "794"
] as const;

export const TED_ICT_CPV_PREFIXES = [
  ...TED_SOFTWARE_CPV_PREFIXES,
  "30",
  "302",
  "323",
  "324",
  "325",
  "386",
  "488",
  "503",
  "5033",
  "713"
] as const;

export const DEFAULT_TED_MARKET_COUNTRY_CODES = [
  "BGR",
  "ROU",
  "GRC",
  "HRV",
  "SVN",
  "MNE",
  "AUT",
  "BEL",
  "DEU",
  "DNK",
  "ESP",
  "FIN",
  "FRA",
  "IRL",
  "ITA",
  "LUX",
  "NLD",
  "PRT",
  "SWE"
] as const;

export class TedClient {
  private readonly baseUrl: URL;
  private readonly fetcher: Fetcher;

  public constructor(options: TedClientOptions = {}) {
    this.baseUrl = new URL(options.baseUrl ?? "https://api.ted.europa.eu");
    this.fetcher = options.fetcher ?? defaultFetcher;
  }

  public async searchNotices(request: TedSearchRequest): Promise<TedSearchResponse> {
    const url = new URL("/v3/notices/search", this.baseUrl);
    const response = await fetchJson<unknown>(this.fetcher, url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...request,
        limit: request.limit ?? 250,
        scope: request.scope ?? "ACTIVE",
        onlyLatestVersions: request.onlyLatestVersions ?? true,
        paginationMode: request.paginationMode ?? "ITERATION"
      })
    });
    const parsed = TedSearchResponseSchema.parse(response);

    return {
      notices: parsed.notices,
      ...(parsed.totalNoticeCount !== undefined
        ? { totalNoticeCount: parsed.totalNoticeCount }
        : {}),
      ...(parsed.iterationNextToken !== undefined
        ? { iterationNextToken: parsed.iterationNextToken }
        : {})
    };
  }

  public async searchAllNotices(
    request: TedSearchRequest,
    options: { maxPages?: number } = {}
  ): Promise<TedSearchResponse> {
    const maxPages = options.maxPages ?? 20;
    const notices: TedNotice[] = [];
    let totalNoticeCount: number | undefined;
    let iterationNextToken = request.iterationNextToken;

    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
      const response = await this.searchNotices({
        ...request,
        paginationMode: "ITERATION",
        ...(iterationNextToken ? { iterationNextToken } : {})
      });

      notices.push(...response.notices);
      totalNoticeCount = response.totalNoticeCount ?? totalNoticeCount;
      iterationNextToken = response.iterationNextToken;

      if (!iterationNextToken || response.notices.length === 0) {
        break;
      }
    }

    return {
      notices,
      ...(totalNoticeCount !== undefined ? { totalNoticeCount } : {}),
      ...(iterationNextToken ? { iterationNextToken } : {})
    };
  }
}

export function buildBulgarianSoftwareTedQuery(
  publicationDateFrom: string,
  publicationDateTo = publicationDateFrom
): string {
  return buildTedIctQuery({
    buyerCountryCodes: ["BGR"],
    publicationDateFrom,
    publicationDateTo,
    cpvPrefixes: TED_SOFTWARE_CPV_PREFIXES
  });
}

export function buildTedIctQuery({
  buyerCountryCodes,
  publicationDateFrom,
  publicationDateTo = publicationDateFrom,
  cpvPrefixes = TED_ICT_CPV_PREFIXES
}: {
  buyerCountryCodes: readonly string[];
  publicationDateFrom: string;
  publicationDateTo?: string;
  cpvPrefixes?: readonly string[];
}): string {
  const normalizedBuyerCountryCodes = normalizeTedBuyerCountryCodes(buyerCountryCodes);
  const cpvFilter = [...new Set(cpvPrefixes)]
    .map((prefix) => `classification-cpv = ${prefix}*`)
    .join(" OR ");
  const buyerCountryFilter =
    normalizedBuyerCountryCodes.length === 1
      ? `buyer-country = ${normalizedBuyerCountryCodes[0]}`
      : `buyer-country IN (${normalizedBuyerCountryCodes.join(" ")})`;
  const filters = [
    `(${cpvFilter})`,
    buyerCountryFilter,
    `publication-date >= ${publicationDateFrom}`,
    `publication-date <= ${publicationDateTo}`,
    "notice-type IN (cn-standard cn-social)"
  ];

  return `${filters.join(" AND ")} SORT BY publication-date DESC`;
}

function normalizeTedBuyerCountryCodes(values: readonly string[]): string[] {
  const countryCodes = values
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^[A-Z]{3}$/.test(value));

  return countryCodes.length > 0
    ? [...new Set(countryCodes)]
    : [...DEFAULT_TED_MARKET_COUNTRY_CODES];
}

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
  const cpvFilter = TED_SOFTWARE_CPV_PREFIXES.map(
    (prefix) => `classification-cpv = ${prefix}*`
  ).join(" OR ");
  const filters = [
    `(${cpvFilter})`,
    "buyer-country = BGR",
    `publication-date >= ${publicationDateFrom}`,
    `publication-date <= ${publicationDateTo}`,
    "notice-type IN (cn-standard cn-social)"
  ];

  return `${filters.join(" AND ")} SORT BY publication-date DESC`;
}

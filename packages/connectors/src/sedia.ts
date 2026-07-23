import { z } from "zod";

import { defaultFetcher, type Fetcher } from "./http.js";

export interface SediaClientOptions {
  baseUrl?: string;
  fetcher?: Fetcher;
}

export interface SediaSearchRequest {
  text: string;
  pageSize?: number;
  pageNumber?: number;
  types?: readonly string[];
  statuses?: readonly string[];
  displayFields?: readonly string[];
}

export type SediaResult = Record<string, unknown>;

export interface SediaSearchResponse {
  totalResults?: number;
  results: SediaResult[];
}

export const SEDIA_OPEN_STATUSES = ["31094501", "31094502"] as const;
export const SEDIA_TENDER_TYPES = ["0"] as const;
export const SEDIA_DISPLAY_FIELDS = [
  "type",
  "identifier",
  "reference",
  "title",
  "status",
  "startDate",
  "deadlineDate",
  "deadlineModel",
  "caName",
  "url",
  "urlExternal",
  "urlExternalTarget",
  "language",
  "description",
  "programmes",
  "frameworkProgramme",
  "programmePeriod",
  "programmeDivision",
  "contractType",
  "procedureType",
  "typesOfAction",
  "cftId",
  "cftBusinessIdentifier",
  "cftProcedureIdentifier",
  "cftProcedureTypeCode",
  "cftSubmissionMethodCode",
  "topicAbbreviation",
  "placesOfDeliveryOrPerformance"
] as const;
export const DEFAULT_SEDIA_ICT_SEARCH_TERMS = [
  "software",
  "hardware",
  "cybersecurity",
  "cloud",
  "network",
  "data",
  "digital",
  "IT services"
] as const;

const SediaSearchResponseSchema = z
  .object({
    totalResults: z.number().optional(),
    results: z.array(z.record(z.string(), z.unknown())).default([])
  })
  .passthrough();

export class SediaClient {
  private readonly baseUrl: URL;
  private readonly fetcher: Fetcher;

  public constructor(options: SediaClientOptions = {}) {
    this.baseUrl = new URL(
      options.baseUrl ?? "https://api.tech.ec.europa.eu/search-api/prod/rest/search"
    );
    this.fetcher = options.fetcher ?? defaultFetcher;
  }

  public async search(request: SediaSearchRequest): Promise<SediaSearchResponse> {
    const url = new URL(this.baseUrl);
    const pageSize = request.pageSize ?? 25;
    url.searchParams.set("apiKey", "SEDIA");
    url.searchParams.set("text", request.text);
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("pageNumber", String(request.pageNumber ?? 1));

    const form = new FormData();
    appendJson(form, "query", {
      bool: {
        must: [
          { terms: { type: request.types ?? SEDIA_TENDER_TYPES } },
          { terms: { status: request.statuses ?? SEDIA_OPEN_STATUSES } }
        ]
      }
    });
    appendJson(form, "languages", ["en"]);
    appendJson(form, "sort", { order: "DESC", field: "startDate" });
    appendJson(form, "displayFields", request.displayFields ?? SEDIA_DISPLAY_FIELDS);

    const response = await this.fetcher.fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: form
    });

    if (!response.ok) {
      throw new Error(`SEDIA search failed with ${response.status}`);
    }

    const parsed = SediaSearchResponseSchema.parse(await response.json());

    return {
      results: parsed.results,
      ...(parsed.totalResults !== undefined ? { totalResults: parsed.totalResults } : {})
    };
  }

  public async searchAll(
    request: SediaSearchRequest,
    options: { maxPages?: number } = {}
  ): Promise<SediaSearchResponse> {
    const maxPages = options.maxPages ?? 5;
    const pageSize = request.pageSize ?? 50;
    const firstPageNumber = request.pageNumber ?? 1;
    const results: SediaResult[] = [];
    let totalResults: number | undefined;

    for (let pageOffset = 0; pageOffset < maxPages; pageOffset += 1) {
      const response = await this.search({
        ...request,
        pageSize,
        pageNumber: firstPageNumber + pageOffset
      });

      results.push(...response.results);
      totalResults = response.totalResults ?? totalResults;

      if (
        response.results.length === 0 ||
        response.results.length < pageSize ||
        (totalResults !== undefined && results.length >= totalResults)
      ) {
        break;
      }
    }

    return {
      results,
      ...(totalResults !== undefined ? { totalResults } : {})
    };
  }
}

function appendJson(form: FormData, name: string, value: unknown): void {
  form.append(
    name,
    new Blob([JSON.stringify(value)], {
      type: "application/json"
    })
  );
}

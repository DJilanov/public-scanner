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
    url.searchParams.set("apiKey", "SEDIA");
    url.searchParams.set("text", request.text);
    url.searchParams.set("pageSize", String(request.pageSize ?? 25));
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
    appendJson(
      form,
      "displayFields",
      request.displayFields ?? [
        "type",
        "identifier",
        "reference",
        "title",
        "status",
        "startDate",
        "deadlineDate",
        "caName"
      ]
    );

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
}

function appendJson(form: FormData, name: string, value: unknown): void {
  form.append(
    name,
    new Blob([JSON.stringify(value)], {
      type: "application/json"
    })
  );
}

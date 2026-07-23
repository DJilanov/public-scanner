import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

import { defaultFetcher, fetchJson, fetchText, type Fetcher } from "./http.js";

export type CaisOpenDataFileKind =
  "tenders" | "ocds-notices" | "contracts" | "annexes" | "unknown";

export interface CaisOpenDataFile {
  key: string;
  url: string;
  size: number;
  kind: CaisOpenDataFileKind;
  lastModified?: string;
}

export interface CaisOpenDataClientOptions {
  baseUrl?: string;
  fetcher?: Fetcher;
}

const CaisBucketEntrySchema = z.object({
  Key: z.string(),
  LastModified: z.string().optional(),
  Size: z.coerce.number().default(0)
});

const CaisBucketResultSchema = z.object({
  ListBucketResult: z.object({
    Contents: z.union([CaisBucketEntrySchema, z.array(CaisBucketEntrySchema)]).optional()
  })
});

const openDataDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export class CaisOpenDataClient {
  private readonly baseUrl: URL;
  private readonly fetcher: Fetcher;
  private readonly parser: XMLParser;

  public constructor(options: CaisOpenDataClientOptions = {}) {
    this.baseUrl = new URL(options.baseUrl ?? "https://storage.eop.bg");
    this.fetcher = options.fetcher ?? defaultFetcher;
    this.parser = new XMLParser({
      ignoreAttributes: false
    });
  }

  public async listDailyFiles(sourceDate: string): Promise<CaisOpenDataFile[]> {
    const validatedDate = openDataDateSchema.parse(sourceDate);
    const listingUrl = new URL(`/open-data-${validatedDate}/`, this.baseUrl);
    const xml = await fetchText(this.fetcher, listingUrl);
    const parsed = CaisBucketResultSchema.parse(this.parser.parse(xml));
    const contents = parsed.ListBucketResult.Contents;
    const entries = Array.isArray(contents) ? contents : contents ? [contents] : [];

    return entries.map((entry) => ({
      key: entry.Key,
      url: buildObjectUrl(listingUrl, entry.Key),
      size: entry.Size,
      kind: classifyCaisFile(entry.Key),
      ...(entry.LastModified ? { lastModified: entry.LastModified } : {})
    }));
  }

  public async downloadJsonFile(file: CaisOpenDataFile): Promise<unknown> {
    return fetchJson<unknown>(this.fetcher, file.url);
  }
}

function buildObjectUrl(listingUrl: URL, key: string): string {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return new URL(encodedKey, listingUrl).toString();
}

function classifyCaisFile(key: string): CaisOpenDataFileKind {
  const normalizedKey = key.toLocaleLowerCase("bg-BG");

  if (normalizedKey.includes("ocds")) {
    return "ocds-notices";
  }

  if (normalizedKey.includes("\u0430\u043d\u0435\u043a\u0441")) {
    return "annexes";
  }

  if (normalizedKey.includes("\u0434\u043e\u0433\u043e\u0432\u043e\u0440")) {
    return "contracts";
  }

  if (normalizedKey.includes("\u043f\u043e\u0440\u044a\u0447\u043a")) {
    return "tenders";
  }

  return "unknown";
}

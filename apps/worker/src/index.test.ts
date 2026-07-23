import type {
  NormalizedContract,
  NormalizedContractAmendment,
  NormalizedOpportunityLot,
  NormalizedOpportunityWithScore
} from "@public-scanner/domain";
import type {
  IngestionWriteResult,
  SourceErrorInput,
  SourceRunCompletionInput,
  SourceRunInput
} from "@public-scanner/db";
import { describe, expect, it } from "vitest";

import {
  ingestCais,
  ingestTed,
  runBackfill,
  runOnce,
  type CaisDailyClient,
  type IngestionStore,
  type TedNoticeClient
} from "./index.js";

class MemoryIngestionStore implements IngestionStore {
  public readonly opportunities: NormalizedOpportunityWithScore[] = [];
  public readonly lots: NormalizedOpportunityLot[] = [];
  public readonly contracts: NormalizedContract[] = [];
  public readonly amendments: NormalizedContractAmendment[] = [];
  public readonly sourceErrors: SourceErrorInput[] = [];
  public readonly completions: SourceRunCompletionInput[] = [];
  private sourceRunSequence = 0;

  public async createSourceRun(_input: SourceRunInput): Promise<string> {
    this.sourceRunSequence += 1;
    return `source-run-${this.sourceRunSequence}`;
  }

  public async finishSourceRun(
    _sourceRunId: string,
    input: SourceRunCompletionInput
  ): Promise<void> {
    this.completions.push(input);
  }

  public async insertRawDocument(): Promise<string> {
    return "raw-document-1";
  }

  public async insertSourceError(input: SourceErrorInput): Promise<void> {
    this.sourceErrors.push(input);
  }

  public async upsertOpportunity(
    opportunity: NormalizedOpportunityWithScore
  ): Promise<{ id: string; inserted: boolean }> {
    this.opportunities.push(opportunity);
    return {
      id: opportunity.externalId,
      inserted: true
    };
  }

  public async upsertLot(
    lot: NormalizedOpportunityLot
  ): Promise<IngestionWriteResult | undefined> {
    this.lots.push(lot);
    return { inserted: true };
  }

  public async upsertContract(
    contract: NormalizedContract
  ): Promise<IngestionWriteResult> {
    this.contracts.push(contract);
    return { inserted: true };
  }

  public async upsertContractAmendment(
    amendment: NormalizedContractAmendment
  ): Promise<IngestionWriteResult> {
    this.amendments.push(amendment);
    return { inserted: true };
  }
}

describe("worker ingestion", () => {
  it("uses the previous UTC date when no source date is supplied", async () => {
    const store = new MemoryIngestionStore();
    const caisClient = buildCaisClient([]);

    const result = await runOnce({
      now: new Date("2026-07-23T10:00:00.000Z"),
      caisClient,
      store,
      includeTed: false
    });

    expect(result.cais).toMatchObject({
      source: "cais-eop",
      sourceDate: "2026-07-22",
      fetchedCount: 1
    });
  });

  it("ingests and scores CAIS tender rows", async () => {
    const store = new MemoryIngestionStore();
    const caisClient = buildCaisClient([
      {
        tenderId: 572277,
        subject: "Разработка на софтуерна система",
        buyerName: "Публичен купувач",
        mainCpvCode: "72230000",
        estimatedValue: "100000,00",
        currency: "EUR",
        submissionDeadline: "2026-08-10T00:00:00.000Z"
      }
    ]);

    const result = await ingestCais({
      sourceDate: "2026-07-22",
      now: new Date("2026-07-23T00:00:00.000Z"),
      store,
      client: caisClient
    });

    expect(result).toMatchObject({
      fetchedCount: 1,
      insertedCount: 1,
      failedCount: 0
    });
    expect(store.opportunities[0]).toMatchObject({
      source: "cais-eop",
      externalId: "572277:main",
      match: {
        score: expect.any(Number)
      }
    });
  });

  it("ingests CAIS contracts, annexes, and OCDS lots", async () => {
    const store = new MemoryIngestionStore();
    const caisClient: CaisDailyClient = {
      async listDailyFiles() {
        return [
          {
            key: "Автоматично генерирани данни за поръчки.json",
            url: "https://storage.example.test/orders.json",
            size: 1,
            kind: "tenders"
          },
          {
            key: "Автоматично генерирани данни за договори.json",
            url: "https://storage.example.test/contracts.json",
            size: 1,
            kind: "contracts"
          },
          {
            key: "Автоматично генерирани данни за анекси.json",
            url: "https://storage.example.test/annexes.json",
            size: 1,
            kind: "annexes"
          },
          {
            key: "Автоматично генерирани данни съгласно стандарт OCDS.json",
            url: "https://storage.example.test/ocds.json",
            size: 1,
            kind: "ocds-notices"
          }
        ];
      },
      async downloadJsonFile(file) {
        if (file.kind === "contracts") {
          return [
            {
              tenderId: 572277,
              contractNumber: "D-1",
              contractDate: "2026-07-22",
              contractSubject: "Software support",
              buyerName: "Buyer",
              supplierName: "Supplier",
              supplierRegisterNumber: "123",
              contractValue: "20000,00",
              contractCurrency: "EUR"
            }
          ];
        }

        if (file.kind === "annexes") {
          return [
            {
              tenderId: 572277,
              contractNumber: "D-1",
              noticeId: "A-1",
              lastContractValue: "20000,00",
              currentContractValue: "25000,00",
              currency: "EUR",
              changeDescription: "Additional scope"
            }
          ];
        }

        if (file.kind === "ocds-notices") {
          return {
            releases: [
              {
                ocid: "ocds-e82gsb-572277",
                tender: {
                  lots: [
                    {
                      id: "main",
                      title: "Main lot",
                      value: {
                        amount: 1000,
                        currency: "EUR"
                      }
                    }
                  ]
                }
              }
            ]
          };
        }

        return [
          {
            tenderId: 572277,
            subject: "Software development",
            buyerName: "Buyer",
            mainCpvCode: "72230000",
            submissionDeadline: "2026-08-10T00:00:00.000Z"
          }
        ];
      }
    };

    const result = await ingestCais({
      sourceDate: "2026-07-22",
      now: new Date("2026-07-23T00:00:00.000Z"),
      store,
      client: caisClient
    });

    expect(result.failedCount).toBe(0);
    expect(store.opportunities).toHaveLength(1);
    expect(store.contracts).toHaveLength(1);
    expect(store.amendments).toHaveLength(1);
    expect(store.lots).toHaveLength(1);
  });

  it("ingests and scores TED notices", async () => {
    const store = new MemoryIngestionStore();
    const tedClient: TedNoticeClient = {
      async searchAllNotices() {
        return {
          totalNoticeCount: 1,
          notices: [
            {
              "publication-number": ["510019-2026"],
              "notice-title": ["Software development"],
              "buyer-name": ["EU buyer"],
              "classification-cpv": ["72230000"],
              "deadline-receipt-tender-date-lot": ["2026-08-10+02:00"],
              links: ["https://ted.europa.eu/en/notice/510019-2026/html"]
            }
          ]
        };
      }
    };

    const result = await ingestTed({
      sourceDate: "2026-07-22",
      now: new Date("2026-07-23T00:00:00.000Z"),
      store,
      client: tedClient,
      query: "classification-cpv = 72*"
    });

    expect(result).toMatchObject({
      source: "ted",
      fetchedCount: 1,
      insertedCount: 1
    });
    expect(store.opportunities[0]).toMatchObject({
      source: "ted",
      externalId: "510019-2026"
    });
  });

  it("builds TED queries for configured regional and western markets", async () => {
    const store = new MemoryIngestionStore();
    let capturedQuery = "";
    const tedClient: TedNoticeClient = {
      async searchAllNotices(request) {
        capturedQuery = request.query;

        return {
          totalNoticeCount: 0,
          notices: []
        };
      }
    };

    const result = await runOnce({
      sourceDate: "2026-07-22",
      now: new Date("2026-07-23T00:00:00.000Z"),
      store,
      includeCais: false,
      tedClient,
      tedCountryCodes: ["RO", "DE", "FR"]
    });

    expect(result.tedCountryCodes).toEqual(["RO", "DE", "FR"]);
    expect(capturedQuery).toContain("buyer-country IN (ROU DEU FRA)");
    expect(capturedQuery).toContain("classification-cpv = 302*");
  });

  it("runs backfill for multiple source dates", async () => {
    const store = new MemoryIngestionStore();
    const results = await runBackfill({
      sourceDates: ["2026-07-21", "2026-07-22"],
      now: new Date("2026-07-23T00:00:00.000Z"),
      store,
      includeTed: false,
      caisClient: buildCaisClient([])
    });

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.cais?.sourceDate)).toEqual([
      "2026-07-21",
      "2026-07-22"
    ]);
  });
});

function buildCaisClient(tenders: unknown[]): CaisDailyClient {
  return {
    async listDailyFiles(sourceDate) {
      return [
        {
          key: "Автоматично генерирани данни за поръчки.json",
          url: "https://storage.example.test/open-data-2026-07-22/orders.json",
          size: 123,
          kind: "tenders"
        }
      ];
    },
    async downloadJsonFile() {
      return tenders;
    }
  };
}

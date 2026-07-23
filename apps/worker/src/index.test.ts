import type {
  NormalizedContract,
  NormalizedContractAmendment,
  NormalizedOpportunityLot,
  NormalizedOpportunityWithScore
} from "@public-scanner/domain";
import type {
  DocumentIntelligenceInput,
  IngestionWriteResult,
  SourceErrorInput,
  SourceRunCompletionInput,
  SourceRunInput
} from "@public-scanner/db";
import { describe, expect, it } from "vitest";

import {
  ingestCais,
  ingestSedia,
  ingestTed,
  runBackfill,
  runOnce,
  type CaisDailyClient,
  type IngestionStore,
  type SediaOpportunityClient,
  type TedNoticeClient,
  type TenderAnalysisClient
} from "./index.js";

class MemoryIngestionStore implements IngestionStore {
  public readonly opportunities: NormalizedOpportunityWithScore[] = [];
  public readonly lots: NormalizedOpportunityLot[] = [];
  public readonly contracts: NormalizedContract[] = [];
  public readonly amendments: NormalizedContractAmendment[] = [];
  public readonly sourceErrors: SourceErrorInput[] = [];
  public readonly completions: SourceRunCompletionInput[] = [];
  public readonly documentIntelligence = new Map<string, DocumentIntelligenceInput>();
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

  public async upsertDocumentIntelligence(
    opportunityId: string,
    input: DocumentIntelligenceInput
  ): Promise<void> {
    this.documentIntelligence.set(opportunityId, input);
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
      includeTed: false,
      includeSedia: false
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

  it("enriches document intelligence with injected AI analysis", async () => {
    const store = new MemoryIngestionStore();
    const caisClient = buildCaisClient([
      {
        tenderId: 572277,
        subject: "Cloud software platform and cybersecurity support",
        buyerName: "Public buyer",
        mainCpvCode: "72230000",
        estimatedValue: "250000,00",
        currency: "EUR",
        submissionDeadline: "2026-08-10T00:00:00.000Z"
      }
    ]);
    let capturedTitle: string | undefined;
    let capturedCpvCodes: readonly string[] = [];
    const aiAnalyzer: TenderAnalysisClient = {
      async analyzeTender(request) {
        capturedTitle = request.title;
        capturedCpvCodes = request.cpvCodes;

        return {
          summary: "Strong software and security fit with clear application path.",
          businessFitScore: 91,
          readinessScore: 74,
          commercialScore: 82,
          dataConfidenceScore: 84,
          complexity: "medium",
          sectors: ["software", "cybersecurity"],
          eligibilityCriteria: ["AI eligibility: verify similar delivery references."],
          requiredDocuments: ["AI required: technical compliance matrix."],
          certifications: ["AI certification: ISO 27001 evidence."],
          risks: ["AI risk: confirm SLA penalties."],
          missingData: ["award criteria weighting"]
        };
      }
    };

    const result = await runOnce({
      sourceDate: "2026-07-22",
      now: new Date("2026-07-23T00:00:00.000Z"),
      store,
      caisClient,
      includeTed: false,
      includeSedia: false,
      aiAnalyzer,
      aiAnalysisMaxPerRun: 1,
      aiAnalysisMinScore: 1
    });

    expect(result.cais).toMatchObject({
      insertedCount: 1,
      failedCount: 0
    });
    expect(capturedTitle).toBe("Cloud software platform and cybersecurity support");
    expect(capturedCpvCodes).toEqual(["72230000"]);
    expect(store.documentIntelligence.get("572277:main")).toMatchObject({
      status: "ready",
      summary: expect.stringContaining("AI-assisted (84/100 confidence)"),
      eligibilityCriteria: expect.arrayContaining([
        "AI eligibility: verify similar delivery references."
      ]),
      requiredDocuments: expect.arrayContaining([
        "AI required: technical compliance matrix."
      ]),
      certifications: expect.arrayContaining(["AI certification: ISO 27001 evidence."]),
      risks: expect.arrayContaining([
        "AI risk: confirm SLA penalties.",
        "Missing data: award criteria weighting."
      ]),
      aiAnalysis: expect.objectContaining({
        provider: "injected",
        model: "injected",
        businessFitScore: 91,
        readinessScore: 74,
        commercialScore: 82,
        dataConfidenceScore: 84,
        complexity: "medium",
        sectors: ["software", "cybersecurity"],
        missingData: ["award criteria weighting"]
      })
    });
  });

  it("keeps ingestion successful when AI analysis fails", async () => {
    const store = new MemoryIngestionStore();
    const caisClient = buildCaisClient([
      {
        tenderId: 572277,
        subject: "Software implementation",
        buyerName: "Public buyer",
        mainCpvCode: "72230000",
        submissionDeadline: "2026-08-10T00:00:00.000Z"
      }
    ]);
    const aiAnalyzer: TenderAnalysisClient = {
      async analyzeTender() {
        throw new Error("AI provider unavailable");
      }
    };

    const result = await runOnce({
      sourceDate: "2026-07-22",
      now: new Date("2026-07-23T00:00:00.000Z"),
      store,
      caisClient,
      includeTed: false,
      includeSedia: false,
      aiAnalyzer,
      aiAnalysisMaxPerRun: 1,
      aiAnalysisMinScore: 1
    });

    expect(result.cais).toMatchObject({
      insertedCount: 1,
      failedCount: 0
    });
    expect(store.documentIntelligence.get("572277:main")?.summary).toContain(
      "Software Development fit"
    );
    expect(store.sourceErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          context: expect.stringContaining(":ai-analysis"),
          errorMessage: "AI provider unavailable"
        })
      ])
    );
  });

  it("splits AI analysis budget across enabled sources", async () => {
    const store = new MemoryIngestionStore();
    const caisClient = buildCaisClient([
      {
        tenderId: 572277,
        subject: "Software implementation platform",
        buyerName: "Public buyer",
        mainCpvCode: "72230000",
        submissionDeadline: "2026-08-10T00:00:00.000Z"
      },
      {
        tenderId: 572278,
        subject: "Software support portal",
        buyerName: "Public buyer",
        mainCpvCode: "72261000",
        submissionDeadline: "2026-08-10T00:00:00.000Z"
      },
      {
        tenderId: 572279,
        subject: "Computer hardware delivery",
        buyerName: "Public buyer",
        mainCpvCode: "30200000",
        submissionDeadline: "2026-08-10T00:00:00.000Z"
      }
    ]);
    const tedClient: TedNoticeClient = {
      async searchAllNotices() {
        return {
          totalNoticeCount: 1,
          notices: [
            {
              "publication-number": ["510019-2026"],
              "notice-title": ["Managed IT services 2026"],
              "description-proc": ["Managed IT support and service desk."],
              "buyer-name": ["EU buyer"],
              "classification-cpv": ["72000000"],
              "deadline-receipt-tender-date-lot": ["2026-08-10+02:00"],
              links: ["https://ted.europa.eu/en/notice/510019-2026/html"]
            }
          ]
        };
      }
    };
    const sediaClient: SediaOpportunityClient = {
      async searchAll() {
        return {
          totalResults: 1,
          results: [
            {
              reference: "sedia-ref",
              url: "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/tender-details/sedia-ref",
              metadata: {
                identifier: ["sedia-ref"],
                title: ["Cloud software platform"],
                description: ["Secure cloud software implementation and support."],
                deadlineDate: ["2026-08-10T17:00:59.000+0000"],
                startDate: ["2026-07-22T00:00:00.000+0000"],
                type: ["0"]
              }
            }
          ]
        };
      }
    };
    const capturedSources: string[] = [];
    const aiAnalyzer: TenderAnalysisClient = {
      async analyzeTender(request) {
        capturedSources.push(request.source);

        return {
          summary: "Relevant opportunity.",
          businessFitScore: 80,
          readinessScore: 70,
          commercialScore: 65,
          dataConfidenceScore: 75,
          complexity: "medium",
          sectors: ["software"],
          eligibilityCriteria: [],
          requiredDocuments: [],
          certifications: [],
          risks: [],
          missingData: []
        };
      }
    };

    await runOnce({
      sourceDate: "2026-07-22",
      now: new Date("2026-07-23T00:00:00.000Z"),
      store,
      caisClient,
      tedClient,
      sediaClient,
      sediaSearchTerms: ["cloud"],
      aiAnalyzer,
      aiAnalysisMaxPerRun: 3,
      aiAnalysisMinScore: 1
    });

    expect(capturedSources).toEqual(["cais-eop", "ted", "sedia"]);
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
              "description-proc": ["Software development and support services."],
              "document-url-lot": ["https://buyer.example.test/documents"],
              "submission-url-lot": ["https://buyer.example.test/submit"],
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
      externalId: "510019-2026",
      description: "Software development and support services.",
      documentUrls: ["https://buyer.example.test/documents"],
      submissionUrls: ["https://buyer.example.test/submit"]
    });
  });

  it("ingests and deduplicates SEDIA tender search results", async () => {
    const store = new MemoryIngestionStore();
    const sediaClient: SediaOpportunityClient = {
      async searchAll() {
        return {
          totalResults: 1,
          results: [
            {
              reference: "sedia-ref",
              url: "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/tender-details/sedia-ref",
              metadata: {
                identifier: ["sedia-ref"],
                title: ["Cloud software platform"],
                description: ["Secure cloud software implementation and support."],
                deadlineDate: ["2026-08-10T17:00:59.000+0000"],
                startDate: ["2026-07-22T00:00:00.000+0000"],
                language: ["en"],
                procedureType: ["47396220"],
                contractType: ["31095499"],
                cftSubmissionMethodCode: ["ESUBMISSION"],
                programmePeriod: ["2021 - 2027"],
                type: ["0"]
              }
            }
          ]
        };
      }
    };

    const result = await ingestSedia({
      sourceDate: "2026-07-22",
      now: new Date("2026-07-23T00:00:00.000Z"),
      store,
      client: sediaClient,
      searchTerms: ["cloud", "software"]
    });

    expect(result).toMatchObject({
      source: "sedia",
      fetchedCount: 1,
      insertedCount: 1,
      failedCount: 0
    });
    expect(store.opportunities[0]).toMatchObject({
      source: "sedia",
      sourceId: "eu-sedia",
      externalId: "sedia-ref",
      title: "Cloud software platform",
      description: "Secure cloud software implementation and support.",
      buyerName: "EU Funding & Tenders",
      status: "open",
      procedureType: "Procedure 47396220; Contract 31095499; Submission ESUBMISSION",
      europeanProgram: "2021 - 2027"
    });
    expect(store.opportunities[0]?.match.score).toBeGreaterThan(0);
    expect(store.opportunities[0]?.match.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "profile.software-development.relevance",
          label: expect.stringContaining("keyword: software")
        }),
        expect.objectContaining({
          code: "profile.software-development.execution",
          label: expect.stringContaining("days remain")
        })
      ])
    );
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
      includeSedia: false,
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
      includeSedia: false,
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

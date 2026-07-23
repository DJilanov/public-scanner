import { describe, expect, it } from "vitest";

import {
  normalizeCaisAnnexRecord,
  normalizeCaisContractRecord,
  normalizeCaisTenderRecord,
  normalizeOcdsLots,
  normalizeSediaResultRecord,
  normalizeTedNoticeRecord,
  parseSourceNumber,
  scoreNormalizedOpportunity
} from "./normalization.js";

describe("normalization", () => {
  it("normalizes CAIS tender records", () => {
    const opportunity = normalizeCaisTenderRecord(
      {
        noticeId: 834398,
        tenderId: 572277,
        uniqueProcurementNumber: "00222-2026-0029",
        subject: "Разработка на уеб портал",
        mainCpvCode: "72230000",
        mainCpvDescription: "Услуги по разработване на софтуер",
        estimatedValue: "102000,00",
        currency: "EUR",
        buyerName: "ДЪРЖАВНА ОРГАНИЗАЦИЯ",
        buyerRegistryNumber: "000000001",
        publicationDate: "2026-07-22T02:03:38+00:00",
        submissionDeadline: "2026-09-08T20:59:59.000Z",
        procedureType: "Открита процедура",
        isEuFunded: true,
        linkToOjEu: "https://ted.europa.eu/bg/notice/510019-2026/html"
      },
      { now: new Date("2026-07-23T00:00:00.000Z") }
    );

    expect(opportunity).toMatchObject({
      source: "cais-eop",
      externalId: "572277:main",
      deduplicationKey: "ted:510019-2026",
      tenderId: "572277",
      publicationNumber: "510019-2026",
      title: "Разработка на уеб портал",
      buyerName: "ДЪРЖАВНА ОРГАНИЗАЦИЯ",
      status: "open",
      cpvCodes: ["72230000"],
      estimatedValue: {
        amount: 102000,
        currency: "EUR"
      }
    });
  });

  it("normalizes CAIS contract records", () => {
    const contract = normalizeCaisContractRecord({
      tenderId: 572277,
      contractNumber: "D-1",
      contractDate: "2026-07-22",
      contractSubject: "Software support",
      buyerName: "Buyer",
      supplierName: "Supplier",
      supplierRegisterNumber: "123",
      contractValue: "20000,00",
      contractCurrency: "EUR"
    });

    expect(contract).toMatchObject({
      source: "cais-eop",
      externalId: "contract:572277:D-1:2026-07-22:123:Supplier",
      opportunityExternalId: "572277:main",
      value: {
        amount: 20000,
        currency: "EUR"
      }
    });
  });

  it("normalizes CAIS annex records", () => {
    const annex = normalizeCaisAnnexRecord({
      tenderId: 572277,
      contractNumber: "D-1",
      noticeId: "A-1",
      lastContractValue: "20000,00",
      currentContractValue: "25000,00",
      currency: "EUR",
      changeDescription: "Additional scope"
    });

    expect(annex).toMatchObject({
      source: "cais-eop",
      externalId: "annex:572277:D-1:A-1:Additional scope",
      currentValue: {
        amount: 25000,
        currency: "EUR"
      }
    });
  });

  it("normalizes OCDS lots", () => {
    const lots = normalizeOcdsLots({
      releases: [
        {
          ocid: "ocds-e82gsb-572277",
          tender: {
            lots: [
              {
                id: "1",
                title: "Lot 1",
                value: {
                  amount: 1000,
                  currency: "EUR"
                },
                tenderPeriod: {
                  endDate: "2026-08-10T00:00:00Z"
                }
              }
            ]
          }
        }
      ]
    });

    expect(lots).toEqual([
      {
        source: "cais-eop",
        opportunityExternalId: "572277:1",
        externalId: "572277:1",
        lotIdentifier: "1",
        title: "Lot 1",
        cpvCodes: [],
        estimatedValue: {
          amount: 1000,
          currency: "EUR"
        },
        submissionDeadline: "2026-08-10T00:00:00.000Z"
      }
    ]);
  });

  it("normalizes TED records with array/object fields", () => {
    const opportunity = normalizeTedNoticeRecord(
      {
        "publication-number": ["510019-2026"],
        "notice-title": {
          bul: ["Услуги, свързани със софтуерни продукти"],
          eng: ["Software services"]
        },
        "title-proc": {
          bul: "Разработка на информационна система",
          eng: "Information system development"
        },
        "description-proc": {
          bul: "Изработка на портал",
          eng: "Development of a web portal &amp; support services."
        },
        "selection-criterion-description-lot": {
          eng: ["At least two software reference projects from the last three years."]
        },
        "document-url-lot": [
          "https://buyer.example.test/tenders/510019/documents?x=1&amp;y=2"
        ],
        "submission-url-lot": [
          "https://buyer.example.test/tenders/510019/submit?x=1&amp;y=2"
        ],
        "buyer-name": ["ОБЩИНА БУРГАС"],
        "buyer-country": ["BGR"],
        "classification-cpv": ["72700000", "72230000"],
        "publication-date": ["2026-07-23+02:00"],
        "deadline-receipt-tender-date-lot": ["2026-08-17+02:00"],
        "estimated-value-proc": ["460000.00"],
        "estimated-value-cur-proc": ["EUR"],
        links: ["https://ted.europa.eu/bg/notice/510019-2026/html"]
      },
      { now: new Date("2026-07-23T00:00:00.000Z") }
    );

    expect(opportunity).toMatchObject({
      source: "ted",
      externalId: "510019-2026",
      deduplicationKey: "ted:510019-2026",
      title: "Information system development",
      description:
        "Development of a web portal & support services. Selection criteria: At least two software reference projects from the last three years.",
      publicationNumber: "510019-2026",
      buyerCountryCode: "BGR",
      status: "open",
      cpvCodes: ["72700000", "72230000"],
      documentUrls: ["https://buyer.example.test/tenders/510019/documents?x=1&y=2"],
      submissionUrls: ["https://buyer.example.test/tenders/510019/submit?x=1&y=2"],
      tedUrl: "https://ted.europa.eu/bg/notice/510019-2026/html"
    });
  });

  it("normalizes SEDIA tender search results", () => {
    const opportunity = normalizeSediaResultRecord(
      {
        reference: "69b193d7-f301-438d-8be9-726e790a2aca-CN",
        content:
          "Acquisition, delivery, installation and hardware and <b>software</b> maintenance.",
        url: "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/tender-details/69b193d7-f301-438d-8be9-726e790a2aca-CN",
        metadata: {
          identifier: ["69b193d7-f301-438d-8be9-726e790a2aca-CN"],
          title: [
            "Acquisition, delivery, installation and hardware and software maintenance"
          ],
          caName: [
            "Acquisition, delivery, installation and hardware and software maintenance"
          ],
          startDate: ["2026-07-23T00:00:00.000+0000"],
          deadlineDate: ["2026-09-01T17:00:59.000+0000"],
          description: [
            "Acquisition of quantum <b>computing</b>, cloud, and data processing capacity."
          ],
          language: ["en"],
          type: ["0"],
          procedureType: ["47396220"],
          contractType: ["31095499"],
          cftSubmissionMethodCode: ["ESUBMISSION"],
          programmePeriod: ["2021 - 2027"],
          url: [
            "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/tender-details/69b193d7-f301-438d-8be9-726e790a2aca-CN"
          ]
        }
      },
      { now: new Date("2026-07-23T00:00:00.000Z") }
    );

    expect(opportunity).toMatchObject({
      source: "sedia",
      sourceId: "eu-sedia",
      opportunityKind: "procurement",
      externalId: "69b193d7-f301-438d-8be9-726e790a2aca-CN",
      deduplicationKey: "sedia:69b193d7-f301-438d-8be9-726e790a2aca-CN",
      description:
        "Acquisition of quantum computing, cloud, and data processing capacity.",
      buyerName: "EU Funding & Tenders",
      status: "open",
      isEuFunded: true,
      language: "en",
      procedureType: "Procedure 47396220; Contract 31095499; Submission ESUBMISSION",
      europeanProgram: "2021 - 2027"
    });
  });

  it("scores normalized opportunities", () => {
    const opportunity = normalizeCaisTenderRecord(
      {
        tenderId: 1,
        subject: "Software development",
        buyerName: "Buyer",
        mainCpvCode: "72230000",
        submissionDeadline: "2026-08-01T00:00:00.000Z",
        currency: "EUR",
        estimatedValue: "1000"
      },
      { now: new Date("2026-07-23T00:00:00.000Z") }
    );

    expect(opportunity).toBeDefined();
    const scored = scoreNormalizedOpportunity(opportunity!, {
      now: new Date("2026-07-23T00:00:00.000Z")
    });

    expect(scored.match.score).toBeGreaterThan(70);
  });

  it("parses comma decimal values", () => {
    expect(parseSourceNumber("102000,50")).toBe(102000.5);
  });
});

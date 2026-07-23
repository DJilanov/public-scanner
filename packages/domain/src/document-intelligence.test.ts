import { describe, expect, it } from "vitest";

import { buildDocumentIntelligence } from "./document-intelligence.js";
import { scoreNormalizedOpportunity } from "./normalization.js";
import type { NormalizedOpportunity } from "./types.js";

describe("buildDocumentIntelligence", () => {
  it("builds a practical checklist from scored metadata", () => {
    const opportunity: NormalizedOpportunity = {
      source: "cais-eop",
      externalId: "1:main",
      deduplicationKey: "cais-eop:1",
      title: "Cybersecurity software support",
      buyerName: "Public buyer",
      status: "open",
      cpvCodes: ["72800000"],
      sourceUrl: "https://example.test/tender/1",
      estimatedValue: {
        amount: 150000,
        currency: "EUR"
      },
      submissionDeadline: "2026-08-01T00:00:00.000Z",
      isEuFunded: true
    };
    const scored = scoreNormalizedOpportunity(opportunity, {
      now: new Date("2026-07-23T00:00:00.000Z")
    });

    const result = buildDocumentIntelligence(scored, {
      now: new Date("2026-07-23T00:00:00.000Z")
    });

    expect(result.status).toBe("ready");
    expect(result.summary).toContain("Public buyer");
    expect(result.eligibilityCriteria).toEqual(
      expect.arrayContaining([
        "EU-funded procedure: check visibility, reporting, and grant rules."
      ])
    );
    expect(result.requiredDocuments).toEqual(
      expect.arrayContaining([
        "Team CVs, delivery methodology, implementation plan, and acceptance plan."
      ])
    );
    expect(result.certifications).toEqual(
      expect.arrayContaining([
        "ISO 27001 or equivalent security controls may be requested."
      ])
    );
  });

  it("uses SEDIA descriptions for portal, security, and hardware checklist signals", () => {
    const opportunity: NormalizedOpportunity = {
      source: "sedia",
      sourceId: "eu-sedia",
      externalId: "sedia-ref",
      deduplicationKey: "sedia:sedia-ref",
      title: "Computing capacity acquisition",
      description:
        "Secure cloud software implementation with server hardware delivery and data processing support.",
      buyerName: "EU Funding & Tenders",
      status: "open",
      cpvCodes: [],
      sourceUrl:
        "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/tender-details/sedia-ref",
      submissionDeadline: "2026-08-15T17:00:00.000Z",
      isEuFunded: true
    };
    const scored = scoreNormalizedOpportunity(opportunity, {
      now: new Date("2026-07-23T00:00:00.000Z")
    });

    const result = buildDocumentIntelligence(scored, {
      now: new Date("2026-07-23T00:00:00.000Z")
    });

    expect(result.eligibilityCriteria).toEqual(
      expect.arrayContaining([
        "SEDIA tender: verify eSubmission access and EU portal role setup."
      ])
    );
    expect(result.requiredDocuments).toEqual(
      expect.arrayContaining([
        "EU Funding & Tenders portal registration and eSubmission mandate.",
        "Manufacturer datasheets, warranty statement, and delivery schedule.",
        "Team CVs, delivery methodology, implementation plan, and acceptance plan."
      ])
    );
    expect(result.certifications).toEqual(
      expect.arrayContaining([
        "ISO 27001 or equivalent security controls may be requested.",
        "Vendor authorization, warranty service rights, or partner status may be requested."
      ])
    );
    expect(result.risks).toEqual(
      expect.arrayContaining([
        "SEDIA list metadata is enriched but official tender documents still need manual review."
      ])
    );
  });

  it("distinguishes TED notices with detected attachment URLs from metadata-only notices", () => {
    const baseOpportunity: NormalizedOpportunity = {
      source: "ted",
      externalId: "510019-2026",
      deduplicationKey: "ted:510019-2026",
      title: "Software support services",
      buyerName: "EU buyer",
      status: "open",
      cpvCodes: ["72230000"],
      sourceUrl: "https://ted.europa.eu/en/notice/510019-2026/html",
      submissionDeadline: "2026-08-15T17:00:00.000Z"
    };

    const withDocuments = buildDocumentIntelligence(
      scoreNormalizedOpportunity(
        {
          ...baseOpportunity,
          documentUrls: ["https://buyer.example.test/documents"]
        },
        { now: new Date("2026-07-23T00:00:00.000Z") }
      ),
      { now: new Date("2026-07-23T00:00:00.000Z") }
    );
    const withoutDocuments = buildDocumentIntelligence(
      scoreNormalizedOpportunity(baseOpportunity, {
        now: new Date("2026-07-23T00:00:00.000Z")
      }),
      { now: new Date("2026-07-23T00:00:00.000Z") }
    );

    expect(withDocuments.requiredDocuments).toContain(
      "Archived official tender attachment bundle from the buyer portal."
    );
    expect(withoutDocuments.risks).toContain(
      "TED notice has no detected buyer attachment URL; open the notice manually."
    );
  });
});

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
});

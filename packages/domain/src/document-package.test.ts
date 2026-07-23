import { describe, expect, it } from "vitest";

import {
  buildDocumentPackageMarkdown,
  buildTenderChangeTimeline,
  buildTenderDocumentPackage,
  extractTenderClauses
} from "./document-package.js";
import type { DocumentIntelligence, Opportunity } from "./types.js";

const opportunity: Opportunity = {
  id: "opportunity-1",
  source: "cais-eop",
  title: "Supply and support of network equipment",
  buyerName: "Municipality",
  status: "open",
  cpvCodes: ["32420000"],
  sourceUrl: "https://example.test/tender/1",
  publicationDate: "2026-07-01T00:00:00.000Z",
  submissionDeadline: "2026-08-15T12:00:00.000Z",
  estimatedValue: { amount: 650000, currency: "BGN" }
};

const documentIntelligence: DocumentIntelligence = {
  status: "ready",
  summary: "Hardware Supply fit 89/100.",
  eligibilityCriteria: [
    "Expect turnover, team capacity, and previous contract evidence."
  ],
  requiredDocuments: [
    "Manufacturer datasheets, warranty statement, and delivery schedule.",
    "Financial proposal with clear pricing and validity."
  ],
  certifications: [
    "Vendor authorization, warranty service rights, or partner status may be requested."
  ],
  risks: ["Profile score suggests partner capacity may be needed."],
  extractedAt: "2026-07-02T00:00:00.000Z"
};

describe("buildTenderDocumentPackage", () => {
  it("builds a package summary from official metadata and document intelligence", () => {
    const documentPackage = buildTenderDocumentPackage({
      opportunity,
      lots: [
        {
          id: "lot-1",
          lotIdentifier: "1",
          title: "Network switches",
          cpvCodes: ["32424000"],
          estimatedValue: { amount: 300000, currency: "BGN" },
          submissionDeadline: "2026-08-15T12:00:00.000Z"
        }
      ],
      contracts: [
        {
          id: "contract-1",
          title: "Previous network equipment supply",
          supplierName: "Existing Supplier",
          contractDate: "2025-03-10T00:00:00.000Z",
          value: { amount: 280000, currency: "BGN" }
        }
      ],
      amendments: [
        {
          id: "amendment-1",
          changeReason: "Additional quantities",
          currentValue: { amount: 320000, currency: "BGN" }
        }
      ],
      documentIntelligence,
      now: new Date("2026-07-23T00:00:00.000Z")
    });

    expect(documentPackage.updatedAt).toBe("2026-07-23T00:00:00.000Z");
    expect(documentPackage.summary.itemCount).toBe(9);
    expect(documentPackage.summary.availableCount).toBe(5);
    expect(documentPackage.summary.needsAttentionCount).toBe(4);
    expect(documentPackage.coveragePercent).toBe(56);
    expect(documentPackage.summary.clauseCount).toBeGreaterThanOrEqual(8);
    expect(documentPackage.summary.riskClauseCount).toBe(1);
    expect(documentPackage.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "official-notice",
        "structured-metadata",
        "official-attachments",
        "required-document-1",
        "certification-1"
      ])
    );
  });
});

describe("buildTenderChangeTimeline", () => {
  it("orders dated package events chronologically and keeps undated changes last", () => {
    const timeline = buildTenderChangeTimeline({
      opportunity,
      amendments: [
        {
          id: "amendment-1",
          changeReason: "Additional quantities"
        }
      ],
      documentIntelligence
    });

    expect(timeline[0]?.id).toBe("published");
    expect(timeline.at(-2)?.id).toBe("deadline");
    expect(timeline.at(-1)?.id).toBe("amendment-amendment-1");
  });
});

describe("extractTenderClauses", () => {
  it("extracts deadlines, budget, certification, warranty, payment, and risk clauses", () => {
    const clauses = extractTenderClauses({
      opportunity,
      documentIntelligence
    });

    expect(clauses.map((clause) => clause.type)).toEqual(
      expect.arrayContaining([
        "deadline",
        "budget",
        "eligibility",
        "warranty",
        "payment",
        "risk"
      ])
    );
    expect(clauses.find((clause) => clause.type === "risk")?.severity).toBe("risk");
    expect(clauses.find((clause) => clause.type === "budget")?.severity).toBe("watch");
  });
});

describe("buildDocumentPackageMarkdown", () => {
  it("creates a portable document brief", () => {
    const documentPackage = buildTenderDocumentPackage({
      opportunity,
      documentIntelligence,
      now: new Date("2026-07-23T00:00:00.000Z")
    });

    const markdown = buildDocumentPackageMarkdown({ opportunity, documentPackage });

    expect(markdown).toContain("# Supply and support of network equipment");
    expect(markdown).toContain("## Package Coverage");
    expect(markdown).toContain("## Extracted Clauses");
  });
});

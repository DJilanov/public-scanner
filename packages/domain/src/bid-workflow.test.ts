import { describe, expect, it } from "vitest";

import {
  buildApplicationPackMarkdown,
  buildBidDecision,
  buildDeadlineCalendarEvent,
  buildOpportunityForecasts,
  calculateBidEconomics
} from "./bid-workflow.js";
import type {
  ComplianceItem,
  Opportunity,
  OpportunityDetail,
  ProcurementDashboard
} from "./types.js";

const opportunity: Opportunity = {
  id: "opportunity-1",
  source: "cais-eop",
  title: "Software platform",
  buyerName: "Digital Agency",
  status: "open",
  cpvCodes: ["72200000"],
  sourceUrl: "https://example.test/tender",
  submissionDeadline: "2026-09-15",
  estimatedValue: { amount: 200000, currency: "BGN" },
  isEuFunded: true,
  profileScores: [
    {
      profileId: "software-development",
      profileName: "Software Development",
      totalScore: 86,
      recommendation: "apply",
      components: []
    }
  ]
};

const complianceItems: ComplianceItem[] = [
  {
    id: "compliance-1",
    opportunityId: "opportunity-1",
    requirementType: "required-document",
    requirement: "Technical proposal",
    status: "ready",
    evidenceItemIds: ["evidence-1"]
  },
  {
    id: "compliance-2",
    opportunityId: "opportunity-1",
    requirementType: "certification",
    requirement: "ISO 9001",
    status: "ready",
    evidenceItemIds: []
  }
];

describe("buildBidDecision", () => {
  it("recommends applying when score, readiness, and deadline are healthy", () => {
    const decision = buildBidDecision({
      opportunity,
      selectedProfileIds: ["software-development"],
      complianceItems,
      documentIntelligence: {
        status: "ready",
        summary: "Fit summary",
        eligibilityCriteria: [],
        requiredDocuments: ["Technical proposal"],
        certifications: ["ISO 9001"],
        risks: []
      },
      now: new Date("2026-08-01T00:00:00Z")
    });

    expect(decision.recommendation).toBe("apply");
    expect(decision.score).toBe(86);
    expect(decision.readinessPercent).toBe(100);
    expect(decision.confidence).toBe(100);
    expect(decision.riskLevel).toBe("low");
  });

  it("forces partner coverage when compliance is blocked", () => {
    const decision = buildBidDecision({
      opportunity,
      selectedProfileIds: ["software-development"],
      complianceItems: [
        {
          ...complianceItems[0]!,
          status: "blocked"
        }
      ],
      now: new Date("2026-08-01T00:00:00Z")
    });

    expect(decision.recommendation).toBe("need-partner");
    expect(decision.riskLevel).toBe("high");
    expect(decision.blockers).toContain("1 compliance items are blocked.");
  });
});

describe("calculateBidEconomics", () => {
  it("calculates margin and expected value", () => {
    const economics = calculateBidEconomics({
      estimatedValue: opportunity.estimatedValue!,
      deliveryCostAmount: 120000,
      partnerCostAmount: 10000,
      bidPreparationCostAmount: 3000,
      warrantyReservePercent: 5,
      winProbabilityPercent: 40
    });

    expect(economics.grossProfit).toBe(60000);
    expect(economics.grossMarginPercent).toBe(30);
    expect(economics.expectedValue).toBe(21000);
    expect(economics.breakEvenWinProbabilityPercent).toBe(5);
    expect(economics.riskLevel).toBe("low");
  });
});

describe("buildOpportunityForecasts", () => {
  it("creates buyer cadence forecasts from contract history", () => {
    const dashboard: ProcurementDashboard = {
      pipeline: [],
      documents: [],
      contracts: [
        {
          id: "contract-1",
          source: "cais-eop",
          title: "Support",
          buyerName: "Digital Agency",
          supplierName: "Supplier A",
          contractDate: "2025-01-10",
          value: { amount: 100000, currency: "BGN" },
          cpvCodes: ["72200000"]
        },
        {
          id: "contract-2",
          source: "cais-eop",
          title: "Support",
          buyerName: "Digital Agency",
          supplierName: "Supplier B",
          contractDate: "2026-01-10",
          value: { amount: 120000, currency: "BGN" },
          cpvCodes: ["72200000"]
        }
      ],
      buyers: [
        {
          buyerName: "Digital Agency",
          opportunityCount: 4,
          openOpportunityCount: 0,
          contractCount: 2,
          averageAwardedValue: { amount: 110000, currency: "BGN" },
          lastActivityDate: "2026-01-10",
          topSuppliers: ["Supplier A"],
          topCpvCodes: ["72200000"]
        }
      ],
      suppliers: [],
      sources: []
    };

    const forecasts = buildOpportunityForecasts({
      dashboard,
      now: new Date("2026-02-01T00:00:00Z")
    });

    expect(forecasts).toHaveLength(1);
    expect(forecasts[0]?.buyerName).toBe("Digital Agency");
    expect(forecasts[0]?.nextExpectedDate).toContain("2027");
  });
});

describe("exports", () => {
  it("builds calendar and markdown application pack exports", () => {
    const calendar = buildDeadlineCalendarEvent(
      opportunity,
      new Date("2026-08-01T00:00:00Z")
    );
    const detail: OpportunityDetail = {
      opportunity,
      lots: [],
      contracts: [],
      amendments: [],
      documentIntelligence: {
        status: "ready",
        eligibilityCriteria: ["Bidder declarations"],
        requiredDocuments: ["Technical proposal"],
        certifications: ["ISO 9001"],
        risks: []
      },
      competitorInsights: []
    };
    const decision = buildBidDecision({
      opportunity,
      selectedProfileIds: ["software-development"],
      complianceItems,
      documentIntelligence: detail.documentIntelligence!,
      now: new Date("2026-08-01T00:00:00Z")
    });
    const markdown = buildApplicationPackMarkdown({
      detail,
      complianceItems,
      evidenceItems: [
        {
          id: "evidence-1",
          title: "Reference project",
          type: "reference",
          profileIds: ["software-development"]
        }
      ],
      selectedProfileIds: ["software-development"],
      decision,
      generatedAt: new Date("2026-08-01T00:00:00Z")
    });

    expect(calendar).toContain("BEGIN:VCALENDAR");
    expect(calendar).toContain("DTSTART;VALUE=DATE:20260915");
    expect(markdown).toContain("# Software platform");
    expect(markdown).toContain(
      "| ready | required-document | Technical proposal | Reference project |"
    );
  });
});

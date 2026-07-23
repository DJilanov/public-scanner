import { describe, expect, it } from "vitest";

import { scoreOpportunity, scoreOpportunityAcrossProfiles } from "./scoring.js";

describe("scoreOpportunity", () => {
  it("scores software CPV opportunities highly", () => {
    const result = scoreOpportunity(
      {
        title: "Software development and API integration",
        cpvCodes: ["72230000"],
        submissionDeadline: new Date("2026-08-10T00:00:00.000Z"),
        estimatedValue: {
          amount: 100000,
          currency: "EUR"
        },
        isEuFunded: true
      },
      { now: new Date("2026-07-23T00:00:00.000Z") }
    );

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.reasons.map((reason) => reason.code)).toContain("cpv.software");
  });

  it("does not add open-deadline weight for expired opportunities", () => {
    const result = scoreOpportunity(
      {
        title: "Construction works",
        cpvCodes: ["45000000"],
        submissionDeadline: new Date("2026-07-01T00:00:00.000Z")
      },
      { now: new Date("2026-07-23T00:00:00.000Z") }
    );

    expect(result.reasons.map((reason) => reason.code)).not.toContain("deadline.open");
  });

  it("ranks business profiles by fit", () => {
    const results = scoreOpportunityAcrossProfiles(
      {
        title: "Delivery of laptops and desktop computers",
        cpvCodes: ["30213100"],
        submissionDeadline: new Date("2026-08-20T00:00:00.000Z"),
        estimatedValue: {
          amount: 120000,
          currency: "EUR"
        }
      },
      { now: new Date("2026-07-23T00:00:00.000Z") }
    );

    expect(results[0]).toMatchObject({
      profileId: "hardware-supply",
      recommendation: expect.stringMatching(/apply|review/)
    });
    expect(results[0]?.components.map((component) => component.id)).toEqual([
      "relevance",
      "eligibility",
      "commercial",
      "execution",
      "competition",
      "urgency"
    ]);
  });
});

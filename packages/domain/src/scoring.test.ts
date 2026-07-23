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

  it("downranks generic consulting CPVs without IT evidence", () => {
    const results = scoreOpportunityAcrossProfiles(
      {
        title:
          "Professional services for preparation of a masterplan for historic estates",
        cpvCodes: ["79415200", "71310000"],
        submissionDeadline: new Date("2026-08-20T00:00:00.000Z")
      },
      { now: new Date("2026-07-23T00:00:00.000Z") }
    );

    expect(results[0]?.totalScore).toBeLessThan(55);
    expect(results[0]?.recommendation).toBe("skip");
  });

  it("downranks generic office supply CPVs without hardware evidence", () => {
    const results = scoreOpportunityAcrossProfiles(
      {
        title: "Supply of personalized souvenir products for resale",
        cpvCodes: ["30192700", "39298900"],
        submissionDeadline: new Date("2026-08-20T00:00:00.000Z")
      },
      { now: new Date("2026-07-23T00:00:00.000Z") }
    );

    expect(results[0]?.totalScore).toBeLessThan(55);
    expect(results[0]?.recommendation).toBe("skip");
  });

  it("keeps generic IT services CPVs when the title has explicit IT evidence", () => {
    const results = scoreOpportunityAcrossProfiles(
      {
        title: "Managed IT services 2026",
        cpvCodes: ["72000000"],
        submissionDeadline: new Date("2026-08-20T00:00:00.000Z"),
        estimatedValue: {
          amount: 120000,
          currency: "EUR"
        }
      },
      { now: new Date("2026-07-23T00:00:00.000Z") }
    );

    expect(results[0]).toMatchObject({
      recommendation: expect.stringMatching(/apply|review/)
    });
    expect(results[0]?.totalScore).toBeGreaterThanOrEqual(62);
  });

  it("scores strong IT services titles even when source metadata has no CPV", () => {
    const results = scoreOpportunityAcrossProfiles(
      {
        title: "MANAGED IT SERVICES 2026",
        cpvCodes: [],
        description: "Service desk, infrastructure monitoring, and managed IT support.",
        submissionDeadline: new Date("2026-08-20T00:00:00.000Z")
      },
      { now: new Date("2026-07-23T00:00:00.000Z") }
    );

    expect(results[0]).toMatchObject({
      recommendation: expect.stringMatching(/apply|review/)
    });
    expect(results[0]?.totalScore).toBeGreaterThanOrEqual(62);
  });

  it("scores strong IT equipment titles even when source metadata has no CPV", () => {
    const results = scoreOpportunityAcrossProfiles(
      {
        title: "Supply of IT equipment for data exchange",
        cpvCodes: [],
        description: "Delivery and installation of computer equipment.",
        submissionDeadline: new Date("2026-08-20T00:00:00.000Z")
      },
      { now: new Date("2026-07-23T00:00:00.000Z") }
    );

    expect(results[0]).toMatchObject({
      profileId: "hardware-supply",
      recommendation: expect.stringMatching(/apply|review/)
    });
    expect(results[0]?.totalScore).toBeGreaterThanOrEqual(62);
  });
});

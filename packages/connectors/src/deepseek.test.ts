import { describe, expect, it } from "vitest";

import { DeepSeekClient } from "./deepseek.js";
import type { Fetcher } from "./http.js";

describe("DeepSeekClient", () => {
  it("requests strict JSON tender analysis and parses the model response", async () => {
    let capturedBody: unknown;
    const fetcher: Fetcher = {
      async fetch(_input, init) {
        capturedBody = JSON.parse(String(init?.body));

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: "Software delivery tender with enough metadata to review.",
                    businessFitScore: 88,
                    readinessScore: 74,
                    commercialScore: 69,
                    dataConfidenceScore: 91,
                    complexity: "medium",
                    sectors: ["software", "integration"],
                    eligibilityCriteria: ["Verify references for similar systems."],
                    requiredDocuments: ["Technical proposal."],
                    certifications: ["ISO 27001 may be relevant."],
                    risks: ["Confirm acceptance criteria in official documents."],
                    missingData: []
                  })
                }
              }
            ]
          }),
          {
            headers: {
              "Content-Type": "application/json"
            },
            status: 200
          }
        );
      }
    };

    const client = new DeepSeekClient({
      apiKey: "test-key",
      fetcher,
      model: "deepseek-v4-flash"
    });
    const analysis = await client.analyzeTender({
      title: "Software integration platform",
      buyerName: "Example buyer",
      source: "ted",
      cpvCodes: ["72230000"],
      description: "API integration and support.",
      documentUrls: ["https://buyer.example.test/documents"],
      submissionUrls: ["https://buyer.example.test/submit"]
    });

    expect(capturedBody).toMatchObject({
      model: "deepseek-v4-flash",
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      stream: false
    });
    expect(analysis).toMatchObject({
      businessFitScore: 88,
      readinessScore: 74,
      dataConfidenceScore: 91,
      sectors: ["software", "integration"]
    });
  });

  it("normalizes accidental 0-10 score output to the product 0-100 scale", async () => {
    const fetcher: Fetcher = {
      async fetch() {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: "Relevant software opportunity.",
                    businessFitScore: 9,
                    readinessScore: 6,
                    commercialScore: 5,
                    dataConfidenceScore: 7,
                    complexity: "medium",
                    sectors: ["software"],
                    eligibilityCriteria: [],
                    requiredDocuments: [],
                    certifications: [],
                    risks: [],
                    missingData: []
                  })
                }
              }
            ]
          }),
          {
            headers: {
              "Content-Type": "application/json"
            },
            status: 200
          }
        );
      }
    };

    const client = new DeepSeekClient({
      apiKey: "test-key",
      fetcher
    });
    const analysis = await client.analyzeTender({
      title: "Software integration platform",
      buyerName: "Example buyer",
      source: "ted",
      cpvCodes: ["72230000"]
    });

    expect(analysis).toMatchObject({
      businessFitScore: 90,
      readinessScore: 60,
      commercialScore: 50,
      dataConfidenceScore: 70
    });
  });
});

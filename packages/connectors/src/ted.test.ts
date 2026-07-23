import { describe, expect, it } from "vitest";

import type { Fetcher } from "./http.js";
import { buildBulgarianSoftwareTedQuery, buildTedIctQuery, TedClient } from "./ted.js";

describe("TedClient", () => {
  it("builds a strict Bulgarian software query", () => {
    expect(buildBulgarianSoftwareTedQuery("20260701")).toBe(
      "(classification-cpv = 72* OR classification-cpv = 48* OR classification-cpv = 723* OR classification-cpv = 724* OR classification-cpv = 726* OR classification-cpv = 727* OR classification-cpv = 728* OR classification-cpv = 729* OR classification-cpv = 793* OR classification-cpv = 794*) AND buyer-country = BGR AND publication-date >= 20260701 AND publication-date <= 20260701 AND notice-type IN (cn-standard cn-social) SORT BY publication-date DESC"
    );
  });

  it("builds an ICT query across multiple buyer countries", () => {
    expect(
      buildTedIctQuery({
        buyerCountryCodes: ["ROU", "DEU", "FRA"],
        publicationDateFrom: "20260701",
        publicationDateTo: "20260703"
      })
    ).toContain(
      "buyer-country IN (ROU DEU FRA) AND publication-date >= 20260701 AND publication-date <= 20260703"
    );
    expect(
      buildTedIctQuery({
        buyerCountryCodes: ["ROU", "DEU", "FRA"],
        publicationDateFrom: "20260701"
      })
    ).toContain("classification-cpv = 302*");
  });

  it("sends TED search requests with safe defaults", async () => {
    let requestBody: unknown;
    const fetcher: Fetcher = {
      async fetch(_input, init) {
        requestBody = JSON.parse(String(init?.body));
        return Response.json({
          totalNoticeCount: 1,
          notices: [{ "publication-number": "510019-2026" }]
        });
      }
    };

    const client = new TedClient({
      baseUrl: "https://ted.example.test",
      fetcher
    });

    const response = await client.searchNotices({
      query: "classification-cpv = 72*",
      fields: ["publication-number"]
    });

    expect(requestBody).toMatchObject({
      limit: 250,
      scope: "ACTIVE",
      onlyLatestVersions: true,
      paginationMode: "ITERATION"
    });
    expect(response).toEqual({
      totalNoticeCount: 1,
      notices: [{ "publication-number": "510019-2026" }]
    });
  });
});

import { describe, expect, it } from "vitest";

import type { Fetcher } from "./http.js";
import { SediaClient } from "./sedia.js";

describe("SediaClient", () => {
  it("sends SEDIA search requests with ICT tender defaults", async () => {
    let requestUrl: URL | undefined;
    let displayFields: string[] = [];
    const fetcher: Fetcher = {
      async fetch(input, init) {
        requestUrl = new URL(String(input));
        const body = init?.body;
        if (body instanceof FormData) {
          const rawDisplayFields = body.get("displayFields");
          if (rawDisplayFields instanceof Blob) {
            displayFields = JSON.parse(await rawDisplayFields.text()) as string[];
          }
        }

        return Response.json({
          totalResults: 1,
          results: [{ reference: "sedia-ref" }]
        });
      }
    };

    const client = new SediaClient({
      baseUrl: "https://sedia.example.test/search",
      fetcher
    });

    const response = await client.search({
      text: "software",
      pageSize: 10
    });

    expect(requestUrl?.searchParams.get("apiKey")).toBe("SEDIA");
    expect(requestUrl?.searchParams.get("text")).toBe("software");
    expect(requestUrl?.searchParams.get("pageSize")).toBe("10");
    expect(displayFields).toContain("url");
    expect(displayFields).toContain("deadlineDate");
    expect(displayFields).toContain("description");
    expect(displayFields).toContain("cftSubmissionMethodCode");
    expect(response.results).toEqual([{ reference: "sedia-ref" }]);
  });

  it("paginates until it reaches the reported total", async () => {
    const requestedPages: string[] = [];
    const fetcher: Fetcher = {
      async fetch(input) {
        const url = new URL(String(input));
        const pageNumber = url.searchParams.get("pageNumber") ?? "1";
        requestedPages.push(pageNumber);

        return Response.json({
          totalResults: 3,
          results:
            pageNumber === "1"
              ? [{ reference: "first" }, { reference: "second" }]
              : [{ reference: "third" }]
        });
      }
    };

    const client = new SediaClient({
      baseUrl: "https://sedia.example.test/search",
      fetcher
    });

    const response = await client.searchAll({
      text: "cloud",
      pageSize: 2
    });

    expect(requestedPages).toEqual(["1", "2"]);
    expect(response.results.map((result) => result.reference)).toEqual([
      "first",
      "second",
      "third"
    ]);
  });
});

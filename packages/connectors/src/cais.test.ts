import { describe, expect, it } from "vitest";

import { CaisOpenDataClient } from "./cais.js";
import type { Fetcher } from "./http.js";

describe("CaisOpenDataClient", () => {
  it("parses and classifies daily open-data bucket listings", async () => {
    const fetcher: Fetcher = {
      async fetch() {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
          <ListBucketResult>
            <Contents>
              <Key>Автоматично генерирани данни за поръчки.json</Key>
              <LastModified>2026-07-23T06:00:00.000Z</LastModified>
              <Size>123</Size>
            </Contents>
            <Contents>
              <Key>Автоматично генерирани данни съгласно стандарт OCDS.json</Key>
              <Size>456</Size>
            </Contents>
          </ListBucketResult>`,
          {
            status: 200,
            headers: {
              "Content-Type": "application/xml"
            }
          }
        );
      }
    };

    const client = new CaisOpenDataClient({
      baseUrl: "https://storage.example.test",
      fetcher
    });

    const files = await client.listDailyFiles("2026-07-22");

    expect(files).toEqual([
      {
        key: "Автоматично генерирани данни за поръчки.json",
        url: "https://storage.example.test/open-data-2026-07-22/%D0%90%D0%B2%D1%82%D0%BE%D0%BC%D0%B0%D1%82%D0%B8%D1%87%D0%BD%D0%BE%20%D0%B3%D0%B5%D0%BD%D0%B5%D1%80%D0%B8%D1%80%D0%B0%D0%BD%D0%B8%20%D0%B4%D0%B0%D0%BD%D0%BD%D0%B8%20%D0%B7%D0%B0%20%D0%BF%D0%BE%D1%80%D1%8A%D1%87%D0%BA%D0%B8.json",
        size: 123,
        kind: "tenders",
        lastModified: "2026-07-23T06:00:00.000Z"
      },
      {
        key: "Автоматично генерирани данни съгласно стандарт OCDS.json",
        url: "https://storage.example.test/open-data-2026-07-22/%D0%90%D0%B2%D1%82%D0%BE%D0%BC%D0%B0%D1%82%D0%B8%D1%87%D0%BD%D0%BE%20%D0%B3%D0%B5%D0%BD%D0%B5%D1%80%D0%B8%D1%80%D0%B0%D0%BD%D0%B8%20%D0%B4%D0%B0%D0%BD%D0%BD%D0%B8%20%D1%81%D1%8A%D0%B3%D0%BB%D0%B0%D1%81%D0%BD%D0%BE%20%D1%81%D1%82%D0%B0%D0%BD%D0%B4%D0%B0%D1%80%D1%82%20OCDS.json",
        size: 456,
        kind: "ocds-notices"
      }
    ]);
  });
});

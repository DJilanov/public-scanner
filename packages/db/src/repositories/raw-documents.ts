import { createHash } from "node:crypto";
import type { QueryResultRow } from "pg";

import type { Queryable } from "../client.js";
import type { RawDocumentInput } from "../types.js";

interface RawDocumentRow extends QueryResultRow {
  id: string;
}

export async function insertRawDocument(
  db: Queryable,
  input: RawDocumentInput
): Promise<string> {
  const checksum = hashPayload(input.payload);
  const result = await db.query<RawDocumentRow>(
    `
      WITH inserted AS (
        INSERT INTO raw_documents (
          source_run_id,
          source,
          source_date,
          source_url,
          content_type,
          checksum_sha256,
          payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        ON CONFLICT (source, source_url, checksum_sha256) DO NOTHING
        RETURNING id
      )
      SELECT id FROM inserted
      UNION ALL
      SELECT id FROM raw_documents
      WHERE source = $2 AND source_url = $4 AND checksum_sha256 = $6
      LIMIT 1
    `,
    [
      input.sourceRunId ?? null,
      input.source,
      input.sourceDate ?? null,
      input.sourceUrl,
      input.contentType,
      checksum,
      JSON.stringify(input.payload)
    ]
  );

  const id = result.rows[0]?.id;
  if (!id) {
    throw new Error("Failed to store raw document");
  }

  return id;
}

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

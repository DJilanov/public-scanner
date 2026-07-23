import type { Queryable } from "../client.js";
import type { SourceErrorInput } from "../types.js";

export async function insertSourceError(
  db: Queryable,
  input: SourceErrorInput
): Promise<void> {
  await db.query(
    `
      INSERT INTO source_errors (
        source_run_id,
        source,
        source_date,
        context,
        error_message,
        payload
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [
      input.sourceRunId ?? null,
      input.source,
      input.sourceDate ?? null,
      input.context,
      input.errorMessage,
      input.payload === undefined ? null : JSON.stringify(input.payload)
    ]
  );
}

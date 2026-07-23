import type { QueryResultRow } from "pg";

import type { Queryable } from "../client.js";
import type {
  SourceRunCompletionInput,
  SourceRunInput,
  SourceRunStatus
} from "../types.js";

interface SourceRunRow extends QueryResultRow {
  id: string;
}

export async function createSourceRun(
  db: Queryable,
  input: SourceRunInput
): Promise<string> {
  const result = await db.query<SourceRunRow>(
    `
      INSERT INTO source_runs (source, source_date, status)
      VALUES ($1, $2, 'running')
      RETURNING id
    `,
    [input.source, input.sourceDate]
  );

  const id = result.rows[0]?.id;
  if (!id) {
    throw new Error("Failed to create source run");
  }

  return id;
}

export async function finishSourceRun(
  db: Queryable,
  sourceRunId: string,
  input: SourceRunCompletionInput
): Promise<void> {
  await db.query(
    `
      UPDATE source_runs
      SET
        status = $2,
        finished_at = now(),
        fetched_count = $3,
        inserted_count = $4,
        updated_count = $5,
        skipped_count = $6,
        failed_count = $7,
        error_message = $8
      WHERE id = $1
    `,
    [
      sourceRunId,
      input.status,
      input.fetchedCount,
      input.insertedCount,
      input.updatedCount,
      input.skippedCount,
      input.failedCount,
      input.errorMessage ?? null
    ]
  );
}

export function summarizeRunStatus(input: {
  failedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
}): SourceRunStatus {
  if (input.failedCount > 0 && input.insertedCount + input.updatedCount > 0) {
    return "partial";
  }

  if (input.failedCount > 0) {
    return "failed";
  }

  return "succeeded";
}

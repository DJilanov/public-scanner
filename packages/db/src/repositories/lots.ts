import type { NormalizedOpportunityLot } from "@public-scanner/domain";
import type { QueryResultRow } from "pg";

import type { Queryable } from "../client.js";
import type { IngestionWriteResult } from "../types.js";

interface LotUpsertRow extends QueryResultRow {
  inserted: boolean;
}

export async function upsertOpportunityLot(
  db: Queryable,
  lot: NormalizedOpportunityLot
): Promise<IngestionWriteResult | undefined> {
  const result = await db.query<LotUpsertRow>(
    `
      INSERT INTO opportunity_lots (
        opportunity_id,
        external_id,
        lot_identifier,
        title,
        cpv_codes,
        estimated_value,
        currency,
        submission_deadline
      )
      SELECT
        id,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9
      FROM opportunities
      WHERE source = $1 AND external_id = $2
      ON CONFLICT (opportunity_id, external_id) DO UPDATE SET
        lot_identifier = excluded.lot_identifier,
        title = excluded.title,
        cpv_codes = excluded.cpv_codes,
        estimated_value = excluded.estimated_value,
        currency = excluded.currency,
        submission_deadline = excluded.submission_deadline,
        updated_at = now()
      RETURNING (xmax = 0) AS inserted
    `,
    [
      lot.source,
      lot.opportunityExternalId,
      lot.externalId,
      lot.lotIdentifier ?? null,
      lot.title ?? null,
      lot.cpvCodes,
      lot.estimatedValue?.amount ?? null,
      lot.estimatedValue?.currency ?? null,
      lot.submissionDeadline ?? null
    ]
  );

  const row = result.rows[0];
  return row ? { inserted: row.inserted } : undefined;
}

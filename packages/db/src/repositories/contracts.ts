import type {
  NormalizedContract,
  NormalizedContractAmendment
} from "@public-scanner/domain";
import type { QueryResultRow } from "pg";

import type { Queryable } from "../client.js";
import type { IngestionWriteResult } from "../types.js";

interface ContractUpsertRow extends QueryResultRow {
  id: string;
  inserted: boolean;
}

export async function upsertContract(
  db: Queryable,
  contract: NormalizedContract,
  rawDocumentId?: string
): Promise<IngestionWriteResult> {
  const result = await db.query<ContractUpsertRow>(
    `
      INSERT INTO contracts (
        source,
        external_id,
        opportunity_id,
        buyer_name,
        supplier_name,
        supplier_registry_number,
        contract_number,
        contract_date,
        title,
        value,
        currency,
        raw_document_id
      )
      VALUES (
        $1,
        $2,
        (
          SELECT id FROM opportunities
          WHERE source = $1 AND external_id = $3
          LIMIT 1
        ),
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12
      )
      ON CONFLICT (source, external_id) DO UPDATE SET
        opportunity_id = excluded.opportunity_id,
        buyer_name = excluded.buyer_name,
        supplier_name = excluded.supplier_name,
        supplier_registry_number = excluded.supplier_registry_number,
        contract_number = excluded.contract_number,
        contract_date = excluded.contract_date,
        title = excluded.title,
        value = excluded.value,
        currency = excluded.currency,
        raw_document_id = excluded.raw_document_id,
        updated_at = now()
      RETURNING id, (xmax = 0) AS inserted
    `,
    [
      contract.source,
      contract.externalId,
      contract.opportunityExternalId ?? null,
      contract.buyerName,
      contract.supplierName ?? null,
      contract.supplierRegistryNumber ?? null,
      contract.contractNumber ?? null,
      contract.contractDate ?? null,
      contract.title,
      contract.value?.amount ?? null,
      contract.value?.currency ?? null,
      rawDocumentId ?? null
    ]
  );

  return {
    inserted: result.rows[0]?.inserted ?? false
  };
}

export async function upsertContractAmendment(
  db: Queryable,
  amendment: NormalizedContractAmendment,
  rawDocumentId?: string
): Promise<IngestionWriteResult> {
  const result = await db.query<ContractUpsertRow>(
    `
      INSERT INTO contract_amendments (
        source,
        external_id,
        contract_id,
        previous_value,
        current_value,
        currency,
        change_reason,
        change_description,
        raw_document_id
      )
      VALUES (
        $1,
        $2,
        (
          SELECT id FROM contracts
          WHERE source = $1 AND (external_id = $3 OR contract_number = $4)
          ORDER BY contract_date DESC NULLS LAST
          LIMIT 1
        ),
        $5,
        $6,
        $7,
        $8,
        $9,
        $10
      )
      ON CONFLICT (source, external_id) DO UPDATE SET
        contract_id = excluded.contract_id,
        previous_value = excluded.previous_value,
        current_value = excluded.current_value,
        currency = excluded.currency,
        change_reason = excluded.change_reason,
        change_description = excluded.change_description,
        raw_document_id = excluded.raw_document_id
      RETURNING id, (xmax = 0) AS inserted
    `,
    [
      amendment.source,
      amendment.externalId,
      amendment.contractExternalId ?? null,
      amendment.contractNumber ?? null,
      amendment.previousValue?.amount ?? null,
      amendment.currentValue?.amount ?? null,
      amendment.currentValue?.currency ?? amendment.previousValue?.currency ?? null,
      amendment.changeReason ?? null,
      amendment.changeDescription ?? null,
      rawDocumentId ?? null
    ]
  );

  return {
    inserted: result.rows[0]?.inserted ?? false
  };
}

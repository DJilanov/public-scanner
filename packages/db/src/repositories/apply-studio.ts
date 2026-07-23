import type {
  ApplyStudioData,
  BusinessProfileId,
  ComplianceItem,
  ComplianceItemInput,
  EvidenceItem,
  EvidenceItemInput
} from "@public-scanner/domain";

import type { Queryable } from "../client.js";
import type {
  ApplyStudioRepositoryPort,
  ComplianceItemRow,
  ComplianceItemUpdateInput,
  DocumentIntelligenceRow,
  EvidenceItemRow
} from "../types.js";

export class ApplyStudioRepository implements ApplyStudioRepositoryPort {
  public constructor(private readonly db: Queryable) {}

  public async getApplyStudioData(opportunityId?: string): Promise<ApplyStudioData> {
    if (opportunityId) {
      await this.ensureComplianceFromDocumentIntelligence(opportunityId);
    }

    const evidenceResult = await this.db.query<EvidenceItemRow>(
      `
        SELECT
          id,
          title,
          type,
          profile_ids,
          issuer,
          valid_until,
          summary,
          storage_url,
          created_at,
          updated_at
        FROM evidence_items
        WHERE user_key = 'default'
        ORDER BY type ASC, valid_until ASC NULLS LAST, title ASC
      `
    );

    const complianceResult = await this.db.query<ComplianceItemRow>(
      `
        SELECT
          id,
          opportunity_id,
          requirement_type,
          requirement,
          status,
          owner,
          evidence_item_ids,
          notes,
          created_at,
          updated_at
        FROM compliance_items
        WHERE user_key = 'default'
          AND ($1::uuid IS NULL OR opportunity_id = $1::uuid)
        ORDER BY
          CASE status
            WHEN 'blocked' THEN 1
            WHEN 'missing' THEN 2
            WHEN 'in-progress' THEN 3
            WHEN 'ready' THEN 4
            ELSE 5
          END,
          requirement_type ASC,
          created_at ASC
      `,
      [opportunityId ?? null]
    );

    return {
      evidenceItems: evidenceResult.rows.map(mapEvidenceItemRow),
      complianceItems: complianceResult.rows.map(mapComplianceItemRow)
    };
  }

  public async upsertEvidenceItem(
    input: EvidenceItemInput,
    id?: string
  ): Promise<EvidenceItem> {
    const result = await this.db.query<EvidenceItemRow>(
      `
        INSERT INTO evidence_items (
          id,
          user_key,
          title,
          type,
          profile_ids,
          issuer,
          valid_until,
          summary,
          storage_url
        )
        VALUES (
          coalesce($1::uuid, gen_random_uuid()),
          'default',
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8
        )
        ON CONFLICT (id) DO UPDATE SET
          title = excluded.title,
          type = excluded.type,
          profile_ids = excluded.profile_ids,
          issuer = excluded.issuer,
          valid_until = excluded.valid_until,
          summary = excluded.summary,
          storage_url = excluded.storage_url,
          updated_at = now()
        RETURNING
          id,
          title,
          type,
          profile_ids,
          issuer,
          valid_until,
          summary,
          storage_url,
          created_at,
          updated_at
      `,
      [
        id ?? null,
        input.title,
        input.type,
        input.profileIds ?? [],
        input.issuer ?? null,
        input.validUntil ?? null,
        input.summary ?? null,
        input.storageUrl ?? null
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to save evidence item");
    }

    return mapEvidenceItemRow(row);
  }

  public async ensureComplianceItems(
    opportunityId: string,
    inputs: ComplianceItemInput[]
  ): Promise<ComplianceItem[]> {
    for (const input of inputs) {
      await this.insertComplianceItem(opportunityId, input);
    }

    return this.listComplianceItems(opportunityId);
  }

  public async updateComplianceItem(
    id: string,
    input: ComplianceItemUpdateInput
  ): Promise<ComplianceItem> {
    const result = await this.db.query<ComplianceItemRow>(
      `
        UPDATE compliance_items
        SET
          status = coalesce($2, status),
          owner = CASE WHEN $3::boolean THEN $4 ELSE owner END,
          evidence_item_ids = coalesce($5, evidence_item_ids),
          notes = CASE WHEN $6::boolean THEN $7 ELSE notes END,
          updated_at = now()
        WHERE id = $1
          AND user_key = 'default'
        RETURNING
          id,
          opportunity_id,
          requirement_type,
          requirement,
          status,
          owner,
          evidence_item_ids,
          notes,
          created_at,
          updated_at
      `,
      [
        id,
        input.status ?? null,
        "owner" in input,
        input.owner ?? null,
        input.evidenceItemIds ?? null,
        "notes" in input,
        input.notes ?? null
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Compliance item not found");
    }

    return mapComplianceItemRow(row);
  }

  private async ensureComplianceFromDocumentIntelligence(
    opportunityId: string
  ): Promise<void> {
    const result = await this.db.query<DocumentIntelligenceRow>(
      `
        SELECT
          status,
          summary,
          eligibility_criteria,
          required_documents,
          certifications,
          risks,
          extracted_at
        FROM document_intelligence
        WHERE opportunity_id = $1
        LIMIT 1
      `,
      [opportunityId]
    );

    const row = result.rows[0];
    if (!row) {
      return;
    }

    const inputs: ComplianceItemInput[] = [
      ...safeStringArray(row.eligibility_criteria).map((requirement) => ({
        requirementType: "eligibility" as const,
        requirement
      })),
      ...safeStringArray(row.required_documents).map((requirement) => ({
        requirementType: "required-document" as const,
        requirement
      })),
      ...safeStringArray(row.certifications).map((requirement) => ({
        requirementType: "certification" as const,
        requirement
      })),
      ...safeStringArray(row.risks).map((requirement) => ({
        requirementType: "risk" as const,
        requirement,
        status: "blocked" as const
      }))
    ];

    for (const input of inputs) {
      await this.insertComplianceItem(opportunityId, input);
    }
  }

  private async insertComplianceItem(
    opportunityId: string,
    input: ComplianceItemInput
  ): Promise<void> {
    await this.db.query(
      `
        INSERT INTO compliance_items (
          opportunity_id,
          user_key,
          requirement_type,
          requirement,
          status,
          owner,
          evidence_item_ids,
          notes
        )
        VALUES ($1, 'default', $2, $3, $4, $5, $6, $7)
        ON CONFLICT (opportunity_id, user_key, requirement_type, requirement)
        DO NOTHING
      `,
      [
        opportunityId,
        input.requirementType,
        input.requirement,
        input.status ?? "missing",
        input.owner ?? null,
        input.evidenceItemIds ?? [],
        input.notes ?? null
      ]
    );
  }

  private async listComplianceItems(opportunityId: string): Promise<ComplianceItem[]> {
    const result = await this.db.query<ComplianceItemRow>(
      `
        SELECT
          id,
          opportunity_id,
          requirement_type,
          requirement,
          status,
          owner,
          evidence_item_ids,
          notes,
          created_at,
          updated_at
        FROM compliance_items
        WHERE opportunity_id = $1
          AND user_key = 'default'
        ORDER BY requirement_type ASC, created_at ASC
      `,
      [opportunityId]
    );

    return result.rows.map(mapComplianceItemRow);
  }
}

function mapEvidenceItemRow(row: EvidenceItemRow): EvidenceItem {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    profileIds: row.profile_ids ?? [],
    ...(row.issuer !== null ? { issuer: row.issuer } : {}),
    ...(row.valid_until
      ? { validUntil: normalizeDbDate(row.valid_until).slice(0, 10) }
      : {}),
    ...(row.summary !== null ? { summary: row.summary } : {}),
    ...(row.storage_url !== null ? { storageUrl: row.storage_url } : {}),
    ...(row.created_at ? { createdAt: normalizeDbDate(row.created_at) } : {}),
    ...(row.updated_at ? { updatedAt: normalizeDbDate(row.updated_at) } : {})
  };
}

function mapComplianceItemRow(row: ComplianceItemRow): ComplianceItem {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    requirementType: row.requirement_type,
    requirement: row.requirement,
    status: row.status,
    evidenceItemIds: row.evidence_item_ids ?? [],
    ...(row.owner !== null ? { owner: row.owner } : {}),
    ...(row.notes !== null ? { notes: row.notes } : {}),
    ...(row.created_at ? { createdAt: normalizeDbDate(row.created_at) } : {}),
    ...(row.updated_at ? { updatedAt: normalizeDbDate(row.updated_at) } : {})
  };
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeDbDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

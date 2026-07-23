import type { Queryable } from "../client.js";
import type { DocumentIntelligenceInput } from "../types.js";

export async function upsertDocumentIntelligence(
  db: Queryable,
  opportunityId: string,
  input: DocumentIntelligenceInput
): Promise<void> {
  await db.query(
    `
      INSERT INTO document_intelligence (
        opportunity_id,
        status,
        summary,
        eligibility_criteria,
        required_documents,
        certifications,
        risks,
        extracted_at,
        ai_analysis
      )
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9::jsonb)
      ON CONFLICT (opportunity_id) DO UPDATE SET
        status = excluded.status,
        summary = excluded.summary,
        eligibility_criteria = excluded.eligibility_criteria,
        required_documents = excluded.required_documents,
        certifications = excluded.certifications,
        risks = excluded.risks,
        extracted_at = excluded.extracted_at,
        ai_analysis = excluded.ai_analysis,
        updated_at = now()
    `,
    [
      opportunityId,
      input.status,
      input.summary ?? null,
      JSON.stringify(input.eligibilityCriteria),
      JSON.stringify(input.requiredDocuments),
      JSON.stringify(input.certifications),
      JSON.stringify(input.risks),
      input.extractedAt ?? null,
      input.aiAnalysis ? JSON.stringify(input.aiAnalysis) : null
    ]
  );
}

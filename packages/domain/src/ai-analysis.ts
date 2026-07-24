import type {
  DocumentIntelligence,
  Money,
  Opportunity,
  ProcurementSource
} from "./types.js";

export interface TenderAiAnalysisRequest {
  title: string;
  buyerName: string;
  source: ProcurementSource | string;
  cpvCodes: readonly string[];
  description?: string;
  estimatedValue?: Money;
  publicationDate?: string;
  submissionDeadline?: string;
  documentUrls?: readonly string[];
  submissionUrls?: readonly string[];
}

export interface TenderAiAnalysisDraft {
  summary: string;
  businessFitScore: number;
  readinessScore: number;
  commercialScore: number;
  dataConfidenceScore: number;
  complexity: "low" | "medium" | "high" | "unknown";
  sectors: string[];
  eligibilityCriteria: string[];
  requiredDocuments: string[];
  certifications: string[];
  risks: string[];
  missingData: string[];
}

export interface TenderAiAnalysisMetadata {
  analyzedAt: string;
  model: string;
  provider: string;
}

export function buildTenderAiAnalysisRequest(
  opportunity: Pick<
    Opportunity,
    | "title"
    | "buyerName"
    | "source"
    | "cpvCodes"
    | "description"
    | "estimatedValue"
    | "publicationDate"
    | "submissionDeadline"
    | "documentUrls"
    | "submissionUrls"
  >
): TenderAiAnalysisRequest {
  return {
    title: opportunity.title,
    buyerName: opportunity.buyerName,
    source: opportunity.source,
    cpvCodes: opportunity.cpvCodes,
    ...(opportunity.description ? { description: opportunity.description } : {}),
    ...(opportunity.estimatedValue ? { estimatedValue: opportunity.estimatedValue } : {}),
    ...(opportunity.publicationDate
      ? { publicationDate: opportunity.publicationDate }
      : {}),
    ...(opportunity.submissionDeadline
      ? { submissionDeadline: opportunity.submissionDeadline }
      : {}),
    ...(opportunity.documentUrls?.length
      ? { documentUrls: opportunity.documentUrls }
      : {}),
    ...(opportunity.submissionUrls?.length
      ? { submissionUrls: opportunity.submissionUrls }
      : {})
  };
}

export function mergeTenderAiAnalysis(
  baseIntelligence: DocumentIntelligence,
  analysis: TenderAiAnalysisDraft,
  metadata: TenderAiAnalysisMetadata
): DocumentIntelligence {
  const aiRisks = [
    ...analysis.risks,
    ...analysis.missingData.map((item) => `Missing data: ${item}.`),
    ...(analysis.dataConfidenceScore < 60
      ? ["AI analysis confidence is low; verify the official documents manually."]
      : [])
  ];
  const baseRisks =
    aiRisks.length > 0
      ? baseIntelligence.risks.filter(
          (risk) =>
            risk !== "No major metadata risk detected; verify against official documents."
        )
      : baseIntelligence.risks;

  return {
    status: "ready",
    summary: [
      `AI-assisted (${analysis.dataConfidenceScore}/100 confidence): ${analysis.summary}`,
      ...(analysis.sectors.length > 0
        ? [`Sectors: ${analysis.sectors.slice(0, 4).join(", ")}.`]
        : []),
      `Scores: fit ${analysis.businessFitScore}/100, readiness ${analysis.readinessScore}/100, commercial ${analysis.commercialScore}/100, complexity ${analysis.complexity}.`
    ].join(" "),
    eligibilityCriteria: mergeStringLists(
      analysis.eligibilityCriteria,
      baseIntelligence.eligibilityCriteria
    ),
    requiredDocuments: mergeStringLists(
      analysis.requiredDocuments,
      baseIntelligence.requiredDocuments
    ),
    certifications: mergeStringLists(
      analysis.certifications,
      baseIntelligence.certifications
    ),
    risks: mergeStringLists(aiRisks, baseRisks),
    aiAnalysis: {
      provider: metadata.provider,
      model: metadata.model,
      analyzedAt: metadata.analyzedAt,
      businessFitScore: analysis.businessFitScore,
      readinessScore: analysis.readinessScore,
      commercialScore: analysis.commercialScore,
      dataConfidenceScore: analysis.dataConfidenceScore,
      complexity: analysis.complexity,
      sectors: analysis.sectors,
      missingData: analysis.missingData
    },
    ...(baseIntelligence.extractedAt ? { extractedAt: baseIntelligence.extractedAt } : {})
  };
}

function mergeStringLists(...lists: readonly string[][]): string[] {
  const values = new Map<string, string>();

  for (const list of lists) {
    for (const item of list) {
      const normalized = item.trim();
      if (!normalized) {
        continue;
      }

      const key = normalized.toLocaleLowerCase("en-US");
      if (!values.has(key)) {
        values.set(key, normalized);
      }
    }
  }

  return [...values.values()].slice(0, 12);
}

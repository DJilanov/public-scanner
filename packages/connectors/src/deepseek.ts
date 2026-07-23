import { z } from "zod";

import { defaultFetcher, fetchJson, type Fetcher } from "./http.js";

export interface DeepSeekClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetcher?: Fetcher;
  maxTokens?: number;
  model?: string;
}

export interface DeepSeekTenderAnalysisRequest {
  title: string;
  buyerName: string;
  source: string;
  cpvCodes: readonly string[];
  description?: string;
  estimatedValue?: {
    amount: number;
    currency: string;
  };
  publicationDate?: string;
  submissionDeadline?: string;
  documentUrls?: readonly string[];
  submissionUrls?: readonly string[];
}

export interface DeepSeekTenderAnalysis {
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

const DeepSeekChatResponseSchema = z
  .object({
    choices: z
      .array(
        z.object({
          message: z.object({
            content: z.string().nullable()
          })
        })
      )
      .min(1)
  })
  .passthrough();

const DeepSeekTenderAnalysisRawSchema = z.object({
  summary: z.string().min(1),
  businessFitScore: scoreNumberSchema(),
  readinessScore: scoreNumberSchema(),
  commercialScore: scoreNumberSchema(),
  dataConfidenceScore: scoreNumberSchema(),
  complexity: z.enum(["low", "medium", "high", "unknown"]).catch("unknown"),
  sectors: z.array(z.string()).default([]),
  eligibilityCriteria: z.array(z.string()).default([]),
  requiredDocuments: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  missingData: z.array(z.string()).default([])
});

const DeepSeekTenderAnalysisSchema = DeepSeekTenderAnalysisRawSchema.transform(
  normalizeTenderAnalysisScores
);

export class DeepSeekClient {
  private readonly apiKey: string;
  private readonly baseUrl: URL;
  private readonly fetcher: Fetcher;
  private readonly maxTokens: number;
  private readonly model: string;

  public constructor(options: DeepSeekClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = new URL(options.baseUrl ?? "https://api.deepseek.com");
    this.fetcher = options.fetcher ?? defaultFetcher;
    this.maxTokens = options.maxTokens ?? 1800;
    this.model = options.model ?? "deepseek-v4-flash";
  }

  public async analyzeTender(
    request: DeepSeekTenderAnalysisRequest
  ): Promise<DeepSeekTenderAnalysis> {
    const url = new URL("/chat/completions", this.baseUrl);
    const response = await fetchJson<unknown>(this.fetcher, url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "system",
            content: buildTenderAnalysisSystemPrompt()
          },
          {
            role: "user",
            content: JSON.stringify(buildTenderAnalysisPayload(request))
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: this.maxTokens,
        thinking: { type: "disabled" },
        stream: false
      })
    });
    const parsed = DeepSeekChatResponseSchema.parse(response);
    const content = parsed.choices[0]?.message.content;

    if (!content) {
      throw new Error("DeepSeek returned an empty analysis response");
    }

    return DeepSeekTenderAnalysisSchema.parse(JSON.parse(content));
  }
}

function scoreNumberSchema() {
  return z.number().finite();
}

function normalizeTenderAnalysisScores(
  analysis: z.infer<typeof DeepSeekTenderAnalysisRawSchema>
): DeepSeekTenderAnalysis {
  const multiplier = getScoreMultiplier([
    analysis.businessFitScore,
    analysis.readinessScore,
    analysis.commercialScore,
    analysis.dataConfidenceScore
  ]);

  return {
    ...analysis,
    businessFitScore: boundedScore(analysis.businessFitScore * multiplier),
    readinessScore: boundedScore(analysis.readinessScore * multiplier),
    commercialScore: boundedScore(analysis.commercialScore * multiplier),
    dataConfidenceScore: boundedScore(analysis.dataConfidenceScore * multiplier)
  };
}

function getScoreMultiplier(scores: readonly number[]): number {
  const positiveScores = scores.filter((score) => score > 0);
  if (positiveScores.length === 0) {
    return 1;
  }

  const maxScore = Math.max(...positiveScores);
  if (maxScore <= 1) {
    return 100;
  }

  if (maxScore <= 10) {
    return 10;
  }

  return 1;
}

function boundedScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function buildTenderAnalysisSystemPrompt(): string {
  return [
    "You analyze public procurement notices for a software and hardware supplier.",
    "Return strict json only. Do not include markdown.",
    "Base conclusions only on the provided tender fields. Mark unknowns in missingData.",
    "Every score must be an integer from 0 to 100. Do not use a 0-10 or 0-1 scale.",
    "Scores must be explainable and conservative:",
    "- businessFitScore: fit for software development, IT services, cloud, cybersecurity, hardware, networking, or licensing.",
    "- readinessScore: practical ability to preview/apply based on deadline, documents, submission link, and clarity.",
    "- commercialScore: attractiveness based on estimated value and scope clarity.",
    "- dataConfidenceScore: confidence in the available metadata.",
    "JSON schema:",
    JSON.stringify({
      summary: "one concise sentence",
      businessFitScore: 86,
      readinessScore: 72,
      commercialScore: 64,
      dataConfidenceScore: 78,
      complexity: "low|medium|high|unknown",
      sectors: ["software"],
      eligibilityCriteria: ["criterion"],
      requiredDocuments: ["document"],
      certifications: ["certification or evidence"],
      risks: ["risk"],
      missingData: ["missing field"]
    })
  ].join("\n");
}

function buildTenderAnalysisPayload(
  request: DeepSeekTenderAnalysisRequest
): Record<string, unknown> {
  return {
    title: request.title,
    buyerName: request.buyerName,
    source: request.source,
    cpvCodes: request.cpvCodes,
    ...(request.description
      ? { description: truncateText(request.description, 6000) }
      : {}),
    ...(request.estimatedValue ? { estimatedValue: request.estimatedValue } : {}),
    ...(request.publicationDate ? { publicationDate: request.publicationDate } : {}),
    ...(request.submissionDeadline
      ? { submissionDeadline: request.submissionDeadline }
      : {}),
    ...(request.documentUrls?.length
      ? { documentUrls: request.documentUrls.slice(0, 3) }
      : {}),
    ...(request.submissionUrls?.length
      ? { submissionUrls: request.submissionUrls.slice(0, 3) }
      : {})
  };
}

function truncateText(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

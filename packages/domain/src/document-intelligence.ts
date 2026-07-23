import type { NormalizedOpportunityWithScore } from "./normalization.js";
import type { DocumentIntelligence } from "./types.js";

export interface DocumentIntelligenceOptions {
  now?: Date;
}

export function buildDocumentIntelligence(
  opportunity: NormalizedOpportunityWithScore,
  options: DocumentIntelligenceOptions = {}
): DocumentIntelligence {
  const now = options.now ?? new Date();
  const bestProfile = opportunity.profileScores[0];
  const eligibilityCriteria = buildEligibilityCriteria(opportunity);
  const requiredDocuments = buildRequiredDocuments(opportunity);
  const certifications = buildCertificationSignals(opportunity);
  const risks = buildRiskSignals(opportunity, now);
  const score = bestProfile?.totalScore ?? opportunity.match.score;
  const profileName = bestProfile?.profileName ?? "General IT";

  return {
    status: "ready",
    summary: `${profileName} fit ${score}/100 for ${opportunity.buyerName}. Use this as an initial triage before reading the official tender documents.`,
    eligibilityCriteria,
    requiredDocuments,
    certifications,
    risks,
    extractedAt: now.toISOString()
  };
}

function buildEligibilityCriteria(opportunity: NormalizedOpportunityWithScore): string[] {
  const criteria = new Set<string>([
    "Check bidder registration and exclusion declarations.",
    "Verify references for similar public-sector delivery."
  ]);

  if (opportunity.estimatedValue && opportunity.estimatedValue.amount >= 100000) {
    criteria.add("Expect turnover, team capacity, and previous contract evidence.");
  }

  if (opportunity.isEuFunded) {
    criteria.add("EU-funded procedure: check visibility, reporting, and grant rules.");
  }

  if (containsCpvPrefix(opportunity.cpvCodes, ["302", "323", "324", "325", "488"])) {
    criteria.add(
      "Hardware supply: validate manufacturer authorization and warranty terms."
    );
  }

  if (
    containsOpportunityText(opportunity, [
      "support",
      "maintenance",
      "\u043f\u043e\u0434\u0434\u0440\u044a\u0436\u043a\u0430"
    ])
  ) {
    criteria.add("Support scope: confirm SLA, response times, and coverage hours.");
  }

  if (opportunity.source === "sedia") {
    criteria.add("SEDIA tender: verify eSubmission access and EU portal role setup.");
  }

  return [...criteria];
}

function buildRequiredDocuments(opportunity: NormalizedOpportunityWithScore): string[] {
  const documents = new Set<string>([
    "Administrative declarations and bidder identification.",
    "Technical proposal mapped to every requirement.",
    "Financial proposal with clear pricing and validity.",
    "References or completion certificates for comparable work."
  ]);

  if (opportunity.estimatedValue && opportunity.estimatedValue.amount >= 50000) {
    documents.add("Evidence of economic and financial standing.");
  }

  if (containsCpvPrefix(opportunity.cpvCodes, ["302", "323", "324", "325"])) {
    documents.add("Manufacturer datasheets, warranty statement, and delivery schedule.");
  }

  if (
    containsOpportunityText(opportunity, [
      "hardware",
      "computer",
      "supercomputer",
      "server",
      "workstation"
    ])
  ) {
    documents.add("Manufacturer datasheets, warranty statement, and delivery schedule.");
  }

  if (
    containsCpvPrefix(opportunity.cpvCodes, ["722", "723", "724", "726", "727", "728"]) ||
    containsOpportunityText(opportunity, [
      "software",
      "cloud",
      "data processing",
      "integration",
      "maintenance"
    ])
  ) {
    documents.add(
      "Team CVs, delivery methodology, implementation plan, and acceptance plan."
    );
  }

  if (opportunity.source === "sedia") {
    documents.add("EU Funding & Tenders portal registration and eSubmission mandate.");
  }

  if (opportunity.documentUrls && opportunity.documentUrls.length > 0) {
    documents.add("Archived official tender attachment bundle from the buyer portal.");
  }

  return [...documents];
}

function buildCertificationSignals(
  opportunity: NormalizedOpportunityWithScore
): string[] {
  const certifications = new Set<string>();

  if (containsCpvPrefix(opportunity.cpvCodes, ["728", "4873"])) {
    certifications.add("ISO 27001 or equivalent security controls may be requested.");
  }

  if (
    containsOpportunityText(opportunity, [
      "quality",
      "\u043a\u0430\u0447\u0435\u0441\u0442\u0432\u043e"
    ])
  ) {
    certifications.add(
      "ISO 9001 or equivalent quality management evidence may be requested."
    );
  }

  if (containsCpvPrefix(opportunity.cpvCodes, ["302", "324", "325", "488"])) {
    certifications.add(
      "Vendor authorization, warranty service rights, or partner status may be requested."
    );
  }

  if (
    containsOpportunityText(opportunity, [
      "cyber",
      "security",
      "cloud",
      "data processing"
    ])
  ) {
    certifications.add("ISO 27001 or equivalent security controls may be requested.");
  }

  if (
    containsOpportunityText(opportunity, [
      "hardware",
      "computer",
      "supercomputer",
      "server"
    ])
  ) {
    certifications.add(
      "Vendor authorization, warranty service rights, or partner status may be requested."
    );
  }

  if (certifications.size === 0) {
    certifications.add("No certification signal detected in structured metadata.");
  }

  return [...certifications];
}

function buildRiskSignals(
  opportunity: NormalizedOpportunityWithScore,
  now: Date
): string[] {
  const risks = new Set<string>();
  const bestProfile = opportunity.profileScores[0];

  if (!opportunity.submissionDeadline) {
    risks.add("Submission deadline is missing in the crawled metadata.");
  } else {
    const days = getDaysUntil(new Date(opportunity.submissionDeadline), now);
    if (days < 0) {
      risks.add("Deadline has passed.");
    } else if (days < 7) {
      risks.add(`Only ${days} days remain before submission.`);
    }
  }

  if (!opportunity.estimatedValue) {
    risks.add("Estimated value is missing; commercial fit needs manual review.");
  }

  if (opportunity.source === "sedia") {
    risks.add(
      "SEDIA list metadata is enriched but official tender documents still need manual review."
    );
  }

  if (
    opportunity.source === "ted" &&
    (!opportunity.documentUrls || opportunity.documentUrls.length === 0)
  ) {
    risks.add(
      "TED notice has no detected buyer attachment URL; open the notice manually."
    );
  }

  if (bestProfile && bestProfile.recommendation === "need-partner") {
    risks.add("Profile score suggests partner capacity may be needed.");
  }

  if (bestProfile && bestProfile.recommendation === "skip") {
    risks.add("Low fit score; apply only if strategic value justifies the effort.");
  }

  if (risks.size === 0) {
    risks.add("No major metadata risk detected; verify against official documents.");
  }

  return [...risks];
}

function containsCpvPrefix(
  cpvCodes: readonly string[],
  prefixes: readonly string[]
): boolean {
  return cpvCodes.some((cpvCode) =>
    prefixes.some((prefix) => cpvCode.trim().startsWith(prefix))
  );
}

function containsText(value: string, needles: readonly string[]): boolean {
  const normalized = value.toLocaleLowerCase("bg-BG");
  return needles.some((needle) => normalized.includes(needle.toLocaleLowerCase("bg-BG")));
}

function containsOpportunityText(
  opportunity: NormalizedOpportunityWithScore,
  needles: readonly string[]
): boolean {
  return containsText(`${opportunity.title} ${opportunity.description ?? ""}`, needles);
}

function getDaysUntil(deadline: Date, now: Date): number {
  return Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

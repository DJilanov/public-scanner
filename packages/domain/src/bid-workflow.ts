import type {
  BidRecommendation,
  BusinessProfileId,
  ComplianceItem,
  ContractDashboardItem,
  DocumentIntelligence,
  EvidenceItem,
  Money,
  Opportunity,
  OpportunityDetail,
  ProcurementDashboard,
  ProfileFitScore
} from "./types.js";

export type BidRiskLevel = "low" | "medium" | "high";

export interface BidDecisionInput {
  opportunity: Opportunity;
  selectedProfileIds: readonly BusinessProfileId[];
  complianceItems?: readonly ComplianceItem[];
  documentIntelligence?: DocumentIntelligence;
  now?: Date;
}

export interface BidDecision {
  recommendation: BidRecommendation;
  score: number;
  confidence: number;
  readinessPercent: number;
  riskLevel: BidRiskLevel;
  strengths: string[];
  blockers: string[];
  nextActions: string[];
}

export interface BidEconomicsInput {
  estimatedValue?: Money;
  deliveryCostAmount: number;
  partnerCostAmount: number;
  bidPreparationCostAmount: number;
  warrantyReservePercent: number;
  winProbabilityPercent: number;
}

export interface BidEconomics {
  currency?: string;
  revenue?: number;
  warrantyReserveAmount?: number;
  totalDeliveryCost?: number;
  grossProfit?: number;
  grossMarginPercent?: number;
  expectedValue?: number;
  breakEvenWinProbabilityPercent?: number;
  riskLevel: BidRiskLevel;
}

export interface OpportunityForecast {
  id: string;
  buyerName: string;
  title: string;
  confidence: number;
  basis: string;
  nextExpectedDate?: string;
  cpvCodes: string[];
  averageValue?: Money;
}

export interface ForecastInput {
  dashboard: ProcurementDashboard;
  now?: Date;
  limit?: number;
}

export interface ApplicationPackInput {
  detail: OpportunityDetail;
  complianceItems: readonly ComplianceItem[];
  evidenceItems: readonly EvidenceItem[];
  selectedProfileIds: readonly BusinessProfileId[];
  decision: BidDecision;
  generatedAt?: Date;
}

export function buildBidDecision(input: BidDecisionInput): BidDecision {
  const now = input.now ?? new Date();
  const selectedScore = getBestSelectedProfileScore(
    input.opportunity.profileScores,
    input.selectedProfileIds
  );
  const score = selectedScore?.totalScore ?? input.opportunity.match?.score ?? 0;
  const complianceItems = input.complianceItems ?? [];
  const documentIntelligence = input.documentIntelligence;
  const deadlineDays = getDaysUntil(input.opportunity.submissionDeadline, now);
  const readinessPercent = getComplianceReadinessPercent(complianceItems);
  const blockedComplianceCount = complianceItems.filter(
    (item) => item.status === "blocked"
  ).length;
  const missingComplianceCount = complianceItems.filter(
    (item) => item.status === "missing"
  ).length;
  const documentRiskCount = documentIntelligence?.risks.length ?? 0;
  const blockers = collectBidBlockers({
    deadlineDays,
    documentIntelligence,
    estimatedValue: input.opportunity.estimatedValue,
    blockedComplianceCount,
    missingComplianceCount
  });
  const strengths = collectBidStrengths({
    opportunity: input.opportunity,
    selectedScore,
    readinessPercent,
    score
  });
  const recommendation = getDecisionRecommendation({
    blockers,
    blockedComplianceCount,
    deadlineDays,
    documentRiskCount,
    readinessPercent,
    score,
    selectedScore
  });
  const riskLevel = getDecisionRiskLevel({
    blockedComplianceCount,
    deadlineDays,
    documentRiskCount,
    missingComplianceCount,
    recommendation,
    score
  });

  return {
    recommendation,
    score,
    confidence: getDecisionConfidence({
      opportunity: input.opportunity,
      documentIntelligence,
      complianceItemCount: complianceItems.length,
      selectedScore
    }),
    readinessPercent,
    riskLevel,
    strengths,
    blockers,
    nextActions: collectDecisionActions({
      recommendation,
      deadlineDays,
      blockedComplianceCount,
      missingComplianceCount,
      documentRiskCount,
      hasEstimatedValue: Boolean(input.opportunity.estimatedValue),
      hasSelectedScore: Boolean(selectedScore)
    })
  };
}

export function calculateBidEconomics(input: BidEconomicsInput): BidEconomics {
  const estimatedValue = input.estimatedValue;
  if (!estimatedValue || estimatedValue.amount <= 0) {
    return { riskLevel: "medium" };
  }

  const deliveryCostAmount = sanitizeMoneyInput(input.deliveryCostAmount);
  const partnerCostAmount = sanitizeMoneyInput(input.partnerCostAmount);
  const bidPreparationCostAmount = sanitizeMoneyInput(input.bidPreparationCostAmount);
  const warrantyReservePercent = clampPercent(input.warrantyReservePercent);
  const winProbabilityPercent = clampPercent(input.winProbabilityPercent);
  const warrantyReserveAmount = estimatedValue.amount * (warrantyReservePercent / 100);
  const totalDeliveryCost =
    deliveryCostAmount + partnerCostAmount + warrantyReserveAmount;
  const grossProfit = estimatedValue.amount - totalDeliveryCost;
  const grossMarginPercent = (grossProfit / estimatedValue.amount) * 100;
  const expectedValue =
    grossProfit * (winProbabilityPercent / 100) - bidPreparationCostAmount;
  const breakEvenWinProbabilityPercent =
    grossProfit > 0 ? clampPercent((bidPreparationCostAmount / grossProfit) * 100) : 100;

  return {
    currency: estimatedValue.currency,
    revenue: roundCurrency(estimatedValue.amount),
    warrantyReserveAmount: roundCurrency(warrantyReserveAmount),
    totalDeliveryCost: roundCurrency(totalDeliveryCost),
    grossProfit: roundCurrency(grossProfit),
    grossMarginPercent: Math.round(grossMarginPercent),
    expectedValue: roundCurrency(expectedValue),
    breakEvenWinProbabilityPercent: Math.round(breakEvenWinProbabilityPercent),
    riskLevel:
      grossProfit <= 0 || expectedValue < 0
        ? "high"
        : grossMarginPercent < 18
          ? "medium"
          : "low"
  };
}

export function buildOpportunityForecasts(input: ForecastInput): OpportunityForecast[] {
  const now = input.now ?? new Date();
  const limit = input.limit ?? 8;
  const contractsByBuyer = groupContractsByBuyer(input.dashboard.contracts);

  return input.dashboard.buyers
    .map((buyer): OpportunityForecast | undefined => {
      const buyerContracts = contractsByBuyer.get(buyer.buyerName) ?? [];
      const datedContracts = buyerContracts
        .filter((contract) => Boolean(contract.contractDate))
        .sort(
          (first, second) =>
            new Date(first.contractDate ?? "").getTime() -
            new Date(second.contractDate ?? "").getTime()
        );
      const intervalDays = getAverageContractIntervalDays(datedContracts);
      const latestActivityDate = getLatestBuyerActivityDate(
        buyer.lastActivityDate,
        datedContracts
      );
      const nextExpectedDate =
        latestActivityDate && intervalDays
          ? addDays(latestActivityDate, intervalDays).toISOString()
          : undefined;
      const topCpvCodes = buyer.topCpvCodes.length
        ? buyer.topCpvCodes
        : mostCommonCpvCodes(buyerContracts);

      if (
        !nextExpectedDate &&
        buyer.contractCount < 2 &&
        buyer.openOpportunityCount === 0
      ) {
        return undefined;
      }

      const confidence = getForecastConfidence({
        contractCount: buyer.contractCount,
        datedContractCount: datedContracts.length,
        intervalDays,
        nextExpectedDate,
        now
      });

      return {
        id: slugifyForecastId(buyer.buyerName),
        buyerName: buyer.buyerName,
        title: buildForecastTitle(topCpvCodes),
        confidence,
        basis: intervalDays
          ? `Based on ${buyer.contractCount} tracked contracts and an average ${intervalDays}-day cadence.`
          : `Based on ${buyer.contractCount} tracked contracts and ${buyer.openOpportunityCount} currently open opportunities.`,
        ...(nextExpectedDate ? { nextExpectedDate } : {}),
        cpvCodes: topCpvCodes.slice(0, 4),
        ...(buyer.averageAwardedValue ? { averageValue: buyer.averageAwardedValue } : {})
      };
    })
    .filter((forecast): forecast is OpportunityForecast => Boolean(forecast))
    .sort((first, second) => second.confidence - first.confidence)
    .slice(0, limit);
}

export function buildDeadlineCalendarEvent(
  opportunity: Opportunity,
  now: Date = new Date()
): string | undefined {
  if (!opportunity.submissionDeadline) {
    return undefined;
  }

  const deadline = new Date(opportunity.submissionDeadline);
  if (Number.isNaN(deadline.getTime())) {
    return undefined;
  }

  const startDate = formatIcsDate(deadline);
  const endDate = formatIcsDate(addDays(deadline, 1));
  const created = formatIcsDateTime(now);
  const summary = escapeIcsText(`Tender deadline: ${opportunity.title}`);
  const description = escapeIcsText(
    [
      `Buyer: ${opportunity.buyerName}`,
      `Source: ${opportunity.source}`,
      `Value: ${formatMoneyPlain(opportunity.estimatedValue)}`,
      `Notice: ${opportunity.sourceUrl}`
    ].join("\\n")
  );

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Public Scanner//Tender Deadline//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(opportunity.id)}@public-scanner`,
    `DTSTAMP:${created}`,
    `DTSTART;VALUE=DATE:${startDate}`,
    `DTEND;VALUE=DATE:${endDate}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `URL:${opportunity.sourceUrl}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

export function buildApplicationPackMarkdown(input: ApplicationPackInput): string {
  const generatedAt = input.generatedAt ?? new Date();
  const opportunity = input.detail.opportunity;
  const evidenceById = new Map(input.evidenceItems.map((item) => [item.id, item]));
  const profileSummary =
    input.selectedProfileIds.length > 0 ? input.selectedProfileIds.join(", ") : "all";

  return [
    `# ${opportunity.title}`,
    "",
    `Generated: ${generatedAt.toISOString()}`,
    `Buyer: ${opportunity.buyerName}`,
    `Source: ${opportunity.source}`,
    `Status: ${opportunity.status}`,
    `Selected profiles: ${profileSummary}`,
    `Recommendation: ${input.decision.recommendation}`,
    `Score: ${input.decision.score}/100`,
    `Confidence: ${input.decision.confidence}/100`,
    `Readiness: ${input.decision.readinessPercent}%`,
    `Deadline: ${opportunity.submissionDeadline ?? "not stated"}`,
    `Estimated value: ${formatMoneyPlain(opportunity.estimatedValue)}`,
    `Official notice: ${opportunity.sourceUrl}`,
    "",
    "## Strengths",
    ...formatMarkdownList(input.decision.strengths),
    "",
    "## Blockers",
    ...formatMarkdownList(input.decision.blockers),
    "",
    "## Next Actions",
    ...formatMarkdownList(input.decision.nextActions),
    "",
    "## Document Intelligence",
    `Status: ${input.detail.documentIntelligence?.status ?? "not available"}`,
    "",
    "### Eligibility",
    ...formatMarkdownList(input.detail.documentIntelligence?.eligibilityCriteria ?? []),
    "",
    "### Required Documents",
    ...formatMarkdownList(input.detail.documentIntelligence?.requiredDocuments ?? []),
    "",
    "### Certifications",
    ...formatMarkdownList(input.detail.documentIntelligence?.certifications ?? []),
    "",
    "### Risks",
    ...formatMarkdownList(input.detail.documentIntelligence?.risks ?? []),
    "",
    "## Compliance Matrix",
    "| Status | Type | Requirement | Evidence |",
    "| --- | --- | --- | --- |",
    ...input.complianceItems.map((item) => {
      const evidence = item.evidenceItemIds
        .map((id) => evidenceById.get(id)?.title)
        .filter((title): title is string => Boolean(title))
        .join(", ");
      return `| ${escapeMarkdownTable(item.status)} | ${escapeMarkdownTable(item.requirementType)} | ${escapeMarkdownTable(item.requirement)} | ${escapeMarkdownTable(evidence || "not linked")} |`;
    }),
    "",
    "## Reusable Evidence",
    ...formatMarkdownList(
      input.evidenceItems.map((item) =>
        [
          item.title,
          item.type,
          item.issuer,
          item.validUntil ? `valid until ${item.validUntil}` : undefined
        ]
          .filter(Boolean)
          .join(" - ")
      )
    ),
    "",
    "## Lots",
    ...formatMarkdownList(
      input.detail.lots.map(
        (lot) =>
          `${lot.title ?? lot.lotIdentifier ?? lot.id} - ${lot.cpvCodes.join(", ") || "no CPV"} - ${formatMoneyPlain(lot.estimatedValue)}`
      )
    ),
    "",
    "## Linked Contracts",
    ...formatMarkdownList(
      input.detail.contracts.map(
        (contract) =>
          `${contract.supplierName ?? contract.title} - ${contract.contractDate ?? "no date"} - ${formatMoneyPlain(contract.value)}`
      )
    ),
    ""
  ].join("\n");
}

function getBestSelectedProfileScore(
  profileScores: ProfileFitScore[] | undefined,
  selectedProfileIds: readonly BusinessProfileId[]
): ProfileFitScore | undefined {
  const selected = new Set(selectedProfileIds);

  return profileScores
    ?.filter((score) => selected.has(score.profileId))
    .sort((first, second) => second.totalScore - first.totalScore)[0];
}

function collectBidBlockers(input: {
  deadlineDays: number | undefined;
  documentIntelligence: DocumentIntelligence | undefined;
  estimatedValue: Money | undefined;
  blockedComplianceCount: number;
  missingComplianceCount: number;
}): string[] {
  const blockers: string[] = [];

  if (input.deadlineDays === undefined) {
    blockers.push("Submission deadline is missing.");
  } else if (input.deadlineDays < 0) {
    blockers.push("Submission deadline has passed.");
  } else if (input.deadlineDays <= 3) {
    blockers.push("Submission window is critically short.");
  }

  if (!input.estimatedValue) {
    blockers.push("Estimated value is missing, so commercial fit needs review.");
  }

  if (input.blockedComplianceCount > 0) {
    blockers.push(`${input.blockedComplianceCount} compliance items are blocked.`);
  }

  if (input.missingComplianceCount > 0) {
    blockers.push(`${input.missingComplianceCount} compliance items are still missing.`);
  }

  for (const risk of input.documentIntelligence?.risks.slice(0, 3) ?? []) {
    blockers.push(risk);
  }

  return dedupe(blockers);
}

function collectBidStrengths(input: {
  opportunity: Opportunity;
  selectedScore: ProfileFitScore | undefined;
  readinessPercent: number;
  score: number;
}): string[] {
  const strengths: string[] = [];

  if (input.score >= 78) {
    strengths.push("Strong profile fit for the selected sector.");
  }

  if (input.selectedScore) {
    strengths.push(`Best matching profile: ${input.selectedScore.profileName}.`);
  }

  if (input.readinessPercent >= 70) {
    strengths.push("Most compliance requirements are ready or not applicable.");
  }

  if (input.opportunity.isEuFunded) {
    strengths.push("EU funding signal is present.");
  }

  if (
    input.opportunity.estimatedValue &&
    input.opportunity.estimatedValue.amount >= 250000
  ) {
    strengths.push("Estimated value is large enough to justify deeper review.");
  }

  return strengths.length > 0 ? strengths : ["No strong positive signal yet."];
}

function getDecisionRecommendation(input: {
  blockers: readonly string[];
  blockedComplianceCount: number;
  deadlineDays: number | undefined;
  documentRiskCount: number;
  readinessPercent: number;
  score: number;
  selectedScore: ProfileFitScore | undefined;
}): BidRecommendation {
  if (input.deadlineDays !== undefined && input.deadlineDays < 0) {
    return "skip";
  }

  if (
    input.selectedScore?.recommendation === "skip" ||
    (input.score < 48 && input.documentRiskCount > 0)
  ) {
    return "skip";
  }

  if (
    input.blockedComplianceCount > 0 ||
    input.selectedScore?.recommendation === "need-partner"
  ) {
    return "need-partner";
  }

  if (input.score >= 78 && input.readinessPercent >= 60 && input.blockers.length <= 1) {
    return "apply";
  }

  if (input.score >= 55 || input.documentRiskCount > 0) {
    return "review";
  }

  return "skip";
}

function getDecisionRiskLevel(input: {
  blockedComplianceCount: number;
  deadlineDays: number | undefined;
  documentRiskCount: number;
  missingComplianceCount: number;
  recommendation: BidRecommendation;
  score: number;
}): BidRiskLevel {
  if (
    input.recommendation === "skip" ||
    input.blockedComplianceCount > 0 ||
    input.documentRiskCount >= 3 ||
    (input.deadlineDays !== undefined && input.deadlineDays <= 3)
  ) {
    return "high";
  }

  if (
    input.recommendation === "need-partner" ||
    input.missingComplianceCount > 0 ||
    input.documentRiskCount > 0 ||
    input.score < 70
  ) {
    return "medium";
  }

  return "low";
}

function getDecisionConfidence(input: {
  opportunity: Opportunity;
  documentIntelligence: DocumentIntelligence | undefined;
  complianceItemCount: number;
  selectedScore: ProfileFitScore | undefined;
}): number {
  const confidence =
    (input.selectedScore ? 25 : 0) +
    (input.opportunity.submissionDeadline ? 15 : 0) +
    (input.opportunity.estimatedValue ? 15 : 0) +
    (input.opportunity.cpvCodes.length > 0 ? 10 : 0) +
    (input.documentIntelligence?.status === "ready" ? 20 : 0) +
    (input.complianceItemCount > 0 ? 15 : 0);

  return clamp(Math.max(confidence, 20), 0, 100);
}

function collectDecisionActions(input: {
  recommendation: BidRecommendation;
  deadlineDays: number | undefined;
  blockedComplianceCount: number;
  missingComplianceCount: number;
  documentRiskCount: number;
  hasEstimatedValue: boolean;
  hasSelectedScore: boolean;
}): string[] {
  const actions: string[] = [];

  if (!input.hasSelectedScore) {
    actions.push("Confirm the business profile before relying on the score.");
  }

  if (!input.hasEstimatedValue) {
    actions.push("Estimate project value and delivery cost before pricing.");
  }

  if (input.blockedComplianceCount > 0) {
    actions.push("Resolve blocked compliance items or identify a partner.");
  }

  if (input.missingComplianceCount > 0) {
    actions.push("Assign owners for missing compliance requirements.");
  }

  if (input.documentRiskCount > 0) {
    actions.push("Prepare clarification questions for the highest-risk clauses.");
  }

  if (input.deadlineDays !== undefined && input.deadlineDays <= 7) {
    actions.push("Create an internal submission checkpoint within 24 hours.");
  }

  if (input.recommendation === "apply") {
    actions.push("Move the tender to preparing and build the application pack.");
  } else if (input.recommendation === "review") {
    actions.push("Complete a manual bid/no-bid review before committing effort.");
  } else if (input.recommendation === "need-partner") {
    actions.push("Validate partner coverage before pricing.");
  } else {
    actions.push("Save a no-bid reason so future decisions improve.");
  }

  return dedupe(actions).slice(0, 5);
}

function getComplianceReadinessPercent(items: readonly ComplianceItem[]): number {
  if (items.length === 0) {
    return 0;
  }

  const readyCount = items.filter((item) =>
    ["ready", "not-applicable"].includes(item.status)
  ).length;

  return Math.round((readyCount / items.length) * 100);
}

function groupContractsByBuyer(
  contracts: readonly ContractDashboardItem[]
): Map<string, ContractDashboardItem[]> {
  const grouped = new Map<string, ContractDashboardItem[]>();

  for (const contract of contracts) {
    const entries = grouped.get(contract.buyerName) ?? [];
    entries.push(contract);
    grouped.set(contract.buyerName, entries);
  }

  return grouped;
}

function getAverageContractIntervalDays(
  contracts: readonly ContractDashboardItem[]
): number | undefined {
  if (contracts.length < 2) {
    return undefined;
  }

  const intervals: number[] = [];
  for (let index = 1; index < contracts.length; index += 1) {
    const previous = new Date(contracts[index - 1]?.contractDate ?? "");
    const current = new Date(contracts[index]?.contractDate ?? "");
    if (Number.isNaN(previous.getTime()) || Number.isNaN(current.getTime())) {
      continue;
    }

    const days = Math.round((current.getTime() - previous.getTime()) / 86_400_000);
    if (days > 0) {
      intervals.push(days);
    }
  }

  if (intervals.length === 0) {
    return undefined;
  }

  const average =
    intervals.reduce((total, interval) => total + interval, 0) / intervals.length;

  return Math.min(730, Math.max(60, Math.round(average)));
}

function getLatestBuyerActivityDate(
  buyerLastActivityDate: string | undefined,
  contracts: readonly ContractDashboardItem[]
): Date | undefined {
  const dates = [
    buyerLastActivityDate,
    ...contracts.map((contract) => contract.contractDate)
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((first, second) => second.getTime() - first.getTime());

  return dates[0];
}

function getForecastConfidence(input: {
  contractCount: number;
  datedContractCount: number;
  intervalDays: number | undefined;
  nextExpectedDate: string | undefined;
  now: Date;
}): number {
  const nextDate = input.nextExpectedDate ? new Date(input.nextExpectedDate) : undefined;
  const nextDatePenalty =
    nextDate && nextDate.getTime() < input.now.getTime()
      ? 12
      : nextDate && nextDate.getTime() - input.now.getTime() > 730 * 86_400_000
        ? 8
        : 0;

  return clamp(
    35 +
      Math.min(input.contractCount * 5, 25) +
      Math.min(input.datedContractCount * 5, 20) +
      (input.intervalDays ? 20 : 0) -
      nextDatePenalty,
    25,
    92
  );
}

function mostCommonCpvCodes(contracts: readonly ContractDashboardItem[]): string[] {
  const counts = new Map<string, number>();
  for (const contract of contracts) {
    for (const cpvCode of contract.cpvCodes) {
      counts.set(cpvCode, (counts.get(cpvCode) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1])
    .map(([cpvCode]) => cpvCode);
}

function buildForecastTitle(cpvCodes: readonly string[]): string {
  return cpvCodes.length > 0
    ? `Recurring procurement watch for CPV ${cpvCodes.slice(0, 2).join(", ")}`
    : "Recurring procurement watch";
}

function slugifyForecastId(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return slug || `forecast-${hashString(value)}`;
}

function hashString(value: string): string {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  }

  return hash.toString(36);
}

function getDaysUntil(value: string | undefined, now: Date): number | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const nowStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dateStart = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );

  return Math.ceil((dateStart - nowStart) / 86_400_000);
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function sanitizeMoneyInput(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function clampPercent(value: number): number {
  return clamp(Number.isFinite(value) ? value : 0, 0, 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatIcsDate(value: Date): string {
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0")
  ].join("");
}

function formatIcsDateTime(value: Date): string {
  return `${formatIcsDate(value)}T${String(value.getUTCHours()).padStart(2, "0")}${String(value.getUTCMinutes()).padStart(2, "0")}${String(value.getUTCSeconds()).padStart(2, "0")}Z`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatMoneyPlain(value: Money | undefined): string {
  return value ? `${value.amount} ${value.currency}` : "not stated";
}

function formatMarkdownList(items: readonly string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ["- none"];
}

function escapeMarkdownTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function dedupe(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

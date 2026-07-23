import type {
  ContractAmendmentSummary,
  ContractSummary,
  DocumentIntelligence,
  ExtractedClauseType,
  ExtractedTenderClause,
  Money,
  Opportunity,
  OpportunityLot,
  TenderChangeTimelineItem,
  TenderClauseSeverity,
  TenderDocumentPackage,
  TenderDocumentPackageItem,
  TenderDocumentStatus
} from "./types.js";

export interface TenderDocumentPackageInput {
  opportunity: Opportunity;
  lots?: OpportunityLot[];
  contracts?: ContractSummary[];
  amendments?: ContractAmendmentSummary[];
  documentIntelligence?: DocumentIntelligence;
  now?: Date;
}

export function buildTenderDocumentPackage(
  input: TenderDocumentPackageInput
): TenderDocumentPackage {
  const lots = input.lots ?? [];
  const contracts = input.contracts ?? [];
  const amendments = input.amendments ?? [];
  const intelligence = input.documentIntelligence;
  const updatedAt = (input.now ?? new Date()).toISOString();
  const packageInput: RequiredTenderDocumentPackageInput = {
    opportunity: input.opportunity,
    lots,
    contracts,
    amendments,
    ...(intelligence ? { documentIntelligence: intelligence } : {})
  };
  const items = buildPackageItems(packageInput);
  const timeline = buildTenderChangeTimeline({
    opportunity: input.opportunity,
    lots,
    contracts,
    amendments,
    ...(intelligence ? { documentIntelligence: intelligence } : {})
  });
  const clauses = extractTenderClauses({
    opportunity: input.opportunity,
    lots,
    contracts,
    amendments,
    ...(intelligence ? { documentIntelligence: intelligence } : {})
  });
  const availableCount = items.filter((item) =>
    isCoveredDocumentStatus(item.status)
  ).length;
  const needsAttentionCount = items.filter((item) =>
    isAttentionDocumentStatus(item.status)
  ).length;

  return {
    items,
    timeline,
    clauses,
    summary: {
      itemCount: items.length,
      availableCount,
      needsAttentionCount,
      timelineCount: timeline.length,
      clauseCount: clauses.length,
      riskClauseCount: clauses.filter((clause) => clause.severity === "risk").length
    },
    coveragePercent:
      items.length === 0 ? 0 : Math.round((availableCount / items.length) * 100),
    updatedAt
  };
}

export function buildDocumentPackageMarkdown(input: {
  opportunity: Opportunity;
  documentPackage: TenderDocumentPackage;
}): string {
  const value = input.opportunity.estimatedValue
    ? formatMoney(input.opportunity.estimatedValue)
    : "not stated";
  const deadline = input.opportunity.submissionDeadline ?? "not stated";

  return [
    `# ${input.opportunity.title}`,
    "",
    `Buyer: ${input.opportunity.buyerName}`,
    `Source: ${input.opportunity.sourceUrl}`,
    `Deadline: ${deadline}`,
    `Estimated value: ${value}`,
    "",
    "## Package Coverage",
    `Coverage: ${input.documentPackage.coveragePercent}%`,
    `Available or extracted: ${input.documentPackage.summary.availableCount}`,
    `Needs attention: ${input.documentPackage.summary.needsAttentionCount}`,
    "",
    "## Source Documents",
    ...input.documentPackage.items.map(
      (item) =>
        `- [${item.status}] ${item.title}${item.description ? ` - ${item.description}` : ""}`
    ),
    "",
    "## Change Timeline",
    ...formatTimelineMarkdown(input.documentPackage.timeline),
    "",
    "## Extracted Clauses",
    ...formatClauseMarkdown(input.documentPackage.clauses)
  ].join("\n");
}

export function buildTenderChangeTimeline(
  input: TenderDocumentPackageInput
): TenderChangeTimelineItem[] {
  const timeline: TenderChangeTimelineItem[] = [];

  if (input.opportunity.publicationDate) {
    timeline.push({
      id: "published",
      type: "published",
      title: "Notice published",
      summary: `${input.opportunity.source} published the tender metadata.`,
      occurredAt: input.opportunity.publicationDate,
      sourceUrl: input.opportunity.sourceUrl
    });
  }

  if (input.documentIntelligence?.extractedAt) {
    timeline.push({
      id: "documents-extracted",
      type: "documents-extracted",
      title: "Document intelligence extracted",
      summary: `${input.documentIntelligence.requiredDocuments.length} required documents, ${input.documentIntelligence.certifications.length} certifications, and ${input.documentIntelligence.risks.length} risks were detected.`,
      occurredAt: input.documentIntelligence.extractedAt,
      sourceUrl: input.opportunity.sourceUrl
    });
  }

  for (const lot of input.lots ?? []) {
    timeline.push({
      id: `lot-${lot.id}`,
      type: "lot",
      title: lot.title ?? lot.lotIdentifier ?? "Lot detected",
      summary: formatLotSummary(lot),
      ...(lot.submissionDeadline
        ? { occurredAt: lot.submissionDeadline }
        : input.opportunity.publicationDate
          ? { occurredAt: input.opportunity.publicationDate }
          : {}),
      sourceUrl: input.opportunity.sourceUrl
    });
  }

  for (const contract of input.contracts ?? []) {
    timeline.push({
      id: `contract-${contract.id}`,
      type: "contract-award",
      title: contract.supplierName
        ? `Award to ${contract.supplierName}`
        : "Linked contract award",
      summary: `${contract.title} - ${formatMoneyOrUnknown(contract.value)}`,
      ...(contract.contractDate ? { occurredAt: contract.contractDate } : {})
    });
  }

  for (const amendment of input.amendments ?? []) {
    timeline.push({
      id: `amendment-${amendment.id}`,
      type: "amendment",
      title: amendment.changeReason ?? "Contract amendment",
      summary:
        amendment.changeDescription ??
        `Value changed from ${formatMoneyOrUnknown(
          amendment.previousValue
        )} to ${formatMoneyOrUnknown(amendment.currentValue)}.`
    });
  }

  if (input.opportunity.submissionDeadline) {
    timeline.push({
      id: "deadline",
      type: "deadline",
      title: "Submission deadline",
      summary: "Final tender submission deadline from the crawled metadata.",
      occurredAt: input.opportunity.submissionDeadline,
      sourceUrl: input.opportunity.sourceUrl
    });
  }

  if (timeline.length === 0) {
    timeline.push({
      id: "source-snapshot",
      type: "source-snapshot",
      title: "Source snapshot available",
      summary: "The opportunity has structured metadata but no dated changes yet.",
      sourceUrl: input.opportunity.sourceUrl
    });
  }

  return timeline.sort(compareTimelineItems);
}

export function extractTenderClauses(
  input: TenderDocumentPackageInput
): ExtractedTenderClause[] {
  const clauses: ExtractedTenderClause[] = [];

  if (input.opportunity.submissionDeadline) {
    clauses.push({
      id: "deadline-submission",
      type: "deadline",
      title: "Submission deadline",
      text: `Submit before ${input.opportunity.submissionDeadline}. Build an internal checkpoint before the official deadline.`,
      severity: "watch",
      confidence: 0.86,
      source: "opportunity metadata"
    });
  }

  if (input.opportunity.estimatedValue) {
    clauses.push({
      id: "budget-estimated-value",
      type: "budget",
      title: "Estimated value",
      text: `Estimated value is ${formatMoney(
        input.opportunity.estimatedValue
      )}. Validate delivery cost, margin, warranty reserve, and bid preparation cost before applying.`,
      severity: input.opportunity.estimatedValue.amount >= 500_000 ? "watch" : "info",
      confidence: 0.82,
      source: "opportunity metadata"
    });
  }

  for (const [index, criterion] of (
    input.documentIntelligence?.eligibilityCriteria ?? []
  ).entries()) {
    clauses.push(
      buildClause({
        id: `eligibility-${index + 1}`,
        type: "eligibility",
        title: "Eligibility requirement",
        text: criterion,
        source: "document intelligence"
      })
    );
  }

  for (const [index, document] of (
    input.documentIntelligence?.requiredDocuments ?? []
  ).entries()) {
    clauses.push(
      buildClause({
        id: `document-${index + 1}`,
        type: inferDocumentClauseType(document),
        title: inferDocumentClauseTitle(document),
        text: document,
        source: "document intelligence"
      })
    );
  }

  for (const [index, certification] of (
    input.documentIntelligence?.certifications ?? []
  ).entries()) {
    clauses.push(
      buildClause({
        id: `certification-${index + 1}`,
        type: inferCertificationClauseType(certification),
        title: "Certification or vendor proof",
        text: certification,
        source: "document intelligence"
      })
    );
  }

  for (const [index, risk] of (input.documentIntelligence?.risks ?? []).entries()) {
    clauses.push({
      id: `risk-${index + 1}`,
      type: "risk",
      title: "Risk clause",
      text: risk,
      severity: "risk",
      confidence: 0.8,
      source: "document intelligence"
    });
  }

  for (const [index, lot] of (input.lots ?? []).entries()) {
    clauses.push({
      id: `lot-${index + 1}`,
      type: "lot",
      title: lot.title ?? lot.lotIdentifier ?? "Lot scope",
      text: formatLotSummary(lot),
      severity: "info",
      confidence: 0.78,
      source: "lot metadata"
    });
  }

  for (const [index, contract] of (input.contracts ?? []).entries()) {
    clauses.push({
      id: `award-${index + 1}`,
      type: "award",
      title: contract.supplierName
        ? `Historical award: ${contract.supplierName}`
        : "Historical award",
      text: `${contract.title} - ${formatMoneyOrUnknown(contract.value)}.`,
      severity: "info",
      confidence: 0.72,
      source: "contract history"
    });
  }

  for (const [index, amendment] of (input.amendments ?? []).entries()) {
    clauses.push({
      id: `amendment-${index + 1}`,
      type: "risk",
      title: amendment.changeReason ?? "Contract amendment signal",
      text:
        amendment.changeDescription ??
        `Value changed from ${formatMoneyOrUnknown(
          amendment.previousValue
        )} to ${formatMoneyOrUnknown(amendment.currentValue)}.`,
      severity: "watch",
      confidence: 0.68,
      source: "contract amendment history"
    });
  }

  return dedupeClauses(clauses);
}

function buildPackageItems(
  input: RequiredTenderDocumentPackageInput
): TenderDocumentPackageItem[] {
  const items: TenderDocumentPackageItem[] = [
    {
      id: "official-notice",
      title: "Official notice",
      kind: "notice",
      status: "available",
      description: "Primary tender notice from the public procurement source.",
      sourceUrl: input.opportunity.sourceUrl,
      ...(input.opportunity.publicationDate
        ? { lastSeenAt: input.opportunity.publicationDate }
        : {})
    },
    {
      id: "structured-metadata",
      title: "Structured metadata snapshot",
      kind: "metadata",
      status: input.documentIntelligence?.status === "failed" ? "failed" : "extracted",
      description:
        "Normalized buyer, CPV, value, deadline, profile score, and source metadata.",
      sourceUrl: input.opportunity.sourceUrl
    },
    {
      id: "official-attachments",
      title: "Official attachment bundle",
      kind: "attachment-bundle",
      status: deriveAttachmentStatus(input.documentIntelligence),
      description:
        "Download and archive the official tender attachments before final submission.",
      sourceUrl: input.opportunity.sourceUrl
    }
  ];

  for (const [index, document] of (
    input.documentIntelligence?.requiredDocuments ?? []
  ).entries()) {
    items.push({
      id: `required-document-${index + 1}`,
      title: document,
      kind: "requirement",
      status: "needs-review",
      description: "Required bid package document detected by document intelligence."
    });
  }

  for (const [index, certification] of (
    input.documentIntelligence?.certifications ?? []
  ).entries()) {
    items.push({
      id: `certification-${index + 1}`,
      title: certification,
      kind: "certification",
      status: "needs-review",
      description: "Certification, authorization, or equivalent evidence to verify."
    });
  }

  for (const lot of input.lots) {
    items.push({
      id: `lot-${lot.id}`,
      title: lot.title ?? lot.lotIdentifier ?? "Lot",
      kind: "lot",
      status: "available",
      description: formatLotSummary(lot),
      ...(lot.submissionDeadline ? { lastSeenAt: lot.submissionDeadline } : {})
    });
  }

  for (const contract of input.contracts) {
    items.push({
      id: `contract-${contract.id}`,
      title: contract.title,
      kind: "contract",
      status: "available",
      description: contract.supplierName
        ? `Awarded supplier: ${contract.supplierName}`
        : "Linked contract history.",
      ...(contract.contractDate ? { lastSeenAt: contract.contractDate } : {})
    });
  }

  for (const amendment of input.amendments) {
    items.push({
      id: `amendment-${amendment.id}`,
      title: amendment.changeReason ?? "Contract amendment",
      kind: "amendment",
      status: "available",
      description:
        amendment.changeDescription ??
        `Value changed from ${formatMoneyOrUnknown(
          amendment.previousValue
        )} to ${formatMoneyOrUnknown(amendment.currentValue)}.`
    });
  }

  return items;
}

interface RequiredTenderDocumentPackageInput {
  opportunity: Opportunity;
  lots: OpportunityLot[];
  contracts: ContractSummary[];
  amendments: ContractAmendmentSummary[];
  documentIntelligence?: DocumentIntelligence;
}

function buildClause(input: {
  id: string;
  type: ExtractedClauseType;
  title: string;
  text: string;
  source: string;
}): ExtractedTenderClause {
  const lowerText = input.text.toLowerCase();
  const severity: TenderClauseSeverity =
    lowerText.includes("missing") ||
    lowerText.includes("deadline") ||
    lowerText.includes("warranty") ||
    lowerText.includes("sla") ||
    lowerText.includes("authorization")
      ? "watch"
      : "info";

  return {
    id: input.id,
    type: input.type,
    title: input.title,
    text: input.text,
    severity,
    confidence: 0.74,
    source: input.source
  };
}

function inferDocumentClauseType(text: string): ExtractedClauseType {
  const lowerText = text.toLowerCase();

  if (lowerText.includes("financial proposal") || lowerText.includes("pricing")) {
    return "payment";
  }

  if (
    lowerText.includes("warranty") ||
    lowerText.includes("manufacturer") ||
    lowerText.includes("datasheet")
  ) {
    return "warranty";
  }

  if (
    lowerText.includes("methodology") ||
    lowerText.includes("implementation") ||
    lowerText.includes("delivery") ||
    lowerText.includes("acceptance")
  ) {
    return "delivery";
  }

  return "document";
}

function inferDocumentClauseTitle(text: string): string {
  const type = inferDocumentClauseType(text);

  switch (type) {
    case "delivery":
      return "Delivery and acceptance package";
    case "payment":
      return "Financial proposal";
    case "warranty":
      return "Warranty or technical proof";
    default:
      return "Required document";
  }
}

function inferCertificationClauseType(text: string): ExtractedClauseType {
  const lowerText = text.toLowerCase();

  if (
    lowerText.includes("vendor") ||
    lowerText.includes("warranty") ||
    lowerText.includes("manufacturer")
  ) {
    return "warranty";
  }

  if (lowerText.includes("sla") || lowerText.includes("support")) {
    return "support";
  }

  return "certification";
}

function deriveAttachmentStatus(
  intelligence: DocumentIntelligence | undefined
): TenderDocumentStatus {
  if (!intelligence || intelligence.status === "not-available") {
    return "needs-download";
  }

  if (intelligence.status === "failed") {
    return "failed";
  }

  if (intelligence.status === "pending") {
    return "needs-download";
  }

  return "needs-review";
}

function isCoveredDocumentStatus(status: TenderDocumentStatus): boolean {
  return status === "available" || status === "extracted";
}

function isAttentionDocumentStatus(status: TenderDocumentStatus): boolean {
  return status === "needs-download" || status === "needs-review" || status === "failed";
}

function compareTimelineItems(
  left: TenderChangeTimelineItem,
  right: TenderChangeTimelineItem
): number {
  const leftMs = left.occurredAt ? Date.parse(left.occurredAt) : Number.MAX_SAFE_INTEGER;
  const rightMs = right.occurredAt
    ? Date.parse(right.occurredAt)
    : Number.MAX_SAFE_INTEGER;

  if (leftMs !== rightMs) {
    return leftMs - rightMs;
  }

  return left.title.localeCompare(right.title);
}

function dedupeClauses(clauses: ExtractedTenderClause[]): ExtractedTenderClause[] {
  const seen = new Set<string>();
  const result: ExtractedTenderClause[] = [];

  for (const clause of clauses) {
    const key = `${clause.type}:${clause.title}:${clause.text}`.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(clause);
  }

  return result;
}

function formatTimelineMarkdown(items: TenderChangeTimelineItem[]): string[] {
  if (items.length === 0) {
    return ["- No dated changes detected."];
  }

  return items.map((item) => {
    const date = item.occurredAt ?? "no date";
    return `- ${date}: ${item.title}${item.summary ? ` - ${item.summary}` : ""}`;
  });
}

function formatClauseMarkdown(clauses: ExtractedTenderClause[]): string[] {
  if (clauses.length === 0) {
    return ["- No extracted clauses yet."];
  }

  return clauses.map(
    (clause) =>
      `- [${clause.severity}] ${clause.title}: ${clause.text} (${Math.round(
        clause.confidence * 100
      )}% confidence)`
  );
}

function formatLotSummary(lot: OpportunityLot): string {
  const parts = [
    lot.cpvCodes.length > 0 ? `CPV ${lot.cpvCodes.join(", ")}` : undefined,
    lot.estimatedValue ? formatMoney(lot.estimatedValue) : undefined,
    lot.submissionDeadline ? `deadline ${lot.submissionDeadline}` : undefined
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" - ") : "Lot metadata requires review.";
}

function formatMoneyOrUnknown(value: Money | undefined): string {
  return value ? formatMoney(value) : "value not stated";
}

function formatMoney(value: Money): string {
  return `${value.amount.toLocaleString("en-US", {
    maximumFractionDigits: 2
  })} ${value.currency}`;
}

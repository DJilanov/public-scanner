import {
  profileScoreToOpportunityScore,
  scoreOpportunity,
  scoreOpportunityAcrossProfiles,
  type OpportunityScoringInput
} from "./scoring.js";
import type {
  MatchReason,
  Money,
  NormalizedContract,
  NormalizedContractAmendment,
  NormalizedOpportunity,
  NormalizedOpportunityLot,
  OpportunityScore,
  OpportunityStatus,
  ProfileFitScore,
  ProcurementSource
} from "./types.js";

export interface NormalizedOpportunityWithScore extends NormalizedOpportunity {
  match: OpportunityScore;
  profileScores: ProfileFitScore[];
}

export function normalizeCaisTenderRecord(
  record: unknown,
  options: { now?: Date } = {}
): NormalizedOpportunity | undefined {
  if (!isRecord(record)) {
    return undefined;
  }

  const tenderId = readString(record.tenderId);
  const noticeId = readString(record.noticeId);
  const uniqueProcurementNumber = readString(record.uniqueProcurementNumber);
  const lotIdentifier = readString(record.lotIdentifier);
  const externalId = buildExternalId(
    "cais-eop",
    tenderId,
    lotIdentifier,
    noticeId,
    uniqueProcurementNumber
  );
  const subject = readString(record.subject);
  const lotTenderName = readString(record.lotTenderName);
  const title = lotTenderName ?? subject;
  const buyerName = readString(record.buyerName);

  if (!externalId || !title || !buyerName) {
    return undefined;
  }

  const mainCpvCode = readString(record.mainCpvCode);
  const submissionDeadline = normalizeDateString(readString(record.submissionDeadline));
  const publicationDate = normalizeDateString(readString(record.publicationDate));
  const sourceUrl = tenderId
    ? `https://app.eop.bg/today/${encodeURIComponent(tenderId)}`
    : (readString(record.linkToOjEu) ?? "https://app.eop.bg/today/");
  const currency = readString(record.currency);
  const estimatedAmount = parseSourceNumber(record.estimatedValue);
  const isCancelled = readBoolean(record.isCancelled);
  const buyerRegistryNumber = readString(record.buyerRegistryNumber);
  const cpvDescription = readString(record.mainCpvDescription);
  const procedureType = readString(record.procedureType);
  const isEuFunded = readBoolean(record.isEuFunded);
  const europeanProgram = readString(record.europeanProgram);
  const tedUrl = readString(record.linkToOjEu);
  const publicationNumber = tedUrl ? extractTedPublicationNumber(tedUrl) : undefined;
  const deduplicationKey = buildOpportunityDeduplicationKey({
    source: "cais-eop",
    ...(publicationNumber ? { publicationNumber } : {}),
    ...(uniqueProcurementNumber ? { uniqueProcurementNumber } : {}),
    ...(tenderId ? { tenderId } : {}),
    ...(lotIdentifier ? { lotIdentifier } : {})
  });

  return {
    source: "cais-eop",
    externalId,
    deduplicationKey,
    title,
    buyerName,
    status: deriveStatus({
      ...(isCancelled !== undefined ? { isCancelled } : {}),
      ...(submissionDeadline ? { submissionDeadline } : {}),
      ...(options.now ? { now: options.now } : {})
    }),
    cpvCodes: mainCpvCode ? [mainCpvCode] : [],
    sourceUrl,
    ...(tenderId ? { tenderId } : {}),
    ...(uniqueProcurementNumber ? { uniqueProcurementNumber } : {}),
    ...(publicationNumber ? { publicationNumber } : {}),
    ...(buyerRegistryNumber ? { buyerRegistryNumber } : {}),
    ...(mainCpvCode ? { mainCpvCode } : {}),
    ...(cpvDescription ? { cpvDescription } : {}),
    ...(estimatedAmount !== undefined && currency
      ? { estimatedValue: { amount: estimatedAmount, currency } }
      : {}),
    ...(publicationDate ? { publicationDate } : {}),
    ...(submissionDeadline ? { submissionDeadline } : {}),
    ...(procedureType ? { procedureType } : {}),
    ...(isEuFunded !== undefined ? { isEuFunded } : {}),
    ...(europeanProgram ? { europeanProgram } : {}),
    ...(tedUrl ? { tedUrl } : {})
  };
}

export function normalizeTedNoticeRecord(
  record: unknown,
  options: { now?: Date } = {}
): NormalizedOpportunity | undefined {
  if (!isRecord(record)) {
    return undefined;
  }

  const publicationNumber = readFirstField(record, "publication-number");
  const title = readFirstField(record, "notice-title");
  const buyerName = readFirstField(record, "buyer-name");

  if (!publicationNumber || !title || !buyerName) {
    return undefined;
  }

  const cpvCodes = readFieldStrings(record, "classification-cpv");
  const deadline =
    normalizeDateString(readFirstField(record, "deadline-receipt-tender-date-lot")) ??
    normalizeDateString(readFirstField(record, "deadline-receipt-request"));
  const publicationDate = normalizeDateString(readFirstField(record, "publication-date"));
  const currency =
    readFirstField(record, "estimated-value-cur-proc") ??
    readFirstField(record, "estimated-value-cur-lot");
  const estimatedAmount =
    parseSourceNumber(readFirstField(record, "estimated-value-proc")) ??
    parseSourceNumber(readFirstField(record, "estimated-value-lot"));
  const tedUrl = readTedUrl(record, publicationNumber);
  const buyerCountryCode = readFirstField(record, "buyer-country");
  const procedureType = readFirstField(record, "procedure-type");
  const deduplicationKey = buildOpportunityDeduplicationKey({
    source: "ted",
    publicationNumber
  });

  return {
    source: "ted",
    externalId: publicationNumber,
    deduplicationKey,
    publicationNumber,
    title,
    buyerName,
    status: deriveStatus({
      ...(deadline ? { submissionDeadline: deadline } : {}),
      ...(options.now ? { now: options.now } : {})
    }),
    cpvCodes,
    sourceUrl: tedUrl,
    tedUrl,
    ...(buyerCountryCode ? { buyerCountryCode } : {}),
    ...(cpvCodes[0] ? { mainCpvCode: cpvCodes[0] } : {}),
    ...(estimatedAmount !== undefined && currency
      ? { estimatedValue: { amount: estimatedAmount, currency } }
      : {}),
    ...(publicationDate ? { publicationDate } : {}),
    ...(deadline ? { submissionDeadline: deadline } : {}),
    ...(procedureType ? { procedureType } : {})
  };
}

export function normalizeCaisContractRecord(
  record: unknown
): NormalizedContract | undefined {
  if (!isRecord(record)) {
    return undefined;
  }

  const tenderId = readString(record.tenderId);
  const lotIdentifier = readString(record.lotIdentifier);
  const contractNumber = readString(record.contractNumber);
  const contractDate = normalizeDateOnlyString(readString(record.contractDate));
  const supplierRegistryNumber = readString(record.supplierRegisterNumber);
  const supplierName = readString(record.supplierName);
  const buyerName = readString(record.buyerName);
  const title =
    readString(record.contractSubject) ?? readString(record.subject) ?? contractNumber;
  const externalId = buildStableExternalId([
    "contract",
    tenderId,
    lotIdentifier,
    contractNumber,
    contractDate,
    supplierRegistryNumber,
    supplierName
  ]);
  const value = buildMoney(record.contractValue, readString(record.contractCurrency));

  if (!externalId || !buyerName || !title) {
    return undefined;
  }

  return {
    source: "cais-eop",
    externalId,
    buyerName,
    title,
    ...(tenderId
      ? { opportunityExternalId: `${tenderId}:${lotIdentifier ?? "main"}` }
      : {}),
    ...(supplierName ? { supplierName } : {}),
    ...(supplierRegistryNumber ? { supplierRegistryNumber } : {}),
    ...(contractNumber ? { contractNumber } : {}),
    ...(contractDate ? { contractDate } : {}),
    ...(value ? { value } : {})
  };
}

export function normalizeCaisAnnexRecord(
  record: unknown
): NormalizedContractAmendment | undefined {
  if (!isRecord(record)) {
    return undefined;
  }

  const tenderId = readString(record.tenderId);
  const lotIdentifier = readString(record.lotIdentifier);
  const contractNumber = readString(record.contractNumber);
  const annexNumber =
    readString(record.annexNumber) ??
    readString(record.changeNoticeId) ??
    readString(record.noticeId);
  const supplierRegistryNumber = readString(record.supplierRegisterNumber);
  const supplierName = readString(record.supplierName);
  const contractExternalId = buildStableExternalId([
    "contract",
    tenderId,
    lotIdentifier,
    contractNumber,
    undefined,
    supplierRegistryNumber,
    supplierName
  ]);
  const externalId = buildStableExternalId([
    "annex",
    tenderId,
    lotIdentifier,
    contractNumber,
    annexNumber,
    readString(record.changeReason),
    readString(record.changeDescription)
  ]);
  const currency =
    readString(record.currency) ??
    readString(record.contractCurrency) ??
    readString(record.currentContractCurrency);
  const previousValue = buildMoney(record.lastContractValue, currency);
  const currentValue = buildMoney(record.currentContractValue, currency);
  const changeReason = readString(record.changeReason);
  const changeDescription = readString(record.changeDescription);

  if (!externalId) {
    return undefined;
  }

  return {
    source: "cais-eop",
    externalId,
    ...(contractExternalId ? { contractExternalId } : {}),
    ...(contractNumber ? { contractNumber } : {}),
    ...(previousValue ? { previousValue } : {}),
    ...(currentValue ? { currentValue } : {}),
    ...(changeReason ? { changeReason } : {}),
    ...(changeDescription ? { changeDescription } : {})
  };
}

export function normalizeOcdsLots(payload: unknown): NormalizedOpportunityLot[] {
  if (!isRecord(payload) || !Array.isArray(payload.releases)) {
    return [];
  }

  const lots: NormalizedOpportunityLot[] = [];

  for (const release of payload.releases) {
    if (!isRecord(release) || !isRecord(release.tender)) {
      continue;
    }

    const tenderId = extractTenderIdFromOcid(readString(release.ocid));
    const tender = release.tender;
    if (!tenderId || !Array.isArray(tender.lots)) {
      continue;
    }

    for (const [index, lot] of tender.lots.entries()) {
      if (!isRecord(lot)) {
        continue;
      }

      const lotIdentifier =
        readString(lot.id) ?? readString(lot.identifier) ?? String(index + 1);
      const title = readString(lot.title) ?? readString(lot.description);
      const value = isRecord(lot.value)
        ? buildMoney(lot.value.amount, readString(lot.value.currency))
        : undefined;
      const tenderPeriod = isRecord(lot.tenderPeriod) ? lot.tenderPeriod : undefined;
      const submissionDeadline = normalizeDateString(
        tenderPeriod ? readString(tenderPeriod.endDate) : undefined
      );

      lots.push({
        source: "cais-eop",
        opportunityExternalId: `${tenderId}:${lotIdentifier}`,
        externalId: `${tenderId}:${lotIdentifier}`,
        lotIdentifier,
        cpvCodes: [],
        ...(title ? { title } : {}),
        ...(value ? { estimatedValue: value } : {}),
        ...(submissionDeadline ? { submissionDeadline } : {})
      });
    }
  }

  return lots;
}

export function scoreNormalizedOpportunity(
  opportunity: NormalizedOpportunity,
  options: { now?: Date } = {}
): NormalizedOpportunityWithScore {
  const scoringInput = buildScoringInput(opportunity);
  const profileScores = scoreOpportunityAcrossProfiles(scoringInput, {
    ...(options.now ? { now: options.now } : {})
  });
  const bestProfileScore = profileScores[0];

  return {
    ...opportunity,
    match: bestProfileScore
      ? profileScoreToOpportunityScore(bestProfileScore)
      : scoreOpportunity(scoringInput, {
          ...(options.now ? { now: options.now } : {})
        }),
    profileScores
  };
}

export function buildScoringInput(
  opportunity: NormalizedOpportunity
): OpportunityScoringInput {
  return {
    title: opportunity.title,
    cpvCodes: opportunity.cpvCodes,
    ...(opportunity.submissionDeadline
      ? { submissionDeadline: new Date(opportunity.submissionDeadline) }
      : {}),
    ...(opportunity.estimatedValue ? { estimatedValue: opportunity.estimatedValue } : {}),
    ...(opportunity.isEuFunded !== undefined
      ? { isEuFunded: opportunity.isEuFunded }
      : {})
  };
}

function deriveStatus(input: {
  isCancelled?: boolean;
  submissionDeadline?: string;
  now?: Date;
}): OpportunityStatus {
  if (input.isCancelled) {
    return "cancelled";
  }

  if (!input.submissionDeadline) {
    return "unknown";
  }

  const deadline = new Date(input.submissionDeadline);
  if (Number.isNaN(deadline.getTime())) {
    return "unknown";
  }

  return deadline.getTime() > (input.now ?? new Date()).getTime() ? "open" : "closed";
}

function buildExternalId(
  source: ProcurementSource,
  tenderId?: string,
  lotIdentifier?: string,
  noticeId?: string,
  fallback?: string
): string | undefined {
  if (source === "cais-eop" && tenderId) {
    return `${tenderId}:${lotIdentifier ?? "main"}`;
  }

  return noticeId ?? fallback;
}

function buildOpportunityDeduplicationKey(input: {
  source: ProcurementSource;
  publicationNumber?: string;
  uniqueProcurementNumber?: string;
  tenderId?: string;
  lotIdentifier?: string;
}): string {
  const lotPart = input.lotIdentifier ? `:lot:${input.lotIdentifier}` : "";

  if (input.publicationNumber) {
    return `ted:${input.publicationNumber}${lotPart}`;
  }

  if (input.uniqueProcurementNumber) {
    return `bg:${input.uniqueProcurementNumber}${lotPart}`;
  }

  return `${input.source}:${input.tenderId ?? "unknown"}${lotPart}`;
}

function buildStableExternalId(
  parts: readonly (string | undefined)[]
): string | undefined {
  const stableParts = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return stableParts.length > 1 ? stableParts.join(":") : undefined;
}

function buildMoney(amount: unknown, currency: string | undefined): Money | undefined {
  const parsedAmount = parseSourceNumber(amount);
  if (parsedAmount === undefined || !currency) {
    return undefined;
  }

  return {
    amount: parsedAmount,
    currency
  };
}

function readFirstField(
  record: Record<string, unknown>,
  key: string
): string | undefined {
  return readFieldStrings(record, key)[0];
}

function readFieldStrings(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  const values = flattenFieldValues(value);
  return [...new Set(values.map((entry) => entry.trim()).filter(Boolean))];
}

function flattenFieldValues(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (typeof value === "string" || typeof value === "number") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenFieldValues(entry));
  }

  if (isRecord(value)) {
    return Object.values(value).flatMap((entry) => flattenFieldValues(entry));
  }

  return [];
}

function readTedUrl(record: Record<string, unknown>, publicationNumber: string): string {
  const links = readFieldStrings(record, "links");
  const htmlLink = links.find(
    (link) => link.includes("/notice/") && link.includes("html")
  );

  return htmlLink ?? `https://ted.europa.eu/en/notice/${publicationNumber}/html`;
}

function extractTedPublicationNumber(value: string): string | undefined {
  return value.match(/notice\/(\d{6}-\d{4})/i)?.[1];
}

function extractTenderIdFromOcid(value: string | undefined): string | undefined {
  return value?.match(/(\d+)$/)?.[1];
}

function readString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLocaleLowerCase("en-US");
    if (["true", "yes", "1"].includes(normalized)) {
      return true;
    }

    if (["false", "no", "0"].includes(normalized)) {
      return false;
    }
  }

  return undefined;
}

export function parseSourceNumber(value: unknown): number | undefined {
  const sourceValue = readString(value);
  if (!sourceValue) {
    return undefined;
  }

  const normalized = sourceValue.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeDateString(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const canonicalValue = trimmed.replace(
    /^(\d{4}-\d{2}-\d{2})([+-]\d{2}:\d{2})$/,
    "$1T00:00:00$2"
  );
  const date = new Date(canonicalValue);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function normalizeDateOnlyString(value: string | undefined): string | undefined {
  const date = normalizeDateString(value);
  return date ? date.slice(0, 10) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type ProcurementSource = "cais-eop" | "ted" | "sedia";

export type OpportunityKind =
  "procurement" | "funding" | "framework" | "award" | "market-consultation";

export type SourceFamily =
  "national-portal" | "eu" | "ifis" | "defence" | "grant" | "ocds";

export type SupportedCountryCode =
  | "AL"
  | "AT"
  | "AU"
  | "BA"
  | "BE"
  | "BG"
  | "CA"
  | "DE"
  | "DK"
  | "ES"
  | "FI"
  | "FR"
  | "GB"
  | "GR"
  | "HR"
  | "IE"
  | "IT"
  | "LU"
  | "ME"
  | "MK"
  | "NL"
  | "PT"
  | "RO"
  | "RS"
  | "SE"
  | "SI"
  | "US";

export interface SupportedCountry {
  code: SupportedCountryCode;
  name: string;
  region: "home" | "balkans" | "eu" | "global";
}

export interface SourceCatalogItem {
  id: string;
  displayName: string;
  family: SourceFamily;
  baseUrl: string;
  countryCode?: SupportedCountryCode;
  legacySource?: ProcurementSource;
  isInternational: boolean;
  supportsDocuments: boolean;
  supportsAwards: boolean;
  supportsChanges: boolean;
  requiresApiKey: boolean;
  requiresRegistration: boolean;
  defaultEnabled: boolean;
}

export type OpportunityStatus =
  "forthcoming" | "open" | "closed" | "awarded" | "cancelled" | "unknown";

export interface Money {
  amount: number;
  currency: string;
}

export interface MatchReason {
  code: string;
  label: string;
  weight: number;
}

export interface OpportunityScore {
  score: number;
  reasons: MatchReason[];
}

export type BusinessProfileId =
  | "software-development"
  | "maintenance-support"
  | "saas-licensing"
  | "hardware-supply"
  | "networking"
  | "cybersecurity"
  | "cloud-infrastructure"
  | "consulting-integration";

export type BusinessProfileKind = "software" | "hardware" | "services";

export interface BusinessProfile {
  id: BusinessProfileId;
  name: string;
  kind: BusinessProfileKind;
  cpvPrefixes: string[];
  keywords: string[];
  excludedKeywords: string[];
  targetValue?: {
    min?: number;
    max?: number;
    currency: string;
  };
  requiredCertifications: string[];
}

export type ScoreComponentId =
  "relevance" | "eligibility" | "commercial" | "execution" | "competition" | "urgency";

export interface FitScoreComponent {
  id: ScoreComponentId;
  label: string;
  score: number;
  weight: number;
  reasons: string[];
}

export type BidRecommendation = "apply" | "review" | "need-partner" | "skip" | "unknown";

export interface ProfileFitScore {
  profileId: BusinessProfileId;
  profileName: string;
  totalScore: number;
  recommendation: BidRecommendation;
  components: FitScoreComponent[];
}

export interface Opportunity {
  id: string;
  source: ProcurementSource;
  sourceId?: string;
  sourceDisplayName?: string;
  sourceCountryCode?: SupportedCountryCode;
  buyerCountryCode?: SupportedCountryCode;
  placeOfPerformanceCountryCodes?: SupportedCountryCode[];
  opportunityKind?: OpportunityKind;
  language?: string;
  title: string;
  description?: string;
  buyerName: string;
  status: OpportunityStatus;
  cpvCodes: string[];
  sourceUrl: string;
  documentUrls?: string[];
  submissionUrls?: string[];
  deduplicationKey?: string;
  publicationDate?: string;
  submissionDeadline?: string;
  estimatedValue?: Money;
  isEuFunded?: boolean;
  match?: OpportunityScore;
  profileScores?: ProfileFitScore[];
}

export interface NormalizedOpportunity {
  source: ProcurementSource;
  sourceId?: string;
  sourceCountryCode?: SupportedCountryCode;
  placeOfPerformanceCountryCodes?: SupportedCountryCode[];
  opportunityKind?: OpportunityKind;
  language?: string;
  externalId: string;
  deduplicationKey: string;
  title: string;
  description?: string;
  buyerName: string;
  status: OpportunityStatus;
  cpvCodes: string[];
  sourceUrl: string;
  documentUrls?: string[];
  submissionUrls?: string[];
  tenderId?: string;
  uniqueProcurementNumber?: string;
  publicationNumber?: string;
  buyerRegistryNumber?: string;
  buyerCountryCode?: string;
  mainCpvCode?: string;
  cpvDescription?: string;
  estimatedValue?: Money;
  publicationDate?: string;
  submissionDeadline?: string;
  procedureType?: string;
  isEuFunded?: boolean;
  europeanProgram?: string;
  tedUrl?: string;
}

export interface NormalizedOpportunityLot {
  source: ProcurementSource;
  opportunityExternalId: string;
  externalId: string;
  lotIdentifier?: string;
  title?: string;
  cpvCodes: string[];
  estimatedValue?: Money;
  submissionDeadline?: string;
}

export interface NormalizedContract {
  source: ProcurementSource;
  externalId: string;
  opportunityExternalId?: string;
  buyerName: string;
  supplierName?: string;
  supplierRegistryNumber?: string;
  contractNumber?: string;
  contractDate?: string;
  title: string;
  value?: Money;
}

export interface NormalizedContractAmendment {
  source: ProcurementSource;
  externalId: string;
  contractExternalId?: string;
  contractNumber?: string;
  previousValue?: Money;
  currentValue?: Money;
  changeReason?: string;
  changeDescription?: string;
}

export interface SourceRunSummary {
  source: ProcurementSource;
  sourceDate: string;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
}

export type ApplicationStage =
  "watching" | "reviewing" | "preparing" | "submitted" | "won" | "lost" | "archived";

export interface OpportunityLot {
  id: string;
  lotIdentifier?: string;
  title?: string;
  cpvCodes: string[];
  estimatedValue?: Money;
  submissionDeadline?: string;
}

export interface ContractSummary {
  id: string;
  supplierName?: string;
  supplierRegistryNumber?: string;
  contractNumber?: string;
  contractDate?: string;
  title: string;
  value?: Money;
}

export interface ContractAmendmentSummary {
  id: string;
  previousValue?: Money;
  currentValue?: Money;
  changeReason?: string;
  changeDescription?: string;
}

export interface SavedOpportunityState {
  stage: ApplicationStage;
  owner?: string;
  notes?: string;
  nextAction?: string;
  dueDate?: string;
  decisionReason?: string;
}

export interface DocumentIntelligence {
  status: "pending" | "ready" | "failed" | "not-available";
  summary?: string;
  eligibilityCriteria: string[];
  requiredDocuments: string[];
  certifications: string[];
  risks: string[];
  extractedAt?: string;
  aiAnalysis?: TenderAiAnalysis;
}

export interface TenderAiAnalysis {
  provider: string;
  model: string;
  analyzedAt: string;
  businessFitScore: number;
  readinessScore: number;
  commercialScore: number;
  dataConfidenceScore: number;
  complexity: "low" | "medium" | "high" | "unknown";
  sectors: string[];
  missingData: string[];
}

export type TenderDocumentKind =
  | "notice"
  | "metadata"
  | "attachment-bundle"
  | "submission-portal"
  | "requirement"
  | "certification"
  | "lot"
  | "contract"
  | "amendment";

export type TenderDocumentStatus =
  "available" | "extracted" | "needs-download" | "needs-review" | "failed";

export interface TenderDocumentPackageItem {
  id: string;
  title: string;
  kind: TenderDocumentKind;
  status: TenderDocumentStatus;
  description?: string;
  sourceUrl?: string;
  lastSeenAt?: string;
}

export type TenderChangeType =
  | "published"
  | "deadline"
  | "documents-extracted"
  | "lot"
  | "contract-award"
  | "amendment"
  | "source-snapshot";

export interface TenderChangeTimelineItem {
  id: string;
  type: TenderChangeType;
  title: string;
  summary?: string;
  occurredAt?: string;
  sourceUrl?: string;
}

export type ExtractedClauseType =
  | "deadline"
  | "budget"
  | "eligibility"
  | "document"
  | "certification"
  | "warranty"
  | "delivery"
  | "payment"
  | "risk"
  | "support"
  | "lot"
  | "award";

export type TenderClauseSeverity = "info" | "watch" | "risk";

export interface ExtractedTenderClause {
  id: string;
  type: ExtractedClauseType;
  title: string;
  text: string;
  severity: TenderClauseSeverity;
  confidence: number;
  source?: string;
}

export interface TenderDocumentPackageSummary {
  itemCount: number;
  availableCount: number;
  needsAttentionCount: number;
  timelineCount: number;
  clauseCount: number;
  riskClauseCount: number;
}

export interface TenderDocumentPackage {
  items: TenderDocumentPackageItem[];
  timeline: TenderChangeTimelineItem[];
  clauses: ExtractedTenderClause[];
  summary: TenderDocumentPackageSummary;
  coveragePercent: number;
  updatedAt: string;
}

export interface CompetitorInsight {
  supplierName: string;
  winsCount: number;
  totalValue?: Money;
  lastWinDate?: string;
}

export interface OpportunityDetail {
  opportunity: Opportunity;
  lots: OpportunityLot[];
  contracts: ContractSummary[];
  amendments: ContractAmendmentSummary[];
  savedState?: SavedOpportunityState;
  documentIntelligence?: DocumentIntelligence;
  documentPackage?: TenderDocumentPackage;
  competitorInsights: CompetitorInsight[];
}

export interface PipelineDashboardItem {
  opportunity: Opportunity;
  savedState: SavedOpportunityState;
  documentIntelligence: DocumentIntelligence;
}

export interface DocumentReviewItem {
  opportunity: Opportunity;
  documentIntelligence: DocumentIntelligence;
  documentPackage?: TenderDocumentPackage;
  savedState?: SavedOpportunityState;
}

export interface ContractDashboardItem {
  id: string;
  source: string;
  title: string;
  buyerName: string;
  supplierName?: string;
  supplierRegistryNumber?: string;
  contractNumber?: string;
  contractDate?: string;
  value?: Money;
  opportunityId?: string;
  opportunityTitle?: string;
  cpvCodes: string[];
}

export interface BuyerDashboardItem {
  buyerName: string;
  opportunityCount: number;
  openOpportunityCount: number;
  contractCount: number;
  totalAwardedValue?: Money;
  averageAwardedValue?: Money;
  lastActivityDate?: string;
  topSuppliers: string[];
  topCpvCodes: string[];
}

export interface SupplierDashboardItem {
  supplierName: string;
  winsCount: number;
  buyerCount: number;
  totalValue?: Money;
  averageValue?: Money;
  lastWinDate?: string;
  topBuyers: string[];
  topCpvCodes: string[];
}

export interface SourceHealthItem {
  source: string;
  sourceDisplayName?: string;
  sourceCountryCode?: SupportedCountryCode;
  status?: SourceRunStatus;
  startedAt?: string;
  finishedAt?: string;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  recentErrorCount: number;
  openOpportunityCount: number;
  highFitOpportunityCount: number;
  readyOpportunityCount: number;
  documentUrlCount: number;
  submissionUrlCount: number;
  readinessScore: number;
  latestOpportunityAt?: string;
  errorMessage?: string;
}

export interface ProcurementDashboard {
  pipeline: PipelineDashboardItem[];
  documents: DocumentReviewItem[];
  contracts: ContractDashboardItem[];
  buyers: BuyerDashboardItem[];
  suppliers: SupplierDashboardItem[];
  sources: SourceHealthItem[];
}

export type SourceRunStatus = "running" | "succeeded" | "failed" | "partial";

export type EvidenceType =
  | "certificate"
  | "reference"
  | "team-cv"
  | "vendor-authorization"
  | "company-document"
  | "methodology"
  | "other";

export interface EvidenceItem {
  id: string;
  title: string;
  type: EvidenceType;
  profileIds: BusinessProfileId[];
  issuer?: string;
  validUntil?: string;
  summary?: string;
  storageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EvidenceItemInput {
  title: string;
  type: EvidenceType;
  profileIds?: BusinessProfileId[];
  issuer?: string;
  validUntil?: string;
  summary?: string;
  storageUrl?: string;
}

export type ComplianceRequirementType =
  "eligibility" | "required-document" | "certification" | "risk";

export type ComplianceStatus =
  "missing" | "in-progress" | "ready" | "not-applicable" | "blocked";

export interface ComplianceItem {
  id: string;
  opportunityId: string;
  requirementType: ComplianceRequirementType;
  requirement: string;
  status: ComplianceStatus;
  owner?: string;
  evidenceItemIds: string[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ComplianceItemInput {
  requirementType: ComplianceRequirementType;
  requirement: string;
  status?: ComplianceStatus;
  owner?: string;
  evidenceItemIds?: string[];
  notes?: string;
}

export interface ApplyStudioData {
  evidenceItems: EvidenceItem[];
  complianceItems: ComplianceItem[];
}

export type AlertChannel = "email" | "webhook" | "slack";

export interface AlertRule {
  id: string;
  name: string;
  minScore: number;
  channel: AlertChannel;
  enabled: boolean;
  profileId?: BusinessProfileId;
  watchedBuyer?: string;
  cpvPrefix?: string;
  deadlineDays?: number;
  target?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AlertRuleInput {
  name: string;
  minScore: number;
  channel: AlertChannel;
  enabled: boolean;
  profileId?: BusinessProfileId;
  watchedBuyer?: string;
  cpvPrefix?: string;
  deadlineDays?: number;
  target?: string;
}

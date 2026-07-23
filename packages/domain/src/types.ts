export type ProcurementSource = "cais-eop" | "ted" | "sedia";

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
  title: string;
  buyerName: string;
  status: OpportunityStatus;
  cpvCodes: string[];
  sourceUrl: string;
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
  externalId: string;
  deduplicationKey: string;
  title: string;
  buyerName: string;
  status: OpportunityStatus;
  cpvCodes: string[];
  sourceUrl: string;
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
  savedState?: SavedOpportunityState;
}

export interface ContractDashboardItem {
  id: string;
  source: ProcurementSource;
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
  source: ProcurementSource;
  status?: SourceRunStatus;
  startedAt?: string;
  finishedAt?: string;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  recentErrorCount: number;
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

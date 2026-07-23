import type {
  AlertRule,
  AlertRuleInput,
  ApplicationStage,
  ApplyStudioData,
  BuyerDashboardItem,
  BusinessProfileId,
  ComplianceItem,
  ComplianceItemInput,
  CompetitorInsight,
  ContractDashboardItem,
  ContractAmendmentSummary,
  ContractSummary,
  DocumentReviewItem,
  DocumentIntelligence,
  EvidenceItem,
  EvidenceItemInput,
  MatchReason,
  NormalizedContract,
  NormalizedContractAmendment,
  NormalizedOpportunityWithScore,
  NormalizedOpportunityLot,
  Opportunity,
  OpportunityDetail,
  OpportunityLot,
  OpportunityStatus,
  PipelineDashboardItem,
  ProcurementDashboard,
  ProfileFitScore,
  SourceHealthItem,
  SupplierDashboardItem,
  SavedOpportunityState,
  ProcurementSource
} from "@public-scanner/domain";
import type { QueryResultRow } from "pg";

export type SourceRunStatus = "running" | "succeeded" | "failed" | "partial";

export interface SourceRunInput {
  source: ProcurementSource;
  sourceDate: string;
}

export interface SourceRunCompletionInput {
  status: SourceRunStatus;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errorMessage?: string;
}

export interface RawDocumentInput {
  sourceRunId?: string;
  source: ProcurementSource;
  sourceDate?: string;
  sourceUrl: string;
  contentType: string;
  payload: unknown;
}

export interface SourceErrorInput {
  sourceRunId?: string;
  source: ProcurementSource;
  sourceDate?: string;
  context: string;
  errorMessage: string;
  payload?: unknown;
}

export interface UpsertOpportunityResult {
  id: string;
  inserted: boolean;
}

export interface OpportunityListFilters {
  limit?: number;
  minScore?: number;
  profileIds?: BusinessProfileId[];
  status?: OpportunityStatus;
  source?: ProcurementSource;
  search?: string;
  buyer?: string;
  cpvPrefix?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
}

export interface OpportunityRepositoryPort {
  list(filters?: OpportunityListFilters): Promise<Opportunity[]>;
  getById(id: string): Promise<Opportunity | undefined>;
  getDetailById?(id: string): Promise<OpportunityDetail | undefined>;
  getDashboard?(): Promise<ProcurementDashboard>;
  savePipelineState?(
    opportunityId: string,
    input: PipelineStateInput
  ): Promise<SavedOpportunityState>;
}

export interface OpportunityWriterPort extends OpportunityRepositoryPort {
  upsertScored(
    opportunity: NormalizedOpportunityWithScore,
    rawDocumentId?: string
  ): Promise<UpsertOpportunityResult>;
}

export interface AlertRuleRepositoryPort {
  listRules(): Promise<AlertRule[]>;
  upsertRule(input: AlertRuleInput, id?: string): Promise<AlertRule>;
}

export interface ApplyStudioRepositoryPort {
  getApplyStudioData(opportunityId?: string): Promise<ApplyStudioData>;
  upsertEvidenceItem(input: EvidenceItemInput, id?: string): Promise<EvidenceItem>;
  ensureComplianceItems(
    opportunityId: string,
    inputs: ComplianceItemInput[]
  ): Promise<ComplianceItem[]>;
  updateComplianceItem(
    id: string,
    input: ComplianceItemUpdateInput
  ): Promise<ComplianceItem>;
}

export type UserRole = "admin";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthUser extends AuthenticatedUser {
  passwordHash: string;
}

export interface AuthUserInput {
  email: string;
  passwordHash: string;
  role: UserRole;
}

export interface AuthSession {
  user: AuthenticatedUser;
  expiresAt: string;
}

export type UserLocalePreference = "en" | "bg";
export type UserThemePreference = "light" | "dark";

export interface UserPreferences {
  locale: UserLocalePreference;
  theme: UserThemePreference;
  selectedProfileIds: BusinessProfileId[];
}

export interface UserPreferencesInput {
  locale?: UserLocalePreference;
  theme?: UserThemePreference;
  selectedProfileIds?: BusinessProfileId[];
}

export interface AuthRepositoryPort {
  findUserByEmail(email: string): Promise<AuthUser | undefined>;
  upsertUser(input: AuthUserInput): Promise<AuthenticatedUser>;
  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<AuthSession>;
  findSessionByTokenHash(tokenHash: string): Promise<AuthSession | undefined>;
  revokeSession(tokenHash: string): Promise<void>;
  pruneExpiredSessions(): Promise<void>;
  getPreferences(userId: string): Promise<UserPreferences>;
  savePreferences(userId: string, input: UserPreferencesInput): Promise<UserPreferences>;
}

export interface IngestionWriteResult {
  inserted: boolean;
}

export interface OpportunityRow extends QueryResultRow {
  id: string;
  source: ProcurementSource;
  external_id: string;
  deduplication_key: string;
  tender_id: string | null;
  unique_procurement_number: string | null;
  publication_number: string | null;
  title: string;
  buyer_name: string;
  buyer_registry_number: string | null;
  buyer_country_code: string | null;
  status: OpportunityStatus;
  main_cpv_code: string | null;
  cpv_codes: string[];
  cpv_description: string | null;
  estimated_value: string | null;
  currency: string | null;
  publication_date: Date | string | null;
  submission_deadline: Date | string | null;
  procedure_type: string | null;
  is_eu_funded: boolean | null;
  european_program: string | null;
  source_url: string;
  ted_url: string | null;
  score: number | null;
  reasons: MatchReason[] | null;
  profile_scores: ProfileFitScore[] | null;
}

export interface PipelineStateInput {
  stage: ApplicationStage;
  owner?: string;
  notes?: string;
  nextAction?: string;
  dueDate?: string;
  decisionReason?: string;
}

export interface OpportunityLotRow extends QueryResultRow {
  id: string;
  lot_identifier: string | null;
  title: string | null;
  cpv_codes: string[];
  estimated_value: string | null;
  currency: string | null;
  submission_deadline: Date | string | null;
}

export interface ContractSummaryRow extends QueryResultRow {
  id: string;
  supplier_name: string | null;
  supplier_registry_number: string | null;
  contract_number: string | null;
  contract_date: Date | string | null;
  title: string;
  value: string | null;
  currency: string | null;
}

export interface ContractAmendmentRow extends QueryResultRow {
  id: string;
  previous_value: string | null;
  current_value: string | null;
  currency: string | null;
  change_reason: string | null;
  change_description: string | null;
}

export interface SavedOpportunityRow extends QueryResultRow {
  stage: ApplicationStage;
  owner: string | null;
  notes: string | null;
  next_action: string | null;
  due_date: Date | string | null;
  decision_reason: string | null;
}

export interface DocumentIntelligenceRow extends QueryResultRow {
  status: DocumentIntelligence["status"];
  summary: string | null;
  eligibility_criteria: string[];
  required_documents: string[];
  certifications: string[];
  risks: string[];
  extracted_at: Date | string | null;
}

export interface CompetitorInsightRow extends QueryResultRow {
  supplier_name: string;
  wins_count: string;
  total_value: string | null;
  currency: string | null;
  last_win_date: Date | string | null;
}

export interface DocumentIntelligenceInput {
  status: DocumentIntelligence["status"];
  summary?: string;
  eligibilityCriteria: string[];
  requiredDocuments: string[];
  certifications: string[];
  risks: string[];
  extractedAt?: string;
}

export interface AlertRuleRow extends QueryResultRow {
  id: string;
  name: string;
  profile_id: NonNullable<AlertRule["profileId"]> | null;
  min_score: number;
  watched_buyer: string | null;
  cpv_prefix: string | null;
  deadline_days: number | null;
  channel: AlertRule["channel"];
  target: string | null;
  enabled: boolean;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

export interface AuthUserRow extends QueryResultRow {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
}

export interface AuthSessionRow extends QueryResultRow {
  user_id: string;
  email: string;
  role: UserRole;
  expires_at: Date | string;
}

export interface UserPreferencesRow extends QueryResultRow {
  locale: UserLocalePreference;
  theme: UserThemePreference;
  selected_profile_ids: BusinessProfileId[];
}

export interface EvidenceItemRow extends QueryResultRow {
  id: string;
  title: string;
  type: EvidenceItem["type"];
  profile_ids: BusinessProfileId[];
  issuer: string | null;
  valid_until: Date | string | null;
  summary: string | null;
  storage_url: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

export interface ComplianceItemRow extends QueryResultRow {
  id: string;
  opportunity_id: string;
  requirement_type: ComplianceItem["requirementType"];
  requirement: string;
  status: ComplianceItem["status"];
  owner: string | null;
  evidence_item_ids: string[];
  notes: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

export interface ComplianceItemUpdateInput {
  status?: ComplianceItem["status"];
  owner?: string;
  evidenceItemIds?: string[];
  notes?: string;
}

export type {
  AlertRule,
  AlertRuleInput,
  ApplyStudioData,
  BuyerDashboardItem,
  ComplianceItem,
  ComplianceItemInput,
  CompetitorInsight,
  ContractDashboardItem,
  ContractAmendmentSummary,
  ContractSummary,
  DocumentReviewItem,
  DocumentIntelligence,
  EvidenceItem,
  EvidenceItemInput,
  OpportunityDetail,
  OpportunityLot,
  PipelineDashboardItem,
  ProcurementDashboard,
  SavedOpportunityState,
  SourceHealthItem,
  SupplierDashboardItem
};

export function isValidSource(value: string): value is ProcurementSource {
  return value === "cais-eop" || value === "ted" || value === "sedia";
}

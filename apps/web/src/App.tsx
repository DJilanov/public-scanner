import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import type {
  AlertChannel,
  AlertRule,
  AlertRuleInput,
  ApplicationStage,
  ApplyStudioData,
  BidRecommendation,
  BusinessProfile,
  BusinessProfileId,
  BusinessProfileKind,
  BuyerDashboardItem,
  ComplianceItem,
  ComplianceRequirementType,
  ComplianceStatus,
  ContractDashboardItem,
  DocumentReviewItem,
  DocumentIntelligence,
  EvidenceItem,
  EvidenceItemInput,
  EvidenceType,
  Money,
  Opportunity,
  OpportunityDetail,
  PipelineDashboardItem,
  ProcurementDashboard,
  ProfileFitScore,
  SavedOpportunityState,
  SourceHealthItem,
  SupplierDashboardItem
} from "@public-scanner/domain";

interface ApiResponse<T> {
  data: T;
}

type LoadState = "idle" | "loading" | "ready" | "error";
type AuthState = "checking" | "authenticated" | "unauthenticated" | "error";
type ThemePreference = "light" | "dark";
type Locale = "en" | "bg";
type SectorFilter = "" | BusinessProfileKind;
type AppView =
  | "overview"
  | "opportunities"
  | "pipeline"
  | "documents"
  | "apply-studio"
  | "buyers"
  | "competitors"
  | "contracts"
  | "alerts"
  | "sources"
  | "profile";

interface AuthUser {
  id: string;
  email: string;
  role: "admin";
}

interface AuthSession {
  user: AuthUser;
  expiresAt?: string;
}

interface UserPreferences {
  locale: Locale;
  theme: ThemePreference;
  selectedProfileIds: BusinessProfileId[];
}

interface LoginForm {
  email: string;
  password: string;
}

interface Filters {
  search: string;
  buyer: string;
  cpvPrefix: string;
  source: string;
  sector: SectorFilter;
  minScore: string;
  deadlineTo: string;
}

interface PipelineForm {
  stage: ApplicationStage;
  owner: string;
  notes: string;
  nextAction: string;
  dueDate: string;
  decisionReason: string;
}

interface AlertForm {
  name: string;
  minScore: string;
  deadlineDays: string;
  channel: AlertChannel;
  target: string;
  enabled: boolean;
}

interface EvidenceForm {
  title: string;
  type: EvidenceType;
  profileIds: BusinessProfileId[];
  issuer: string;
  validUntil: string;
  storageUrl: string;
  summary: string;
}

interface ComplianceUpdatePayload {
  status?: ComplianceStatus;
  evidenceItemIds?: string[];
}

interface OpportunitySignal {
  id: string;
  label: string;
  tone: "positive" | "warning" | "risk" | "neutral";
}

interface BidIntelligencePanel {
  id: string;
  title: string;
  value: string;
  body: string;
  tone: OpportunitySignal["tone"];
  actions: string[];
}

interface BidIntelligenceInput {
  applyStudio: ApplyStudioData;
  complianceItems: ComplianceItem[];
  dashboard: ProcurementDashboard;
  locale: Locale;
  profiles: BusinessProfile[];
  selectedBid: PipelineDashboardItem;
  selectedProfileIds: BusinessProfileId[];
}

const APPLICATION_STAGES: ApplicationStage[] = [
  "watching",
  "reviewing",
  "preparing",
  "submitted",
  "won",
  "lost",
  "archived"
];

const DEFAULT_PIPELINE_FORM: PipelineForm = {
  stage: "watching",
  owner: "",
  notes: "",
  nextAction: "",
  dueDate: "",
  decisionReason: ""
};

const DEFAULT_ALERT_FORM: AlertForm = {
  name: "",
  minScore: "75",
  deadlineDays: "7",
  channel: "email",
  target: "",
  enabled: true
};

const DEFAULT_LOGIN_FORM: LoginForm = {
  email: "",
  password: ""
};

const DEFAULT_EVIDENCE_FORM: EvidenceForm = {
  title: "",
  type: "reference",
  profileIds: ["software-development"],
  issuer: "",
  validUntil: "",
  storageUrl: "",
  summary: ""
};

const DEFAULT_SELECTED_PROFILE_IDS: BusinessProfileId[] = [
  "software-development",
  "hardware-supply"
];

const EMPTY_DASHBOARD: ProcurementDashboard = {
  pipeline: [],
  documents: [],
  contracts: [],
  buyers: [],
  suppliers: [],
  sources: []
};

const EMPTY_APPLY_STUDIO: ApplyStudioData = {
  evidenceItems: [],
  complianceItems: []
};

const EVIDENCE_TYPES: EvidenceType[] = [
  "certificate",
  "reference",
  "team-cv",
  "vendor-authorization",
  "company-document",
  "methodology",
  "other"
];

const COMPLIANCE_STATUS_OPTIONS: ComplianceStatus[] = [
  "missing",
  "in-progress",
  "ready",
  "blocked",
  "not-applicable"
];

const SECTOR_FILTERS: BusinessProfileKind[] = ["software", "hardware", "services"];

const FALLBACK_PROFILE_IDS_BY_SECTOR: Record<BusinessProfileKind, BusinessProfileId[]> = {
  software: ["software-development", "saas-licensing"],
  hardware: ["hardware-supply", "networking"],
  services: [
    "maintenance-support",
    "cybersecurity",
    "cloud-infrastructure",
    "consulting-integration"
  ]
};

const TRANSLATIONS = {
  en: {
    productEyebrow: "Public Scanner",
    productTitle: "Procurement Monitor",
    loginIntro:
      "Review scored tenders, inspect buyer history, and keep bid decisions moving from one private workspace.",
    loginSignalDecision: "Bid decision",
    loginSignalDecisionValue: "Apply / Partner / Skip",
    loginSignalEvidence: "Evidence",
    loginSignalEvidenceValue: "Docs + buyer history",
    loginSignalPipeline: "Pipeline",
    loginSignalPipelineValue: "Owner + next action",
    adminAccess: "Admin access",
    signIn: "Sign in",
    signingIn: "Signing in",
    checkingSession: "Checking session",
    email: "Email",
    password: "Password",
    darkMode: "Dark mode",
    language: "Language",
    english: "English",
    bulgarian: "Български",
    navOverview: "Overview",
    navOpportunities: "Opportunities",
    navPipeline: "Pipeline",
    navDocuments: "Documents",
    navApplyStudio: "Apply Studio",
    navBuyers: "Buyers",
    navCompetitors: "Competitors",
    navContracts: "Contracts",
    navAlerts: "Alerts",
    navSources: "Sources",
    navProfile: "Profile",
    signedIn: "Signed in",
    signOut: "Sign out",
    activeScan: "Active scan",
    opportunitiesSuffix: "opportunities",
    refresh: "Refresh",
    loading: "Loading",
    openMatches: "Open matches",
    highScore: "High score",
    nextDeadline: "Next deadline",
    activeProfile: "Active profile",
    selectedSectors: "Selected sectors",
    selectedSectorOpportunities: "Selected sector opportunities",
    bestSector: "Best sector",
    sector: "Sector",
    sectors: "Sectors",
    allSectors: "All sectors",
    softwareSector: "Software",
    hardwareSector: "Hardware",
    servicesSector: "Services",
    business: "Business",
    search: "Search",
    buyer: "Buyer",
    cpv: "CPV",
    source: "Source",
    score: "Score",
    deadline: "Deadline",
    all: "All",
    opportunity: "Opportunity",
    value: "Value",
    sourceNotice: "Source notice",
    notStated: "Not stated",
    noDeadline: "No deadline",
    couldNotLoadOpportunities: "Could not load opportunities",
    noMatchingOpportunities: "No matching opportunities",
    noActiveScoredRecords: "No active scored records are available for the filters.",
    loadingPreview: "Loading preview",
    loadingPreviewBody: "Fetching tender detail, contracts, and saved state.",
    couldNotLoadPreview: "Could not load preview",
    selectOpportunity: "Select an opportunity",
    selectOpportunityBody:
      "Open a row to preview score, checklist, history, and bid stage.",
    tenderPreview: "Tender preview",
    officialNotice: "Official notice",
    scoreBreakdown: "Score Breakdown",
    noSignal: "No signal",
    noProfileScore: "No profile score is available for",
    businessProfiles: "Business Profiles",
    applicationPipeline: "Application Pipeline",
    notSaved: "not saved",
    stage: "Stage",
    owner: "Owner",
    dueDate: "Due date",
    nextAction: "Next action",
    decisionReason: "Decision reason",
    notes: "Notes",
    saving: "Saving",
    saveStage: "Save stage",
    documentIntelligence: "Document Intelligence",
    eligibility: "Eligibility",
    requiredDocs: "Required Docs",
    certifications: "Certifications",
    risks: "Risks",
    lotsAndContracts: "Lots and Contracts",
    noLots: "No lots attached yet.",
    noLinkedContracts: "No linked contracts yet.",
    noCpv: "No CPV",
    competitors: "Competitors",
    noSupplierHistory: "No supplier history for this buyer yet.",
    wins: "wins",
    alertRules: "Alert Rules",
    name: "Name",
    minScore: "Min score",
    deadlineDays: "Deadline days",
    channel: "Channel",
    enabled: "Enabled",
    target: "Target",
    emailChannel: "Email",
    webhookChannel: "Webhook",
    slackChannel: "Slack",
    paused: "Paused",
    saveAlert: "Save alert",
    noAlertRules: "No alert rules saved yet.",
    profileDefault: "Default",
    businessProfile: "Business profile",
    over: "over",
    authInvalid: "The email or password is not correct.",
    authVerifyFailed: "Could not verify the session",
    signInFailed: "Could not sign in",
    loadDataFailed: "Failed to load data",
    loadDetailsFailed: "Failed to load details",
    loadPreferencesFailed: "Failed to load profile settings",
    savePipelineFailed: "Failed to save pipeline state",
    savePreferencesFailed: "Failed to save profile settings",
    loadAlertRulesFailed: "Failed to load alert rules",
    saveAlertFailed: "Failed to save alert rule",
    highFit: "High fit",
    reviewFit: "Review fit",
    lowFit: "Low fit",
    partnerLikely: "Partner likely",
    skipSignal: "Skip signal",
    deadlinePassed: "Deadline passed",
    dueSoon: "Due soon",
    nearDeadline: "Near deadline",
    euFunded: "EU funded",
    highValue: "High value",
    unknown: "unknown",
    notAvailable: "not-available",
    noItemsDetected: "No items detected.",
    profileSettings: "Profile settings",
    profileSettingsBody:
      "Choose how the dashboard looks and which business sectors should drive opportunity scoring.",
    appearance: "Appearance",
    languageBody: "Controls labels, dates, and local UI formatting.",
    themeBody: "Choose the dashboard color mode for this browser.",
    lightTheme: "Light theme",
    darkTheme: "Dark theme",
    sectorSelection: "Sector selection",
    sectorSelectionBody:
      "Select every sector you want to track. The dashboard will rank tenders by the best matching selected sector.",
    selectedCount: "selected",
    selectAtLeastOneSector: "Select at least one sector to keep the scanner useful.",
    resetDefaults: "Reset defaults",
    noSelectedSectors: "No selected sectors",
    cpvPrefixes: "CPV prefixes",
    keywords: "Keywords",
    selected: "Selected",
    notSelected: "Not selected",
    dashboardLoading: "Loading dashboard",
    couldNotLoadDashboard: "Could not load dashboard",
    overviewTitle: "Command Center",
    overviewBody:
      "A single operating view for discovery, bid decisions, document risk, source health, and application work.",
    pipelineTitle: "Application Pipeline",
    pipelineBody: "Track every saved tender by stage, owner, next action, and due date.",
    documentReviewTitle: "Document Review",
    documentReviewBody:
      "Review extracted eligibility, required documents, certifications, and risks across active tenders.",
    applyStudioTitle: "Apply Studio",
    applyStudioBody:
      "Prepare bid packages from the live pipeline, document checklist, compliance matrix, and evidence needs.",
    buyersTitle: "Buyer Intelligence",
    buyersBody:
      "Analyze contracting authorities by open opportunities, award history, suppliers, and CPV patterns.",
    competitorsTitle: "Competitor Intelligence",
    competitorsBody:
      "See suppliers that repeatedly win, which buyers they serve, and their contract value profile.",
    contractsTitle: "Contracts Intelligence",
    contractsBody:
      "Inspect awarded contracts linked to buyers, suppliers, notices, values, and CPV categories.",
    alertsTitle: "Alert Rules",
    alertsBody:
      "Manage watch rules for score thresholds, deadlines, sectors, CPV prefixes, and notification channels.",
    sourcesTitle: "Source Health",
    sourcesBody:
      "Monitor ingestion freshness, failed records, recent parser errors, and source coverage.",
    activeBids: "Active bids",
    documentRisks: "Document risks",
    sourceProblems: "Source problems",
    openOpportunities: "Open opportunities",
    totalContracts: "Total contracts",
    activeAlerts: "Active alerts",
    readyDocuments: "Ready documents",
    failedDocuments: "Failed documents",
    missingDocuments: "Missing documents",
    reviewQueue: "Review queue",
    preparationQueue: "Preparation queue",
    submittedQueue: "Submitted queue",
    wonLostArchive: "Won/lost archive",
    noPipelineItems: "No saved pipeline items yet.",
    noDocumentItems: "No active document review items yet.",
    noContracts: "No contracts available yet.",
    noBuyers: "No buyer intelligence available yet.",
    noCompetitors: "No competitor intelligence available yet.",
    noSources: "No source runs available yet.",
    noDashboardData: "No dashboard data is available yet.",
    documentStatus: "Document status",
    requiredCount: "Required docs",
    riskCount: "Risks",
    certificationCount: "Certifications",
    readiness: "Readiness",
    applyReadiness: "Apply readiness",
    evidenceVault: "Evidence vault",
    complianceMatrix: "Compliance matrix",
    bidPackage: "Bid package",
    sourceHealth: "Source health",
    lastRun: "Last run",
    recentErrors: "Recent errors",
    fetched: "Fetched",
    inserted: "Inserted",
    updated: "Updated",
    failed: "Failed",
    skipped: "Skipped",
    supplier: "Supplier",
    averageValue: "Average value",
    totalValue: "Total value",
    open: "Open",
    contracts: "Contracts",
    contract: "Contract",
    documents: "Documents",
    viewDossier: "View dossier",
    packageReady: "Package ready",
    needsReview: "Needs review",
    blocked: "Blocked",
    noAction: "No action",
    officialSource: "Official source",
    documentExtracted: "Extracted",
    applyStudioLoading: "Loading Apply Studio",
    loadApplyStudioFailed: "Failed to load Apply Studio",
    saveEvidenceFailed: "Failed to save evidence",
    saveComplianceFailed: "Failed to update compliance",
    selectedBid: "Selected bid",
    selectBid: "Select bid",
    evidenceTitle: "Evidence title",
    evidenceTitleRequired: "Add an evidence title before saving.",
    evidenceType: "Evidence type",
    issuer: "Issuer",
    validUntil: "Valid until",
    storageUrl: "Storage URL",
    saveEvidence: "Save evidence",
    evidenceSummary: "Evidence summary",
    noEvidenceItems: "No evidence saved yet.",
    linkedEvidence: "Linked evidence",
    availableEvidence: "Available evidence",
    complianceStatus: "Compliance status",
    requirement: "Requirement",
    requirementType: "Requirement type",
    noComplianceItems: "No compliance items for the selected bid yet.",
    selectBidForMatrix: "Select an active bid to review its compliance matrix.",
    notLinked: "Not linked",
    statusMissing: "Missing",
    statusInProgress: "In progress",
    statusReady: "Ready",
    statusNotApplicable: "Not applicable",
    statusBlocked: "Blocked",
    typeCertificate: "Certificate",
    typeReference: "Reference",
    typeTeamCv: "Team CV",
    typeVendorAuthorization: "Vendor authorization",
    typeCompanyDocument: "Company document",
    typeMethodology: "Methodology",
    typeOther: "Other",
    bidIntelligence: "Bid Intelligence",
    tenderBrief: "Tender brief",
    companyCapabilityProfile: "Company capability profile",
    evidenceExpiryAlerts: "Evidence expiry alerts",
    effortProfitabilityScore: "Effort and profitability",
    clarificationQuestions: "Clarification questions",
    noBidKnowledgeBase: "No-bid knowledge base",
    buyerRiskProfile: "Buyer risk profile",
    competitorWatch: "Competitor watch",
    applicationPackBuilder: "Application pack builder",
    deadlineCommandCenter: "Deadline command center",
    partnerMatching: "Partner matching",
    tenderChangeDetection: "Tender change detection",
    sourceTrust: "Source trust",
    decisionHistory: "Decision history",
    winLossLearning: "Win/loss learning",
    recommendedDecision: "Recommended decision",
    applyDecision: "Apply",
    reviewDecision: "Review",
    partnerDecision: "Partner",
    skipDecision: "Skip",
    evidenceExpired: "expired",
    evidenceExpiring: "expiring",
    requirementsReady: "requirements ready",
    actionItems: "Action items"
  },
  bg: {
    productEyebrow: "Public Scanner",
    productTitle: "Монитор за обществени поръчки",
    loginIntro:
      "Преглеждай оценени търгове, анализирай история на възложители и движи решенията за кандидатстване от едно лично работно място.",
    loginSignalDecision: "Решение за участие",
    loginSignalDecisionValue: "Участвай / Партньор / Пропусни",
    loginSignalEvidence: "Доказателства",
    loginSignalEvidenceValue: "Документи + история",
    loginSignalPipeline: "Процес",
    loginSignalPipelineValue: "Отговорник + следващо действие",
    adminAccess: "Администраторски достъп",
    signIn: "Вход",
    signingIn: "Влизане",
    checkingSession: "Проверка на сесията",
    email: "Имейл",
    password: "Парола",
    darkMode: "Тъмен режим",
    language: "Език",
    english: "English",
    bulgarian: "Български",
    navOverview: "Преглед",
    navOpportunities: "Възможности",
    navPipeline: "Процес",
    navDocuments: "Документи",
    navApplyStudio: "Кандидатстване",
    navBuyers: "Възложители",
    navCompetitors: "Конкуренти",
    navContracts: "Договори",
    navAlerts: "Известия",
    navSources: "Източници",
    navProfile: "Профил",
    signedIn: "Влязъл потребител",
    signOut: "Изход",
    activeScan: "Активно сканиране",
    opportunitiesSuffix: "възможности",
    refresh: "Обнови",
    loading: "Зареждане",
    openMatches: "Отворени съвпадения",
    highScore: "Висок резултат",
    nextDeadline: "Следващ срок",
    activeProfile: "Активен профил",
    selectedSectors: "Избрани сектори",
    selectedSectorOpportunities: "Възможности по избрани сектори",
    bestSector: "Най-подходящ сектор",
    sector: "Сектор",
    sectors: "Сектори",
    allSectors: "Всички сектори",
    softwareSector: "Софтуер",
    hardwareSector: "Хардуер",
    servicesSector: "Услуги",
    business: "Бизнес",
    search: "Търсене",
    buyer: "Възложител",
    cpv: "CPV",
    source: "Източник",
    score: "Резултат",
    deadline: "Срок",
    all: "Всички",
    opportunity: "Възможност",
    value: "Стойност",
    sourceNotice: "Официално обявление",
    notStated: "Не е посочено",
    noDeadline: "Няма срок",
    couldNotLoadOpportunities: "Възможностите не могат да се заредят",
    noMatchingOpportunities: "Няма съвпадащи възможности",
    noActiveScoredRecords: "Няма активни оценени записи за избраните филтри.",
    loadingPreview: "Зареждане на преглед",
    loadingPreviewBody: "Зареждат се детайли, договори и запазено състояние.",
    couldNotLoadPreview: "Прегледът не може да се зареди",
    selectOpportunity: "Избери възможност",
    selectOpportunityBody: "Отвори ред, за да видиш резултат, списък, история и етап.",
    tenderPreview: "Преглед на търг",
    officialNotice: "Официално обявление",
    scoreBreakdown: "Разбивка на резултата",
    noSignal: "Няма сигнал",
    noProfileScore: "Няма резултат за профил",
    businessProfiles: "Бизнес профили",
    applicationPipeline: "Процес на кандидатстване",
    notSaved: "не е запазено",
    stage: "Етап",
    owner: "Отговорник",
    dueDate: "Краен срок",
    nextAction: "Следващо действие",
    decisionReason: "Причина за решението",
    notes: "Бележки",
    saving: "Запазване",
    saveStage: "Запази етап",
    documentIntelligence: "Анализ на документи",
    eligibility: "Допустимост",
    requiredDocs: "Необходими документи",
    certifications: "Сертификати",
    risks: "Рискове",
    lotsAndContracts: "Обособени позиции и договори",
    noLots: "Все още няма обособени позиции.",
    noLinkedContracts: "Все още няма свързани договори.",
    noCpv: "Няма CPV",
    competitors: "Конкуренти",
    noSupplierHistory: "Все още няма история на доставчици за този възложител.",
    wins: "спечелени",
    alertRules: "Правила за известия",
    name: "Име",
    minScore: "Мин. резултат",
    deadlineDays: "Дни до срок",
    channel: "Канал",
    enabled: "Активно",
    target: "Получател",
    emailChannel: "Имейл",
    webhookChannel: "Webhook",
    slackChannel: "Slack",
    paused: "Спряно",
    saveAlert: "Запази известие",
    noAlertRules: "Все още няма запазени правила за известия.",
    profileDefault: "По подразбиране",
    businessProfile: "Бизнес профил",
    over: "над",
    authInvalid: "Имейлът или паролата не са правилни.",
    authVerifyFailed: "Сесията не може да бъде проверена",
    signInFailed: "Влизането не беше успешно",
    loadDataFailed: "Данните не могат да се заредят",
    loadDetailsFailed: "Детайлите не могат да се заредят",
    loadPreferencesFailed: "Настройките на профила не могат да се заредят",
    savePipelineFailed: "Състоянието на процеса не може да се запази",
    savePreferencesFailed: "Настройките на профила не могат да се запазят",
    loadAlertRulesFailed: "Правилата за известия не могат да се заредят",
    saveAlertFailed: "Правилото за известие не може да се запази",
    highFit: "Силно съвпадение",
    reviewFit: "За преглед",
    lowFit: "Слабо съвпадение",
    partnerLikely: "Вероятен партньор",
    skipSignal: "Сигнал за пропускане",
    deadlinePassed: "Срокът е изтекъл",
    dueSoon: "Скоро изтича",
    nearDeadline: "Близък срок",
    euFunded: "ЕС финансиране",
    highValue: "Висока стойност",
    unknown: "неизвестно",
    notAvailable: "няма данни",
    noItemsDetected: "Няма открити елементи.",
    profileSettings: "Настройки на профила",
    profileSettingsBody:
      "Избери как да изглежда таблото и кои бизнес сектори да влияят на оценката на възможностите.",
    appearance: "Изглед",
    languageBody: "Управлява етикетите, датите и локалното форматиране.",
    themeBody: "Избери цветови режим за този браузър.",
    lightTheme: "Светъл режим",
    darkTheme: "Тъмен режим",
    sectorSelection: "Избор на сектори",
    sectorSelectionBody:
      "Избери всички сектори, които искаш да следиш. Таблото ще подрежда търговете по най-добрия избран сектор.",
    selectedCount: "избрани",
    selectAtLeastOneSector: "Избери поне един сектор, за да остане скенерът полезен.",
    resetDefaults: "Върни стандартните",
    noSelectedSectors: "Няма избрани сектори",
    cpvPrefixes: "CPV префикси",
    keywords: "Ключови думи",
    selected: "Избрано",
    notSelected: "Не е избрано",
    dashboardLoading: "Зареждане на таблото",
    couldNotLoadDashboard: "Таблото не може да се зареди",
    overviewTitle: "Команден център",
    overviewBody:
      "Единна оперативна гледна точка за откриване, решения за участие, документен риск, състояние на източници и работа по кандидатстване.",
    pipelineTitle: "Процес на кандидатстване",
    pipelineBody:
      "Следи всеки запазен търг по етап, отговорник, следващо действие и срок.",
    documentReviewTitle: "Преглед на документи",
    documentReviewBody:
      "Преглеждай извлечена допустимост, необходими документи, сертификати и рискове за активните търгове.",
    applyStudioTitle: "Студио за кандидатстване",
    applyStudioBody:
      "Подготвяй пакети за участие от процеса, документния списък, матрицата за съответствие и нужните доказателства.",
    buyersTitle: "Анализ на възложители",
    buyersBody:
      "Анализирай възложители по отворени възможности, история на договори, доставчици и CPV модели.",
    competitorsTitle: "Анализ на конкуренти",
    competitorsBody:
      "Виж доставчици, които печелят често, с кои възложители работят и какъв е профилът на договорите им.",
    contractsTitle: "Анализ на договори",
    contractsBody:
      "Преглеждай спечелени договори, свързани с възложители, доставчици, обявления, стойности и CPV категории.",
    alertsTitle: "Правила за известия",
    alertsBody:
      "Управлявай правила за резултат, срокове, сектори, CPV префикси и канали за известяване.",
    sourcesTitle: "Състояние на източници",
    sourcesBody:
      "Следи свежест на данните, неуспешни записи, последни грешки при парсване и покритие на източниците.",
    activeBids: "Активни участия",
    documentRisks: "Документни рискове",
    sourceProblems: "Проблеми с източници",
    openOpportunities: "Отворени възможности",
    totalContracts: "Общо договори",
    activeAlerts: "Активни известия",
    readyDocuments: "Готови документи",
    failedDocuments: "Грешни документи",
    missingDocuments: "Липсващи документи",
    reviewQueue: "Опашка за преглед",
    preparationQueue: "Подготовка",
    submittedQueue: "Подадени",
    wonLostArchive: "Спечелени/загубени",
    noPipelineItems: "Все още няма запазени елементи в процеса.",
    noDocumentItems: "Все още няма активни елементи за документен преглед.",
    noContracts: "Все още няма налични договори.",
    noBuyers: "Все още няма анализ на възложители.",
    noCompetitors: "Все още няма анализ на конкуренти.",
    noSources: "Все още няма стартирания на източници.",
    noDashboardData: "Все още няма данни за таблото.",
    documentStatus: "Статус на документите",
    requiredCount: "Необходими документи",
    riskCount: "Рискове",
    certificationCount: "Сертификати",
    readiness: "Готовност",
    applyReadiness: "Готовност за участие",
    evidenceVault: "Хранилище за доказателства",
    complianceMatrix: "Матрица за съответствие",
    bidPackage: "Пакет за участие",
    sourceHealth: "Състояние на източника",
    lastRun: "Последно стартиране",
    recentErrors: "Последни грешки",
    fetched: "Изтеглени",
    inserted: "Добавени",
    updated: "Обновени",
    failed: "Неуспешни",
    skipped: "Пропуснати",
    supplier: "Доставчик",
    averageValue: "Средна стойност",
    totalValue: "Обща стойност",
    open: "Отворени",
    contracts: "Договори",
    contract: "Договор",
    documents: "Документи",
    viewDossier: "Виж досие",
    packageReady: "Пакетът е готов",
    needsReview: "Нужен преглед",
    blocked: "Блокирано",
    noAction: "Няма действие",
    officialSource: "Официален източник",
    documentExtracted: "Извлечено",
    applyStudioLoading: "Зареждане на студиото",
    loadApplyStudioFailed: "Студиото за кандидатстване не може да се зареди",
    saveEvidenceFailed: "Доказателството не може да се запази",
    saveComplianceFailed: "Съответствието не може да се обнови",
    selectedBid: "Избрано участие",
    selectBid: "Избери участие",
    evidenceTitle: "Име на доказателство",
    evidenceTitleRequired: "Добави име на доказателството преди запазване.",
    evidenceType: "Тип доказателство",
    issuer: "Издател",
    validUntil: "Валидно до",
    storageUrl: "Линк към файл",
    saveEvidence: "Запази доказателство",
    evidenceSummary: "Описание на доказателството",
    noEvidenceItems: "Все още няма запазени доказателства.",
    linkedEvidence: "Свързани доказателства",
    availableEvidence: "Налични доказателства",
    complianceStatus: "Статус на съответствие",
    requirement: "Изискване",
    requirementType: "Тип изискване",
    noComplianceItems: "Все още няма елементи за съответствие за избраното участие.",
    selectBidForMatrix: "Избери активно участие, за да прегледаш матрицата.",
    notLinked: "Не е свързано",
    statusMissing: "Липсва",
    statusInProgress: "В процес",
    statusReady: "Готово",
    statusNotApplicable: "Неприложимо",
    statusBlocked: "Блокирано",
    typeCertificate: "Сертификат",
    typeReference: "Референция",
    typeTeamCv: "CV на екип",
    typeVendorAuthorization: "Оторизация от производител",
    typeCompanyDocument: "Фирмен документ",
    typeMethodology: "Методология",
    typeOther: "Друго",
    bidIntelligence: "Интелигентен анализ",
    tenderBrief: "Кратко резюме",
    companyCapabilityProfile: "Профил на възможностите",
    evidenceExpiryAlerts: "Валидност на доказателства",
    effortProfitabilityScore: "Усилие и рентабилност",
    clarificationQuestions: "Въпроси за разяснения",
    noBidKnowledgeBase: "База с откази",
    buyerRiskProfile: "Риск на възложителя",
    competitorWatch: "Наблюдение на конкуренти",
    applicationPackBuilder: "Пакет за кандидатстване",
    deadlineCommandCenter: "Център за срокове",
    partnerMatching: "Партньорско покритие",
    tenderChangeDetection: "Следене на промени",
    sourceTrust: "Надеждност на източника",
    decisionHistory: "История на решенията",
    winLossLearning: "Учене от резултати",
    recommendedDecision: "Препоръчано решение",
    applyDecision: "Участвай",
    reviewDecision: "Преглед",
    partnerDecision: "Партньор",
    skipDecision: "Пропусни",
    evidenceExpired: "изтекли",
    evidenceExpiring: "изтичащи",
    requirementsReady: "готови изисквания",
    actionItems: "Действия"
  }
} as const;

type TranslationKey = keyof typeof TRANSLATIONS.en;
type ScoreComponentKey = ProfileFitScore["components"][number]["id"];

function t(locale: Locale, key: TranslationKey): string {
  return TRANSLATIONS[locale][key];
}

const PROFILE_NAMES: Record<Locale, Record<BusinessProfileId, string>> = {
  en: {
    "software-development": "Software Development",
    "maintenance-support": "Maintenance & Support",
    "saas-licensing": "SaaS Licensing",
    "hardware-supply": "Hardware Supply",
    networking: "Networking",
    cybersecurity: "Cybersecurity",
    "cloud-infrastructure": "Cloud Infrastructure",
    "consulting-integration": "Consulting & Integration"
  },
  bg: {
    "software-development": "Софтуерна разработка",
    "maintenance-support": "Поддръжка и обслужване",
    "saas-licensing": "SaaS лицензи",
    "hardware-supply": "Хардуерни доставки",
    networking: "Мрежова инфраструктура",
    cybersecurity: "Киберсигурност",
    "cloud-infrastructure": "Облачна инфраструктура",
    "consulting-integration": "Консултиране и интеграции"
  }
};

const ALL_PROFILE_IDS = Object.keys(PROFILE_NAMES.en) as BusinessProfileId[];

const STAGE_LABELS: Record<Locale, Record<ApplicationStage, string>> = {
  en: {
    watching: "Watching",
    reviewing: "Reviewing",
    preparing: "Preparing",
    submitted: "Submitted",
    won: "Won",
    lost: "Lost",
    archived: "Archived"
  },
  bg: {
    watching: "Наблюдение",
    reviewing: "Преглед",
    preparing: "Подготовка",
    submitted: "Подадено",
    won: "Спечелено",
    lost: "Загубено",
    archived: "Архивирано"
  }
};

const RECOMMENDATION_LABELS: Record<Locale, Record<BidRecommendation, string>> = {
  en: {
    apply: "apply",
    review: "review",
    "need-partner": "need partner",
    skip: "skip",
    unknown: "unknown"
  },
  bg: {
    apply: "участвай",
    review: "за преглед",
    "need-partner": "нужен партньор",
    skip: "пропусни",
    unknown: "неизвестно"
  }
};

const SCORE_COMPONENT_LABELS: Record<Locale, Record<ScoreComponentKey, string>> = {
  en: {
    relevance: "Relevance",
    eligibility: "Eligibility",
    commercial: "Commercial",
    execution: "Execution",
    competition: "Competition",
    urgency: "Urgency"
  },
  bg: {
    relevance: "Релевантност",
    eligibility: "Допустимост",
    commercial: "Търговски потенциал",
    execution: "Изпълнение",
    competition: "Конкуренция",
    urgency: "Спешност"
  }
};

const DOCUMENT_STATUS_LABELS: Record<
  Locale,
  Record<DocumentIntelligence["status"], string>
> = {
  en: {
    pending: "pending",
    ready: "ready",
    failed: "failed",
    "not-available": "not available"
  },
  bg: {
    pending: "изчаква",
    ready: "готово",
    failed: "грешка",
    "not-available": "няма данни"
  }
};

const GENERATED_TEXT_BG: Record<string, string> = {
  "Check bidder registration and exclusion declarations.":
    "Провери регистрацията на участника и декларациите за липса на основания за отстраняване.",
  "Verify references for similar public-sector delivery.":
    "Провери референции за сходни доставки или услуги в публичния сектор.",
  "Expect turnover, team capacity, and previous contract evidence.":
    "Очаквай изисквания за оборот, капацитет на екипа и доказателства за предходни договори.",
  "EU-funded procedure: check visibility, reporting, and grant rules.":
    "Процедура с ЕС финансиране: провери правилата за публичност, отчетност и грантово финансиране.",
  "Hardware supply: validate manufacturer authorization and warranty terms.":
    "Хардуерна доставка: провери оторизацията от производителя и гаранционните условия.",
  "Support scope: confirm SLA, response times, and coverage hours.":
    "Обхват на поддръжката: потвърди SLA, времена за реакция и часови диапазон на обслужване.",
  "Administrative declarations and bidder identification.":
    "Административни декларации и идентификация на участника.",
  "Technical proposal mapped to every requirement.":
    "Техническо предложение, съпоставено с всяко изискване.",
  "Financial proposal with clear pricing and validity.":
    "Ценово предложение с ясни цени и срок на валидност.",
  "References or completion certificates for comparable work.":
    "Референции или удостоверения за изпълнение на сходни дейности.",
  "Evidence of economic and financial standing.":
    "Доказателства за икономическо и финансово състояние.",
  "Manufacturer datasheets, warranty statement, and delivery schedule.":
    "Технически спецификации от производителя, гаранционна декларация и график за доставка.",
  "Team CVs, delivery methodology, implementation plan, and acceptance plan.":
    "CV-та на екипа, методология за изпълнение, план за внедряване и план за приемане.",
  "ISO 27001 or equivalent security controls may be requested.":
    "Може да се изисква ISO 27001 или еквивалентни мерки за информационна сигурност.",
  "ISO 9001 or equivalent quality management evidence may be requested.":
    "Може да се изисква ISO 9001 или еквивалентно доказателство за управление на качеството.",
  "Vendor authorization, warranty service rights, or partner status may be requested.":
    "Може да се изисква оторизация от доставчик, права за гаранционно обслужване или партньорски статус.",
  "No certification signal detected in structured metadata.":
    "В структурираните данни няма сигнал за конкретен сертификат.",
  "Submission deadline is missing in the crawled metadata.":
    "Крайният срок липсва в събраните метаданни.",
  "Deadline has passed.": "Крайният срок е изтекъл.",
  "Estimated value is missing; commercial fit needs manual review.":
    "Прогнозната стойност липсва; търговското съвпадение изисква ръчен преглед.",
  "Profile score suggests partner capacity may be needed.":
    "Оценката подсказва, че може да е нужен партньорски капацитет.",
  "Low fit score; apply only if strategic value justifies the effort.":
    "Ниско съвпадение; участвай само ако стратегическата стойност оправдава усилието.",
  "No major metadata risk detected; verify against official documents.":
    "Няма голям риск в метаданните; провери срещу официалните документи.",
  "No profile-level certification blocker":
    "Няма блокиращо изискване за сертификат на ниво профил.",
  "Estimated value is not available": "Прогнозната стойност не е налична.",
  "No submission deadline available": "Няма наличен краен срок за подаване.",
  "Deadline has passed": "Крайният срок е изтекъл.",
  "Competition data requires contract history":
    "Данните за конкуренцията изискват история на договори.",
  "Deadline is unknown": "Крайният срок е неизвестен.",
  Closed: "Затворена.",
  "Critical deadline": "Критичен срок.",
  "Near-term deadline": "Близък срок.",
  "Enough time to review": "Има достатъчно време за преглед."
};

const ENGLISH_PROFILE_NAME_TO_ID = Object.fromEntries(
  Object.entries(PROFILE_NAMES.en).map(([id, name]) => [name, id])
) as Record<string, BusinessProfileId>;
ENGLISH_PROFILE_NAME_TO_ID["SaaS & Licensing"] = "saas-licensing";

export function App() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [currentUser, setCurrentUser] = useState<AuthUser>();
  const [loginSaving, setLoginSaving] = useState(false);
  const [loginErrorMessage, setLoginErrorMessage] = useState<string>();
  const [loginForm, setLoginForm] = useState<LoginForm>(DEFAULT_LOGIN_FORM);
  const [theme, setTheme] = useState<ThemePreference>(getInitialThemePreference);
  const [locale, setLocale] = useState<Locale>(getInitialLocalePreference);
  const [selectedProfileIds, setSelectedProfileIds] = useState<BusinessProfileId[]>(
    getInitialSelectedProfileIds
  );
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [activeView, setActiveView] = useState<AppView>("overview");
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [dashboard, setDashboard] = useState<ProcurementDashboard>(EMPTY_DASHBOARD);
  const [applyStudio, setApplyStudio] = useState<ApplyStudioData>(EMPTY_APPLY_STUDIO);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [dashboardLoadState, setDashboardLoadState] = useState<LoadState>("idle");
  const [applyStudioLoadState, setApplyStudioLoadState] = useState<LoadState>("idle");
  const [detailLoadState, setDetailLoadState] = useState<LoadState>("idle");
  const [alertLoadState, setAlertLoadState] = useState<LoadState>("idle");
  const [pipelineSaving, setPipelineSaving] = useState(false);
  const [evidenceSaving, setEvidenceSaving] = useState(false);
  const [complianceSavingId, setComplianceSavingId] = useState<string>();
  const [alertSaving, setAlertSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [dashboardErrorMessage, setDashboardErrorMessage] = useState<string>();
  const [applyStudioErrorMessage, setApplyStudioErrorMessage] = useState<string>();
  const [detailErrorMessage, setDetailErrorMessage] = useState<string>();
  const [pipelineErrorMessage, setPipelineErrorMessage] = useState<string>();
  const [alertErrorMessage, setAlertErrorMessage] = useState<string>();
  const [preferenceErrorMessage, setPreferenceErrorMessage] = useState<string>();
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string>();
  const [selectedDetail, setSelectedDetail] = useState<OpportunityDetail>();
  const [pipelineForm, setPipelineForm] = useState<PipelineForm>(DEFAULT_PIPELINE_FORM);
  const [evidenceForm, setEvidenceForm] = useState<EvidenceForm>(DEFAULT_EVIDENCE_FORM);
  const [alertForm, setAlertForm] = useState<AlertForm>(DEFAULT_ALERT_FORM);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    buyer: "",
    cpvPrefix: "",
    source: "",
    sector: "",
    minScore: "",
    deadlineTo: ""
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("public-scanner-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem("public-scanner-locale", locale);
  }, [locale]);

  useEffect(() => {
    window.localStorage.setItem(
      "public-scanner-selected-profile-ids",
      JSON.stringify(selectedProfileIds)
    );
  }, [selectedProfileIds]);

  const clearDashboardState = useCallback(() => {
    setProfiles([]);
    setOpportunities([]);
    setDashboard(EMPTY_DASHBOARD);
    setApplyStudio(EMPTY_APPLY_STUDIO);
    setAlertRules([]);
    setLoadState("idle");
    setDashboardLoadState("idle");
    setApplyStudioLoadState("idle");
    setDetailLoadState("idle");
    setAlertLoadState("idle");
    setPipelineSaving(false);
    setEvidenceSaving(false);
    setComplianceSavingId(undefined);
    setAlertSaving(false);
    setErrorMessage(undefined);
    setDashboardErrorMessage(undefined);
    setApplyStudioErrorMessage(undefined);
    setDetailErrorMessage(undefined);
    setPipelineErrorMessage(undefined);
    setAlertErrorMessage(undefined);
    setSelectedOpportunityId(undefined);
    setSelectedDetail(undefined);
    setPipelineForm(DEFAULT_PIPELINE_FORM);
    setEvidenceForm(DEFAULT_EVIDENCE_FORM);
    setAlertForm(DEFAULT_ALERT_FORM);
  }, []);

  const handleUnauthenticated = useCallback(() => {
    setCurrentUser(undefined);
    setAuthState("unauthenticated");
    setPreferencesLoaded(false);
    clearDashboardState();
  }, [clearDashboardState]);

  const loadSession = useCallback(
    async (signal?: AbortSignal) => {
      setAuthState("checking");
      setLoginErrorMessage(undefined);

      try {
        const response = await fetch("/api/auth/session", signal ? { signal } : {});
        if (response.status === 401) {
          handleUnauthenticated();
          return;
        }

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const body = (await response.json()) as ApiResponse<AuthSession>;
        setCurrentUser(body.data.user);
        setAuthState("authenticated");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setCurrentUser(undefined);
        setAuthState("error");
        setLoginErrorMessage(
          error instanceof Error ? error.message : TRANSLATIONS.en.authVerifyFailed
        );
      }
    },
    [handleUnauthenticated]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadSession(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadSession]);

  const loadPreferences = useCallback(
    async (signal?: AbortSignal) => {
      setPreferenceErrorMessage(undefined);

      try {
        const response = await fetch("/api/preferences", signal ? { signal } : {});
        if (response.status === 401) {
          handleUnauthenticated();
          return;
        }

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const body = (await response.json()) as ApiResponse<UserPreferences>;
        setTheme(body.data.theme);
        setLocale(body.data.locale);
        setSelectedProfileIds(normalizeSelectedProfileIds(body.data.selectedProfileIds));
        setPreferencesLoaded(true);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setPreferenceErrorMessage(
          error instanceof Error ? error.message : TRANSLATIONS.en.loadPreferencesFailed
        );
        setPreferencesLoaded(true);
      }
    },
    [handleUnauthenticated]
  );

  const persistPreferences = useCallback(
    async (preferences: UserPreferences, signal?: AbortSignal) => {
      setPreferenceErrorMessage(undefined);

      try {
        const response = await fetch("/api/preferences", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(preferences),
          ...(signal ? { signal } : {})
        });

        if (response.status === 401) {
          handleUnauthenticated();
          return;
        }

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setPreferenceErrorMessage(
          error instanceof Error ? error.message : t(locale, "savePreferencesFailed")
        );
      }
    },
    [handleUnauthenticated, locale]
  );

  const loadProfiles = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch("/api/profiles", signal ? { signal } : {});
        if (response.status === 401) {
          handleUnauthenticated();
          return;
        }

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const body = (await response.json()) as ApiResponse<BusinessProfile[]>;
        setProfiles(body.data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setProfiles([]);
      }
    },
    [handleUnauthenticated]
  );

  const opportunityProfileIds = useMemo(
    () => getOpportunityFilterProfileIds(filters.sector, profiles, selectedProfileIds),
    [filters.sector, profiles, selectedProfileIds]
  );

  const loadOpportunities = useCallback(
    async (signal?: AbortSignal) => {
      setLoadState("loading");
      setErrorMessage(undefined);

      try {
        const response = await fetch(
          buildOpportunityUrl(filters, opportunityProfileIds),
          signal ? { signal } : {}
        );

        if (response.status === 401) {
          handleUnauthenticated();
          return;
        }

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const body = (await response.json()) as ApiResponse<Opportunity[]>;
        setOpportunities(body.data);
        setLoadState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setLoadState("error");
        setErrorMessage(
          error instanceof Error ? error.message : t(locale, "loadDataFailed")
        );
      }
    },
    [filters, handleUnauthenticated, locale, opportunityProfileIds]
  );

  const loadDashboard = useCallback(
    async (signal?: AbortSignal) => {
      setDashboardLoadState("loading");
      setDashboardErrorMessage(undefined);

      try {
        const response = await fetch("/api/dashboard", signal ? { signal } : {});

        if (response.status === 401) {
          handleUnauthenticated();
          return;
        }

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const body = (await response.json()) as ApiResponse<ProcurementDashboard>;
        setDashboard(body.data);
        setDashboardLoadState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setDashboardLoadState("error");
        setDashboardErrorMessage(
          error instanceof Error ? error.message : t(locale, "loadDataFailed")
        );
      }
    },
    [handleUnauthenticated, locale]
  );

  const loadApplyStudio = useCallback(
    async (opportunityId?: string, signal?: AbortSignal) => {
      setApplyStudioLoadState("loading");
      setApplyStudioErrorMessage(undefined);

      try {
        const url = opportunityId
          ? `/api/apply-studio?opportunityId=${encodeURIComponent(opportunityId)}`
          : "/api/apply-studio";
        const response = await fetch(url, signal ? { signal } : {});

        if (response.status === 401) {
          handleUnauthenticated();
          return;
        }

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const body = (await response.json()) as ApiResponse<ApplyStudioData>;
        setApplyStudio(body.data);
        setApplyStudioLoadState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setApplyStudioLoadState("error");
        setApplyStudioErrorMessage(
          error instanceof Error ? error.message : t(locale, "loadApplyStudioFailed")
        );
      }
    },
    [handleUnauthenticated, locale]
  );

  useEffect(() => {
    if (authState !== "authenticated") {
      return;
    }

    const controller = new AbortController();
    void loadPreferences(controller.signal);

    return () => {
      controller.abort();
    };
  }, [authState, loadPreferences]);

  useEffect(() => {
    if (authState !== "authenticated" || !preferencesLoaded) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void persistPreferences(
        {
          locale,
          theme,
          selectedProfileIds
        },
        controller.signal
      );
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    authState,
    locale,
    persistPreferences,
    preferencesLoaded,
    selectedProfileIds,
    theme
  ]);

  const loadAlertRules = useCallback(
    async (signal?: AbortSignal) => {
      setAlertLoadState("loading");
      setAlertErrorMessage(undefined);

      try {
        const response = await fetch("/api/alerts/rules", signal ? { signal } : {});
        if (response.status === 401) {
          handleUnauthenticated();
          return;
        }

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const body = (await response.json()) as ApiResponse<AlertRule[]>;
        setAlertRules(body.data);
        setAlertLoadState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setAlertLoadState("error");
        setAlertErrorMessage(
          error instanceof Error ? error.message : t(locale, "loadAlertRulesFailed")
        );
      }
    },
    [handleUnauthenticated, locale]
  );

  useEffect(() => {
    if (authState !== "authenticated" || !preferencesLoaded) {
      return;
    }

    const controller = new AbortController();
    void loadProfiles(controller.signal);

    return () => {
      controller.abort();
    };
  }, [authState, loadProfiles, preferencesLoaded]);

  useEffect(() => {
    if (authState !== "authenticated" || !preferencesLoaded) {
      return;
    }

    const controller = new AbortController();
    void loadOpportunities(controller.signal);

    return () => {
      controller.abort();
    };
  }, [authState, loadOpportunities, preferencesLoaded]);

  useEffect(() => {
    if (authState !== "authenticated" || !preferencesLoaded) {
      return;
    }

    const controller = new AbortController();
    void loadDashboard(controller.signal);

    return () => {
      controller.abort();
    };
  }, [authState, loadDashboard, preferencesLoaded]);

  useEffect(() => {
    if (authState !== "authenticated" || !preferencesLoaded) {
      return;
    }

    const controller = new AbortController();
    void loadApplyStudio(selectedOpportunityId, controller.signal);

    return () => {
      controller.abort();
    };
  }, [authState, loadApplyStudio, preferencesLoaded, selectedOpportunityId]);

  useEffect(() => {
    if (authState !== "authenticated") {
      return;
    }

    const controller = new AbortController();
    void loadAlertRules(controller.signal);

    return () => {
      controller.abort();
    };
  }, [authState, loadAlertRules]);

  const sortedOpportunities = useMemo(
    () =>
      [...opportunities].sort(
        (first, second) =>
          getOpportunityScore(second, opportunityProfileIds) -
          getOpportunityScore(first, opportunityProfileIds)
      ),
    [opportunities, opportunityProfileIds]
  );

  useEffect(() => {
    const firstOpportunity = sortedOpportunities[0];
    if (!firstOpportunity) {
      setSelectedOpportunityId(undefined);
      setSelectedDetail(undefined);
      return;
    }

    if (
      !selectedOpportunityId ||
      !sortedOpportunities.some((opportunity) => opportunity.id === selectedOpportunityId)
    ) {
      setSelectedOpportunityId(firstOpportunity.id);
    }
  }, [selectedOpportunityId, sortedOpportunities]);

  useEffect(() => {
    if (authState !== "authenticated") {
      return;
    }

    if (!selectedOpportunityId) {
      return;
    }

    const opportunityId = selectedOpportunityId;
    const controller = new AbortController();
    setDetailLoadState("loading");
    setDetailErrorMessage(undefined);
    setPipelineErrorMessage(undefined);

    async function loadDetail(): Promise<void> {
      try {
        const response = await fetch(
          `/api/opportunities/${encodeURIComponent(opportunityId)}`,
          { signal: controller.signal }
        );

        if (response.status === 401) {
          handleUnauthenticated();
          return;
        }

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const body = (await response.json()) as ApiResponse<OpportunityDetail>;
        setSelectedDetail(body.data);
        setPipelineForm(toPipelineForm(body.data.savedState));
        setDetailLoadState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setDetailLoadState("error");
        setDetailErrorMessage(
          error instanceof Error ? error.message : t(locale, "loadDetailsFailed")
        );
      }
    }

    void loadDetail();

    return () => {
      controller.abort();
    };
  }, [authState, handleUnauthenticated, locale, selectedOpportunityId]);

  const savePipelineState = useCallback(async () => {
    const opportunityId = selectedDetail?.opportunity.id;
    if (!opportunityId) {
      return;
    }

    setPipelineSaving(true);
    setPipelineErrorMessage(undefined);

    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunityId)}/pipeline`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(pipelineForm)
        }
      );

      if (response.status === 401) {
        handleUnauthenticated();
        return;
      }

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const body = (await response.json()) as ApiResponse<SavedOpportunityState>;
      setSelectedDetail((current) =>
        current
          ? {
              ...current,
              savedState: body.data
            }
          : current
      );
      setPipelineForm(toPipelineForm(body.data));
      void loadDashboard();
    } catch (error) {
      setPipelineErrorMessage(
        error instanceof Error ? error.message : t(locale, "savePipelineFailed")
      );
    } finally {
      setPipelineSaving(false);
    }
  }, [
    handleUnauthenticated,
    loadDashboard,
    locale,
    pipelineForm,
    selectedDetail?.opportunity.id
  ]);

  const primaryProfileId =
    opportunityProfileIds[0] ?? selectedProfileIds[0] ?? "software-development";
  const primaryProfile = profiles.find((profile) => profile.id === primaryProfileId);

  const login = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setLoginSaving(true);
      setLoginErrorMessage(undefined);

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(loginForm)
        });

        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? t(locale, "authInvalid")
              : `API returned ${response.status}`
          );
        }

        const body = (await response.json()) as ApiResponse<AuthSession>;
        setCurrentUser(body.data.user);
        setAuthState("authenticated");
        setLoginForm(DEFAULT_LOGIN_FORM);
      } catch (error) {
        setAuthState("unauthenticated");
        setLoginErrorMessage(
          error instanceof Error ? error.message : t(locale, "signInFailed")
        );
      } finally {
        setLoginSaving(false);
      }
    },
    [locale, loginForm]
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST"
      });
    } finally {
      handleUnauthenticated();
      setLoginForm((current) => ({
        ...current,
        password: ""
      }));
    }
  }, [handleUnauthenticated]);

  const saveAlertRule = useCallback(async () => {
    const minScore = parsePositiveInteger(alertForm.minScore) ?? 75;
    const deadlineDays = parsePositiveInteger(alertForm.deadlineDays);
    const name =
      alertForm.name.trim() ||
      `${primaryProfile ? formatProfileName(primaryProfile, locale) : formatProfileName(primaryProfileId, locale)} ${t(locale, "over")} ${minScore}`;
    const target = alertForm.target.trim();
    const cpvPrefix = filters.cpvPrefix.trim();
    const payload: AlertRuleInput = {
      name,
      minScore,
      channel: alertForm.channel,
      enabled: alertForm.enabled,
      profileId: primaryProfileId,
      ...(target ? { target } : {}),
      ...(cpvPrefix ? { cpvPrefix } : {}),
      ...(deadlineDays !== undefined ? { deadlineDays } : {})
    };

    setAlertSaving(true);
    setAlertErrorMessage(undefined);

    try {
      const response = await fetch("/api/alerts/rules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 401) {
        handleUnauthenticated();
        return;
      }

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const body = (await response.json()) as ApiResponse<AlertRule>;
      setAlertRules((current) => [
        body.data,
        ...current.filter((rule) => rule.id !== body.data.id)
      ]);
      setAlertForm((current) => ({
        ...current,
        name: ""
      }));
      setAlertLoadState("ready");
    } catch (error) {
      setAlertErrorMessage(
        error instanceof Error ? error.message : t(locale, "saveAlertFailed")
      );
    } finally {
      setAlertSaving(false);
    }
  }, [
    alertForm,
    filters.cpvPrefix,
    handleUnauthenticated,
    locale,
    primaryProfile,
    primaryProfileId
  ]);

  const saveEvidenceItem = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const title = evidenceForm.title.trim();
      if (!title) {
        setApplyStudioErrorMessage(t(locale, "evidenceTitleRequired"));
        return;
      }

      const payload: EvidenceItemInput = {
        title,
        type: evidenceForm.type,
        profileIds: evidenceForm.profileIds,
        ...(evidenceForm.issuer.trim() ? { issuer: evidenceForm.issuer.trim() } : {}),
        ...(evidenceForm.validUntil ? { validUntil: evidenceForm.validUntil } : {}),
        ...(evidenceForm.storageUrl.trim()
          ? { storageUrl: evidenceForm.storageUrl.trim() }
          : {}),
        ...(evidenceForm.summary.trim() ? { summary: evidenceForm.summary.trim() } : {})
      };

      setEvidenceSaving(true);
      setApplyStudioErrorMessage(undefined);

      try {
        const response = await fetch("/api/evidence", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (response.status === 401) {
          handleUnauthenticated();
          return;
        }

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const body = (await response.json()) as ApiResponse<EvidenceItem>;
        setApplyStudio((current) => ({
          ...current,
          evidenceItems: [
            body.data,
            ...current.evidenceItems.filter((item) => item.id !== body.data.id)
          ]
        }));
        setEvidenceForm({
          ...DEFAULT_EVIDENCE_FORM,
          profileIds: opportunityProfileIds.length
            ? opportunityProfileIds
            : DEFAULT_EVIDENCE_FORM.profileIds
        });
        setApplyStudioLoadState("ready");
      } catch (error) {
        setApplyStudioErrorMessage(
          error instanceof Error ? error.message : t(locale, "saveEvidenceFailed")
        );
      } finally {
        setEvidenceSaving(false);
      }
    },
    [evidenceForm, handleUnauthenticated, locale, opportunityProfileIds]
  );

  const updateComplianceItem = useCallback(
    async (id: string, payload: ComplianceUpdatePayload) => {
      setComplianceSavingId(id);
      setApplyStudioErrorMessage(undefined);

      try {
        const response = await fetch(`/api/compliance/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (response.status === 401) {
          handleUnauthenticated();
          return;
        }

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const body = (await response.json()) as ApiResponse<ComplianceItem>;
        setApplyStudio((current) => ({
          ...current,
          complianceItems: current.complianceItems.map((item) =>
            item.id === body.data.id ? body.data : item
          )
        }));
      } catch (error) {
        setApplyStudioErrorMessage(
          error instanceof Error ? error.message : t(locale, "saveComplianceFailed")
        );
      } finally {
        setComplianceSavingId(undefined);
      }
    },
    [handleUnauthenticated, locale]
  );

  const updateComplianceStatus = useCallback(
    (item: ComplianceItem, status: ComplianceStatus) => {
      if (item.status === status) {
        return;
      }

      void updateComplianceItem(item.id, { status });
    },
    [updateComplianceItem]
  );

  const toggleComplianceEvidence = useCallback(
    (item: ComplianceItem, evidenceId: string) => {
      const evidenceItemIds = item.evidenceItemIds.includes(evidenceId)
        ? item.evidenceItemIds.filter((id) => id !== evidenceId)
        : [...item.evidenceItemIds, evidenceId];

      void updateComplianceItem(item.id, { evidenceItemIds });
    },
    [updateComplianceItem]
  );

  const updatePipelineField = useCallback((key: keyof PipelineForm, value: string) => {
    setPipelineForm((current) => {
      switch (key) {
        case "stage":
          return { ...current, stage: value as ApplicationStage };
        case "owner":
          return { ...current, owner: value };
        case "notes":
          return { ...current, notes: value };
        case "nextAction":
          return { ...current, nextAction: value };
        case "dueDate":
          return { ...current, dueDate: value };
        case "decisionReason":
          return { ...current, decisionReason: value };
      }

      return current;
    });
  }, []);

  const updateEvidenceField = useCallback((key: keyof EvidenceForm, value: string) => {
    setEvidenceForm((current) => {
      switch (key) {
        case "title":
          return { ...current, title: value };
        case "type":
          return { ...current, type: value as EvidenceType };
        case "issuer":
          return { ...current, issuer: value };
        case "validUntil":
          return { ...current, validUntil: value };
        case "storageUrl":
          return { ...current, storageUrl: value };
        case "summary":
          return { ...current, summary: value };
        case "profileIds":
          return current;
      }

      return current;
    });
  }, []);

  const toggleEvidenceProfile = useCallback((profileId: BusinessProfileId) => {
    setEvidenceForm((current) => {
      if (current.profileIds.includes(profileId)) {
        return {
          ...current,
          profileIds:
            current.profileIds.length > 1
              ? current.profileIds.filter((id) => id !== profileId)
              : current.profileIds
        };
      }

      return {
        ...current,
        profileIds: [...current.profileIds, profileId]
      };
    });
  }, []);

  const updateLoginField = useCallback((key: keyof LoginForm, value: string) => {
    setLoginForm((current) => ({
      ...current,
      [key]: value
    }));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const changeLocale = useCallback((nextLocale: Locale) => {
    setLocale(nextLocale);
  }, []);

  const changeTheme = useCallback((nextTheme: ThemePreference) => {
    setTheme(nextTheme);
  }, []);

  const toggleSelectedProfile = useCallback((profileId: BusinessProfileId) => {
    setSelectedProfileIds((current) => {
      if (current.includes(profileId)) {
        return current.length > 1 ? current.filter((id) => id !== profileId) : current;
      }

      return [...current, profileId];
    });
  }, []);

  const resetSelectedProfiles = useCallback(() => {
    setSelectedProfileIds(DEFAULT_SELECTED_PROFILE_IDS);
  }, []);

  const updateAlertField = useCallback(
    (key: keyof AlertForm, value: string | boolean) => {
      setAlertForm((current) => {
        switch (key) {
          case "name":
            return { ...current, name: String(value) };
          case "minScore":
            return { ...current, minScore: String(value).replace(/\D/g, "").slice(0, 3) };
          case "deadlineDays":
            return {
              ...current,
              deadlineDays: String(value).replace(/\D/g, "").slice(0, 3)
            };
          case "channel":
            return { ...current, channel: value as AlertChannel };
          case "target":
            return { ...current, target: String(value) };
          case "enabled":
            return { ...current, enabled: Boolean(value) };
        }

        return current;
      });
    },
    []
  );

  const highScoreCount = sortedOpportunities.filter(
    (opportunity) => getOpportunityScore(opportunity, opportunityProfileIds) >= 70
  ).length;
  const nextDeadline = getNextDeadline(sortedOpportunities, locale);
  const selectedScore = selectedDetail
    ? getBestProfileScore(selectedDetail.opportunity.profileScores, opportunityProfileIds)
    : undefined;
  const refreshWorkspaceData = useCallback(() => {
    void loadOpportunities();
    void loadDashboard();
    void loadApplyStudio(selectedOpportunityId);
    void loadAlertRules();
  }, [
    loadAlertRules,
    loadApplyStudio,
    loadDashboard,
    loadOpportunities,
    selectedOpportunityId
  ]);
  const openOpportunityDossier = useCallback((opportunityId: string) => {
    setSelectedOpportunityId(opportunityId);
    setActiveView("opportunities");
  }, []);

  if (authState !== "authenticated") {
    return (
      <LoginScreen
        authState={authState}
        errorMessage={loginErrorMessage}
        form={loginForm}
        locale={locale}
        saving={loginSaving}
        theme={theme}
        onChangeField={updateLoginField}
        onChangeLocale={changeLocale}
        onSubmit={login}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label={t(locale, "navOpportunities")}>
        <div>
          <p className="eyebrow">{t(locale, "productEyebrow")}</p>
          <h1>{t(locale, "productTitle")}</h1>
        </div>
        <nav>
          <button
            type="button"
            aria-current={activeView === "overview" ? "page" : undefined}
            onClick={() => setActiveView("overview")}
          >
            {t(locale, "navOverview")}
          </button>
          <button
            type="button"
            aria-current={activeView === "opportunities" ? "page" : undefined}
            onClick={() => setActiveView("opportunities")}
          >
            {t(locale, "navOpportunities")}
          </button>
          <button
            type="button"
            aria-current={activeView === "pipeline" ? "page" : undefined}
            onClick={() => setActiveView("pipeline")}
          >
            {t(locale, "navPipeline")}
          </button>
          <button
            type="button"
            aria-current={activeView === "documents" ? "page" : undefined}
            onClick={() => setActiveView("documents")}
          >
            {t(locale, "navDocuments")}
          </button>
          <button
            type="button"
            aria-current={activeView === "apply-studio" ? "page" : undefined}
            onClick={() => setActiveView("apply-studio")}
          >
            {t(locale, "navApplyStudio")}
          </button>
          <button
            type="button"
            aria-current={activeView === "buyers" ? "page" : undefined}
            onClick={() => setActiveView("buyers")}
          >
            {t(locale, "navBuyers")}
          </button>
          <button
            type="button"
            aria-current={activeView === "competitors" ? "page" : undefined}
            onClick={() => setActiveView("competitors")}
          >
            {t(locale, "navCompetitors")}
          </button>
          <button
            type="button"
            aria-current={activeView === "contracts" ? "page" : undefined}
            onClick={() => setActiveView("contracts")}
          >
            {t(locale, "navContracts")}
          </button>
          <button
            type="button"
            aria-current={activeView === "alerts" ? "page" : undefined}
            onClick={() => setActiveView("alerts")}
          >
            {t(locale, "navAlerts")}
          </button>
          <button
            type="button"
            aria-current={activeView === "sources" ? "page" : undefined}
            onClick={() => setActiveView("sources")}
          >
            {t(locale, "navSources")}
          </button>
          <button
            type="button"
            aria-current={activeView === "profile" ? "page" : undefined}
            onClick={() => setActiveView("profile")}
          >
            {t(locale, "navProfile")}
          </button>
        </nav>
        <div className="sidebar-footer">
          <LanguageSwitch locale={locale} onChangeLocale={changeLocale} />
          <ThemeSwitch locale={locale} theme={theme} onToggleTheme={toggleTheme} />
          <div className="session-card">
            <span>{t(locale, "signedIn")}</span>
            <strong>{currentUser?.email}</strong>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void logout()}
            >
              {t(locale, "signOut")}
            </button>
          </div>
        </div>
      </aside>

      {activeView === "overview" ? (
        <OverviewPage
          dashboard={dashboard}
          dashboardErrorMessage={dashboardErrorMessage}
          dashboardLoadState={dashboardLoadState}
          highScoreCount={highScoreCount}
          locale={locale}
          nextDeadline={nextDeadline}
          opportunities={sortedOpportunities}
          selectedProfileIds={opportunityProfileIds}
          onOpenOpportunity={openOpportunityDossier}
          onRefresh={refreshWorkspaceData}
        />
      ) : null}

      {activeView === "opportunities" ? (
        <section className="content" id="opportunities">
          <header className="toolbar">
            <div>
              <p className="eyebrow">{t(locale, "activeScan")}</p>
              <h2>{t(locale, "selectedSectorOpportunities")}</h2>
            </div>
            <button
              type="button"
              disabled={loadState === "loading"}
              onClick={() => {
                refreshWorkspaceData();
              }}
            >
              {loadState === "loading" ? t(locale, "loading") : t(locale, "refresh")}
            </button>
          </header>

          <section className="metrics" aria-label={t(locale, "openMatches")}>
            <Metric
              label={t(locale, "openMatches")}
              value={String(sortedOpportunities.length)}
            />
            <Metric label={t(locale, "highScore")} value={String(highScoreCount)} />
            <Metric label={t(locale, "nextDeadline")} value={nextDeadline} />
            <Metric
              label={t(locale, "selectedSectors")}
              value={formatOpportunityFilterSummary(
                filters.sector,
                opportunityProfileIds,
                locale
              )}
            />
          </section>

          <section className="filters" aria-label={t(locale, "navOpportunities")}>
            <label>
              <span>{t(locale, "search")}</span>
              <input
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, search: event.target.value }))
                }
              />
            </label>
            <label>
              <span>{t(locale, "buyer")}</span>
              <input
                value={filters.buyer}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, buyer: event.target.value }))
                }
              />
            </label>
            <label>
              <span>{t(locale, "cpv")}</span>
              <input
                inputMode="numeric"
                value={filters.cpvPrefix}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    cpvPrefix: event.target.value.replace(/\D/g, "").slice(0, 8)
                  }))
                }
              />
            </label>
            <label>
              <span>{t(locale, "source")}</span>
              <select
                value={filters.source}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, source: event.target.value }))
                }
              >
                <option value="">{t(locale, "all")}</option>
                <option value="cais-eop">CAIS</option>
                <option value="ted">TED</option>
                <option value="sedia">SEDIA</option>
              </select>
            </label>
            <label>
              <span>{t(locale, "sector")}</span>
              <select
                value={filters.sector}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    sector: event.target.value as SectorFilter
                  }))
                }
              >
                <option value="">{t(locale, "allSectors")}</option>
                {SECTOR_FILTERS.map((sector) => (
                  <option key={sector} value={sector}>
                    {formatSectorFilter(sector, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t(locale, "score")}</span>
              <input
                inputMode="numeric"
                value={filters.minScore}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    minScore: event.target.value.replace(/\D/g, "").slice(0, 3)
                  }))
                }
              />
            </label>
            <label>
              <span>{t(locale, "deadline")}</span>
              <input
                type="date"
                value={filters.deadlineTo}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    deadlineTo: event.target.value
                  }))
                }
              />
            </label>
          </section>

          {loadState === "error" ? (
            <div className="state-panel" role="alert">
              <strong>{t(locale, "couldNotLoadOpportunities")}</strong>
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <section className="workbench">
            <div>
              {loadState === "ready" && sortedOpportunities.length === 0 ? (
                <div className="state-panel">
                  <strong>{t(locale, "noMatchingOpportunities")}</strong>
                  <span>{t(locale, "noActiveScoredRecords")}</span>
                </div>
              ) : (
                <OpportunityTable
                  opportunities={sortedOpportunities}
                  locale={locale}
                  selectedProfileIds={opportunityProfileIds}
                  selectedOpportunityId={selectedOpportunityId}
                  onSelectOpportunity={setSelectedOpportunityId}
                />
              )}
            </div>

            <OpportunityPreview
              detail={selectedDetail}
              detailLoadState={detailLoadState}
              detailErrorMessage={detailErrorMessage}
              pipelineErrorMessage={pipelineErrorMessage}
              pipelineForm={pipelineForm}
              pipelineSaving={pipelineSaving}
              alertForm={alertForm}
              alertRules={alertRules}
              alertLoadState={alertLoadState}
              alertErrorMessage={alertErrorMessage}
              alertSaving={alertSaving}
              locale={locale}
              profileScore={selectedScore}
              selectedProfileIds={opportunityProfileIds}
              onChangePipelineField={updatePipelineField}
              onSavePipeline={savePipelineState}
              onChangeAlertField={updateAlertField}
              onSaveAlertRule={saveAlertRule}
            />
          </section>
        </section>
      ) : null}

      {activeView === "pipeline" ? (
        <PipelinePage
          dashboardLoadState={dashboardLoadState}
          items={dashboard.pipeline}
          locale={locale}
          onOpenOpportunity={openOpportunityDossier}
          onRefresh={refreshWorkspaceData}
        />
      ) : null}

      {activeView === "documents" ? (
        <DocumentReviewPage
          dashboardLoadState={dashboardLoadState}
          items={dashboard.documents}
          locale={locale}
          onOpenOpportunity={openOpportunityDossier}
          onRefresh={refreshWorkspaceData}
        />
      ) : null}

      {activeView === "apply-studio" ? (
        <ApplyStudioPage
          applyStudio={applyStudio}
          applyStudioErrorMessage={applyStudioErrorMessage}
          applyStudioLoadState={applyStudioLoadState}
          complianceSavingId={complianceSavingId}
          dashboard={dashboard}
          dashboardLoadState={dashboardLoadState}
          evidenceForm={evidenceForm}
          evidenceSaving={evidenceSaving}
          locale={locale}
          profiles={profiles}
          selectedOpportunityId={selectedOpportunityId}
          selectedProfileIds={selectedProfileIds}
          onOpenOpportunity={openOpportunityDossier}
          onRefresh={refreshWorkspaceData}
          onSaveEvidence={saveEvidenceItem}
          onSelectOpportunity={setSelectedOpportunityId}
          onToggleComplianceEvidence={toggleComplianceEvidence}
          onToggleEvidenceProfile={toggleEvidenceProfile}
          onUpdateComplianceStatus={updateComplianceStatus}
          onUpdateEvidenceField={updateEvidenceField}
        />
      ) : null}

      {activeView === "buyers" ? (
        <BuyersPage
          buyers={dashboard.buyers}
          dashboardLoadState={dashboardLoadState}
          locale={locale}
          onRefresh={refreshWorkspaceData}
        />
      ) : null}

      {activeView === "competitors" ? (
        <CompetitorsPage
          dashboardLoadState={dashboardLoadState}
          locale={locale}
          suppliers={dashboard.suppliers}
          onRefresh={refreshWorkspaceData}
        />
      ) : null}

      {activeView === "contracts" ? (
        <ContractsPage
          contracts={dashboard.contracts}
          dashboardLoadState={dashboardLoadState}
          locale={locale}
          onOpenOpportunity={openOpportunityDossier}
          onRefresh={refreshWorkspaceData}
        />
      ) : null}

      {activeView === "alerts" ? (
        <AlertsPage
          alertErrorMessage={alertErrorMessage}
          alertForm={alertForm}
          alertLoadState={alertLoadState}
          alertRules={alertRules}
          alertSaving={alertSaving}
          locale={locale}
          onChangeAlertField={updateAlertField}
          onRefresh={refreshWorkspaceData}
          onSaveAlertRule={saveAlertRule}
        />
      ) : null}

      {activeView === "sources" ? (
        <SourcesPage
          dashboardLoadState={dashboardLoadState}
          locale={locale}
          onRefresh={refreshWorkspaceData}
          sources={dashboard.sources}
        />
      ) : null}

      {activeView === "profile" ? (
        <ProfileSettingsPage
          locale={locale}
          errorMessage={preferenceErrorMessage}
          profiles={profiles}
          selectedProfileIds={selectedProfileIds}
          theme={theme}
          onChangeLocale={changeLocale}
          onChangeTheme={changeTheme}
          onResetSelectedProfiles={resetSelectedProfiles}
          onToggleSelectedProfile={toggleSelectedProfile}
        />
      ) : null}
    </main>
  );
}

interface MetricProps {
  label: string;
  value: string;
}

interface LoginScreenProps {
  authState: AuthState;
  errorMessage: string | undefined;
  form: LoginForm;
  locale: Locale;
  saving: boolean;
  theme: ThemePreference;
  onChangeField(key: keyof LoginForm, value: string): void;
  onChangeLocale(locale: Locale): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  onToggleTheme(): void;
}

function LoginScreen({
  authState,
  errorMessage,
  form,
  locale,
  saving,
  theme,
  onChangeField,
  onChangeLocale,
  onSubmit,
  onToggleTheme
}: LoginScreenProps) {
  const checkingSession = authState === "checking";

  return (
    <main className="auth-shell">
      <section className="auth-copy" aria-label={t(locale, "productTitle")}>
        <div>
          <p className="eyebrow">{t(locale, "productEyebrow")}</p>
          <h1>{t(locale, "productTitle")}</h1>
          <p>{t(locale, "loginIntro")}</p>
        </div>
        <div className="auth-signal-grid" aria-label={t(locale, "loginSignalEvidence")}>
          <div>
            <span>{t(locale, "loginSignalDecision")}</span>
            <strong>{t(locale, "loginSignalDecisionValue")}</strong>
          </div>
          <div>
            <span>{t(locale, "loginSignalEvidence")}</span>
            <strong>{t(locale, "loginSignalEvidenceValue")}</strong>
          </div>
          <div>
            <span>{t(locale, "loginSignalPipeline")}</span>
            <strong>{t(locale, "loginSignalPipelineValue")}</strong>
          </div>
        </div>
      </section>

      <section className="auth-panel" aria-label={t(locale, "adminAccess")}>
        <LanguageSwitch locale={locale} onChangeLocale={onChangeLocale} />
        <ThemeSwitch locale={locale} theme={theme} onToggleTheme={onToggleTheme} />
        <form className="auth-card" onSubmit={onSubmit}>
          <div>
            <p className="eyebrow">{t(locale, "adminAccess")}</p>
            <h2>{t(locale, "signIn")}</h2>
          </div>

          <label>
            <span>{t(locale, "email")}</span>
            <input
              autoComplete="email"
              inputMode="email"
              name="email"
              type="email"
              value={form.email}
              onChange={(event) => onChangeField("email", event.target.value)}
            />
          </label>

          <label>
            <span>{t(locale, "password")}</span>
            <input
              autoComplete="current-password"
              name="password"
              type="password"
              value={form.password}
              onChange={(event) => onChangeField("password", event.target.value)}
            />
          </label>

          {errorMessage ? (
            <div className="form-error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <button type="submit" disabled={saving || checkingSession}>
            {checkingSession
              ? t(locale, "checkingSession")
              : saving
                ? t(locale, "signingIn")
                : t(locale, "signIn")}
          </button>
        </form>
      </section>
    </main>
  );
}

interface ThemeSwitchProps {
  locale: Locale;
  theme: ThemePreference;
  onToggleTheme(): void;
}

interface LanguageSwitchProps {
  locale: Locale;
  onChangeLocale(locale: Locale): void;
}

function LanguageSwitch({ locale, onChangeLocale }: LanguageSwitchProps) {
  return (
    <label className="language-switch">
      <span>{t(locale, "language")}</span>
      <select
        value={locale}
        onChange={(event) => onChangeLocale(event.target.value as Locale)}
      >
        <option value="en">{t(locale, "english")}</option>
        <option value="bg">{t(locale, "bulgarian")}</option>
      </select>
    </label>
  );
}

function ThemeSwitch({ locale, theme, onToggleTheme }: ThemeSwitchProps) {
  const enabled = theme === "dark";

  return (
    <label className="theme-switch">
      <input type="checkbox" checked={enabled} onChange={onToggleTheme} />
      <span aria-hidden="true" />
      <b>{t(locale, "darkMode")}</b>
    </label>
  );
}

function Metric({ label, value }: MetricProps) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

interface WorkspaceHeaderProps {
  eyebrow: string;
  title: string;
  body: string;
  locale: Locale;
  loading?: boolean;
  onRefresh(): void;
}

function WorkspaceHeader({
  eyebrow,
  title,
  body,
  locale,
  loading = false,
  onRefresh
}: WorkspaceHeaderProps) {
  return (
    <header className="toolbar">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="toolbar-copy">{body}</p>
      </div>
      <button type="button" disabled={loading} onClick={onRefresh}>
        {loading ? t(locale, "loading") : t(locale, "refresh")}
      </button>
    </header>
  );
}

interface DashboardNoticeProps {
  errorMessage: string | undefined;
  locale: Locale;
  state: LoadState;
}

function DashboardNotice({ errorMessage, locale, state }: DashboardNoticeProps) {
  if (state === "loading") {
    return (
      <div className="state-panel">
        <strong>{t(locale, "dashboardLoading")}</strong>
        <span>{t(locale, "overviewBody")}</span>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="state-panel" role="alert">
        <strong>{t(locale, "couldNotLoadDashboard")}</strong>
        <span>{errorMessage ?? t(locale, "loadDataFailed")}</span>
      </div>
    );
  }

  return null;
}

interface OverviewPageProps {
  dashboard: ProcurementDashboard;
  dashboardErrorMessage: string | undefined;
  dashboardLoadState: LoadState;
  highScoreCount: number;
  locale: Locale;
  nextDeadline: string;
  opportunities: Opportunity[];
  selectedProfileIds: BusinessProfileId[];
  onOpenOpportunity(opportunityId: string): void;
  onRefresh(): void;
}

function OverviewPage({
  dashboard,
  dashboardErrorMessage,
  dashboardLoadState,
  highScoreCount,
  locale,
  nextDeadline,
  opportunities,
  selectedProfileIds,
  onOpenOpportunity,
  onRefresh
}: OverviewPageProps) {
  const activePipeline = dashboard.pipeline.filter((item) =>
    isActivePipelineStage(item.savedState.stage)
  );
  const documentRiskCount = dashboard.documents.reduce(
    (total, item) => total + item.documentIntelligence.risks.length,
    0
  );
  const sourceProblemCount = dashboard.sources.filter(
    (source) =>
      source.status === "failed" ||
      source.status === "partial" ||
      source.recentErrorCount > 0
  ).length;

  return (
    <section className="content" id="overview">
      <WorkspaceHeader
        eyebrow={t(locale, "navOverview")}
        title={t(locale, "overviewTitle")}
        body={t(locale, "overviewBody")}
        locale={locale}
        loading={dashboardLoadState === "loading"}
        onRefresh={onRefresh}
      />
      <DashboardNotice
        errorMessage={dashboardErrorMessage}
        locale={locale}
        state={dashboardLoadState}
      />
      <section className="metrics" aria-label={t(locale, "overviewTitle")}>
        <Metric label={t(locale, "openMatches")} value={String(opportunities.length)} />
        <Metric label={t(locale, "highScore")} value={String(highScoreCount)} />
        <Metric label={t(locale, "activeBids")} value={String(activePipeline.length)} />
        <Metric label={t(locale, "documentRisks")} value={String(documentRiskCount)} />
        <Metric label={t(locale, "nextDeadline")} value={nextDeadline} />
        <Metric label={t(locale, "sourceProblems")} value={String(sourceProblemCount)} />
        <Metric
          label={t(locale, "selectedSectors")}
          value={formatSelectedSectorSummary(selectedProfileIds, locale)}
        />
        <Metric
          label={t(locale, "totalContracts")}
          value={String(dashboard.contracts.length)}
        />
      </section>

      <section className="dashboard-grid">
        <DashboardPanel title={t(locale, "openOpportunities")}>
          <CompactList
            emptyLabel={t(locale, "noMatchingOpportunities")}
            items={opportunities.slice(0, 6).map((opportunity) => ({
              id: opportunity.id,
              title: opportunity.title,
              meta: `${opportunity.buyerName} - ${getOpportunityScore(opportunity, selectedProfileIds)}`
            }))}
          />
        </DashboardPanel>
        <DashboardPanel title={t(locale, "pipelineTitle")}>
          <CompactList
            emptyLabel={t(locale, "noPipelineItems")}
            items={activePipeline.slice(0, 6).map((item) => ({
              id: item.opportunity.id,
              title: item.opportunity.title,
              meta: `${formatStage(item.savedState.stage, locale)} - ${item.savedState.nextAction ?? t(locale, "noAction")}`
            }))}
          />
        </DashboardPanel>
        <DashboardPanel title={t(locale, "documentReviewTitle")}>
          <CompactList
            emptyLabel={t(locale, "noDocumentItems")}
            items={dashboard.documents.slice(0, 6).map((item) => ({
              id: item.opportunity.id,
              title: item.opportunity.title,
              meta: `${formatDocumentStatus(item.documentIntelligence.status, locale)} - ${item.documentIntelligence.risks.length} ${t(locale, "risks")}`
            }))}
          />
        </DashboardPanel>
        <DashboardPanel title={t(locale, "sourceHealth")}>
          <CompactList
            emptyLabel={t(locale, "noSources")}
            items={dashboard.sources.map((source) => ({
              id: source.source,
              title: source.source,
              meta: `${formatSourceRunStatus(source.status, locale)} - ${source.recentErrorCount} ${t(locale, "recentErrors")}`
            }))}
          />
        </DashboardPanel>
      </section>

      {opportunities[0] ? (
        <button
          type="button"
          className="secondary-action"
          onClick={() => onOpenOpportunity(opportunities[0]!.id)}
        >
          {t(locale, "viewDossier")}
        </button>
      ) : null}
    </section>
  );
}

interface DashboardPanelProps {
  children: ReactNode;
  title: string;
}

function DashboardPanel({ children, title }: DashboardPanelProps) {
  return (
    <section className="settings-panel dashboard-panel">
      <div className="section-heading">
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

interface BidIntelligenceCardProps {
  locale: Locale;
  panel: BidIntelligencePanel;
}

function BidIntelligenceCard({ locale, panel }: BidIntelligenceCardProps) {
  return (
    <article className={`intelligence-card intelligence-${panel.tone}`}>
      <div className="section-heading">
        <h4>{panel.title}</h4>
        <span>{panel.value}</span>
      </div>
      <p>{panel.body}</p>
      <strong>{t(locale, "actionItems")}</strong>
      <ul>
        {panel.actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
    </article>
  );
}

interface PipelinePageProps {
  dashboardLoadState: LoadState;
  items: PipelineDashboardItem[];
  locale: Locale;
  onOpenOpportunity(opportunityId: string): void;
  onRefresh(): void;
}

function PipelinePage({
  dashboardLoadState,
  items,
  locale,
  onOpenOpportunity,
  onRefresh
}: PipelinePageProps) {
  return (
    <section className="content" id="pipeline">
      <WorkspaceHeader
        eyebrow={t(locale, "navPipeline")}
        title={t(locale, "pipelineTitle")}
        body={t(locale, "pipelineBody")}
        locale={locale}
        loading={dashboardLoadState === "loading"}
        onRefresh={onRefresh}
      />
      <section className="metrics" aria-label={t(locale, "pipelineTitle")}>
        <Metric
          label={t(locale, "reviewQueue")}
          value={String(countPipelineStage(items, "reviewing"))}
        />
        <Metric
          label={t(locale, "preparationQueue")}
          value={String(countPipelineStage(items, "preparing"))}
        />
        <Metric
          label={t(locale, "submittedQueue")}
          value={String(countPipelineStage(items, "submitted"))}
        />
        <Metric
          label={t(locale, "wonLostArchive")}
          value={String(
            items.filter((item) =>
              ["won", "lost", "archived"].includes(item.savedState.stage)
            ).length
          )}
        />
      </section>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{t(locale, "stage")}</th>
              <th scope="col">{t(locale, "opportunity")}</th>
              <th scope="col">{t(locale, "owner")}</th>
              <th scope="col">{t(locale, "nextAction")}</th>
              <th scope="col">{t(locale, "dueDate")}</th>
              <th scope="col">{t(locale, "documentStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <EmptyTableRow colSpan={6} label={t(locale, "noPipelineItems")} />
            ) : (
              items.map((item) => (
                <tr key={item.opportunity.id}>
                  <td>
                    <span className={getPipelineBadgeClass(item.savedState.stage)}>
                      {formatStage(item.savedState.stage, locale)}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onOpenOpportunity(item.opportunity.id)}
                    >
                      {item.opportunity.title}
                    </button>
                    <span>{item.opportunity.buyerName}</span>
                  </td>
                  <td>{item.savedState.owner ?? t(locale, "notStated")}</td>
                  <td>{item.savedState.nextAction ?? t(locale, "noAction")}</td>
                  <td>{formatDate(item.savedState.dueDate, locale)}</td>
                  <td>
                    {formatDocumentStatus(item.documentIntelligence.status, locale)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface DocumentReviewPageProps {
  dashboardLoadState: LoadState;
  items: DocumentReviewItem[];
  locale: Locale;
  onOpenOpportunity(opportunityId: string): void;
  onRefresh(): void;
}

function DocumentReviewPage({
  dashboardLoadState,
  items,
  locale,
  onOpenOpportunity,
  onRefresh
}: DocumentReviewPageProps) {
  const readyCount = items.filter(
    (item) => item.documentIntelligence.status === "ready"
  ).length;
  const failedCount = items.filter(
    (item) => item.documentIntelligence.status === "failed"
  ).length;
  const missingCount = items.filter(
    (item) => item.documentIntelligence.status === "not-available"
  ).length;
  const riskCount = items.reduce(
    (total, item) => total + item.documentIntelligence.risks.length,
    0
  );

  return (
    <section className="content" id="documents">
      <WorkspaceHeader
        eyebrow={t(locale, "navDocuments")}
        title={t(locale, "documentReviewTitle")}
        body={t(locale, "documentReviewBody")}
        locale={locale}
        loading={dashboardLoadState === "loading"}
        onRefresh={onRefresh}
      />
      <section className="metrics" aria-label={t(locale, "documentReviewTitle")}>
        <Metric label={t(locale, "readyDocuments")} value={String(readyCount)} />
        <Metric label={t(locale, "failedDocuments")} value={String(failedCount)} />
        <Metric label={t(locale, "missingDocuments")} value={String(missingCount)} />
        <Metric label={t(locale, "documentRisks")} value={String(riskCount)} />
      </section>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{t(locale, "documentStatus")}</th>
              <th scope="col">{t(locale, "opportunity")}</th>
              <th scope="col">{t(locale, "requiredCount")}</th>
              <th scope="col">{t(locale, "certificationCount")}</th>
              <th scope="col">{t(locale, "riskCount")}</th>
              <th scope="col">{t(locale, "risks")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <EmptyTableRow colSpan={6} label={t(locale, "noDocumentItems")} />
            ) : (
              items.map((item) => (
                <tr key={item.opportunity.id}>
                  <td>
                    {formatDocumentStatus(item.documentIntelligence.status, locale)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onOpenOpportunity(item.opportunity.id)}
                    >
                      {item.opportunity.title}
                    </button>
                    <span>{item.opportunity.buyerName}</span>
                  </td>
                  <td>{item.documentIntelligence.requiredDocuments.length}</td>
                  <td>{item.documentIntelligence.certifications.length}</td>
                  <td>{item.documentIntelligence.risks.length}</td>
                  <td>
                    {formatGeneratedText(
                      item.documentIntelligence.risks[0] ?? t(locale, "noSignal"),
                      locale
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface ApplyStudioPageProps {
  applyStudio: ApplyStudioData;
  applyStudioErrorMessage: string | undefined;
  applyStudioLoadState: LoadState;
  complianceSavingId: string | undefined;
  dashboard: ProcurementDashboard;
  dashboardLoadState: LoadState;
  evidenceForm: EvidenceForm;
  evidenceSaving: boolean;
  locale: Locale;
  profiles: BusinessProfile[];
  selectedOpportunityId: string | undefined;
  selectedProfileIds: BusinessProfileId[];
  onOpenOpportunity(opportunityId: string): void;
  onRefresh(): void;
  onSaveEvidence(event: FormEvent<HTMLFormElement>): void;
  onSelectOpportunity(opportunityId: string): void;
  onToggleComplianceEvidence(item: ComplianceItem, evidenceId: string): void;
  onToggleEvidenceProfile(profileId: BusinessProfileId): void;
  onUpdateComplianceStatus(item: ComplianceItem, status: ComplianceStatus): void;
  onUpdateEvidenceField(key: keyof EvidenceForm, value: string): void;
}

function ApplyStudioPage({
  applyStudio,
  applyStudioErrorMessage,
  applyStudioLoadState,
  complianceSavingId,
  dashboard,
  dashboardLoadState,
  evidenceForm,
  evidenceSaving,
  locale,
  profiles,
  selectedOpportunityId,
  selectedProfileIds,
  onOpenOpportunity,
  onRefresh,
  onSaveEvidence,
  onSelectOpportunity,
  onToggleComplianceEvidence,
  onToggleEvidenceProfile,
  onUpdateComplianceStatus,
  onUpdateEvidenceField
}: ApplyStudioPageProps) {
  const activeItems = dashboard.pipeline.filter((item) =>
    isActivePipelineStage(item.savedState.stage)
  );
  const selectedBid =
    activeItems.find((item) => item.opportunity.id === selectedOpportunityId) ??
    activeItems[0];
  const selectedComplianceItems = selectedBid
    ? applyStudio.complianceItems.filter(
        (item) => item.opportunityId === selectedBid.opportunity.id
      )
    : [];
  const readyRequirementCount = selectedComplianceItems.filter((item) =>
    ["ready", "not-applicable"].includes(item.status)
  ).length;
  const openRequirementCount = Math.max(
    selectedComplianceItems.length - readyRequirementCount,
    0
  );
  const blockerCount = selectedComplianceItems.filter(
    (item) => item.status === "blocked"
  ).length;
  const loading = dashboardLoadState === "loading" || applyStudioLoadState === "loading";
  const intelligencePanels = selectedBid
    ? buildBidIntelligencePanels({
        applyStudio,
        complianceItems: selectedComplianceItems,
        dashboard,
        locale,
        profiles,
        selectedBid,
        selectedProfileIds
      })
    : [];

  return (
    <section className="content" id="apply-studio">
      <WorkspaceHeader
        eyebrow={t(locale, "navApplyStudio")}
        title={t(locale, "applyStudioTitle")}
        body={t(locale, "applyStudioBody")}
        locale={locale}
        loading={loading}
        onRefresh={onRefresh}
      />

      {applyStudioErrorMessage ? (
        <div className="state-panel" role="alert">
          <strong>{t(locale, "loadApplyStudioFailed")}</strong>
          <span>{applyStudioErrorMessage}</span>
        </div>
      ) : null}

      <section className="metrics" aria-label={t(locale, "applyStudioTitle")}>
        <Metric label={t(locale, "activeBids")} value={String(activeItems.length)} />
        <Metric
          label={t(locale, "complianceMatrix")}
          value={`${readyRequirementCount}/${selectedComplianceItems.length}`}
        />
        <Metric
          label={t(locale, "evidenceVault")}
          value={String(applyStudio.evidenceItems.length)}
        />
        <Metric label={t(locale, "blocked")} value={String(blockerCount)} />
      </section>

      <section className="dashboard-grid">
        <DashboardPanel title={t(locale, "selectedBid")}>
          {selectedBid ? (
            <div className="selected-bid-summary">
              <strong>{selectedBid.opportunity.title}</strong>
              <span>{selectedBid.opportunity.buyerName}</span>
              <div className="signal-list">
                <span className={getPipelineBadgeClass(selectedBid.savedState.stage)}>
                  {formatStage(selectedBid.savedState.stage, locale)}
                </span>
                <span className="signal-badge signal-neutral">
                  {formatApplyReadiness(selectedBid, locale)}
                </span>
              </div>
            </div>
          ) : (
            <p className="muted">{t(locale, "selectBidForMatrix")}</p>
          )}
        </DashboardPanel>
        <DashboardPanel title={t(locale, "bidPackage")}>
          <p className="muted">
            {readyRequirementCount} {t(locale, "statusReady").toLowerCase()} /{" "}
            {openRequirementCount} {t(locale, "needsReview").toLowerCase()}
          </p>
          <p className="muted">
            {applyStudio.evidenceItems.length}{" "}
            {t(locale, "availableEvidence").toLowerCase()}
          </p>
        </DashboardPanel>
      </section>

      {selectedBid ? (
        <section
          className="intelligence-section"
          aria-label={t(locale, "bidIntelligence")}
        >
          <div className="section-heading">
            <h3>{t(locale, "bidIntelligence")}</h3>
            <span>{t(locale, "recommendedDecision")}</span>
          </div>
          <div className="intelligence-grid">
            {intelligencePanels.map((panel) => (
              <BidIntelligenceCard key={panel.id} panel={panel} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="table-wrap apply-bid-table">
        <table>
          <thead>
            <tr>
              <th scope="col">{t(locale, "readiness")}</th>
              <th scope="col">{t(locale, "opportunity")}</th>
              <th scope="col">{t(locale, "stage")}</th>
              <th scope="col">{t(locale, "requiredCount")}</th>
              <th scope="col">{t(locale, "riskCount")}</th>
              <th scope="col">{t(locale, "nextAction")}</th>
              <th scope="col">{t(locale, "selectBid")}</th>
            </tr>
          </thead>
          <tbody>
            {activeItems.length === 0 ? (
              <EmptyTableRow colSpan={7} label={t(locale, "noPipelineItems")} />
            ) : (
              activeItems.map((item) => (
                <tr
                  key={item.opportunity.id}
                  className={
                    item.opportunity.id === selectedBid?.opportunity.id
                      ? "selected-row"
                      : undefined
                  }
                >
                  <td>{formatApplyReadiness(item, locale)}</td>
                  <td>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onSelectOpportunity(item.opportunity.id)}
                    >
                      {item.opportunity.title}
                    </button>
                    <span>{item.opportunity.buyerName}</span>
                  </td>
                  <td>{formatStage(item.savedState.stage, locale)}</td>
                  <td>{item.documentIntelligence.requiredDocuments.length}</td>
                  <td>{item.documentIntelligence.risks.length}</td>
                  <td>{item.savedState.nextAction ?? t(locale, "noAction")}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="secondary-action mini-action"
                        onClick={() => onSelectOpportunity(item.opportunity.id)}
                      >
                        {t(locale, "selectBid")}
                      </button>
                      <button
                        type="button"
                        className="secondary-action mini-action"
                        onClick={() => onOpenOpportunity(item.opportunity.id)}
                      >
                        {t(locale, "viewDossier")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <section className="dashboard-grid apply-studio-grid">
        <DashboardPanel title={t(locale, "evidenceVault")}>
          <form className="pipeline-form evidence-form" onSubmit={onSaveEvidence}>
            <label>
              <span>{t(locale, "evidenceTitle")}</span>
              <input
                value={evidenceForm.title}
                onChange={(event) => onUpdateEvidenceField("title", event.target.value)}
              />
            </label>
            <label>
              <span>{t(locale, "evidenceType")}</span>
              <select
                value={evidenceForm.type}
                onChange={(event) => onUpdateEvidenceField("type", event.target.value)}
              >
                {EVIDENCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatEvidenceType(type, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t(locale, "issuer")}</span>
              <input
                value={evidenceForm.issuer}
                onChange={(event) => onUpdateEvidenceField("issuer", event.target.value)}
              />
            </label>
            <label>
              <span>{t(locale, "validUntil")}</span>
              <input
                type="date"
                value={evidenceForm.validUntil}
                onChange={(event) =>
                  onUpdateEvidenceField("validUntil", event.target.value)
                }
              />
            </label>
            <label className="wide-field">
              <span>{t(locale, "storageUrl")}</span>
              <input
                value={evidenceForm.storageUrl}
                onChange={(event) =>
                  onUpdateEvidenceField("storageUrl", event.target.value)
                }
              />
            </label>
            <label className="wide-field">
              <span>{t(locale, "evidenceSummary")}</span>
              <textarea
                value={evidenceForm.summary}
                onChange={(event) => onUpdateEvidenceField("summary", event.target.value)}
              />
            </label>
            <div className="wide-field evidence-profile-group">
              <span>{t(locale, "businessProfiles")}</span>
              <div className="evidence-profile-grid">
                {ALL_PROFILE_IDS.map((profileId) => {
                  const profile = profiles.find((entry) => entry.id === profileId);
                  return (
                    <button
                      key={profileId}
                      type="button"
                      className="secondary-action mini-action"
                      aria-pressed={evidenceForm.profileIds.includes(profileId)}
                      onClick={() => onToggleEvidenceProfile(profileId)}
                    >
                      {formatProfileName(profileId, locale, profile?.name)}
                    </button>
                  );
                })}
              </div>
            </div>
            <button type="submit" disabled={evidenceSaving}>
              {evidenceSaving ? t(locale, "saving") : t(locale, "saveEvidence")}
            </button>
          </form>

          <div className="evidence-list">
            {applyStudio.evidenceItems.length === 0 ? (
              <p className="muted">{t(locale, "noEvidenceItems")}</p>
            ) : (
              applyStudio.evidenceItems.map((item) => (
                <div key={item.id} className="evidence-list-item">
                  <strong>{item.title}</strong>
                  <span>
                    {formatEvidenceType(item.type, locale)}
                    {item.issuer ? ` · ${item.issuer}` : ""}
                    {item.validUntil
                      ? ` · ${t(locale, "validUntil")} ${formatDate(
                          item.validUntil,
                          locale
                        )}`
                      : ""}
                  </span>
                  {item.summary ? <p>{item.summary}</p> : null}
                </div>
              ))
            )}
          </div>
        </DashboardPanel>

        <DashboardPanel title={t(locale, "complianceMatrix")}>
          {applyStudioLoadState === "loading" ? (
            <div className="state-panel">
              <strong>{t(locale, "applyStudioLoading")}</strong>
              <span>{t(locale, "applyStudioBody")}</span>
            </div>
          ) : null}
          <div className="table-wrap compliance-table">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t(locale, "complianceStatus")}</th>
                  <th scope="col">{t(locale, "requirement")}</th>
                  <th scope="col">{t(locale, "linkedEvidence")}</th>
                </tr>
              </thead>
              <tbody>
                {!selectedBid ? (
                  <EmptyTableRow colSpan={3} label={t(locale, "selectBidForMatrix")} />
                ) : selectedComplianceItems.length === 0 ? (
                  <EmptyTableRow colSpan={3} label={t(locale, "noComplianceItems")} />
                ) : (
                  selectedComplianceItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className={getComplianceBadgeClass(item.status)}>
                          {formatComplianceStatus(item.status, locale)}
                        </span>
                        <div className="status-actions">
                          {COMPLIANCE_STATUS_OPTIONS.map((status) => (
                            <button
                              key={status}
                              type="button"
                              className="secondary-action mini-action"
                              aria-pressed={item.status === status}
                              disabled={complianceSavingId === item.id}
                              onClick={() => onUpdateComplianceStatus(item, status)}
                            >
                              {formatComplianceStatus(status, locale)}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>
                        <strong>
                          {formatComplianceRequirementType(item.requirementType, locale)}
                        </strong>
                        <span>{formatGeneratedText(item.requirement, locale)}</span>
                        {item.notes ? <span>{item.notes}</span> : null}
                      </td>
                      <td>
                        {applyStudio.evidenceItems.length === 0 ? (
                          <span className="muted">{t(locale, "noEvidenceItems")}</span>
                        ) : (
                          <div className="evidence-link-grid">
                            {applyStudio.evidenceItems.map((evidence) => (
                              <button
                                key={evidence.id}
                                type="button"
                                className="secondary-action mini-action evidence-link-button"
                                aria-pressed={item.evidenceItemIds.includes(evidence.id)}
                                disabled={complianceSavingId === item.id}
                                onClick={() =>
                                  onToggleComplianceEvidence(item, evidence.id)
                                }
                              >
                                {evidence.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DashboardPanel>
      </section>
    </section>
  );
}

interface BuyersPageProps {
  buyers: BuyerDashboardItem[];
  dashboardLoadState: LoadState;
  locale: Locale;
  onRefresh(): void;
}

function BuyersPage({ buyers, dashboardLoadState, locale, onRefresh }: BuyersPageProps) {
  return (
    <section className="content" id="buyers">
      <WorkspaceHeader
        eyebrow={t(locale, "navBuyers")}
        title={t(locale, "buyersTitle")}
        body={t(locale, "buyersBody")}
        locale={locale}
        loading={dashboardLoadState === "loading"}
        onRefresh={onRefresh}
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{t(locale, "buyer")}</th>
              <th scope="col">{t(locale, "open")}</th>
              <th scope="col">{t(locale, "opportunitiesSuffix")}</th>
              <th scope="col">{t(locale, "contracts")}</th>
              <th scope="col">{t(locale, "totalValue")}</th>
              <th scope="col">{t(locale, "supplier")}</th>
              <th scope="col">{t(locale, "cpv")}</th>
            </tr>
          </thead>
          <tbody>
            {buyers.length === 0 ? (
              <EmptyTableRow colSpan={7} label={t(locale, "noBuyers")} />
            ) : (
              buyers.map((buyer) => (
                <tr key={buyer.buyerName}>
                  <td>{buyer.buyerName}</td>
                  <td>{buyer.openOpportunityCount}</td>
                  <td>{buyer.opportunityCount}</td>
                  <td>{buyer.contractCount}</td>
                  <td>{formatMoney(buyer.totalAwardedValue, locale)}</td>
                  <td>
                    {buyer.topSuppliers.slice(0, 3).join(", ") || t(locale, "notStated")}
                  </td>
                  <td>
                    {buyer.topCpvCodes.slice(0, 4).join(", ") || t(locale, "notStated")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface CompetitorsPageProps {
  dashboardLoadState: LoadState;
  locale: Locale;
  suppliers: SupplierDashboardItem[];
  onRefresh(): void;
}

function CompetitorsPage({
  dashboardLoadState,
  locale,
  suppliers,
  onRefresh
}: CompetitorsPageProps) {
  return (
    <section className="content" id="competitors">
      <WorkspaceHeader
        eyebrow={t(locale, "navCompetitors")}
        title={t(locale, "competitorsTitle")}
        body={t(locale, "competitorsBody")}
        locale={locale}
        loading={dashboardLoadState === "loading"}
        onRefresh={onRefresh}
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{t(locale, "supplier")}</th>
              <th scope="col">{t(locale, "wins")}</th>
              <th scope="col">{t(locale, "buyer")}</th>
              <th scope="col">{t(locale, "totalValue")}</th>
              <th scope="col">{t(locale, "averageValue")}</th>
              <th scope="col">{t(locale, "lastRun")}</th>
              <th scope="col">{t(locale, "cpv")}</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 ? (
              <EmptyTableRow colSpan={7} label={t(locale, "noCompetitors")} />
            ) : (
              suppliers.map((supplier) => (
                <tr key={supplier.supplierName}>
                  <td>{supplier.supplierName}</td>
                  <td>{supplier.winsCount}</td>
                  <td>
                    {supplier.topBuyers.slice(0, 3).join(", ") || supplier.buyerCount}
                  </td>
                  <td>{formatMoney(supplier.totalValue, locale)}</td>
                  <td>{formatMoney(supplier.averageValue, locale)}</td>
                  <td>{formatDate(supplier.lastWinDate, locale)}</td>
                  <td>
                    {supplier.topCpvCodes.slice(0, 4).join(", ") ||
                      t(locale, "notStated")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface ContractsPageProps {
  contracts: ContractDashboardItem[];
  dashboardLoadState: LoadState;
  locale: Locale;
  onOpenOpportunity(opportunityId: string): void;
  onRefresh(): void;
}

function ContractsPage({
  contracts,
  dashboardLoadState,
  locale,
  onOpenOpportunity,
  onRefresh
}: ContractsPageProps) {
  return (
    <section className="content" id="contracts">
      <WorkspaceHeader
        eyebrow={t(locale, "navContracts")}
        title={t(locale, "contractsTitle")}
        body={t(locale, "contractsBody")}
        locale={locale}
        loading={dashboardLoadState === "loading"}
        onRefresh={onRefresh}
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{t(locale, "contract")}</th>
              <th scope="col">{t(locale, "buyer")}</th>
              <th scope="col">{t(locale, "supplier")}</th>
              <th scope="col">{t(locale, "value")}</th>
              <th scope="col">{t(locale, "deadline")}</th>
              <th scope="col">{t(locale, "cpv")}</th>
            </tr>
          </thead>
          <tbody>
            {contracts.length === 0 ? (
              <EmptyTableRow colSpan={6} label={t(locale, "noContracts")} />
            ) : (
              contracts.map((contract) => (
                <tr key={contract.id}>
                  <td>
                    {contract.opportunityId ? (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => onOpenOpportunity(contract.opportunityId!)}
                      >
                        {contract.title}
                      </button>
                    ) : (
                      contract.title
                    )}
                    <span>{contract.contractNumber ?? contract.source}</span>
                  </td>
                  <td>{contract.buyerName}</td>
                  <td>{contract.supplierName ?? t(locale, "notStated")}</td>
                  <td>{formatMoney(contract.value, locale)}</td>
                  <td>{formatDate(contract.contractDate, locale)}</td>
                  <td>{contract.cpvCodes.join(", ") || t(locale, "notStated")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface AlertsPageProps {
  alertErrorMessage: string | undefined;
  alertForm: AlertForm;
  alertLoadState: LoadState;
  alertRules: AlertRule[];
  alertSaving: boolean;
  locale: Locale;
  onChangeAlertField(key: keyof AlertForm, value: string | boolean): void;
  onRefresh(): void;
  onSaveAlertRule(): void;
}

function AlertsPage({
  alertErrorMessage,
  alertForm,
  alertLoadState,
  alertRules,
  alertSaving,
  locale,
  onChangeAlertField,
  onRefresh,
  onSaveAlertRule
}: AlertsPageProps) {
  const activeRules = alertRules.filter((rule) => rule.enabled).length;

  return (
    <section className="content" id="alerts">
      <WorkspaceHeader
        eyebrow={t(locale, "navAlerts")}
        title={t(locale, "alertsTitle")}
        body={t(locale, "alertsBody")}
        locale={locale}
        loading={alertLoadState === "loading"}
        onRefresh={onRefresh}
      />
      <section className="metrics" aria-label={t(locale, "alertsTitle")}>
        <Metric label={t(locale, "activeAlerts")} value={String(activeRules)} />
        <Metric label={t(locale, "alertRules")} value={String(alertRules.length)} />
      </section>
      <section className="settings-panel">
        <div className="section-heading">
          <h3>{t(locale, "saveAlert")}</h3>
        </div>
        <AlertRuleForm
          alertErrorMessage={alertErrorMessage}
          alertForm={alertForm}
          alertSaving={alertSaving}
          locale={locale}
          onChangeAlertField={onChangeAlertField}
          onSaveAlertRule={onSaveAlertRule}
        />
      </section>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{t(locale, "name")}</th>
              <th scope="col">{t(locale, "enabled")}</th>
              <th scope="col">{t(locale, "minScore")}</th>
              <th scope="col">{t(locale, "deadlineDays")}</th>
              <th scope="col">{t(locale, "channel")}</th>
              <th scope="col">{t(locale, "target")}</th>
            </tr>
          </thead>
          <tbody>
            {alertRules.length === 0 ? (
              <EmptyTableRow colSpan={6} label={t(locale, "noAlertRules")} />
            ) : (
              alertRules.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.name}</td>
                  <td>{rule.enabled ? t(locale, "enabled") : t(locale, "paused")}</td>
                  <td>{rule.minScore}</td>
                  <td>{rule.deadlineDays ?? t(locale, "notStated")}</td>
                  <td>{formatAlertChannel(rule.channel, locale)}</td>
                  <td>{rule.target ?? t(locale, "notStated")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface SourcesPageProps {
  dashboardLoadState: LoadState;
  locale: Locale;
  sources: SourceHealthItem[];
  onRefresh(): void;
}

function SourcesPage({
  dashboardLoadState,
  locale,
  sources,
  onRefresh
}: SourcesPageProps) {
  return (
    <section className="content" id="sources">
      <WorkspaceHeader
        eyebrow={t(locale, "navSources")}
        title={t(locale, "sourcesTitle")}
        body={t(locale, "sourcesBody")}
        locale={locale}
        loading={dashboardLoadState === "loading"}
        onRefresh={onRefresh}
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{t(locale, "source")}</th>
              <th scope="col">{t(locale, "sourceHealth")}</th>
              <th scope="col">{t(locale, "lastRun")}</th>
              <th scope="col">{t(locale, "fetched")}</th>
              <th scope="col">{t(locale, "inserted")}</th>
              <th scope="col">{t(locale, "updated")}</th>
              <th scope="col">{t(locale, "failed")}</th>
              <th scope="col">{t(locale, "recentErrors")}</th>
            </tr>
          </thead>
          <tbody>
            {sources.length === 0 ? (
              <EmptyTableRow colSpan={8} label={t(locale, "noSources")} />
            ) : (
              sources.map((source) => (
                <tr key={source.source}>
                  <td>
                    <span className="source-pill">{source.source}</span>
                  </td>
                  <td>{formatSourceRunStatus(source.status, locale)}</td>
                  <td>{formatDate(source.finishedAt ?? source.startedAt, locale)}</td>
                  <td>{source.fetchedCount}</td>
                  <td>{source.insertedCount}</td>
                  <td>{source.updatedCount}</td>
                  <td>{source.failedCount}</td>
                  <td>{source.recentErrorCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface EmptyTableRowProps {
  colSpan: number;
  label: string;
}

function EmptyTableRow({ colSpan, label }: EmptyTableRowProps) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <span className="muted">{label}</span>
      </td>
    </tr>
  );
}

interface AlertRuleFormProps {
  alertErrorMessage: string | undefined;
  alertForm: AlertForm;
  alertSaving: boolean;
  locale: Locale;
  onChangeAlertField(key: keyof AlertForm, value: string | boolean): void;
  onSaveAlertRule(): void;
}

function AlertRuleForm({
  alertErrorMessage,
  alertForm,
  alertSaving,
  locale,
  onChangeAlertField,
  onSaveAlertRule
}: AlertRuleFormProps) {
  return (
    <div className="pipeline-form">
      <label className="wide-field">
        <span>{t(locale, "name")}</span>
        <input
          value={alertForm.name}
          onChange={(event) => onChangeAlertField("name", event.target.value)}
        />
      </label>
      <label>
        <span>{t(locale, "minScore")}</span>
        <input
          inputMode="numeric"
          value={alertForm.minScore}
          onChange={(event) => onChangeAlertField("minScore", event.target.value)}
        />
      </label>
      <label>
        <span>{t(locale, "deadlineDays")}</span>
        <input
          inputMode="numeric"
          value={alertForm.deadlineDays}
          onChange={(event) => onChangeAlertField("deadlineDays", event.target.value)}
        />
      </label>
      <label>
        <span>{t(locale, "channel")}</span>
        <select
          value={alertForm.channel}
          onChange={(event) =>
            onChangeAlertField("channel", event.target.value as AlertChannel)
          }
        >
          <option value="email">{t(locale, "emailChannel")}</option>
          <option value="webhook">{t(locale, "webhookChannel")}</option>
          <option value="slack">{t(locale, "slackChannel")}</option>
        </select>
      </label>
      <label>
        <span>{t(locale, "enabled")}</span>
        <select
          value={alertForm.enabled ? "true" : "false"}
          onChange={(event) =>
            onChangeAlertField("enabled", event.target.value === "true")
          }
        >
          <option value="true">{t(locale, "enabled")}</option>
          <option value="false">{t(locale, "paused")}</option>
        </select>
      </label>
      <label className="wide-field">
        <span>{t(locale, "target")}</span>
        <input
          value={alertForm.target}
          onChange={(event) => onChangeAlertField("target", event.target.value)}
        />
      </label>
      {alertErrorMessage ? (
        <div className="form-error" role="alert">
          {alertErrorMessage}
        </div>
      ) : null}
      <button type="button" disabled={alertSaving} onClick={onSaveAlertRule}>
        {alertSaving ? t(locale, "saving") : t(locale, "saveAlert")}
      </button>
    </div>
  );
}

interface ProfileSettingsPageProps {
  locale: Locale;
  errorMessage: string | undefined;
  profiles: BusinessProfile[];
  selectedProfileIds: BusinessProfileId[];
  theme: ThemePreference;
  onChangeLocale(locale: Locale): void;
  onChangeTheme(theme: ThemePreference): void;
  onResetSelectedProfiles(): void;
  onToggleSelectedProfile(profileId: BusinessProfileId): void;
}

function ProfileSettingsPage({
  locale,
  errorMessage,
  profiles,
  selectedProfileIds,
  theme,
  onChangeLocale,
  onChangeTheme,
  onResetSelectedProfiles,
  onToggleSelectedProfile
}: ProfileSettingsPageProps) {
  const profileIds =
    profiles.length > 0 ? profiles.map((profile) => profile.id) : ALL_PROFILE_IDS;

  return (
    <section className="content profile-page" id="profile">
      <header className="toolbar">
        <div>
          <p className="eyebrow">{t(locale, "navProfile")}</p>
          <h2>{t(locale, "profileSettings")}</h2>
          <p className="toolbar-copy">{t(locale, "profileSettingsBody")}</p>
        </div>
      </header>

      {errorMessage ? (
        <div className="form-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <section className="settings-grid" aria-label={t(locale, "appearance")}>
        <div className="settings-panel">
          <div className="section-heading">
            <h3>{t(locale, "appearance")}</h3>
            <span>{t(locale, "language")}</span>
          </div>
          <p className="muted">{t(locale, "languageBody")}</p>
          <LanguageSwitch locale={locale} onChangeLocale={onChangeLocale} />
        </div>

        <div className="settings-panel">
          <div className="section-heading">
            <h3>{t(locale, "appearance")}</h3>
            <span>{t(locale, "darkMode")}</span>
          </div>
          <p className="muted">{t(locale, "themeBody")}</p>
          <div
            className="segmented-control"
            role="group"
            aria-label={t(locale, "darkMode")}
          >
            <button
              type="button"
              aria-pressed={theme === "light"}
              onClick={() => onChangeTheme("light")}
            >
              {t(locale, "lightTheme")}
            </button>
            <button
              type="button"
              aria-pressed={theme === "dark"}
              onClick={() => onChangeTheme("dark")}
            >
              {t(locale, "darkTheme")}
            </button>
          </div>
        </div>
      </section>

      <section
        className="settings-panel sector-settings"
        aria-label={t(locale, "sectorSelection")}
      >
        <div className="section-heading">
          <div>
            <h3>{t(locale, "sectorSelection")}</h3>
            <p className="muted">{t(locale, "sectorSelectionBody")}</p>
          </div>
          <span>
            {selectedProfileIds.length} {t(locale, "selectedCount")}
          </span>
        </div>

        {selectedProfileIds.length === 0 ? (
          <div className="form-error" role="alert">
            {t(locale, "selectAtLeastOneSector")}
          </div>
        ) : null}

        <div className="sector-grid">
          {profileIds.map((profileId) => {
            const profile = profiles.find((entry) => entry.id === profileId);
            const selected = selectedProfileIds.includes(profileId);
            const keywords = profile?.keywords.slice(0, 5) ?? [];
            const cpvPrefixes = profile?.cpvPrefixes ?? [];

            return (
              <label key={profileId} className="sector-card">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleSelectedProfile(profileId)}
                />
                <span
                  className={`signal-badge ${selected ? "signal-positive" : "signal-neutral"}`}
                >
                  {selected ? t(locale, "selected") : t(locale, "notSelected")}
                </span>
                <strong>{formatProfileName(profileId, locale, profile?.name)}</strong>
                <span>
                  {t(locale, "cpvPrefixes")}:{" "}
                  {cpvPrefixes.join(", ") || t(locale, "notStated")}
                </span>
                <span>
                  {t(locale, "keywords")}: {keywords.join(", ") || t(locale, "notStated")}
                </span>
              </label>
            );
          })}
        </div>

        <button
          type="button"
          className="secondary-action"
          onClick={onResetSelectedProfiles}
        >
          {t(locale, "resetDefaults")}
        </button>
      </section>
    </section>
  );
}

interface OpportunityTableProps {
  opportunities: Opportunity[];
  locale: Locale;
  selectedProfileIds: BusinessProfileId[];
  selectedOpportunityId: string | undefined;
  onSelectOpportunity(opportunityId: string): void;
}

function OpportunityTable({
  opportunities,
  locale,
  selectedProfileIds,
  selectedOpportunityId,
  onSelectOpportunity
}: OpportunityTableProps) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">{t(locale, "score")}</th>
            <th scope="col">{t(locale, "opportunity")}</th>
            <th scope="col">{t(locale, "buyer")}</th>
            <th scope="col">{t(locale, "cpv")}</th>
            <th scope="col">{t(locale, "deadline")}</th>
            <th scope="col">{t(locale, "value")}</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((opportunity) => {
            const profileScore = getBestProfileScore(
              opportunity.profileScores,
              selectedProfileIds
            );
            const score = profileScore?.totalScore ?? opportunity.match?.score ?? 0;
            const signals = getOpportunitySignals(
              opportunity,
              profileScore,
              score,
              locale
            );

            return (
              <tr
                key={opportunity.id}
                className={opportunity.id === selectedOpportunityId ? "selected-row" : ""}
              >
                <td>
                  <span className={getScoreClassName(score)}>{score}</span>
                  <span>
                    {formatRecommendation(profileScore?.recommendation, locale)}
                  </span>
                  {profileScore ? (
                    <span>
                      {t(locale, "bestSector")}:{" "}
                      {formatProfileName(
                        profileScore.profileId,
                        locale,
                        profileScore.profileName
                      )}
                    </span>
                  ) : null}
                </td>
                <td>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onSelectOpportunity(opportunity.id)}
                  >
                    {opportunity.title}
                  </button>
                  {signals.length > 0 ? (
                    <div className="signal-list" aria-label={t(locale, "opportunity")}>
                      {signals.map((signal) => (
                        <span
                          key={signal.id}
                          className={`signal-badge signal-${signal.tone}`}
                        >
                          {signal.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <a
                    className="external-link"
                    href={opportunity.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t(locale, "sourceNotice")}
                  </a>
                </td>
                <td>
                  <span className="source-pill">{opportunity.source}</span>
                  {opportunity.buyerName}
                </td>
                <td>{opportunity.cpvCodes.join(", ") || t(locale, "notStated")}</td>
                <td>{formatDate(opportunity.submissionDeadline, locale)}</td>
                <td>{formatMoney(opportunity.estimatedValue, locale)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface OpportunityPreviewProps {
  detail: OpportunityDetail | undefined;
  detailLoadState: LoadState;
  detailErrorMessage: string | undefined;
  pipelineErrorMessage: string | undefined;
  pipelineForm: PipelineForm;
  pipelineSaving: boolean;
  alertForm: AlertForm;
  alertRules: AlertRule[];
  alertLoadState: LoadState;
  alertErrorMessage: string | undefined;
  alertSaving: boolean;
  locale: Locale;
  profileScore: ProfileFitScore | undefined;
  selectedProfileIds: BusinessProfileId[];
  onChangePipelineField(key: keyof PipelineForm, value: string): void;
  onSavePipeline(): void;
  onChangeAlertField(key: keyof AlertForm, value: string | boolean): void;
  onSaveAlertRule(): void;
}

function OpportunityPreview({
  detail,
  detailLoadState,
  detailErrorMessage,
  pipelineErrorMessage,
  pipelineForm,
  pipelineSaving,
  alertForm,
  alertRules,
  alertLoadState,
  alertErrorMessage,
  alertSaving,
  locale,
  profileScore,
  selectedProfileIds,
  onChangePipelineField,
  onSavePipeline,
  onChangeAlertField,
  onSaveAlertRule
}: OpportunityPreviewProps) {
  if (detailLoadState === "loading") {
    return (
      <aside className="preview-panel">
        <div className="state-panel">
          <strong>{t(locale, "loadingPreview")}</strong>
          <span>{t(locale, "loadingPreviewBody")}</span>
        </div>
      </aside>
    );
  }

  if (detailLoadState === "error") {
    return (
      <aside className="preview-panel">
        <div className="state-panel" role="alert">
          <strong>{t(locale, "couldNotLoadPreview")}</strong>
          <span>{detailErrorMessage}</span>
        </div>
      </aside>
    );
  }

  if (!detail) {
    return (
      <aside className="preview-panel">
        <div className="state-panel">
          <strong>{t(locale, "selectOpportunity")}</strong>
          <span>{t(locale, "selectOpportunityBody")}</span>
        </div>
      </aside>
    );
  }

  const sortedProfileScores = sortProfileScoresBySelection(
    detail.opportunity.profileScores,
    selectedProfileIds
  );
  const bestScore = getBestProfileScore(
    detail.opportunity.profileScores,
    ALL_PROFILE_IDS
  );
  const visibleScore = profileScore ?? bestScore;
  const intelligence = detail.documentIntelligence;

  return (
    <aside className="preview-panel" id="pipeline">
      <header className="preview-header">
        <div>
          <p className="eyebrow">{t(locale, "tenderPreview")}</p>
          <h3>{detail.opportunity.title}</h3>
          <span>{detail.opportunity.buyerName}</span>
        </div>
        <span className={getScoreClassName(visibleScore?.totalScore ?? 0)}>
          {visibleScore?.totalScore ?? detail.opportunity.match?.score ?? 0}
        </span>
      </header>

      <div className="preview-actions">
        <a href={detail.opportunity.sourceUrl} target="_blank" rel="noreferrer">
          {t(locale, "officialNotice")}
        </a>
        <span>{formatMoney(detail.opportunity.estimatedValue, locale)}</span>
        <span>{formatDate(detail.opportunity.submissionDeadline, locale)}</span>
      </div>

      <section className="preview-section">
        <div className="section-heading">
          <h4>{t(locale, "scoreBreakdown")}</h4>
          <span>
            {visibleScore
              ? `${formatProfileName(visibleScore.profileId, locale, visibleScore.profileName)} - ${formatRecommendation(visibleScore.recommendation, locale)}`
              : formatRecommendation(undefined, locale)}
          </span>
        </div>
        {visibleScore ? (
          <div className="score-breakdown">
            {visibleScore.components.map((component) => (
              <div key={component.id} className="score-component">
                <div>
                  <strong>
                    {formatScoreComponent(component.id, component.label, locale)}
                  </strong>
                  <span>
                    {formatGeneratedText(
                      component.reasons[0] ?? t(locale, "noSignal"),
                      locale
                    )}
                  </span>
                </div>
                <meter min={0} max={100} value={component.score} />
                <b>{component.score}</b>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">
            {t(locale, "noProfileScore")}{" "}
            {formatSelectedSectorSummary(selectedProfileIds, locale)}.
          </p>
        )}
      </section>

      <section className="preview-section">
        <div className="section-heading">
          <h4>{t(locale, "businessProfiles")}</h4>
          <span>{detail.opportunity.profileScores?.length ?? 0}</span>
        </div>
        <div className="profile-grid">
          {sortedProfileScores.slice(0, 6).map((score) => (
            <div key={score.profileId} className="profile-tile">
              <strong>
                {formatProfileName(score.profileId, locale, score.profileName)}
              </strong>
              <span>{formatRecommendation(score.recommendation, locale)}</span>
              <b>{score.totalScore}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="preview-section">
        <div className="section-heading">
          <h4>{t(locale, "applicationPipeline")}</h4>
          <span>
            {detail.savedState?.stage
              ? formatStage(detail.savedState.stage, locale)
              : t(locale, "notSaved")}
          </span>
        </div>
        <div className="pipeline-form">
          <label>
            <span>{t(locale, "stage")}</span>
            <select
              value={pipelineForm.stage}
              onChange={(event) =>
                onChangePipelineField("stage", event.target.value as ApplicationStage)
              }
            >
              {APPLICATION_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {formatStage(stage, locale)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t(locale, "owner")}</span>
            <input
              value={pipelineForm.owner}
              onChange={(event) => onChangePipelineField("owner", event.target.value)}
            />
          </label>
          <label>
            <span>{t(locale, "dueDate")}</span>
            <input
              type="date"
              value={pipelineForm.dueDate}
              onChange={(event) => onChangePipelineField("dueDate", event.target.value)}
            />
          </label>
          <label>
            <span>{t(locale, "nextAction")}</span>
            <input
              value={pipelineForm.nextAction}
              onChange={(event) =>
                onChangePipelineField("nextAction", event.target.value)
              }
            />
          </label>
          <label className="wide-field">
            <span>{t(locale, "decisionReason")}</span>
            <input
              value={pipelineForm.decisionReason}
              onChange={(event) =>
                onChangePipelineField("decisionReason", event.target.value)
              }
            />
          </label>
          <label className="wide-field">
            <span>{t(locale, "notes")}</span>
            <textarea
              value={pipelineForm.notes}
              onChange={(event) => onChangePipelineField("notes", event.target.value)}
            />
          </label>
          {pipelineErrorMessage ? (
            <div className="form-error" role="alert">
              {pipelineErrorMessage}
            </div>
          ) : null}
          <button type="button" disabled={pipelineSaving} onClick={onSavePipeline}>
            {pipelineSaving ? t(locale, "saving") : t(locale, "saveStage")}
          </button>
        </div>
      </section>

      <section className="preview-section">
        <div className="section-heading">
          <h4>{t(locale, "documentIntelligence")}</h4>
          <span>{formatDocumentStatus(intelligence?.status, locale)}</span>
        </div>
        {intelligence?.summary ? (
          <p className="summary-text">
            {formatGeneratedSummary(intelligence.summary, locale)}
          </p>
        ) : null}
        <Checklist
          title={t(locale, "eligibility")}
          items={intelligence?.eligibilityCriteria ?? []}
          locale={locale}
        />
        <Checklist
          title={t(locale, "requiredDocs")}
          items={intelligence?.requiredDocuments ?? []}
          locale={locale}
        />
        <Checklist
          title={t(locale, "certifications")}
          items={intelligence?.certifications ?? []}
          locale={locale}
        />
        <Checklist
          title={t(locale, "risks")}
          items={intelligence?.risks ?? []}
          locale={locale}
        />
      </section>

      <section className="preview-section" id="contracts">
        <div className="section-heading">
          <h4>{t(locale, "lotsAndContracts")}</h4>
          <span>{detail.lots.length + detail.contracts.length}</span>
        </div>
        <CompactList
          emptyLabel={t(locale, "noLots")}
          items={detail.lots.map((lot) => ({
            id: lot.id,
            title: lot.title ?? lot.lotIdentifier ?? "Lot",
            meta: `${lot.cpvCodes.join(", ") || t(locale, "noCpv")} - ${formatMoney(lot.estimatedValue, locale)}`
          }))}
        />
        <CompactList
          emptyLabel={t(locale, "noLinkedContracts")}
          items={detail.contracts.map((contract) => ({
            id: contract.id,
            title: contract.supplierName ?? contract.title,
            meta: `${formatDate(contract.contractDate, locale)} - ${formatMoney(contract.value, locale)}`
          }))}
        />
      </section>

      <section className="preview-section">
        <div className="section-heading">
          <h4>{t(locale, "competitors")}</h4>
          <span>{detail.competitorInsights.length}</span>
        </div>
        <CompactList
          emptyLabel={t(locale, "noSupplierHistory")}
          items={detail.competitorInsights.map((competitor) => ({
            id: competitor.supplierName,
            title: competitor.supplierName,
            meta: `${competitor.winsCount} ${t(locale, "wins")} - ${formatMoney(competitor.totalValue, locale)}`
          }))}
        />
      </section>

      <section className="preview-section" id="alerts">
        <div className="section-heading">
          <h4>{t(locale, "alertRules")}</h4>
          <span>
            {alertLoadState === "loading" ? t(locale, "loading") : alertRules.length}
          </span>
        </div>
        <AlertRuleForm
          alertErrorMessage={alertErrorMessage}
          alertForm={alertForm}
          alertSaving={alertSaving}
          locale={locale}
          onChangeAlertField={onChangeAlertField}
          onSaveAlertRule={onSaveAlertRule}
        />
        <CompactList
          emptyLabel={t(locale, "noAlertRules")}
          items={alertRules.slice(0, 6).map((rule) => ({
            id: rule.id,
            title: rule.name,
            meta: `${rule.enabled ? t(locale, "enabled") : t(locale, "paused")} - ${t(locale, "score")} ${rule.minScore}+ - ${formatAlertChannel(rule.channel, locale)}`
          }))}
        />
      </section>
    </aside>
  );
}

interface ChecklistProps {
  title: string;
  items: string[];
  locale: Locale;
}

function Checklist({ title, items, locale }: ChecklistProps) {
  return (
    <div className="checklist">
      <strong>{title}</strong>
      {items.length === 0 ? (
        <span className="muted">{t(locale, "noItemsDetected")}</span>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item}>{formatGeneratedText(item, locale)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface CompactListItem {
  id: string;
  title: string;
  meta: string;
}

interface CompactListProps {
  emptyLabel: string;
  items: CompactListItem[];
}

function CompactList({ emptyLabel, items }: CompactListProps) {
  if (items.length === 0) {
    return <p className="muted">{emptyLabel}</p>;
  }

  return (
    <div className="compact-list">
      {items.map((item) => (
        <div key={item.id}>
          <strong>{item.title}</strong>
          <span>{item.meta}</span>
        </div>
      ))}
    </div>
  );
}

function getOpportunityFilterProfileIds(
  sector: SectorFilter,
  profiles: BusinessProfile[],
  selectedProfileIds: BusinessProfileId[]
): BusinessProfileId[] {
  if (!sector) {
    return normalizeSelectedProfileIds(selectedProfileIds);
  }

  const profileIds = profiles
    .filter((profile) => profile.kind === sector)
    .map((profile) => profile.id);

  return profileIds.length > 0 ? profileIds : FALLBACK_PROFILE_IDS_BY_SECTOR[sector];
}

function buildBidIntelligencePanels({
  applyStudio,
  complianceItems,
  dashboard,
  locale,
  profiles,
  selectedBid,
  selectedProfileIds
}: BidIntelligenceInput): BidIntelligencePanel[] {
  const opportunity = selectedBid.opportunity;
  const documentIntelligence = selectedBid.documentIntelligence;
  const savedState = selectedBid.savedState;
  const profileScore = getBestProfileScore(opportunity.profileScores, selectedProfileIds);
  const score = getOpportunityScore(opportunity, selectedProfileIds);
  const recommendation = getStrategicRecommendation(
    profileScore?.recommendation,
    score,
    complianceItems,
    opportunity.submissionDeadline
  );
  const deadlineDays = getDaysUntil(opportunity.submissionDeadline);
  const readinessPercent = getComplianceReadinessPercent(complianceItems);
  const readyCount = complianceItems.filter((item) =>
    ["ready", "not-applicable"].includes(item.status)
  ).length;
  const blockedCount = complianceItems.filter((item) => item.status === "blocked").length;
  const missingCount = complianceItems.filter((item) => item.status === "missing").length;
  const relevantEvidence = getRelevantEvidence(
    applyStudio.evidenceItems,
    selectedProfileIds
  );
  const evidenceExpiry = getEvidenceExpiryCounts(relevantEvidence);
  const buyer = dashboard.buyers.find((item) => item.buyerName === opportunity.buyerName);
  const competitors = getCompetitorNamesForBuyer(dashboard, opportunity.buyerName);
  const source = dashboard.sources.find((item) => item.source === opportunity.source);
  const noBidItems = dashboard.pipeline.filter(
    (item) =>
      ["lost", "archived"].includes(item.savedState.stage) &&
      Boolean(item.savedState.decisionReason)
  );
  const wonCount = dashboard.pipeline.filter(
    (item) => item.savedState.stage === "won"
  ).length;
  const lostCount = dashboard.pipeline.filter(
    (item) => item.savedState.stage === "lost"
  ).length;
  const effortScore = getEffortProfitabilityScore(
    selectedBid,
    complianceItems,
    readinessPercent
  );
  const certificationNeeds = [
    ...documentIntelligence.certifications,
    ...complianceItems
      .filter((item) => item.requirementType === "certification")
      .map((item) => item.requirement)
  ];
  const partnerNeeds = complianceItems.filter(
    (item) => item.status === "blocked" || item.requirementType === "risk"
  );

  return [
    {
      id: "tender-brief",
      title: t(locale, "tenderBrief"),
      value: formatStrategicRecommendation(recommendation, locale),
      tone: getRecommendationTone(recommendation),
      body: localText(
        locale,
        `${opportunity.buyerName} is buying ${opportunity.title}. Fit score is ${score}/100 and package readiness is ${readinessPercent}%.`,
        `${opportunity.buyerName} купува ${opportunity.title}. Съвпадението е ${score}/100, а готовността на пакета е ${readinessPercent}%.`
      ),
      actions: [
        localText(
          locale,
          `Confirm scope against ${opportunity.cpvCodes.slice(0, 3).join(", ") || t(locale, "noCpv")}.`,
          `Потвърди обхвата срещу ${opportunity.cpvCodes.slice(0, 3).join(", ") || t(locale, "noCpv")}.`
        ),
        localText(
          locale,
          `Use recommendation: ${formatStrategicRecommendation(recommendation, locale)}.`,
          `Използвай препоръката: ${formatStrategicRecommendation(recommendation, locale)}.`
        )
      ]
    },
    {
      id: "capability-profile",
      title: t(locale, "companyCapabilityProfile"),
      value: `${relevantEvidence.length} ${t(locale, "availableEvidence").toLowerCase()}`,
      tone: relevantEvidence.length >= 3 ? "positive" : "warning",
      body: localText(
        locale,
        `Selected sectors: ${formatSelectedSectorSummary(selectedProfileIds, locale)}. Required certifications detected: ${dedupeStrings(certificationNeeds).length}.`,
        `Избрани сектори: ${formatSelectedSectorSummary(selectedProfileIds, locale)}. Открити изисквания за сертификати: ${dedupeStrings(certificationNeeds).length}.`
      ),
      actions: [
        localText(
          locale,
          "Attach reusable references, team CVs, vendor authorizations, and certificates to the evidence vault.",
          "Добави референции, CV-та на екип, оторизации и сертификати в хранилището."
        ),
        localText(
          locale,
          "Map each evidence item to the software, hardware, or services sector it supports.",
          "Свържи всяко доказателство със сектора, който покрива."
        )
      ]
    },
    {
      id: "evidence-expiry",
      title: t(locale, "evidenceExpiryAlerts"),
      value: `${evidenceExpiry.expired} ${t(locale, "evidenceExpired")} / ${evidenceExpiry.expiring} ${t(locale, "evidenceExpiring")}`,
      tone:
        evidenceExpiry.expired > 0
          ? "risk"
          : evidenceExpiry.expiring > 0
            ? "warning"
            : "positive",
      body: localText(
        locale,
        `${relevantEvidence.length} relevant evidence records are available for this bid.`,
        `Има ${relevantEvidence.length} релевантни доказателства за това участие.`
      ),
      actions:
        evidenceExpiry.expired + evidenceExpiry.expiring > 0
          ? [
              localText(
                locale,
                "Refresh expiring certificates before marking compliance ready.",
                "Обнови изтичащите сертификати преди маркиране като готово."
              ),
              localText(
                locale,
                "Replace expired evidence links in the compliance matrix.",
                "Смени изтеклите доказателства в матрицата за съответствие."
              )
            ]
          : [
              localText(
                locale,
                "Keep expiry dates populated so alerts stay accurate.",
                "Поддържай датите на валидност попълнени, за да са точни известията."
              )
            ]
    },
    {
      id: "effort-profitability",
      title: t(locale, "effortProfitabilityScore"),
      value: `${effortScore}/100`,
      tone: effortScore >= 72 ? "positive" : effortScore >= 48 ? "warning" : "risk",
      body: localText(
        locale,
        `Estimated value is ${formatMoney(opportunity.estimatedValue, locale)}. Effort is driven by ${documentIntelligence.requiredDocuments.length} documents, ${documentIntelligence.risks.length} risks, and deadline pressure.`,
        `Прогнозната стойност е ${formatMoney(opportunity.estimatedValue, locale)}. Усилието зависи от ${documentIntelligence.requiredDocuments.length} документа, ${documentIntelligence.risks.length} риска и натиска от срока.`
      ),
      actions: [
        localText(
          locale,
          "Estimate delivery margin before moving to preparing.",
          "Оцени маржа на изпълнение преди преминаване към подготовка."
        ),
        localText(
          locale,
          "Flag hardware availability or partner dependency in decision notes.",
          "Отбележи наличност на хардуер или партньорска зависимост в бележките."
        )
      ]
    },
    {
      id: "clarification-questions",
      title: t(locale, "clarificationQuestions"),
      value: String(buildClarificationQuestions(documentIntelligence, locale).length),
      tone: documentIntelligence.risks.length > 0 ? "warning" : "neutral",
      body: localText(
        locale,
        "Use these questions before the official clarification deadline.",
        "Използвай тези въпроси преди официалния срок за разяснения."
      ),
      actions: buildClarificationQuestions(documentIntelligence, locale)
    },
    {
      id: "no-bid-knowledge",
      title: t(locale, "noBidKnowledgeBase"),
      value: String(noBidItems.length),
      tone: noBidItems.length > 0 ? "neutral" : "warning",
      body: localText(
        locale,
        "Skipped and lost bids should capture a decision reason so future scoring learns from them.",
        "Пропуснатите и загубени участия трябва да имат причина, за да се учи бъдещото оценяване."
      ),
      actions:
        noBidItems.length > 0
          ? noBidItems
              .slice(0, 2)
              .map((item) =>
                localText(
                  locale,
                  `${item.opportunity.title}: ${item.savedState.decisionReason}`,
                  `${item.opportunity.title}: ${item.savedState.decisionReason}`
                )
              )
          : [
              localText(
                locale,
                "When skipping, save a decision reason in the tender dossier.",
                "При пропускане запази причина в досието на поръчката."
              )
            ]
    },
    {
      id: "buyer-risk",
      title: t(locale, "buyerRiskProfile"),
      value: buyer
        ? `${buyer.contractCount} ${t(locale, "contracts").toLowerCase()}`
        : t(locale, "notAvailable"),
      tone: buyer && buyer.contractCount > 0 ? "positive" : "neutral",
      body: buyer
        ? localText(
            locale,
            `${buyer.buyerName} has ${buyer.opportunityCount} tracked opportunities and ${buyer.contractCount} contracts. Average award: ${formatMoney(buyer.averageAwardedValue, locale)}.`,
            `${buyer.buyerName} има ${buyer.opportunityCount} проследени възможности и ${buyer.contractCount} договора. Средна стойност: ${formatMoney(buyer.averageAwardedValue, locale)}.`
          )
        : localText(
            locale,
            "Buyer history is limited; inspect official documents and contract context.",
            "Историята на възложителя е ограничена; провери официалните документи и договорния контекст."
          ),
      actions: [
        localText(
          locale,
          `Review top suppliers: ${buyer?.topSuppliers.slice(0, 3).join(", ") || t(locale, "notStated")}.`,
          `Прегледай водещите доставчици: ${buyer?.topSuppliers.slice(0, 3).join(", ") || t(locale, "notStated")}.`
        ),
        localText(
          locale,
          "Check cancellation, amendment, and incumbent signals before pricing.",
          "Провери сигнали за прекратяване, анекси и утвърден доставчик преди ценообразуване."
        )
      ]
    },
    {
      id: "competitor-watch",
      title: t(locale, "competitorWatch"),
      value: String(competitors.length),
      tone: competitors.length > 2 ? "warning" : "neutral",
      body: localText(
        locale,
        `Known competitors for this buyer: ${competitors.slice(0, 4).join(", ") || t(locale, "notStated")}.`,
        `Познати конкуренти при този възложител: ${competitors.slice(0, 4).join(", ") || t(locale, "notStated")}.`
      ),
      actions: [
        localText(
          locale,
          "Compare their CPV focus and average contract values before committing.",
          "Сравни CPV фокуса и средните им договорни стойности преди решение."
        ),
        localText(
          locale,
          "If one supplier dominates this buyer, require stronger differentiators.",
          "Ако един доставчик доминира при възложителя, изискай по-силни диференциатори."
        )
      ]
    },
    {
      id: "application-pack",
      title: t(locale, "applicationPackBuilder"),
      value: `${documentIntelligence.requiredDocuments.length + documentIntelligence.certifications.length}`,
      tone: missingCount === 0 && blockedCount === 0 ? "positive" : "warning",
      body: localText(
        locale,
        `${documentIntelligence.requiredDocuments.length} documents and ${documentIntelligence.certifications.length} certifications should be represented in the bid package.`,
        `${documentIntelligence.requiredDocuments.length} документа и ${documentIntelligence.certifications.length} сертификата трябва да са покрити в пакета.`
      ),
      actions: buildPackageActions(documentIntelligence, locale)
    },
    {
      id: "deadline-command",
      title: t(locale, "deadlineCommandCenter"),
      value: formatDeadlineWindow(deadlineDays, locale),
      tone:
        deadlineDays === undefined
          ? "neutral"
          : deadlineDays < 0 || deadlineDays <= 5
            ? "risk"
            : deadlineDays <= 14
              ? "warning"
              : "positive",
      body: localText(
        locale,
        `Submission deadline: ${formatDate(opportunity.submissionDeadline, locale)}. Next action: ${savedState.nextAction ?? t(locale, "noAction")}.`,
        `Краен срок за подаване: ${formatDate(opportunity.submissionDeadline, locale)}. Следващо действие: ${savedState.nextAction ?? t(locale, "noAction")}.`
      ),
      actions: [
        localText(
          locale,
          "Set clarification, internal review, pricing, and final submission checkpoints.",
          "Задай срокове за разяснения, вътрешен преглед, цена и финално подаване."
        ),
        localText(
          locale,
          `Owner: ${savedState.owner ?? t(locale, "notStated")}.`,
          `Отговорник: ${savedState.owner ?? t(locale, "notStated")}.`
        )
      ]
    },
    {
      id: "partner-matching",
      title: t(locale, "partnerMatching"),
      value: String(partnerNeeds.length),
      tone: partnerNeeds.length > 0 ? "warning" : "positive",
      body: localText(
        locale,
        partnerNeeds.length > 0
          ? "This tender has requirements or risks that may need external coverage."
          : "No partner blocker is visible from the extracted requirements.",
        partnerNeeds.length > 0
          ? "Поръчката има изисквания или рискове, които може да изискват външно покритие."
          : "Не се вижда партньорски блокер от извлечените изисквания."
      ),
      actions:
        partnerNeeds.length > 0
          ? partnerNeeds
              .slice(0, 3)
              .map((item) =>
                localText(
                  locale,
                  `Find coverage for: ${formatGeneratedText(item.requirement, locale)}.`,
                  `Намери покритие за: ${formatGeneratedText(item.requirement, locale)}.`
                )
              )
          : [
              localText(
                locale,
                "Keep partner decision open until official documents are checked.",
                "Дръж партньорското решение отворено до проверка на официалните документи."
              )
            ]
    },
    {
      id: "change-detection",
      title: t(locale, "tenderChangeDetection"),
      value: source ? String(source.updatedCount) : t(locale, "notAvailable"),
      tone:
        source && (source.failedCount > 0 || source.recentErrorCount > 0)
          ? "warning"
          : "neutral",
      body: localText(
        locale,
        source
          ? `${source.source.toUpperCase()} recently inserted ${source.insertedCount} and updated ${source.updatedCount} records.`
          : "Source freshness is not available for this notice.",
        source
          ? `${source.source.toUpperCase()} наскоро е добавил ${source.insertedCount} и обновил ${source.updatedCount} записа.`
          : "Свежестта на източника не е налична за това обявление."
      ),
      actions: [
        localText(
          locale,
          "Open the official notice before submission to catch corrigenda and deadline changes.",
          "Отвори официалното обявление преди подаване за промени и нови срокове."
        ),
        localText(
          locale,
          "Refresh the source after buyer clarifications are expected.",
          "Обнови източника след очаквани разяснения от възложителя."
        )
      ]
    },
    {
      id: "source-trust",
      title: t(locale, "sourceTrust"),
      value: source
        ? formatSourceRunStatus(source.status, locale)
        : t(locale, "notAvailable"),
      tone:
        source?.status === "succeeded"
          ? "positive"
          : source?.status === "failed"
            ? "risk"
            : "warning",
      body: source
        ? localText(
            locale,
            `Fetched ${source.fetchedCount}, failed ${source.failedCount}, recent errors ${source.recentErrorCount}.`,
            `Изтеглени ${source.fetchedCount}, неуспешни ${source.failedCount}, последни грешки ${source.recentErrorCount}.`
          )
        : localText(
            locale,
            "No source health row is available for this source yet.",
            "Все още няма ред за състояние на този източник."
          ),
      actions: [
        localText(
          locale,
          "Do not rely on extracted fields alone for final submission.",
          "Не разчитай само на извлечените полета при финално подаване."
        )
      ]
    },
    {
      id: "decision-history",
      title: t(locale, "decisionHistory"),
      value: formatStage(savedState.stage, locale),
      tone: savedState.decisionReason ? "positive" : "neutral",
      body: localText(
        locale,
        `Owner ${savedState.owner ?? t(locale, "notStated")} has stage ${formatStage(savedState.stage, locale)} and due date ${formatDate(savedState.dueDate, locale)}.`,
        `Отговорник ${savedState.owner ?? t(locale, "notStated")} е на етап ${formatStage(savedState.stage, locale)} със срок ${formatDate(savedState.dueDate, locale)}.`
      ),
      actions: [
        localText(
          locale,
          `Decision reason: ${savedState.decisionReason ?? t(locale, "notStated")}.`,
          `Причина за решението: ${savedState.decisionReason ?? t(locale, "notStated")}.`
        ),
        localText(
          locale,
          "Keep stage, owner, next action, and evidence links current.",
          "Поддържай етап, отговорник, следващо действие и доказателства актуални."
        )
      ]
    },
    {
      id: "win-loss-learning",
      title: t(locale, "winLossLearning"),
      value: `${wonCount}/${lostCount}`,
      tone: wonCount > lostCount ? "positive" : lostCount > 0 ? "warning" : "neutral",
      body: localText(
        locale,
        `Current pipeline outcomes: ${wonCount} won and ${lostCount} lost. Use outcomes to tune sector and buyer scoring.`,
        `Текущи резултати в процеса: ${wonCount} спечелени и ${lostCount} загубени. Използвай ги за настройка на оценяването по сектор и възложител.`
      ),
      actions: [
        localText(
          locale,
          "After each award, update the final stage and decision reason.",
          "След всяко възлагане обнови финалния етап и причината."
        ),
        localText(
          locale,
          "Use repeated losses to tighten no-bid rules.",
          "Използвай повторяемите загуби за по-строги правила за отказ."
        )
      ]
    }
  ];
}

function localText(locale: Locale, english: string, bulgarian: string): string {
  return locale === "bg" ? bulgarian : english;
}

function getStrategicRecommendation(
  profileRecommendation: BidRecommendation | undefined,
  score: number,
  complianceItems: ComplianceItem[],
  deadline: string | undefined
): BidRecommendation {
  const daysUntilDeadline = getDaysUntil(deadline);
  if (daysUntilDeadline !== undefined && daysUntilDeadline < 0) {
    return "skip";
  }

  if (profileRecommendation === "skip") {
    return "skip";
  }

  if (
    profileRecommendation === "need-partner" ||
    complianceItems.some((item) => item.status === "blocked")
  ) {
    return "need-partner";
  }

  if (score >= 78 && getComplianceReadinessPercent(complianceItems) >= 60) {
    return "apply";
  }

  return score >= 55 ? "review" : "skip";
}

function formatStrategicRecommendation(
  recommendation: BidRecommendation,
  locale: Locale
): string {
  switch (recommendation) {
    case "apply":
      return t(locale, "applyDecision");
    case "review":
      return t(locale, "reviewDecision");
    case "need-partner":
      return t(locale, "partnerDecision");
    case "skip":
      return t(locale, "skipDecision");
    case "unknown":
      return t(locale, "unknown");
  }
}

function getRecommendationTone(
  recommendation: BidRecommendation
): OpportunitySignal["tone"] {
  switch (recommendation) {
    case "apply":
      return "positive";
    case "review":
      return "warning";
    case "need-partner":
      return "warning";
    case "skip":
      return "risk";
    case "unknown":
      return "neutral";
  }
}

function getComplianceReadinessPercent(items: ComplianceItem[]): number {
  if (items.length === 0) {
    return 0;
  }

  const readyCount = items.filter((item) =>
    ["ready", "not-applicable"].includes(item.status)
  ).length;

  return Math.round((readyCount / items.length) * 100);
}

function getRelevantEvidence(
  evidenceItems: EvidenceItem[],
  selectedProfileIds: BusinessProfileId[]
): EvidenceItem[] {
  const selected = new Set(selectedProfileIds);

  return evidenceItems.filter(
    (item) =>
      item.profileIds.length === 0 ||
      item.profileIds.some((profileId) => selected.has(profileId))
  );
}

function getEvidenceExpiryCounts(evidenceItems: EvidenceItem[]): {
  expired: number;
  expiring: number;
} {
  return evidenceItems.reduce(
    (counts, item) => {
      const days = getDaysUntil(item.validUntil);
      if (days === undefined) {
        return counts;
      }

      if (days < 0) {
        return {
          ...counts,
          expired: counts.expired + 1
        };
      }

      if (days <= 30) {
        return {
          ...counts,
          expiring: counts.expiring + 1
        };
      }

      return counts;
    },
    { expired: 0, expiring: 0 }
  );
}

function getEffortProfitabilityScore(
  item: PipelineDashboardItem,
  complianceItems: ComplianceItem[],
  readinessPercent: number
): number {
  const deadlineDays = getDaysUntil(item.opportunity.submissionDeadline);
  const deadlinePenalty =
    deadlineDays === undefined ? 10 : deadlineDays < 0 ? 45 : deadlineDays <= 7 ? 24 : 0;
  const documentPenalty = item.documentIntelligence.requiredDocuments.length * 5;
  const riskPenalty =
    item.documentIntelligence.risks.length * 10 +
    complianceItems.filter((entry) => entry.status === "blocked").length * 14;
  const valueBoost =
    item.opportunity.estimatedValue && item.opportunity.estimatedValue.amount >= 250000
      ? 12
      : 0;

  return Math.max(
    0,
    Math.min(
      100,
      62 +
        Math.round(readinessPercent * 0.25) +
        valueBoost -
        deadlinePenalty -
        documentPenalty -
        riskPenalty
    )
  );
}

function buildClarificationQuestions(
  documentIntelligence: DocumentIntelligence,
  locale: Locale
): string[] {
  const questions = [
    ...documentIntelligence.risks
      .slice(0, 2)
      .map((risk) =>
        localText(
          locale,
          `Please clarify how bidders should address: ${formatGeneratedText(risk, locale)}?`,
          `Моля, пояснете как участниците трябва да адресират: ${formatGeneratedText(risk, locale)}?`
        )
      ),
    ...documentIntelligence.requiredDocuments
      .slice(0, 2)
      .map((document) =>
        localText(
          locale,
          `Can ${formatGeneratedText(document, locale)} be submitted as a signed electronic document?`,
          `Може ли ${formatGeneratedText(document, locale)} да се подаде като подписан електронен документ?`
        )
      )
  ];

  return questions.length > 0
    ? questions
    : [
        localText(
          locale,
          "Ask whether equivalent certificates, references, or partner capacity are accepted.",
          "Попитай дали се приемат еквивалентни сертификати, референции или партньорски капацитет."
        )
      ];
}

function buildPackageActions(
  documentIntelligence: DocumentIntelligence,
  locale: Locale
): string[] {
  const actions = [
    ...documentIntelligence.requiredDocuments
      .slice(0, 3)
      .map((document) =>
        localText(
          locale,
          `Prepare: ${formatGeneratedText(document, locale)}.`,
          `Подготви: ${formatGeneratedText(document, locale)}.`
        )
      ),
    ...documentIntelligence.certifications
      .slice(0, 2)
      .map((certification) =>
        localText(
          locale,
          `Attach certificate evidence for: ${formatGeneratedText(certification, locale)}.`,
          `Прикачи доказателство за сертификат: ${formatGeneratedText(certification, locale)}.`
        )
      )
  ];

  return actions.length > 0
    ? actions
    : [
        localText(
          locale,
          "Create administrative, technical, and pricing package placeholders.",
          "Създай административен, технически и ценови пакет."
        )
      ];
}

function getCompetitorNamesForBuyer(
  dashboard: ProcurementDashboard,
  buyerName: string
): string[] {
  return dedupeStrings([
    ...(dashboard.buyers.find((buyer) => buyer.buyerName === buyerName)?.topSuppliers ??
      []),
    ...dashboard.suppliers
      .filter((supplier) => supplier.topBuyers.includes(buyerName))
      .map((supplier) => supplier.supplierName)
  ]);
}

function formatDeadlineWindow(days: number | undefined, locale: Locale): string {
  if (days === undefined) {
    return t(locale, "noDeadline");
  }

  if (days < 0) {
    return t(locale, "deadlinePassed");
  }

  return localText(locale, `${days} days`, `${days} дни`);
}

function dedupeStrings(values: string[]): string[] {
  const normalized: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed && !normalized.includes(trimmed)) {
      normalized.push(trimmed);
    }
  }

  return normalized;
}

function buildOpportunityUrl(
  filters: Filters,
  selectedProfileIds: BusinessProfileId[]
): string {
  const params = new URLSearchParams({
    status: "open",
    limit: "250"
  });
  const normalizedProfileIds = normalizeSelectedProfileIds(selectedProfileIds);

  params.set("profileIds", normalizedProfileIds.join(","));

  const apiFilters = {
    search: filters.search,
    buyer: filters.buyer,
    cpvPrefix: filters.cpvPrefix,
    source: filters.source,
    minScore: filters.minScore,
    deadlineTo: filters.deadlineTo
  };

  for (const [key, value] of Object.entries(apiFilters)) {
    const trimmed = value.trim();
    if (trimmed) {
      params.set(key, trimmed);
    }
  }

  return `/api/opportunities?${params.toString()}`;
}

function getInitialThemePreference(): ThemePreference {
  const stored = window.localStorage.getItem("public-scanner-theme");
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialLocalePreference(): Locale {
  const stored = window.localStorage.getItem("public-scanner-locale");
  if (stored === "en" || stored === "bg") {
    return stored;
  }

  return navigator.language.toLowerCase().startsWith("bg") ? "bg" : "en";
}

function getInitialSelectedProfileIds(): BusinessProfileId[] {
  const stored = window.localStorage.getItem("public-scanner-selected-profile-ids");
  if (!stored) {
    return DEFAULT_SELECTED_PROFILE_IDS;
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    return normalizeSelectedProfileIds(parsed);
  } catch {
    return DEFAULT_SELECTED_PROFILE_IDS;
  }
}

function normalizeSelectedProfileIds(value: unknown): BusinessProfileId[] {
  if (!Array.isArray(value)) {
    return DEFAULT_SELECTED_PROFILE_IDS;
  }

  const selectedProfileIds: BusinessProfileId[] = [];
  for (const entry of value) {
    if (
      typeof entry === "string" &&
      ALL_PROFILE_IDS.includes(entry as BusinessProfileId) &&
      !selectedProfileIds.includes(entry as BusinessProfileId)
    ) {
      selectedProfileIds.push(entry as BusinessProfileId);
    }
  }

  return selectedProfileIds.length > 0
    ? selectedProfileIds
    : DEFAULT_SELECTED_PROFILE_IDS;
}

function getOpportunityScore(
  opportunity: Opportunity,
  profileIds: BusinessProfileId[]
): number {
  return (
    getBestProfileScore(opportunity.profileScores, profileIds)?.totalScore ??
    opportunity.match?.score ??
    0
  );
}

function getBestProfileScore(
  profileScores: ProfileFitScore[] | undefined,
  profileIds: BusinessProfileId[]
): ProfileFitScore | undefined {
  const selectedProfileIds = new Set(profileIds);

  return profileScores
    ?.filter((score) => selectedProfileIds.has(score.profileId))
    .sort((first, second) => second.totalScore - first.totalScore)[0];
}

function sortProfileScoresBySelection(
  profileScores: ProfileFitScore[] | undefined,
  profileIds: BusinessProfileId[]
): ProfileFitScore[] {
  const selectedProfileIds = new Set(profileIds);

  return [...(profileScores ?? [])].sort((first, second) => {
    const selectedDelta =
      Number(selectedProfileIds.has(second.profileId)) -
      Number(selectedProfileIds.has(first.profileId));

    return selectedDelta || second.totalScore - first.totalScore;
  });
}

function getNextDeadline(opportunities: Opportunity[], locale: Locale): string {
  const deadlines = opportunities
    .map((opportunity) => opportunity.submissionDeadline)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((first, second) => first.getTime() - second.getTime());

  return deadlines[0]
    ? formatDate(deadlines[0].toISOString(), locale)
    : t(locale, "noDeadline");
}

function getOpportunitySignals(
  opportunity: Opportunity,
  profileScore: ProfileFitScore | undefined,
  score: number,
  locale: Locale
): OpportunitySignal[] {
  const signals: OpportunitySignal[] = [];
  const daysUntilDeadline = getDaysUntil(opportunity.submissionDeadline);

  if (score >= 78) {
    signals.push({ id: "high-fit", label: t(locale, "highFit"), tone: "positive" });
  } else if (score >= 62) {
    signals.push({ id: "review-fit", label: t(locale, "reviewFit"), tone: "warning" });
  } else if (score > 0) {
    signals.push({ id: "low-fit", label: t(locale, "lowFit"), tone: "risk" });
  }

  if (profileScore?.recommendation === "need-partner") {
    signals.push({ id: "partner", label: t(locale, "partnerLikely"), tone: "warning" });
  } else if (profileScore?.recommendation === "skip") {
    signals.push({ id: "skip", label: t(locale, "skipSignal"), tone: "risk" });
  }

  if (daysUntilDeadline === undefined) {
    signals.push({
      id: "deadline-missing",
      label: t(locale, "noDeadline"),
      tone: "neutral"
    });
  } else if (daysUntilDeadline < 0) {
    signals.push({
      id: "deadline-passed",
      label: t(locale, "deadlinePassed"),
      tone: "risk"
    });
  } else if (daysUntilDeadline <= 7) {
    signals.push({ id: "deadline-soon", label: t(locale, "dueSoon"), tone: "warning" });
  } else if (daysUntilDeadline <= 21) {
    signals.push({
      id: "deadline-near",
      label: t(locale, "nearDeadline"),
      tone: "neutral"
    });
  }

  if (opportunity.isEuFunded) {
    signals.push({ id: "eu-funded", label: t(locale, "euFunded"), tone: "positive" });
  }

  if (opportunity.estimatedValue && opportunity.estimatedValue.amount >= 250000) {
    signals.push({ id: "high-value", label: t(locale, "highValue"), tone: "positive" });
  }

  return signals.slice(0, 4);
}

function getDaysUntil(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) {
    return undefined;
  }

  const today = new Date();
  const todayStart = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const deadlineStart = Date.UTC(
    deadline.getFullYear(),
    deadline.getMonth(),
    deadline.getDate()
  );

  return Math.ceil((deadlineStart - todayStart) / 86_400_000);
}

function parsePositiveInteger(value: string): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function toPipelineForm(state: SavedOpportunityState | undefined): PipelineForm {
  return {
    stage: state?.stage ?? "watching",
    owner: state?.owner ?? "",
    notes: state?.notes ?? "",
    nextAction: state?.nextAction ?? "",
    dueDate: state?.dueDate ?? "",
    decisionReason: state?.decisionReason ?? ""
  };
}

function formatDate(value: string | undefined, locale: Locale): string {
  if (!value) {
    return t(locale, "noDeadline");
  }

  return new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatMoney(value: Money | undefined, locale: Locale): string {
  if (!value) {
    return t(locale, "notStated");
  }

  try {
    return new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-GB", {
      style: "currency",
      currency: value.currency,
      maximumFractionDigits: 0
    }).format(value.amount);
  } catch {
    return `${value.amount.toLocaleString(locale === "bg" ? "bg-BG" : "en-GB")} ${value.currency}`;
  }
}

function formatStage(stage: ApplicationStage, locale: Locale): string {
  return STAGE_LABELS[locale][stage];
}

function formatRecommendation(
  recommendation: BidRecommendation | undefined,
  locale: Locale
): string {
  return RECOMMENDATION_LABELS[locale][recommendation ?? "unknown"];
}

function formatScoreComponent(
  id: ScoreComponentKey,
  fallback: string,
  locale: Locale
): string {
  return SCORE_COMPONENT_LABELS[locale][id] ?? fallback;
}

function formatDocumentStatus(
  status: DocumentIntelligence["status"] | undefined,
  locale: Locale
): string {
  return status ? DOCUMENT_STATUS_LABELS[locale][status] : t(locale, "notAvailable");
}

function formatEvidenceType(type: EvidenceType, locale: Locale): string {
  switch (type) {
    case "certificate":
      return t(locale, "typeCertificate");
    case "reference":
      return t(locale, "typeReference");
    case "team-cv":
      return t(locale, "typeTeamCv");
    case "vendor-authorization":
      return t(locale, "typeVendorAuthorization");
    case "company-document":
      return t(locale, "typeCompanyDocument");
    case "methodology":
      return t(locale, "typeMethodology");
    case "other":
      return t(locale, "typeOther");
  }
}

function formatComplianceRequirementType(
  requirementType: ComplianceRequirementType,
  locale: Locale
): string {
  switch (requirementType) {
    case "eligibility":
      return t(locale, "eligibility");
    case "required-document":
      return t(locale, "requiredDocs");
    case "certification":
      return t(locale, "certifications");
    case "risk":
      return t(locale, "risks");
  }
}

function formatComplianceStatus(status: ComplianceStatus, locale: Locale): string {
  switch (status) {
    case "missing":
      return t(locale, "statusMissing");
    case "in-progress":
      return t(locale, "statusInProgress");
    case "ready":
      return t(locale, "statusReady");
    case "not-applicable":
      return t(locale, "statusNotApplicable");
    case "blocked":
      return t(locale, "statusBlocked");
  }
}

function isActivePipelineStage(stage: ApplicationStage): boolean {
  return ["watching", "reviewing", "preparing", "submitted"].includes(stage);
}

function countPipelineStage(
  items: PipelineDashboardItem[],
  stage: ApplicationStage
): number {
  return items.filter((item) => item.savedState.stage === stage).length;
}

function getPipelineBadgeClass(stage: ApplicationStage): string {
  if (stage === "won") {
    return "signal-badge signal-positive";
  }

  if (stage === "lost" || stage === "archived") {
    return "signal-badge signal-neutral";
  }

  if (stage === "preparing" || stage === "submitted") {
    return "signal-badge signal-warning";
  }

  return "signal-badge signal-positive";
}

function getComplianceBadgeClass(status: ComplianceStatus): string {
  if (status === "ready" || status === "not-applicable") {
    return "signal-badge signal-positive";
  }

  if (status === "blocked") {
    return "signal-badge signal-risk";
  }

  if (status === "in-progress") {
    return "signal-badge signal-warning";
  }

  return "signal-badge signal-neutral";
}

function formatApplyReadiness(item: PipelineDashboardItem, locale: Locale): string {
  if (
    item.documentIntelligence.status === "failed" ||
    item.documentIntelligence.risks.length > 0
  ) {
    return t(locale, "blocked");
  }

  if (
    item.documentIntelligence.status === "ready" &&
    item.documentIntelligence.requiredDocuments.length > 0 &&
    item.savedState.nextAction
  ) {
    return t(locale, "packageReady");
  }

  return t(locale, "needsReview");
}

function formatSourceRunStatus(
  status: SourceHealthItem["status"] | undefined,
  locale: Locale
): string {
  if (!status) {
    return t(locale, "notAvailable");
  }

  switch (status) {
    case "running":
      return t(locale, "loading");
    case "succeeded":
      return locale === "bg" ? "успешно" : "succeeded";
    case "failed":
      return t(locale, "failed").toLowerCase();
    case "partial":
      return locale === "bg" ? "частично" : "partial";
  }
}

function formatGeneratedSummary(value: string, locale: Locale): string {
  if (locale !== "bg") {
    return value;
  }

  const match =
    /^(.+?) fit (\d+)\/100 for (.+)\. Use this as an initial triage before reading the official tender documents\.$/.exec(
      value
    );

  if (!match) {
    return formatGeneratedText(value, locale);
  }

  const profileName = match[1] ?? "";
  const score = match[2] ?? "0";
  const buyerName = match[3] ?? "";

  return `${formatGeneratedProfileName(profileName, locale)}: съвпадение ${score}/100 за ${buyerName}. Използвай това като първоначален преглед преди четене на официалните тръжни документи.`;
}

function formatGeneratedText(value: string, locale: Locale): string {
  if (locale !== "bg") {
    return value;
  }

  const exactTranslation = GENERATED_TEXT_BG[value];
  if (exactTranslation) {
    return exactTranslation;
  }

  const cpvMatch = /^CPV match: (.+)$/.exec(value);
  if (cpvMatch) {
    return `CPV съвпадение: ${cpvMatch[1] ?? ""}`;
  }

  const keywordMatch = /^keyword: (.+)$/.exec(value);
  if (keywordMatch) {
    return `Ключова дума: ${keywordMatch[1] ?? ""}`;
  }

  const excludedKeywordMatch = /^excluded keyword: (.+)$/.exec(value);
  if (excludedKeywordMatch) {
    return `Изключваща ключова дума: ${excludedKeywordMatch[1] ?? ""}`;
  }

  const certificationMatch = /^Check certifications: (.+)$/.exec(value);
  if (certificationMatch) {
    return `Провери сертификати: ${certificationMatch[1] ?? ""}`;
  }

  const budgetFitsMatch = /^Budget fits profile range: (.+)$/.exec(value);
  if (budgetFitsMatch) {
    return `Бюджетът пасва на диапазона на профила: ${budgetFitsMatch[1] ?? ""}`;
  }

  const budgetOutsideMatch = /^Budget outside preferred range: (.+)$/.exec(value);
  if (budgetOutsideMatch) {
    return `Бюджетът е извън предпочитания диапазон: ${budgetOutsideMatch[1] ?? ""}`;
  }

  const submissionDaysMatch = /^Only (\d+) days remain before submission\.$/.exec(value);
  if (submissionDaysMatch) {
    return `Остават само ${submissionDaysMatch[1] ?? "0"} дни до подаване.`;
  }

  const onlyDaysMatch = /^Only (\d+) days remain$/.exec(value);
  if (onlyDaysMatch) {
    return `Остават само ${onlyDaysMatch[1] ?? "0"} дни.`;
  }

  const daysMatch = /^(\d+) days remain$/.exec(value);
  if (daysMatch) {
    return `Остават ${daysMatch[1] ?? "0"} дни.`;
  }

  return value;
}

function formatGeneratedProfileName(value: string | undefined, locale: Locale): string {
  if (!value) {
    return locale === "bg" ? "Общ ИТ профил" : "General IT";
  }

  if (value === "General IT") {
    return locale === "bg" ? "Общ ИТ профил" : value;
  }

  const profileId = ENGLISH_PROFILE_NAME_TO_ID[value];
  return profileId ? formatProfileName(profileId, locale) : value;
}

function formatProfileName(
  profile: BusinessProfile | BusinessProfileId,
  locale: Locale,
  fallback?: string
): string {
  const profileId = typeof profile === "string" ? profile : profile.id;
  return PROFILE_NAMES[locale][profileId] ?? fallback ?? profileId;
}

function formatSelectedSectorSummary(
  profileIds: BusinessProfileId[],
  locale: Locale
): string {
  if (profileIds.length === 0) {
    return t(locale, "noSelectedSectors");
  }

  if (profileIds.length <= 2) {
    return profileIds.map((profileId) => formatProfileName(profileId, locale)).join(", ");
  }

  return `${profileIds.length} ${t(locale, "sectors")}`;
}

function formatOpportunityFilterSummary(
  sector: SectorFilter,
  profileIds: BusinessProfileId[],
  locale: Locale
): string {
  return sector
    ? formatSectorFilter(sector, locale)
    : formatSelectedSectorSummary(profileIds, locale);
}

function formatSectorFilter(sector: BusinessProfileKind, locale: Locale): string {
  switch (sector) {
    case "software":
      return t(locale, "softwareSector");
    case "hardware":
      return t(locale, "hardwareSector");
    case "services":
      return t(locale, "servicesSector");
  }
}

function formatAlertChannel(channel: AlertChannel, locale: Locale): string {
  switch (channel) {
    case "email":
      return t(locale, "emailChannel");
    case "webhook":
      return t(locale, "webhookChannel");
    case "slack":
      return t(locale, "slackChannel");
  }
}

function getScoreClassName(score: number): string {
  if (score >= 78) {
    return "score score-strong";
  }

  if (score >= 62) {
    return "score score-review";
  }

  if (score >= 48) {
    return "score score-partner";
  }

  return "score";
}

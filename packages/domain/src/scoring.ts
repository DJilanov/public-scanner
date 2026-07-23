import type {
  BidRecommendation,
  BusinessProfile,
  BusinessProfileId,
  FitScoreComponent,
  MatchReason,
  Money,
  OpportunityScore,
  ProfileFitScore,
  ScoreComponentId
} from "./types.js";

export const SOFTWARE_CPV_PREFIXES = [
  "72",
  "722",
  "724",
  "726",
  "727",
  "728",
  "48",
  "30",
  "723",
  "793",
  "794"
] as const;

const DIRECT_ICT_CPV_PREFIXES = [
  "722",
  "723",
  "724",
  "725",
  "726",
  "727",
  "728",
  "729",
  "48",
  "302",
  "323",
  "324",
  "325",
  "386",
  "487",
  "488",
  "503",
  "5033"
] as const;

const CONTEXTUAL_ICT_CPV_PREFIXES = ["30", "72", "713", "793", "794"] as const;

const STRONG_ICT_KEYWORDS = [
  "software",
  "managed it services",
  "it services",
  "it equipment",
  "computer equipment",
  "information system",
  "cybersecurity",
  "cloud",
  "backup",
  "network"
] as const;

export const SOFTWARE_KEYWORDS = [
  "software",
  "development",
  "managed it services",
  "it services",
  "it equipment",
  "computer equipment",
  "ict",
  "web portal",
  "mobile application",
  "information system",
  "api",
  "integration",
  "database",
  "cybersecurity",
  "cloud",
  "erp",
  "crm",
  "gis",
  "bi",
  "dashboard",
  "artificial intelligence",
  "\u0441\u043e\u0444\u0442\u0443\u0435\u0440",
  "\u0440\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u043a\u0430",
  "\u0443\u0435\u0431",
  "\u043f\u043e\u0440\u0442\u0430\u043b",
  "\u043c\u043e\u0431\u0438\u043b\u043d\u043e",
  "\u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u043e\u043d\u043d\u0430 \u0441\u0438\u0441\u0442\u0435\u043c\u0430",
  "\u0431\u0430\u0437\u0430 \u0434\u0430\u043d\u043d\u0438",
  "\u043a\u0438\u0431\u0435\u0440",
  "\u043e\u0431\u043b\u0430\u043a"
] as const;

export const BUSINESS_PROFILES: BusinessProfile[] = [
  {
    id: "software-development",
    name: "Software Development",
    kind: "software",
    cpvPrefixes: ["722", "72", "723", "724", "793", "794"],
    keywords: [
      "software",
      "development",
      "managed it services",
      "it services",
      "ict",
      "web portal",
      "mobile application",
      "information system",
      "api",
      "integration",
      "database",
      "\u0441\u043e\u0444\u0442\u0443\u0435\u0440",
      "\u0440\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u043a\u0430",
      "\u043f\u043e\u0440\u0442\u0430\u043b",
      "\u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u043e\u043d\u043d\u0430 \u0441\u0438\u0441\u0442\u0435\u043c\u0430"
    ],
    excludedKeywords: [
      "construction",
      "\u0441\u0442\u0440\u043e\u0438\u0442\u0435\u043b"
    ],
    targetValue: { min: 5000, max: 500000, currency: "EUR" },
    requiredCertifications: []
  },
  {
    id: "maintenance-support",
    name: "Maintenance & Support",
    kind: "services",
    cpvPrefixes: ["7225", "7226", "726", "503", "713"],
    keywords: [
      "managed it services",
      "it services",
      "support",
      "maintenance",
      "sla",
      "helpdesk",
      "\u043f\u043e\u0434\u0434\u0440\u044a\u0436\u043a\u0430",
      "\u0430\u0431\u043e\u043d\u0430\u043c\u0435\u043d\u0442"
    ],
    excludedKeywords: [],
    targetValue: { min: 2000, max: 250000, currency: "EUR" },
    requiredCertifications: []
  },
  {
    id: "saas-licensing",
    name: "SaaS & Licensing",
    kind: "software",
    cpvPrefixes: ["48", "482", "483", "484", "485", "486", "487", "488", "7226"],
    keywords: [
      "license",
      "subscription",
      "saas",
      "software package",
      "\u043b\u0438\u0446\u0435\u043d\u0437",
      "\u0430\u0431\u043e\u043d\u0430\u043c\u0435\u043d\u0442"
    ],
    excludedKeywords: ["custom development"],
    targetValue: { min: 1000, max: 300000, currency: "EUR" },
    requiredCertifications: []
  },
  {
    id: "hardware-supply",
    name: "Hardware Supply",
    kind: "hardware",
    cpvPrefixes: ["30", "302", "323", "324", "325", "386", "488"],
    keywords: [
      "hardware",
      "computer",
      "it equipment",
      "computer equipment",
      "server",
      "laptop",
      "workstation",
      "printer",
      "\u0445\u0430\u0440\u0434\u0443\u0435\u0440",
      "\u043a\u043e\u043c\u043f\u044e\u0442\u044a\u0440",
      "\u0441\u044a\u0440\u0432\u044a\u0440",
      "\u043b\u0430\u043f\u0442\u043e\u043f"
    ],
    excludedKeywords: ["civil works", "\u0441\u0442\u0440\u043e\u0438\u0442\u0435\u043b"],
    targetValue: { min: 3000, max: 750000, currency: "EUR" },
    requiredCertifications: []
  },
  {
    id: "networking",
    name: "Networking",
    kind: "hardware",
    cpvPrefixes: ["324", "325", "727", "5033"],
    keywords: [
      "network",
      "switch",
      "router",
      "wifi",
      "firewall",
      "\u043c\u0440\u0435\u0436",
      "\u0440\u0443\u0442\u0435\u0440",
      "\u0441\u0443\u0438\u0447"
    ],
    excludedKeywords: [],
    targetValue: { min: 3000, max: 500000, currency: "EUR" },
    requiredCertifications: []
  },
  {
    id: "cybersecurity",
    name: "Cybersecurity",
    kind: "services",
    cpvPrefixes: ["4873", "728", "7222", "726"],
    keywords: [
      "cyber",
      "security",
      "firewall",
      "audit",
      "penetration",
      "soc",
      "\u043a\u0438\u0431\u0435\u0440",
      "\u0441\u0438\u0433\u0443\u0440\u043d\u043e\u0441\u0442"
    ],
    excludedKeywords: [],
    targetValue: { min: 5000, max: 400000, currency: "EUR" },
    requiredCertifications: []
  },
  {
    id: "cloud-infrastructure",
    name: "Cloud & Infrastructure",
    kind: "services",
    cpvPrefixes: ["488", "724", "725", "726", "7225"],
    keywords: [
      "cloud",
      "hosting",
      "infrastructure",
      "virtualization",
      "backup",
      "\u043e\u0431\u043b\u0430\u043a",
      "\u0445\u043e\u0441\u0442\u0438\u043d\u0433",
      "\u0431\u0435\u043a\u044a\u043f"
    ],
    excludedKeywords: [],
    targetValue: { min: 3000, max: 500000, currency: "EUR" },
    requiredCertifications: []
  },
  {
    id: "consulting-integration",
    name: "Consulting & Integration",
    kind: "services",
    cpvPrefixes: ["7222", "7224", "794", "793", "723"],
    keywords: [
      "consulting",
      "analysis",
      "integration",
      "architecture",
      "implementation",
      "\u043a\u043e\u043d\u0441\u0443\u043b\u0442",
      "\u0430\u043d\u0430\u043b\u0438\u0437",
      "\u0438\u043d\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044f"
    ],
    excludedKeywords: [],
    targetValue: { min: 3000, max: 300000, currency: "EUR" },
    requiredCertifications: []
  }
];

export interface OpportunityScoringInput {
  title: string;
  cpvCodes: readonly string[];
  description?: string;
  submissionDeadline?: Date;
  estimatedValue?: Money;
  isEuFunded?: boolean;
}

export interface ScoringOptions {
  now?: Date;
}

export function scoreOpportunity(
  input: OpportunityScoringInput,
  options: ScoringOptions = {}
): OpportunityScore {
  const now = options.now ?? new Date();
  const reasons: MatchReason[] = [];

  const strongestCpvWeight = getStrongestCpvWeight(input.cpvCodes);
  if (strongestCpvWeight > 0) {
    reasons.push({
      code: "cpv.software",
      label: "Software or IT CPV code",
      weight: strongestCpvWeight
    });
  }

  const keywordMatches = findKeywordMatches(input);
  for (const keyword of keywordMatches.slice(0, 5)) {
    reasons.push({
      code: "keyword.match",
      label: `Keyword match: ${keyword}`,
      weight: 6
    });
  }

  if (input.submissionDeadline) {
    const deadlineWeight = getDeadlineWeight(input.submissionDeadline, now);
    if (deadlineWeight > 0) {
      reasons.push({
        code: "deadline.open",
        label: "Submission deadline is still open",
        weight: deadlineWeight
      });
    }
  }

  if (input.estimatedValue && input.estimatedValue.amount > 0) {
    reasons.push({
      code: "value.available",
      label: "Estimated value is available",
      weight: 5
    });
  }

  if (input.isEuFunded) {
    reasons.push({
      code: "funding.eu",
      label: "EU-funded opportunity",
      weight: 5
    });
  }

  const score = Math.min(
    100,
    reasons.reduce((total, reason) => total + reason.weight, 0)
  );

  return { score, reasons };
}

export function scoreOpportunityAcrossProfiles(
  input: OpportunityScoringInput,
  options: ScoringOptions = {}
): ProfileFitScore[] {
  return BUSINESS_PROFILES.map((profile) =>
    scoreOpportunityForProfile(profile, input, options)
  ).sort((first, second) => second.totalScore - first.totalScore);
}

export function scoreOpportunityForProfile(
  profile: BusinessProfile,
  input: OpportunityScoringInput,
  options: ScoringOptions = {}
): ProfileFitScore {
  const now = options.now ?? new Date();
  const components: FitScoreComponent[] = [
    scoreRelevance(profile, input),
    scoreEligibility(profile, input),
    scoreCommercial(profile, input),
    scoreExecution(input, now),
    scoreCompetition(),
    scoreUrgency(input, now)
  ];
  const totalScore = Math.round(
    components.reduce(
      (total, component) => total + component.score * component.weight,
      0
    ) / components.reduce((total, component) => total + component.weight, 0)
  );

  return {
    profileId: profile.id,
    profileName: profile.name,
    totalScore,
    recommendation: getBidRecommendation(totalScore),
    components
  };
}

export function getBusinessProfile(profileId: BusinessProfileId): BusinessProfile {
  const profile = BUSINESS_PROFILES.find((entry) => entry.id === profileId);
  if (!profile) {
    throw new Error(`Unknown business profile: ${profileId}`);
  }

  return profile;
}

export function profileScoreToOpportunityScore(
  profileScore: ProfileFitScore
): OpportunityScore {
  const reasons: MatchReason[] = profileScore.components.flatMap((component) =>
    component.reasons.slice(0, 2).map((reason) => ({
      code: `profile.${profileScore.profileId}.${component.id}`,
      label: `${component.label}: ${reason}`,
      weight: Math.round(component.score * component.weight)
    }))
  );

  return {
    score: profileScore.totalScore,
    reasons
  };
}

function getStrongestCpvWeight(cpvCodes: readonly string[]): number {
  let weight = 0;

  for (const cpvCode of cpvCodes) {
    const normalizedCode = cpvCode.trim();
    if (normalizedCode.startsWith("722")) {
      weight = Math.max(weight, 55);
    } else if (normalizedCode.startsWith("48")) {
      weight = Math.max(weight, 35);
    } else if (
      DIRECT_ICT_CPV_PREFIXES.some((prefix) => normalizedCode.startsWith(prefix))
    ) {
      weight = Math.max(weight, 20);
    }
  }

  return weight;
}

function scoreRelevance(
  profile: BusinessProfile,
  input: OpportunityScoringInput
): FitScoreComponent {
  const keywordMatches = findProfileKeywordMatches(profile, input);
  const cpvMatches = input.cpvCodes.filter((cpvCode) =>
    profile.cpvPrefixes.some((prefix) => cpvCode.trim().startsWith(prefix))
  );
  const directCpvMatches = cpvMatches.filter((cpvCode) =>
    hasDirectProfileCpvMatch(profile, cpvCode)
  );
  const contextualCpvMatches = cpvMatches.filter(
    (cpvCode) => !hasDirectProfileCpvMatch(profile, cpvCode)
  );
  const excludedMatches = findExcludedKeywordMatches(profile, input);
  const cpvScore =
    directCpvMatches.length > 0
      ? 62
      : contextualCpvMatches.length > 0
        ? keywordMatches.length > 0
          ? 46
          : 18
        : 0;
  const keywordEvidenceScore = getKeywordEvidenceScore(keywordMatches);
  const score = clampScore(
    Math.max(cpvScore + Math.min(keywordMatches.length * 8, 32), keywordEvidenceScore) -
      excludedMatches.length * 25
  );

  return buildComponent("relevance", "Relevance", 0.4, score, [
    ...(cpvMatches.length > 0 ? [`CPV match: ${cpvMatches.slice(0, 3).join(", ")}`] : []),
    ...(contextualCpvMatches.length > 0 && directCpvMatches.length === 0
      ? ["Generic CPV needs IT-specific title or description evidence"]
      : []),
    ...keywordMatches.slice(0, 4).map((keyword) => `keyword: ${keyword}`),
    ...excludedMatches.slice(0, 2).map((keyword) => `excluded keyword: ${keyword}`)
  ]);
}

function getKeywordEvidenceScore(keywordMatches: readonly string[]): number {
  if (keywordMatches.length === 0) {
    return 0;
  }

  if (
    keywordMatches.some((keyword) =>
      STRONG_ICT_KEYWORDS.includes(
        normalizeText(keyword) as (typeof STRONG_ICT_KEYWORDS)[number]
      )
    )
  ) {
    return 68;
  }

  if (keywordMatches.length >= 3) {
    return 62;
  }

  if (keywordMatches.length >= 2) {
    return 52;
  }

  return 34;
}

function hasDirectProfileCpvMatch(profile: BusinessProfile, cpvCode: string): boolean {
  const normalizedCode = cpvCode.trim();

  return profile.cpvPrefixes.some(
    (prefix) =>
      normalizedCode.startsWith(prefix) &&
      !CONTEXTUAL_ICT_CPV_PREFIXES.includes(
        prefix as (typeof CONTEXTUAL_ICT_CPV_PREFIXES)[number]
      )
  );
}

function scoreEligibility(
  profile: BusinessProfile,
  _input: OpportunityScoringInput
): FitScoreComponent {
  const score = profile.requiredCertifications.length > 0 ? 55 : 70;

  return buildComponent("eligibility", "Eligibility", 0.15, score, [
    profile.requiredCertifications.length > 0
      ? `Check certifications: ${profile.requiredCertifications.join(", ")}`
      : "No profile-level certification blocker"
  ]);
}

function scoreCommercial(
  profile: BusinessProfile,
  input: OpportunityScoringInput
): FitScoreComponent {
  if (!input.estimatedValue) {
    return buildComponent("commercial", "Commercial", 0.15, 45, [
      "Estimated value is not available"
    ]);
  }

  const min = profile.targetValue?.min ?? 0;
  const max = profile.targetValue?.max ?? Number.POSITIVE_INFINITY;
  const inRange =
    input.estimatedValue.amount >= min && input.estimatedValue.amount <= max;

  return buildComponent("commercial", "Commercial", 0.15, inRange ? 82 : 58, [
    inRange
      ? `Budget fits profile range: ${input.estimatedValue.amount} ${input.estimatedValue.currency}`
      : `Budget outside preferred range: ${input.estimatedValue.amount} ${input.estimatedValue.currency}`
  ]);
}

function scoreExecution(input: OpportunityScoringInput, now: Date): FitScoreComponent {
  if (!input.submissionDeadline) {
    return buildComponent("execution", "Execution", 0.12, 45, [
      "No submission deadline available"
    ]);
  }

  const days = getDaysUntil(input.submissionDeadline, now);
  if (days < 0) {
    return buildComponent("execution", "Execution", 0.12, 0, ["Deadline has passed"]);
  }

  if (days < 7) {
    return buildComponent("execution", "Execution", 0.12, 42, [
      `Only ${days} days remain`
    ]);
  }

  if (days <= 30) {
    return buildComponent("execution", "Execution", 0.12, 82, [`${days} days remain`]);
  }

  return buildComponent("execution", "Execution", 0.12, 70, [`${days} days remain`]);
}

function scoreCompetition(): FitScoreComponent {
  return buildComponent("competition", "Competition", 0.1, 50, [
    "Competition data requires contract history"
  ]);
}

function scoreUrgency(input: OpportunityScoringInput, now: Date): FitScoreComponent {
  if (!input.submissionDeadline) {
    return buildComponent("urgency", "Urgency", 0.08, 35, ["Deadline is unknown"]);
  }

  const days = getDaysUntil(input.submissionDeadline, now);
  if (days < 0) {
    return buildComponent("urgency", "Urgency", 0.08, 0, ["Closed"]);
  }

  if (days <= 3) {
    return buildComponent("urgency", "Urgency", 0.08, 35, ["Critical deadline"]);
  }

  if (days <= 14) {
    return buildComponent("urgency", "Urgency", 0.08, 82, ["Near-term deadline"]);
  }

  return buildComponent("urgency", "Urgency", 0.08, 65, ["Enough time to review"]);
}

function findKeywordMatches(input: OpportunityScoringInput): string[] {
  const haystack = normalizeText(`${input.title} ${input.description ?? ""}`);
  const matches = new Set<string>();

  for (const keyword of SOFTWARE_KEYWORDS) {
    if (containsKeyword(haystack, keyword)) {
      matches.add(keyword);
    }
  }

  return [...matches];
}

function findProfileKeywordMatches(
  profile: BusinessProfile,
  input: OpportunityScoringInput
): string[] {
  const haystack = normalizeText(`${input.title} ${input.description ?? ""}`);
  return profile.keywords.filter((keyword) => containsKeyword(haystack, keyword));
}

function findExcludedKeywordMatches(
  profile: BusinessProfile,
  input: OpportunityScoringInput
): string[] {
  const haystack = normalizeText(`${input.title} ${input.description ?? ""}`);
  return profile.excludedKeywords.filter((keyword) => containsKeyword(haystack, keyword));
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase("bg-BG").replace(/\s+/g, " ").trim();
}

function containsKeyword(normalizedHaystack: string, keyword: string): boolean {
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) {
    return false;
  }

  if (/^[a-z0-9]{1,3}$/.test(normalizedKeyword)) {
    return new RegExp(
      `(^|[^a-z0-9])${escapeRegExp(normalizedKeyword)}([^a-z0-9]|$)`,
      "u"
    ).test(normalizedHaystack);
  }

  return normalizedHaystack.includes(normalizedKeyword);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getDeadlineWeight(deadline: Date, now: Date): number {
  if (deadline.getTime() <= now.getTime()) {
    return 0;
  }

  const daysUntilDeadline = Math.ceil(
    (deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (daysUntilDeadline >= 7) {
    return 15;
  }

  return 8;
}

function buildComponent(
  id: ScoreComponentId,
  label: string,
  weight: number,
  score: number,
  reasons: string[]
): FitScoreComponent {
  return {
    id,
    label,
    score: clampScore(score),
    weight,
    reasons
  };
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

function getDaysUntil(deadline: Date, now: Date): number {
  return Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function getBidRecommendation(score: number): BidRecommendation {
  if (score >= 78) {
    return "apply";
  }

  if (score >= 62) {
    return "review";
  }

  if (score >= 48) {
    return "need-partner";
  }

  return "skip";
}

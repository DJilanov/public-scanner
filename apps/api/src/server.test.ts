import type {
  AlertRuleRepositoryPort,
  ApplyStudioRepositoryPort,
  AuthRepositoryPort,
  AuthSession,
  AuthenticatedUser,
  AuthUser,
  AuthUserInput,
  ComplianceItemUpdateInput,
  OpportunityListFilters,
  OpportunityRepositoryPort,
  PipelineStateInput,
  UserPreferences,
  UserPreferencesInput
} from "@public-scanner/db";
import type {
  AlertRule,
  AlertRuleInput,
  ApplyStudioData,
  ComplianceItem,
  ComplianceItemInput,
  EvidenceItem,
  EvidenceItemInput,
  Opportunity,
  OpportunityDetail,
  ProcurementDashboard,
  SavedOpportunityState
} from "@public-scanner/domain";
import { describe, expect, it } from "vitest";

import { hashPassword } from "./auth.js";
import { buildServer } from "./server.js";

const opportunity: Opportunity = {
  id: "opportunity-1",
  source: "ted",
  title: "Software development services",
  buyerName: "Example buyer",
  status: "open",
  cpvCodes: ["72230000"],
  sourceUrl: "https://ted.europa.eu/en/notice/1/html",
  match: {
    score: 82,
    reasons: [
      {
        code: "cpv.software",
        label: "Software or IT CPV code",
        weight: 55
      }
    ]
  }
};

const opportunityDetail: OpportunityDetail = {
  opportunity,
  lots: [],
  contracts: [],
  amendments: [],
  savedState: {
    stage: "reviewing",
    owner: "Dimitar"
  },
  documentIntelligence: {
    status: "ready",
    summary: "Software Development fit 82/100.",
    eligibilityCriteria: ["Check references."],
    requiredDocuments: ["Technical proposal."],
    certifications: ["No certification signal detected in structured metadata."],
    risks: ["Verify official documents."]
  },
  competitorInsights: []
};

const dashboard: ProcurementDashboard = {
  pipeline: [
    {
      opportunity,
      savedState: {
        stage: "reviewing",
        owner: "Dimitar"
      },
      documentIntelligence: opportunityDetail.documentIntelligence!
    }
  ],
  documents: [
    {
      opportunity,
      documentIntelligence: opportunityDetail.documentIntelligence!,
      savedState: opportunityDetail.savedState!
    }
  ],
  contracts: [
    {
      id: "contract-1",
      source: "ted",
      title: "Software delivery contract",
      buyerName: "Example buyer",
      supplierName: "Winning supplier",
      contractDate: "2026-07-01T00:00:00.000Z",
      value: {
        amount: 100000,
        currency: "EUR"
      },
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
      cpvCodes: ["72230000"]
    }
  ],
  buyers: [
    {
      buyerName: "Example buyer",
      opportunityCount: 4,
      openOpportunityCount: 1,
      contractCount: 2,
      topSuppliers: ["Winning supplier"],
      topCpvCodes: ["72230000"]
    }
  ],
  suppliers: [
    {
      supplierName: "Winning supplier",
      winsCount: 2,
      buyerCount: 1,
      topBuyers: ["Example buyer"],
      topCpvCodes: ["72230000"]
    }
  ],
  sources: [
    {
      source: "ted",
      status: "succeeded",
      fetchedCount: 50,
      insertedCount: 4,
      updatedCount: 12,
      skippedCount: 34,
      failedCount: 0,
      recentErrorCount: 0,
      openOpportunityCount: 6,
      highFitOpportunityCount: 3,
      readyOpportunityCount: 2,
      documentUrlCount: 4,
      submissionUrlCount: 3,
      readinessScore: 88,
      latestOpportunityAt: "2026-07-23T00:00:00.000Z"
    }
  ]
};

const defaultInternationalSourceIds = [
  "eu-ted",
  "eu-sedia",
  "opentender-ocds",
  "worldbank",
  "ungm",
  "ebrd-ecepp",
  "nato-procurement"
];

const evidenceItem: EvidenceItem = {
  id: "evidence-1",
  title: "ISO 27001 certificate",
  type: "certificate",
  profileIds: ["cybersecurity"],
  issuer: "Accredited auditor",
  validUntil: "2027-12-31",
  summary: "Security management certification.",
  storageUrl: "https://example.test/iso-27001.pdf",
  createdAt: "2026-07-23T00:00:00.000Z",
  updatedAt: "2026-07-23T00:00:00.000Z"
};

const complianceItem: ComplianceItem = {
  id: "compliance-1",
  opportunityId: opportunity.id,
  requirementType: "certification",
  requirement: "ISO 27001",
  status: "missing",
  owner: "Dimitar",
  evidenceItemIds: [evidenceItem.id],
  notes: "Attach latest certificate.",
  createdAt: "2026-07-23T00:00:00.000Z",
  updatedAt: "2026-07-23T00:00:00.000Z"
};

class FakeOpportunityRepository implements OpportunityRepositoryPort {
  public lastFilters: OpportunityListFilters | undefined;
  public lastDashboardFilters: OpportunityListFilters | undefined;
  public lastPipelineInput: PipelineStateInput | undefined;

  public async list(filters: OpportunityListFilters = {}): Promise<Opportunity[]> {
    this.lastFilters = filters;
    return [opportunity];
  }

  public async getById(id: string): Promise<Opportunity | undefined> {
    return id === opportunity.id ? opportunity : undefined;
  }

  public async getDetailById(id: string): Promise<OpportunityDetail | undefined> {
    return id === opportunity.id ? opportunityDetail : undefined;
  }

  public async getDashboard(
    filters: OpportunityListFilters = {}
  ): Promise<ProcurementDashboard> {
    this.lastDashboardFilters = filters;
    return dashboard;
  }

  public async savePipelineState(
    id: string,
    input: PipelineStateInput
  ): Promise<SavedOpportunityState> {
    this.lastPipelineInput = input;
    if (id !== opportunity.id) {
      throw new Error("not found");
    }

    return {
      stage: input.stage,
      ...(input.owner ? { owner: input.owner } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.nextAction ? { nextAction: input.nextAction } : {}),
      ...(input.dueDate ? { dueDate: input.dueDate } : {}),
      ...(input.decisionReason ? { decisionReason: input.decisionReason } : {})
    };
  }
}

class FailingOpportunityRepository implements OpportunityRepositoryPort {
  public async list(): Promise<Opportunity[]> {
    throw new Error("database unavailable");
  }

  public async getById(): Promise<Opportunity | undefined> {
    throw new Error("database unavailable");
  }
}

class FakeAlertRuleRepository implements AlertRuleRepositoryPort {
  public readonly rules: AlertRule[] = [];
  public lastInput: AlertRuleInput | undefined;

  public async listRules(): Promise<AlertRule[]> {
    return this.rules;
  }

  public async upsertRule(input: AlertRuleInput, id?: string): Promise<AlertRule> {
    this.lastInput = input;
    const rule: AlertRule = {
      id: id ?? "alert-rule-1",
      ...input,
      createdAt: "2026-07-23T00:00:00.000Z",
      updatedAt: "2026-07-23T00:00:00.000Z"
    };
    this.rules.push(rule);
    return rule;
  }
}

class FakeApplyStudioRepository implements ApplyStudioRepositoryPort {
  public data: ApplyStudioData = {
    evidenceItems: [evidenceItem],
    complianceItems: [complianceItem]
  };
  public lastOpportunityId: string | undefined;
  public lastEvidenceInput: EvidenceItemInput | undefined;
  public lastComplianceInputs: ComplianceItemInput[] | undefined;
  public lastComplianceUpdate: ComplianceItemUpdateInput | undefined;

  public async getApplyStudioData(opportunityId?: string): Promise<ApplyStudioData> {
    this.lastOpportunityId = opportunityId;
    return this.data;
  }

  public async upsertEvidenceItem(
    input: EvidenceItemInput,
    id?: string
  ): Promise<EvidenceItem> {
    this.lastEvidenceInput = input;
    const item: EvidenceItem = {
      id: id ?? "evidence-created",
      title: input.title,
      type: input.type,
      profileIds: input.profileIds ?? [],
      ...(input.issuer ? { issuer: input.issuer } : {}),
      ...(input.validUntil ? { validUntil: input.validUntil } : {}),
      ...(input.summary ? { summary: input.summary } : {}),
      ...(input.storageUrl ? { storageUrl: input.storageUrl } : {}),
      createdAt: "2026-07-23T00:00:00.000Z",
      updatedAt: "2026-07-23T00:00:00.000Z"
    };

    this.data = {
      ...this.data,
      evidenceItems: [
        item,
        ...this.data.evidenceItems.filter((existing) => existing.id !== item.id)
      ]
    };

    return item;
  }

  public async ensureComplianceItems(
    opportunityId: string,
    inputs: ComplianceItemInput[]
  ): Promise<ComplianceItem[]> {
    this.lastOpportunityId = opportunityId;
    this.lastComplianceInputs = inputs;

    const items = inputs.map((input, index): ComplianceItem => {
      return {
        id: `compliance-created-${index + 1}`,
        opportunityId,
        requirementType: input.requirementType,
        requirement: input.requirement,
        status: input.status ?? "missing",
        evidenceItemIds: input.evidenceItemIds ?? [],
        ...(input.owner ? { owner: input.owner } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
        createdAt: "2026-07-23T00:00:00.000Z",
        updatedAt: "2026-07-23T00:00:00.000Z"
      };
    });

    this.data = {
      ...this.data,
      complianceItems: [...this.data.complianceItems, ...items]
    };

    return items;
  }

  public async updateComplianceItem(
    id: string,
    input: ComplianceItemUpdateInput
  ): Promise<ComplianceItem> {
    this.lastComplianceUpdate = input;
    const existing = this.data.complianceItems.find((item) => item.id === id);
    if (!existing) {
      throw new Error("not found");
    }

    const updated: ComplianceItem = {
      ...existing,
      ...(input.status ? { status: input.status } : {}),
      ...("owner" in input ? { owner: input.owner } : {}),
      ...(input.evidenceItemIds ? { evidenceItemIds: input.evidenceItemIds } : {}),
      ...("notes" in input ? { notes: input.notes } : {}),
      updatedAt: "2026-07-23T00:00:00.000Z"
    };

    this.data = {
      ...this.data,
      complianceItems: this.data.complianceItems.map((item) =>
        item.id === id ? updated : item
      )
    };

    return updated;
  }
}

class FakeAuthRepository implements AuthRepositoryPort {
  public readonly sessions = new Map<string, AuthSession>();
  public preferences: UserPreferences = {
    locale: "en",
    theme: "light",
    selectedProfileIds: ["software-development", "hardware-supply"],
    selectedCountryCodes: ["BG"],
    includeInternationalSources: false,
    selectedInternationalSourceIds: defaultInternationalSourceIds
  };
  public user: AuthUser | undefined;

  public async findUserByEmail(email: string): Promise<AuthUser | undefined> {
    return this.user?.email === email ? this.user : undefined;
  }

  public async upsertUser(input: AuthUserInput): Promise<AuthenticatedUser> {
    this.user = {
      id: "user-1",
      email: input.email,
      passwordHash: input.passwordHash,
      role: input.role
    };

    return {
      id: this.user.id,
      email: this.user.email,
      role: this.user.role
    };
  }

  public async createSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date
  ): Promise<AuthSession> {
    if (!this.user || this.user.id !== userId) {
      throw new Error("missing user");
    }

    const session: AuthSession = {
      user: {
        id: this.user.id,
        email: this.user.email,
        role: this.user.role
      },
      expiresAt: expiresAt.toISOString()
    };
    this.sessions.set(tokenHash, session);

    return session;
  }

  public async findSessionByTokenHash(
    tokenHash: string
  ): Promise<AuthSession | undefined> {
    return this.sessions.get(tokenHash);
  }

  public async revokeSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  public async pruneExpiredSessions(): Promise<void> {}

  public async getPreferences(userId: string): Promise<UserPreferences> {
    if (!this.user || this.user.id !== userId) {
      throw new Error("missing user");
    }

    return this.preferences;
  }

  public async savePreferences(
    userId: string,
    input: UserPreferencesInput
  ): Promise<UserPreferences> {
    if (!this.user || this.user.id !== userId) {
      throw new Error("missing user");
    }

    this.preferences = {
      locale: input.locale ?? this.preferences.locale,
      theme: input.theme ?? this.preferences.theme,
      selectedProfileIds: input.selectedProfileIds ?? this.preferences.selectedProfileIds,
      selectedCountryCodes:
        input.selectedCountryCodes ?? this.preferences.selectedCountryCodes,
      includeInternationalSources:
        input.includeInternationalSources ?? this.preferences.includeInternationalSources,
      selectedInternationalSourceIds:
        input.selectedInternationalSourceIds ??
        this.preferences.selectedInternationalSourceIds
    };

    return this.preferences;
  }
}

describe("api server", () => {
  it("returns health status", async () => {
    const server = buildServer({
      opportunities: new FakeOpportunityRepository()
    });

    const response = await server.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });

    await server.close();
  });

  it("returns liveness and readiness status", async () => {
    const server = buildServer({
      opportunities: new FakeOpportunityRepository()
    });

    const live = await server.inject({
      method: "GET",
      url: "/live"
    });
    const ready = await server.inject({
      method: "GET",
      url: "/ready"
    });

    expect(live.statusCode).toBe(200);
    expect(ready.statusCode).toBe(200);

    await server.close();
  });

  it("lists opportunities with parsed filters", async () => {
    const repository = new FakeOpportunityRepository();
    const server = buildServer({
      opportunities: repository
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/opportunities?status=open&source=ted&minScore=50&minAiBusinessFit=75&minAiReadiness=70&minAiCommercial=60&minAiConfidence=80&limit=25&buyer=Agency&cpvPrefix=722&deadlineTo=2026-08-31&profileIds=hardware-supply,cybersecurity&countryCodes=BG,RO&includeInternationalSources=true&selectedInternationalSourceIds=eu-ted,worldbank"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [opportunity] });
    expect(repository.lastFilters).toEqual({
      status: "open",
      source: "ted",
      minScore: 50,
      minAiBusinessFit: 75,
      minAiReadiness: 70,
      minAiCommercial: 60,
      minAiConfidence: 80,
      limit: 25,
      profileIds: ["hardware-supply", "cybersecurity"],
      countryCodes: ["BG", "RO"],
      includeInternationalSources: true,
      selectedInternationalSourceIds: ["eu-ted", "worldbank"],
      buyer: "Agency",
      cpvPrefix: "722",
      deadlineTo: "2026-08-31"
    });

    await server.close();
  });

  it("returns business profiles", async () => {
    const server = buildServer({
      opportunities: new FakeOpportunityRepository()
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/profiles"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "software-development",
          name: "Software Development"
        }),
        expect.objectContaining({
          id: "hardware-supply",
          name: "Hardware Supply"
        })
      ])
    );

    await server.close();
  });

  it("returns the procurement dashboard", async () => {
    const repository = new FakeOpportunityRepository();
    const server = buildServer({
      opportunities: repository
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/dashboard?countryCodes=BG,GR"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: dashboard });
    expect(repository.lastDashboardFilters).toEqual({
      profileIds: ["software-development", "hardware-supply"],
      countryCodes: ["BG", "GR"],
      includeInternationalSources: false,
      selectedInternationalSourceIds: defaultInternationalSourceIds
    });

    await server.close();
  });

  it("returns opportunity details", async () => {
    const server = buildServer({
      opportunities: new FakeOpportunityRepository()
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/opportunities/opportunity-1"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: opportunityDetail });

    await server.close();
  });

  it("returns 404 for missing opportunity details", async () => {
    const server = buildServer({
      opportunities: new FakeOpportunityRepository()
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/opportunities/missing"
    });

    expect(response.statusCode).toBe(404);

    await server.close();
  });

  it("saves opportunity pipeline state", async () => {
    const repository = new FakeOpportunityRepository();
    const server = buildServer({
      opportunities: repository
    });

    const response = await server.inject({
      method: "PUT",
      url: "/api/opportunities/opportunity-1/pipeline",
      payload: {
        stage: "preparing",
        owner: "Dimitar",
        nextAction: "Prepare questions",
        dueDate: "2026-08-01",
        decisionReason: "Strong software profile"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        stage: "preparing",
        owner: "Dimitar",
        nextAction: "Prepare questions",
        dueDate: "2026-08-01",
        decisionReason: "Strong software profile"
      }
    });
    expect(repository.lastPipelineInput).toEqual({
      stage: "preparing",
      owner: "Dimitar",
      nextAction: "Prepare questions",
      dueDate: "2026-08-01",
      decisionReason: "Strong software profile"
    });

    await server.close();
  });

  it("lists and saves alert rules", async () => {
    const alertRules = new FakeAlertRuleRepository();
    const server = buildServer({
      opportunities: new FakeOpportunityRepository(),
      alertRules
    });

    const createResponse = await server.inject({
      method: "POST",
      url: "/api/alerts/rules",
      payload: {
        name: "High score software",
        profileId: "software-development",
        minScore: 75,
        cpvPrefix: "722",
        deadlineDays: 10,
        channel: "email",
        target: "alerts@example.test",
        enabled: true
      }
    });
    const listResponse = await server.inject({
      method: "GET",
      url: "/api/alerts/rules"
    });

    expect(createResponse.statusCode).toBe(200);
    expect(createResponse.json().data).toMatchObject({
      id: "alert-rule-1",
      name: "High score software",
      profileId: "software-development",
      minScore: 75,
      cpvPrefix: "722",
      deadlineDays: 10,
      channel: "email",
      target: "alerts@example.test",
      enabled: true
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().data).toHaveLength(1);
    expect(alertRules.lastInput).toEqual({
      name: "High score software",
      profileId: "software-development",
      minScore: 75,
      cpvPrefix: "722",
      deadlineDays: 10,
      channel: "email",
      target: "alerts@example.test",
      enabled: true
    });

    await server.close();
  });

  it("reads Apply Studio data for an opportunity", async () => {
    const applyStudio = new FakeApplyStudioRepository();
    const server = buildServer({
      opportunities: new FakeOpportunityRepository(),
      applyStudio
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/apply-studio?opportunityId=opportunity-1"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: applyStudio.data });
    expect(applyStudio.lastOpportunityId).toBe(opportunity.id);

    await server.close();
  });

  it("saves evidence items", async () => {
    const applyStudio = new FakeApplyStudioRepository();
    const server = buildServer({
      opportunities: new FakeOpportunityRepository(),
      applyStudio
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/evidence",
      payload: {
        title: "Reference from ministry project",
        type: "reference",
        profileIds: ["software-development"],
        issuer: "Ministry",
        validUntil: "2027-07-23",
        summary: "Delivery reference for a public sector web platform.",
        storageUrl: "https://example.test/reference.pdf"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      id: "evidence-created",
      title: "Reference from ministry project",
      type: "reference",
      profileIds: ["software-development"],
      issuer: "Ministry",
      validUntil: "2027-07-23"
    });
    expect(applyStudio.lastEvidenceInput).toEqual({
      title: "Reference from ministry project",
      type: "reference",
      profileIds: ["software-development"],
      issuer: "Ministry",
      validUntil: "2027-07-23",
      summary: "Delivery reference for a public sector web platform.",
      storageUrl: "https://example.test/reference.pdf"
    });

    await server.close();
  });

  it("creates and updates compliance items without clearing evidence links", async () => {
    const applyStudio = new FakeApplyStudioRepository();
    const server = buildServer({
      opportunities: new FakeOpportunityRepository(),
      applyStudio
    });

    const createResponse = await server.inject({
      method: "POST",
      url: "/api/opportunities/opportunity-1/compliance",
      payload: {
        items: [
          {
            requirementType: "required-document",
            requirement: "Technical proposal",
            status: "in-progress",
            owner: "Dimitar",
            evidenceItemIds: ["evidence-1"],
            notes: "Draft in progress."
          }
        ]
      }
    });
    const updateResponse = await server.inject({
      method: "PATCH",
      url: "/api/compliance/compliance-1",
      payload: {
        status: "ready"
      }
    });

    expect(createResponse.statusCode).toBe(200);
    expect(createResponse.json().data).toMatchObject([
      {
        opportunityId: opportunity.id,
        requirementType: "required-document",
        requirement: "Technical proposal",
        status: "in-progress",
        evidenceItemIds: ["evidence-1"]
      }
    ]);
    expect(applyStudio.lastComplianceInputs).toEqual([
      {
        requirementType: "required-document",
        requirement: "Technical proposal",
        status: "in-progress",
        owner: "Dimitar",
        evidenceItemIds: ["evidence-1"],
        notes: "Draft in progress."
      }
    ]);
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().data).toMatchObject({
      id: "compliance-1",
      status: "ready",
      evidenceItemIds: ["evidence-1"]
    });
    expect(applyStudio.lastComplianceUpdate).toEqual({
      status: "ready"
    });

    await server.close();
  });

  it("rejects invalid pipeline state", async () => {
    const server = buildServer({
      opportunities: new FakeOpportunityRepository()
    });

    const response = await server.inject({
      method: "PUT",
      url: "/api/opportunities/opportunity-1/pipeline",
      payload: {
        stage: "invalid"
      }
    });

    expect(response.statusCode).toBe(400);

    await server.close();
  });

  it("returns 503 when opportunity storage fails", async () => {
    const server = buildServer({
      opportunities: new FailingOpportunityRepository()
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/opportunities"
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "Opportunity storage unavailable" });

    await server.close();
  });

  it("requires authentication for protected API routes when auth is configured", async () => {
    const server = buildServer({
      opportunities: new FakeOpportunityRepository(),
      auth: new FakeAuthRepository()
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/opportunities"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Authentication required" });

    await server.close();
  });

  it("logs in, reads the session, and logs out", async () => {
    const auth = new FakeAuthRepository();
    await auth.upsertUser({
      email: "admin@example.test",
      passwordHash: await hashPassword("valid-password"),
      role: "admin"
    });
    const server = buildServer({
      opportunities: new FakeOpportunityRepository(),
      auth
    });

    const loginResponse = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "ADMIN@example.test",
        password: "valid-password"
      }
    });
    const cookieHeader = readSetCookieHeader(loginResponse.headers["set-cookie"]);
    const sessionResponse = await server.inject({
      method: "GET",
      url: "/api/auth/session",
      headers: {
        cookie: cookieHeader
      }
    });
    const protectedResponse = await server.inject({
      method: "GET",
      url: "/api/opportunities",
      headers: {
        cookie: cookieHeader
      }
    });
    const logoutResponse = await server.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: {
        cookie: cookieHeader
      }
    });
    const rejectedAfterLogout = await server.inject({
      method: "GET",
      url: "/api/opportunities",
      headers: {
        cookie: cookieHeader
      }
    });

    expect(loginResponse.statusCode).toBe(200);
    expect(cookieHeader).toContain("public_scanner_session=");
    expect(sessionResponse.statusCode).toBe(200);
    expect(sessionResponse.json().data.user).toEqual({
      id: "user-1",
      email: "admin@example.test",
      role: "admin"
    });
    expect(protectedResponse.statusCode).toBe(200);
    expect(logoutResponse.statusCode).toBe(200);
    expect(rejectedAfterLogout.statusCode).toBe(401);

    await server.close();
  });

  it("reads and saves authenticated profile preferences", async () => {
    const auth = new FakeAuthRepository();
    await auth.upsertUser({
      email: "admin@example.test",
      passwordHash: await hashPassword("valid-password"),
      role: "admin"
    });
    const server = buildServer({
      opportunities: new FakeOpportunityRepository(),
      auth
    });

    const loginResponse = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "admin@example.test",
        password: "valid-password"
      }
    });
    const cookieHeader = readSetCookieHeader(loginResponse.headers["set-cookie"]);
    const initialResponse = await server.inject({
      method: "GET",
      url: "/api/preferences",
      headers: {
        cookie: cookieHeader
      }
    });
    const updateResponse = await server.inject({
      method: "PUT",
      url: "/api/preferences",
      headers: {
        cookie: cookieHeader
      },
      payload: {
        locale: "bg",
        theme: "dark",
        selectedProfileIds: ["hardware-supply", "networking"],
        selectedCountryCodes: ["BG", "RO"],
        includeInternationalSources: true,
        selectedInternationalSourceIds: ["eu-ted", "worldbank"]
      }
    });
    const invalidResponse = await server.inject({
      method: "PUT",
      url: "/api/preferences",
      headers: {
        cookie: cookieHeader
      },
      payload: {
        selectedProfileIds: []
      }
    });

    expect(initialResponse.statusCode).toBe(200);
    expect(initialResponse.json().data).toEqual({
      locale: "en",
      theme: "light",
      selectedProfileIds: ["software-development", "hardware-supply"],
      selectedCountryCodes: ["BG"],
      includeInternationalSources: false,
      selectedInternationalSourceIds: defaultInternationalSourceIds
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().data).toEqual({
      locale: "bg",
      theme: "dark",
      selectedProfileIds: ["hardware-supply", "networking"],
      selectedCountryCodes: ["BG", "RO"],
      includeInternationalSources: true,
      selectedInternationalSourceIds: ["eu-ted", "worldbank"]
    });
    expect(invalidResponse.statusCode).toBe(400);

    await server.close();
  });
});

function readSetCookieHeader(header: number | string | string[] | undefined): string {
  if (Array.isArray(header)) {
    return header[0] ?? "";
  }

  return String(header ?? "");
}

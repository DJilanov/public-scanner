import {
  AlertRuleRepository,
  ApplyStudioRepository,
  AuthRepository,
  createDatabasePool,
  isValidSource,
  OpportunityRepository,
  type AlertRuleRepositoryPort,
  type ApplyStudioRepositoryPort,
  type AuthRepositoryPort,
  type AuthSession,
  type AuthenticatedUser,
  type ComplianceItemUpdateInput,
  type PipelineStateInput,
  type OpportunityListFilters,
  type OpportunityRepositoryPort,
  type UserPreferences,
  type UserPreferencesInput
} from "@public-scanner/db";
import {
  BUSINESS_PROFILES,
  buildTenderDocumentPackage,
  DEFAULT_SELECTED_COUNTRY_CODES,
  INTERNATIONAL_SOURCE_IDS,
  normalizeCountryCode,
  normalizeSourceIds,
  type AlertChannel,
  type AlertRuleInput,
  type ApplicationStage,
  type BusinessProfileId,
  type ComplianceItemInput,
  type ComplianceRequirementType,
  type ComplianceStatus,
  type DocumentIntelligence,
  type EvidenceItemInput,
  type EvidenceType,
  type Opportunity,
  type OpportunityDetail,
  type OpportunityKind,
  type OpportunityStatus,
  type ProcurementDashboard,
  type SupportedCountryCode
} from "@public-scanner/domain";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { pathToFileURL } from "node:url";

import {
  createSessionToken,
  hashSessionToken,
  isValidEmail,
  normalizeLoginEmail,
  SESSION_COOKIE_NAME,
  verifyPassword
} from "./auth.js";

export interface ServerOptions {
  opportunities?: OpportunityRepositoryPort;
  alertRules?: AlertRuleRepositoryPort;
  applyStudio?: ApplyStudioRepositoryPort;
  auth?: AuthRepositoryPort | false;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface PreferencePayload {
  locale?: unknown;
  theme?: unknown;
  selectedProfileIds?: unknown;
  selectedCountryCodes?: unknown;
  includeInternationalSources?: unknown;
  selectedInternationalSourceIds?: unknown;
}

const DEFAULT_USER_PREFERENCES: UserPreferences = {
  locale: "en",
  theme: "light",
  selectedProfileIds: ["software-development", "hardware-supply"],
  selectedCountryCodes: DEFAULT_SELECTED_COUNTRY_CODES,
  includeInternationalSources: false,
  selectedInternationalSourceIds: INTERNATIONAL_SOURCE_IDS
};

const PUBLIC_API_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session"
]);

export function buildServer(options: ServerOptions = {}): FastifyInstance {
  const pool = options.opportunities ? undefined : createDatabasePool();
  const opportunities = options.opportunities ?? new OpportunityRepository(pool!);
  const alertRules =
    options.alertRules ?? (pool ? new AlertRuleRepository(pool) : undefined);
  const applyStudio =
    options.applyStudio ?? (pool ? new ApplyStudioRepository(pool) : undefined);
  const auth =
    options.auth === false
      ? undefined
      : (options.auth ?? (pool ? new AuthRepository(pool) : undefined));
  const server = Fastify({
    logger: true
  });

  if (pool) {
    server.addHook("onClose", async () => {
      await pool.end();
    });
  }

  server.get("/live", async () => ({
    status: "ok"
  }));

  server.get("/ready", async (_request, reply) => {
    const ready = await isReady(pool);
    if (!ready) {
      return reply.status(503).send({ status: "unavailable" });
    }

    return { status: "ok" };
  });

  server.get("/health", async (_request, reply) => {
    const ready = await isReady(pool);
    if (!ready) {
      return reply.status(503).send({ status: "unavailable" });
    }

    return { status: "ok" };
  });

  server.addHook("preHandler", async (request, reply) => {
    if (!hasTrustedOrigin(request)) {
      return reply.status(403).send({ error: "Invalid request origin" });
    }

    if (!auth || !isProtectedApiPath(request.url)) {
      return;
    }

    try {
      const session = await readSession(auth, request.headers.cookie);
      if (!session) {
        return reply.status(401).send({ error: "Authentication required" });
      }
    } catch (error) {
      request.log.error({ error }, "Failed to read auth session");
      return reply.status(503).send({ error: "Authentication storage unavailable" });
    }
  });

  server.get("/api/auth/session", async (request, reply) => {
    if (!auth) {
      return {
        data: {
          user: {
            id: "local",
            email: "local@public-scanner.internal",
            role: "admin"
          } satisfies AuthenticatedUser
        }
      };
    }

    try {
      const session = await readSession(auth, request.headers.cookie);
      if (!session) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      return { data: session };
    } catch (error) {
      request.log.error({ error }, "Failed to read auth session");
      return reply.status(503).send({ error: "Authentication storage unavailable" });
    }
  });

  server.get("/api/preferences", async (request, reply) => {
    if (!auth) {
      return { data: DEFAULT_USER_PREFERENCES };
    }

    try {
      const session = await readSession(auth, request.headers.cookie);
      if (!session) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      return { data: await auth.getPreferences(session.user.id) };
    } catch (error) {
      request.log.error({ error }, "Failed to read user preferences");
      return reply.status(503).send({ error: "Preference storage unavailable" });
    }
  });

  server.put("/api/preferences", async (request, reply) => {
    const input = parsePreferencePayload(request.body);
    if (!input) {
      return reply.status(400).send({ error: "Invalid preference payload" });
    }

    if (!auth) {
      return {
        data: {
          ...DEFAULT_USER_PREFERENCES,
          ...input
        }
      };
    }

    try {
      const session = await readSession(auth, request.headers.cookie);
      if (!session) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      return { data: await auth.savePreferences(session.user.id, input) };
    } catch (error) {
      request.log.error({ error }, "Failed to save user preferences");
      return reply.status(503).send({ error: "Preference storage unavailable" });
    }
  });

  server.post("/api/auth/login", async (request, reply) => {
    if (!auth) {
      return reply.status(501).send({ error: "Authentication is not configured" });
    }

    const payload = parseLoginPayload(request.body);
    if (!payload) {
      return reply.status(400).send({ error: "Invalid login payload" });
    }

    try {
      const user = await auth.findUserByEmail(payload.email);
      const passwordMatches = user
        ? await verifyPassword(payload.password, user.passwordHash)
        : false;

      if (!user || !passwordMatches) {
        return reply.status(401).send({ error: "Invalid email or password" });
      }

      const token = createSessionToken();
      const expiresAt = getSessionExpiry();
      const session = await auth.createSession(
        user.id,
        hashSessionToken(token),
        expiresAt
      );

      await auth.pruneExpiredSessions();

      return reply
        .header("Set-Cookie", serializeSessionCookie(token, expiresAt))
        .send({ data: session });
    } catch (error) {
      request.log.error({ error }, "Failed to log in");
      return reply.status(503).send({ error: "Authentication storage unavailable" });
    }
  });

  server.post("/api/auth/logout", async (request, reply) => {
    if (auth) {
      const token = getCookieValue(request.headers.cookie, SESSION_COOKIE_NAME);
      if (token) {
        try {
          await auth.revokeSession(hashSessionToken(token));
        } catch (error) {
          request.log.error({ error }, "Failed to revoke auth session");
          return reply.status(503).send({ error: "Authentication storage unavailable" });
        }
      }
    }

    return reply
      .header("Set-Cookie", serializeExpiredSessionCookie())
      .send({ data: { ok: true } });
  });

  server.get("/api/opportunities", async (request, reply) => {
    const queryFilters = parseOpportunityFilters(
      request.query as Record<string, string | undefined>
    );

    try {
      const preferences = await readRequestPreferences(auth, request.headers.cookie);
      if (!preferences) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      const filters = applyPreferenceFilters(queryFilters, preferences);

      return {
        data: await opportunities.list(filters)
      };
    } catch (error) {
      request.log.error({ error }, "Failed to list opportunities");
      return reply.status(503).send({ error: "Opportunity storage unavailable" });
    }
  });

  server.get("/api/profiles", async () => ({
    data: BUSINESS_PROFILES
  }));

  server.get("/api/dashboard", async (request, reply) => {
    try {
      const preferences = await readRequestPreferences(auth, request.headers.cookie);
      if (!preferences) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      const filters = applyPreferenceFilters(
        parseOpportunityFilters(request.query as Record<string, string | undefined>),
        preferences
      );

      return {
        data: opportunities.getDashboard
          ? await opportunities.getDashboard(filters)
          : buildFallbackDashboard(
              await opportunities.list({ ...filters, status: "open", limit: 250 })
            )
      };
    } catch (error) {
      request.log.error({ error }, "Failed to read dashboard");
      return reply.status(503).send({ error: "Dashboard storage unavailable" });
    }
  });

  server.get("/api/apply-studio", async (request, reply) => {
    if (!applyStudio) {
      return reply.status(501).send({ error: "Apply Studio storage is not configured" });
    }

    const query = request.query as { opportunityId?: string };

    try {
      return {
        data: await applyStudio.getApplyStudioData(query.opportunityId)
      };
    } catch (error) {
      request.log.error({ error }, "Failed to read Apply Studio data");
      return reply.status(503).send({ error: "Apply Studio storage unavailable" });
    }
  });

  server.post("/api/evidence", async (request, reply) => {
    if (!applyStudio) {
      return reply.status(501).send({ error: "Apply Studio storage is not configured" });
    }

    const parsed = parseEvidencePayload(request.body);
    if (!parsed) {
      return reply.status(400).send({ error: "Invalid evidence payload" });
    }

    try {
      return {
        data: await applyStudio.upsertEvidenceItem(parsed.input, parsed.id)
      };
    } catch (error) {
      request.log.error({ error }, "Failed to save evidence item");
      return reply.status(503).send({ error: "Evidence storage unavailable" });
    }
  });

  server.get("/api/alerts/rules", async (_request, reply) => {
    if (!alertRules) {
      return reply.status(501).send({ error: "Alert rule storage is not configured" });
    }

    try {
      return {
        data: await alertRules.listRules()
      };
    } catch (error) {
      server.log.error({ error }, "Failed to list alert rules");
      return reply.status(503).send({ error: "Alert storage unavailable" });
    }
  });

  server.post("/api/alerts/rules", async (request, reply) => {
    if (!alertRules) {
      return reply.status(501).send({ error: "Alert rule storage is not configured" });
    }

    const parsed = parseAlertRulePayload(request.body);
    if (!parsed) {
      return reply.status(400).send({ error: "Invalid alert rule payload" });
    }

    try {
      return {
        data: await alertRules.upsertRule(parsed.input, parsed.id)
      };
    } catch (error) {
      request.log.error({ error }, "Failed to save alert rule");
      return reply.status(503).send({ error: "Alert storage unavailable" });
    }
  });

  server.get("/api/opportunities/:id", async (request, reply) => {
    const params = request.params as { id?: string };
    if (!params.id) {
      return reply.status(400).send({ error: "Missing opportunity id" });
    }

    let detail: OpportunityDetail | undefined;
    try {
      if (opportunities.getDetailById) {
        detail = await opportunities.getDetailById(params.id);
      } else {
        const opportunity = await opportunities.getById(params.id);
        detail = opportunity ? buildEmptyOpportunityDetail(opportunity) : undefined;
      }
    } catch (error) {
      request.log.error({ error }, "Failed to read opportunity");
      return reply.status(503).send({ error: "Opportunity storage unavailable" });
    }

    if (!detail) {
      return reply.status(404).send({ error: "Opportunity not found" });
    }

    return { data: detail };
  });

  server.put("/api/opportunities/:id/pipeline", async (request, reply) => {
    const params = request.params as { id?: string };
    if (!params.id) {
      return reply.status(400).send({ error: "Missing opportunity id" });
    }

    if (!opportunities.savePipelineState) {
      return reply.status(501).send({ error: "Pipeline storage is not configured" });
    }

    const input = parsePipelineStateInput(request.body);
    if (!input) {
      return reply.status(400).send({ error: "Invalid pipeline payload" });
    }

    try {
      const opportunity = await opportunities.getById(params.id);
      if (!opportunity) {
        return reply.status(404).send({ error: "Opportunity not found" });
      }

      return {
        data: await opportunities.savePipelineState(params.id, input)
      };
    } catch (error) {
      request.log.error({ error }, "Failed to save pipeline state");
      return reply.status(503).send({ error: "Opportunity storage unavailable" });
    }
  });

  server.post("/api/opportunities/:id/compliance", async (request, reply) => {
    const params = request.params as { id?: string };
    if (!params.id) {
      return reply.status(400).send({ error: "Missing opportunity id" });
    }

    if (!applyStudio) {
      return reply.status(501).send({ error: "Apply Studio storage is not configured" });
    }

    const inputs = parseComplianceItemsPayload(request.body);
    if (!inputs) {
      return reply.status(400).send({ error: "Invalid compliance payload" });
    }

    try {
      const opportunity = await opportunities.getById(params.id);
      if (!opportunity) {
        return reply.status(404).send({ error: "Opportunity not found" });
      }

      return {
        data: await applyStudio.ensureComplianceItems(params.id, inputs)
      };
    } catch (error) {
      request.log.error({ error }, "Failed to save compliance items");
      return reply.status(503).send({ error: "Compliance storage unavailable" });
    }
  });

  server.patch("/api/compliance/:id", async (request, reply) => {
    const params = request.params as { id?: string };
    if (!params.id) {
      return reply.status(400).send({ error: "Missing compliance item id" });
    }

    if (!applyStudio) {
      return reply.status(501).send({ error: "Apply Studio storage is not configured" });
    }

    const input = parseComplianceUpdatePayload(request.body);
    if (!input) {
      return reply.status(400).send({ error: "Invalid compliance update payload" });
    }

    try {
      return {
        data: await applyStudio.updateComplianceItem(params.id, input)
      };
    } catch (error) {
      request.log.error({ error }, "Failed to update compliance item");
      return reply.status(503).send({ error: "Compliance storage unavailable" });
    }
  });

  return server;
}

async function readSession(
  auth: AuthRepositoryPort,
  cookieHeader: string | undefined
): Promise<AuthSession | undefined> {
  const token = getCookieValue(cookieHeader, SESSION_COOKIE_NAME);
  if (!token) {
    return undefined;
  }

  return auth.findSessionByTokenHash(hashSessionToken(token));
}

async function readRequestPreferences(
  auth: AuthRepositoryPort | undefined,
  cookieHeader: string | undefined
): Promise<UserPreferences | undefined> {
  if (!auth) {
    return DEFAULT_USER_PREFERENCES;
  }

  const session = await readSession(auth, cookieHeader);
  return session ? auth.getPreferences(session.user.id) : undefined;
}

function applyPreferenceFilters(
  filters: OpportunityListFilters,
  preferences: UserPreferences
): OpportunityListFilters {
  return {
    ...filters,
    profileIds: filters.profileIds?.length
      ? filters.profileIds
      : preferences.selectedProfileIds,
    countryCodes: filters.countryCodes?.length
      ? filters.countryCodes
      : preferences.selectedCountryCodes,
    includeInternationalSources:
      filters.includeInternationalSources ?? preferences.includeInternationalSources,
    selectedInternationalSourceIds: filters.selectedInternationalSourceIds?.length
      ? filters.selectedInternationalSourceIds
      : preferences.selectedInternationalSourceIds
  };
}

function parseLoginPayload(body: unknown): LoginPayload | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const payload = body as Record<string, unknown>;
  if (typeof payload.email !== "string" || typeof payload.password !== "string") {
    return undefined;
  }

  const email = normalizeLoginEmail(payload.email);
  if (!isValidEmail(email) || payload.password.length === 0) {
    return undefined;
  }

  return {
    email,
    password: payload.password
  };
}

function isProtectedApiPath(url: string): boolean {
  const path = getPathname(url);

  return path.startsWith("/api/") && !PUBLIC_API_PATHS.has(path);
}

function getPathname(url: string): string {
  try {
    return new URL(url, "http://localhost").pathname;
  } catch {
    return url.split("?")[0] ?? url;
  }
}

function hasTrustedOrigin(request: FastifyRequest): boolean {
  if (
    request.method === "GET" ||
    request.method === "HEAD" ||
    request.method === "OPTIONS"
  ) {
    return true;
  }

  const origin = request.headers.origin;
  if (!origin) {
    return true;
  }

  const host = request.headers.host;
  if (!host) {
    return false;
  }

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function getCookieValue(
  cookieHeader: string | undefined,
  name: string
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return undefined;
}

function serializeSessionCookie(token: string, expiresAt: Date): string {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

  return serializeCookie(SESSION_COOKIE_NAME, token, {
    expires: expiresAt,
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production"
  });
}

function serializeExpiredSessionCookie(): string {
  return serializeCookie(SESSION_COOKIE_NAME, "", {
    expires: new Date(0),
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production"
  });
}

interface CookieOptions {
  expires: Date;
  httpOnly: boolean;
  maxAge: number;
  path: string;
  sameSite: "Lax";
  secure: boolean;
}

function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${options.maxAge}`,
    `Expires=${options.expires.toUTCString()}`,
    `Path=${options.path}`,
    `SameSite=${options.sameSite}`
  ];

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function getSessionExpiry(): Date {
  const ttlDays = Number(process.env.SESSION_TTL_DAYS ?? 14);
  const safeDays = Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : 14;

  return new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);
}

function buildEmptyOpportunityDetail(opportunity: Opportunity): OpportunityDetail {
  const documentIntelligence: DocumentIntelligence = {
    status: "not-available",
    eligibilityCriteria: [],
    requiredDocuments: [],
    certifications: [],
    risks: []
  };

  return {
    opportunity,
    lots: [],
    contracts: [],
    amendments: [],
    documentIntelligence,
    documentPackage: buildTenderDocumentPackage({
      opportunity,
      documentIntelligence
    }),
    competitorInsights: []
  };
}

function buildFallbackDashboard(opportunities: Opportunity[]): ProcurementDashboard {
  return {
    pipeline: [],
    documents: opportunities.map((opportunity) => {
      const documentIntelligence: DocumentIntelligence = {
        status: "not-available",
        eligibilityCriteria: [],
        requiredDocuments: [],
        certifications: [],
        risks: []
      };

      return {
        opportunity,
        documentIntelligence,
        documentPackage: buildTenderDocumentPackage({
          opportunity,
          documentIntelligence
        })
      };
    }),
    contracts: [],
    buyers: [],
    suppliers: [],
    sources: []
  };
}

function parsePipelineStateInput(body: unknown): PipelineStateInput | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const input = body as Record<string, unknown>;
  if (!isValidApplicationStage(input.stage)) {
    return undefined;
  }

  const dueDate = normalizeOptionalString(input.dueDate);
  if (dueDate && !isValidDate(dueDate)) {
    return undefined;
  }

  return {
    stage: input.stage,
    ...optionalStringProperty("owner", input.owner),
    ...optionalStringProperty("notes", input.notes),
    ...optionalStringProperty("nextAction", input.nextAction),
    ...(dueDate ? { dueDate } : {}),
    ...optionalStringProperty("decisionReason", input.decisionReason)
  };
}

function parseAlertRulePayload(
  body: unknown
): { input: AlertRuleInput; id?: string } | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const payload = body as Record<string, unknown>;
  const name = normalizeOptionalString(payload.name);
  if (!name) {
    return undefined;
  }

  const minScore = normalizeScore(payload.minScore);
  if (minScore === undefined) {
    return undefined;
  }

  const profileIdInput = normalizeOptionalString(payload.profileId);
  let profileId: BusinessProfileId | undefined;
  if (profileIdInput) {
    if (!isValidBusinessProfileId(profileIdInput)) {
      return undefined;
    }

    profileId = profileIdInput;
  }

  const cpvPrefix = normalizeOptionalString(payload.cpvPrefix);
  const normalizedCpvPrefix = cpvPrefix ? normalizeCpvPrefix(cpvPrefix) : undefined;
  const deadlineDays = normalizePositiveInteger(payload.deadlineDays);
  const channel = isValidAlertChannel(payload.channel) ? payload.channel : "email";
  const enabled = typeof payload.enabled === "boolean" ? payload.enabled : true;
  const id = normalizeOptionalString(payload.id);

  return {
    ...(id ? { id } : {}),
    input: {
      name,
      minScore,
      channel,
      enabled,
      ...(profileId ? { profileId } : {}),
      ...optionalStringProperty("watchedBuyer", payload.watchedBuyer),
      ...(normalizedCpvPrefix ? { cpvPrefix: normalizedCpvPrefix } : {}),
      ...(deadlineDays !== undefined ? { deadlineDays } : {}),
      ...optionalStringProperty("target", payload.target)
    }
  };
}

function parseEvidencePayload(
  body: unknown
): { input: EvidenceItemInput; id?: string } | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const payload = body as Record<string, unknown>;
  const title = normalizeOptionalString(payload.title);
  if (!title || !isValidEvidenceType(payload.type)) {
    return undefined;
  }

  const profileIds = parseBusinessProfileIdsAllowEmpty(payload.profileIds);
  if (payload.profileIds !== undefined && !profileIds) {
    return undefined;
  }

  const validUntil = normalizeOptionalString(payload.validUntil);
  if (validUntil && !isValidDate(validUntil)) {
    return undefined;
  }

  const id = normalizeOptionalString(payload.id);

  return {
    ...(id ? { id } : {}),
    input: {
      title,
      type: payload.type,
      ...(profileIds ? { profileIds } : {}),
      ...optionalStringProperty("issuer", payload.issuer),
      ...(validUntil ? { validUntil } : {}),
      ...optionalStringProperty("summary", payload.summary),
      ...optionalStringProperty("storageUrl", payload.storageUrl)
    }
  };
}

function parseComplianceItemsPayload(body: unknown): ComplianceItemInput[] | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const payload = body as Record<string, unknown>;
  const rawItems = Array.isArray(payload.items) ? payload.items : [payload];
  const items: ComplianceItemInput[] = [];

  for (const rawItem of rawItems) {
    const item = parseComplianceItemInput(rawItem);
    if (!item) {
      return undefined;
    }

    items.push(item);
  }

  return items.length > 0 ? items : undefined;
}

function parseComplianceItemInput(rawItem: unknown): ComplianceItemInput | undefined {
  if (!rawItem || typeof rawItem !== "object") {
    return undefined;
  }

  const payload = rawItem as Record<string, unknown>;
  const requirement = normalizeOptionalString(payload.requirement);
  if (!requirement || !isValidComplianceRequirementType(payload.requirementType)) {
    return undefined;
  }

  const evidenceItemIds =
    payload.evidenceItemIds === undefined
      ? undefined
      : parseStringListAllowEmpty(payload.evidenceItemIds);
  if (payload.evidenceItemIds !== undefined && evidenceItemIds === undefined) {
    return undefined;
  }

  if (payload.status !== undefined && !isValidComplianceStatus(payload.status)) {
    return undefined;
  }

  return {
    requirementType: payload.requirementType,
    requirement,
    ...(isValidComplianceStatus(payload.status) ? { status: payload.status } : {}),
    ...optionalStringProperty("owner", payload.owner),
    ...(evidenceItemIds !== undefined ? { evidenceItemIds } : {}),
    ...optionalStringProperty("notes", payload.notes)
  };
}

function parseComplianceUpdatePayload(
  body: unknown
): ComplianceItemUpdateInput | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const payload = body as Record<string, unknown>;
  const evidenceItemIds =
    payload.evidenceItemIds === undefined
      ? undefined
      : parseStringListAllowEmpty(payload.evidenceItemIds);
  if (payload.evidenceItemIds !== undefined && evidenceItemIds === undefined) {
    return undefined;
  }

  if (payload.status !== undefined && !isValidComplianceStatus(payload.status)) {
    return undefined;
  }

  const input: ComplianceItemUpdateInput = {
    ...(isValidComplianceStatus(payload.status) ? { status: payload.status } : {}),
    ...(payload.owner !== undefined
      ? { owner: normalizeOptionalString(payload.owner) ?? "" }
      : {}),
    ...(evidenceItemIds !== undefined ? { evidenceItemIds } : {}),
    ...(payload.notes !== undefined
      ? { notes: normalizeOptionalString(payload.notes) ?? "" }
      : {})
  };

  return Object.keys(input).length > 0 ? input : undefined;
}

function optionalStringProperty<K extends string>(
  key: K,
  value: unknown
): { [P in K]: string } | Record<string, never> {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return {};
  }

  return {
    [key]: normalized
  } as { [P in K]: string };
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function parseOpportunityFilters(
  query: Record<string, string | undefined>
): OpportunityListFilters {
  const limit = query.limit ? parsePositiveInteger(query.limit) : undefined;
  const minScore = query.minScore ? parsePositiveInteger(query.minScore) : undefined;
  const profileIds = parseBusinessProfileIds(query.profileIds);
  const countryCodes = query.countryCodes
    ? parseCountryCodes(query.countryCodes)
    : undefined;
  const sourceIds = query.sourceIds ? parseSourceIds(query.sourceIds) : undefined;
  const selectedInternationalSourceIds = query.selectedInternationalSourceIds
    ? parseInternationalSourceIds(query.selectedInternationalSourceIds)
    : undefined;
  const opportunityKinds = query.opportunityKinds
    ? parseOpportunityKinds(query.opportunityKinds)
    : undefined;
  const includeInternationalSources =
    query.includeInternationalSources === "true"
      ? true
      : query.includeInternationalSources === "false"
        ? false
        : undefined;

  return {
    ...(query.status && isValidStatus(query.status) ? { status: query.status } : {}),
    ...(query.source && isValidSource(query.source) ? { source: query.source } : {}),
    ...(query.search ? { search: query.search } : {}),
    ...(query.buyer ? { buyer: query.buyer } : {}),
    ...(query.cpvPrefix ? { cpvPrefix: normalizeCpvPrefix(query.cpvPrefix) } : {}),
    ...(query.deadlineFrom && isValidDate(query.deadlineFrom)
      ? { deadlineFrom: query.deadlineFrom }
      : {}),
    ...(query.deadlineTo && isValidDate(query.deadlineTo)
      ? { deadlineTo: query.deadlineTo }
      : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(minScore !== undefined ? { minScore } : {}),
    ...(profileIds ? { profileIds } : {}),
    ...(countryCodes ? { countryCodes } : {}),
    ...(sourceIds ? { sourceIds } : {}),
    ...(includeInternationalSources !== undefined ? { includeInternationalSources } : {}),
    ...(selectedInternationalSourceIds ? { selectedInternationalSourceIds } : {}),
    ...(opportunityKinds ? { opportunityKinds } : {})
  };
}

function parsePreferencePayload(payload: unknown): UserPreferencesInput | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const input = payload as PreferencePayload;
  const selectedProfileIds = Array.isArray(input.selectedProfileIds)
    ? parseBusinessProfileIds(input.selectedProfileIds)
    : undefined;
  const selectedCountryCodes =
    input.selectedCountryCodes !== undefined
      ? parseCountryCodes(input.selectedCountryCodes)
      : undefined;
  const selectedInternationalSourceIds =
    input.selectedInternationalSourceIds !== undefined
      ? parseInternationalSourceIds(input.selectedInternationalSourceIds)
      : undefined;

  if (input.selectedProfileIds !== undefined && !selectedProfileIds) {
    return undefined;
  }

  if (input.selectedCountryCodes !== undefined && !selectedCountryCodes) {
    return undefined;
  }

  if (
    input.selectedInternationalSourceIds !== undefined &&
    !selectedInternationalSourceIds
  ) {
    return undefined;
  }

  if (input.locale !== undefined && !isValidLocalePreference(input.locale)) {
    return undefined;
  }

  if (input.theme !== undefined && !isValidThemePreference(input.theme)) {
    return undefined;
  }

  if (
    input.includeInternationalSources !== undefined &&
    typeof input.includeInternationalSources !== "boolean"
  ) {
    return undefined;
  }

  return {
    ...(isValidLocalePreference(input.locale) ? { locale: input.locale } : {}),
    ...(isValidThemePreference(input.theme) ? { theme: input.theme } : {}),
    ...(selectedProfileIds ? { selectedProfileIds } : {}),
    ...(selectedCountryCodes ? { selectedCountryCodes } : {}),
    ...(typeof input.includeInternationalSources === "boolean"
      ? { includeInternationalSources: input.includeInternationalSources }
      : {}),
    ...(selectedInternationalSourceIds ? { selectedInternationalSourceIds } : {})
  };
}

function parseBusinessProfileIds(value: unknown): BusinessProfileId[] | undefined {
  const values =
    typeof value === "string" ? value.split(",") : Array.isArray(value) ? value : [];
  const selectedProfileIds: BusinessProfileId[] = [];

  for (const entry of values) {
    if (typeof entry !== "string") {
      return undefined;
    }

    const profileId = entry.trim();
    if (!profileId) {
      continue;
    }

    if (!isValidBusinessProfileId(profileId)) {
      return undefined;
    }

    if (!selectedProfileIds.includes(profileId)) {
      selectedProfileIds.push(profileId);
    }
  }

  return selectedProfileIds.length > 0 ? selectedProfileIds : undefined;
}

function parseCountryCodes(value: unknown): SupportedCountryCode[] | undefined {
  const values = parseDelimitedStringList(value);
  if (!values || values.length === 0) {
    return undefined;
  }

  const countryCodes: SupportedCountryCode[] = [];
  for (const entry of values) {
    const countryCode = normalizeCountryCode(entry);
    if (!countryCode) {
      return undefined;
    }

    if (!countryCodes.includes(countryCode)) {
      countryCodes.push(countryCode);
    }
  }

  return countryCodes.length > 0 ? countryCodes : undefined;
}

function parseSourceIds(value: unknown): string[] | undefined {
  const values = parseDelimitedStringList(value);
  if (!values || values.length === 0) {
    return undefined;
  }

  const normalized = normalizeSourceIds(values);
  return normalized.length === values.length ? normalized : undefined;
}

function parseInternationalSourceIds(value: unknown): string[] | undefined {
  const sourceIds = parseSourceIds(value);
  if (!sourceIds) {
    return undefined;
  }

  return sourceIds.every((sourceId) => INTERNATIONAL_SOURCE_IDS.includes(sourceId))
    ? sourceIds
    : undefined;
}

function parseOpportunityKinds(value: unknown): OpportunityKind[] | undefined {
  const values = parseDelimitedStringList(value);
  if (!values || values.length === 0) {
    return undefined;
  }

  const opportunityKinds: OpportunityKind[] = [];
  for (const entry of values) {
    if (!isValidOpportunityKind(entry)) {
      return undefined;
    }

    if (!opportunityKinds.includes(entry)) {
      opportunityKinds.push(entry);
    }
  }

  return opportunityKinds.length > 0 ? opportunityKinds : undefined;
}

function parseDelimitedStringList(value: unknown): string[] | undefined {
  const rawValues =
    typeof value === "string" ? value.split(",") : Array.isArray(value) ? value : [];
  const values: string[] = [];

  for (const entry of rawValues) {
    if (typeof entry !== "string") {
      return undefined;
    }

    const normalized = entry.trim();
    if (!normalized) {
      continue;
    }

    if (!values.includes(normalized)) {
      values.push(normalized);
    }
  }

  return values;
}

function parseBusinessProfileIdsAllowEmpty(
  value: unknown
): BusinessProfileId[] | undefined {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const profileIds: BusinessProfileId[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !isValidBusinessProfileId(entry)) {
      return undefined;
    }

    if (!profileIds.includes(entry)) {
      profileIds.push(entry);
    }
  }

  return profileIds;
}

function parseStringListAllowEmpty(value: unknown): string[] | undefined {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const values: string[] = [];
  for (const entry of value) {
    const normalized = normalizeOptionalString(entry);
    if (!normalized) {
      return undefined;
    }

    if (!values.includes(normalized)) {
      values.push(normalized);
    }
  }

  return values;
}

function parsePositiveInteger(value: string): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function isValidStatus(value: string): value is OpportunityStatus {
  return ["forthcoming", "open", "closed", "awarded", "cancelled", "unknown"].includes(
    value
  );
}

function isValidApplicationStage(value: unknown): value is ApplicationStage {
  return (
    typeof value === "string" &&
    [
      "watching",
      "reviewing",
      "preparing",
      "submitted",
      "won",
      "lost",
      "archived"
    ].includes(value)
  );
}

function isValidBusinessProfileId(value: string): value is BusinessProfileId {
  return BUSINESS_PROFILES.some((profile) => profile.id === value);
}

function isValidLocalePreference(value: unknown): value is UserPreferences["locale"] {
  return value === "en" || value === "bg";
}

function isValidThemePreference(value: unknown): value is UserPreferences["theme"] {
  return value === "light" || value === "dark";
}

function isValidOpportunityKind(value: string): value is OpportunityKind {
  return ["procurement", "funding", "framework", "award", "market-consultation"].includes(
    value
  );
}

function isValidAlertChannel(value: unknown): value is AlertChannel {
  return typeof value === "string" && ["email", "webhook", "slack"].includes(value);
}

function isValidEvidenceType(value: unknown): value is EvidenceType {
  return (
    typeof value === "string" &&
    [
      "certificate",
      "reference",
      "team-cv",
      "vendor-authorization",
      "company-document",
      "methodology",
      "other"
    ].includes(value)
  );
}

function isValidComplianceRequirementType(
  value: unknown
): value is ComplianceRequirementType {
  return (
    typeof value === "string" &&
    ["eligibility", "required-document", "certification", "risk"].includes(value)
  );
}

function isValidComplianceStatus(value: unknown): value is ComplianceStatus {
  return (
    typeof value === "string" &&
    ["missing", "in-progress", "ready", "not-applicable", "blocked"].includes(value)
  );
}

function normalizeScore(value: unknown): number | undefined {
  const parsed = normalizePositiveInteger(value);
  if (parsed === undefined || parsed > 100) {
    return undefined;
  }

  return parsed;
}

function normalizePositiveInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    return parsePositiveInteger(value);
  }

  return undefined;
}

function normalizeCpvPrefix(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

async function isReady(
  pool: ReturnType<typeof createDatabasePool> | undefined
): Promise<boolean> {
  if (!pool) {
    return true;
  }

  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function start(): Promise<void> {
  const server = buildServer();
  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);
  const host = process.env.API_HOST ?? "0.0.0.0";

  await server.listen({ host, port });
}

const entryPoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (import.meta.url === entryPoint || process.env.pm_id !== undefined) {
  start().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

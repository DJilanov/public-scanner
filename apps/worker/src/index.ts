import {
  buildBulgarianSoftwareTedQuery,
  CaisOpenDataClient,
  TED_SOFTWARE_FIELDS,
  TedClient,
  type CaisOpenDataFile,
  type TedSearchResponse
} from "@public-scanner/connectors";
import {
  buildDocumentIntelligence,
  normalizeCaisTenderRecord,
  normalizeCaisAnnexRecord,
  normalizeCaisContractRecord,
  normalizeOcdsLots,
  normalizeTedNoticeRecord,
  scoreNormalizedOpportunity,
  type NormalizedContract,
  type NormalizedContractAmendment,
  type NormalizedOpportunityWithScore,
  type NormalizedOpportunityLot,
  type ProcurementSource,
  type SourceRunSummary
} from "@public-scanner/domain";
import {
  createDatabasePool,
  createSourceRun,
  finishSourceRun,
  insertRawDocument,
  insertSourceError,
  OpportunityRepository,
  runMigrations,
  summarizeRunStatus,
  upsertContract,
  upsertContractAmendment,
  upsertDocumentIntelligence,
  upsertOpportunityLot,
  type DocumentIntelligenceInput,
  type IngestionWriteResult,
  type RawDocumentInput,
  type SourceErrorInput,
  type SourceRunCompletionInput,
  type SourceRunInput,
  type UpsertOpportunityResult
} from "@public-scanner/db";
import { pathToFileURL } from "node:url";

export interface CaisDailyClient {
  listDailyFiles(sourceDate: string): Promise<CaisOpenDataFile[]>;
  downloadJsonFile(file: CaisOpenDataFile): Promise<unknown>;
}

export interface TedNoticeClient {
  searchAllNotices(
    request: {
      query: string;
      fields: string[];
      limit?: number;
      scope?: "ACTIVE" | "ALL";
      onlyLatestVersions?: boolean;
      paginationMode?: "PAGE_NUMBER" | "ITERATION";
    },
    options?: { maxPages?: number }
  ): Promise<TedSearchResponse>;
}

export interface IngestionStore {
  createSourceRun(input: SourceRunInput): Promise<string>;
  finishSourceRun(sourceRunId: string, input: SourceRunCompletionInput): Promise<void>;
  insertRawDocument(input: RawDocumentInput): Promise<string>;
  insertSourceError(input: SourceErrorInput): Promise<void>;
  upsertOpportunity(
    opportunity: NormalizedOpportunityWithScore,
    rawDocumentId?: string
  ): Promise<UpsertOpportunityResult>;
  upsertDocumentIntelligence?(
    opportunityId: string,
    input: DocumentIntelligenceInput
  ): Promise<void>;
  upsertLot(lot: NormalizedOpportunityLot): Promise<IngestionWriteResult | undefined>;
  upsertContract(
    contract: NormalizedContract,
    rawDocumentId?: string
  ): Promise<IngestionWriteResult>;
  upsertContractAmendment(
    amendment: NormalizedContractAmendment,
    rawDocumentId?: string
  ): Promise<IngestionWriteResult>;
  close?(): Promise<void>;
}

export interface WorkerRunOptions {
  sourceDate?: string;
  now?: Date;
  caisClient?: CaisDailyClient;
  tedClient?: TedNoticeClient;
  store?: IngestionStore;
  includeCais?: boolean;
  includeTed?: boolean;
  tedMaxPages?: number;
  runMigrations?: boolean;
}

export interface WorkerRunResult {
  cais?: SourceRunSummary;
  ted?: SourceRunSummary;
  tedQuery?: string;
}

export interface WorkerBackfillOptions extends Omit<WorkerRunOptions, "sourceDate"> {
  sourceDates: string[];
}

interface IngestSourceOptions {
  sourceDate: string;
  now: Date;
  store: IngestionStore;
}

interface MutableRunCounts {
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
}

export async function runOnce(options: WorkerRunOptions = {}): Promise<WorkerRunResult> {
  const now = options.now ?? new Date();
  const sourceDate = options.sourceDate ?? getPreviousDateIso(now);
  const store =
    options.store ??
    (isDryRun()
      ? new DryRunIngestionStore()
      : await createPostgresIngestionStore({
          runMigrations: options.runMigrations ?? true
        }));

  try {
    const result: WorkerRunResult = {};

    if (options.includeCais ?? true) {
      result.cais = await ingestCais({
        sourceDate,
        now,
        store,
        client: options.caisClient ?? new CaisOpenDataClient()
      });
    }

    if (options.includeTed ?? true) {
      const tedQuery = buildBulgarianSoftwareTedQuery(sourceDate.replaceAll("-", ""));
      result.tedQuery = tedQuery;
      result.ted = await ingestTed({
        sourceDate,
        now,
        store,
        query: tedQuery,
        client: options.tedClient ?? new TedClient(),
        ...(options.tedMaxPages !== undefined ? { maxPages: options.tedMaxPages } : {})
      });
    }

    return result;
  } finally {
    if (!options.store) {
      await store.close?.();
    }
  }
}

export async function runBackfill(
  options: WorkerBackfillOptions
): Promise<WorkerRunResult[]> {
  const store =
    options.store ??
    (isDryRun()
      ? new DryRunIngestionStore()
      : await createPostgresIngestionStore({
          runMigrations: options.runMigrations ?? true
        }));
  const results: WorkerRunResult[] = [];

  try {
    for (const sourceDate of options.sourceDates) {
      results.push(
        await runOnce({
          ...options,
          sourceDate,
          store,
          runMigrations: false
        })
      );
    }

    return results;
  } finally {
    if (!options.store) {
      await store.close?.();
    }
  }
}

export async function ingestCais(
  options: IngestSourceOptions & { client: CaisDailyClient }
): Promise<SourceRunSummary> {
  const source: ProcurementSource = "cais-eop";
  const sourceRunId = await options.store.createSourceRun({
    source,
    sourceDate: options.sourceDate
  });
  const counts = emptyCounts();
  let errorMessage: string | undefined;

  try {
    const files = sortCaisFiles(await options.client.listDailyFiles(options.sourceDate));
    counts.fetchedCount = files.length;

    for (const file of files) {
      try {
        const payload = await options.client.downloadJsonFile(file);
        const rawDocumentId = await options.store.insertRawDocument({
          sourceRunId,
          source,
          sourceDate: options.sourceDate,
          sourceUrl: file.url,
          contentType: "application/json",
          payload
        });

        if (file.kind === "tenders") {
          await persistOpportunities({
            source,
            payload,
            rawDocumentId,
            counts,
            now: options.now,
            normalize: (record) =>
              normalizeCaisTenderRecord(record, { now: options.now }),
            context: file.key,
            store: options.store
          });
        } else if (file.kind === "contracts") {
          await persistContracts({
            payload,
            rawDocumentId,
            counts,
            context: file.key,
            store: options.store
          });
        } else if (file.kind === "annexes") {
          await persistContractAmendments({
            payload,
            rawDocumentId,
            counts,
            context: file.key,
            store: options.store
          });
        } else if (file.kind === "ocds-notices") {
          await persistLots({
            lots: normalizeOcdsLots(payload),
            counts,
            context: file.key,
            store: options.store
          });
        }
      } catch (error) {
        counts.failedCount += 1;
        errorMessage = getErrorMessage(error);
        await recordSourceError(options.store, {
          sourceRunId,
          source,
          sourceDate: options.sourceDate,
          context: file.key,
          errorMessage
        });
      }
    }
  } catch (error) {
    counts.failedCount += 1;
    errorMessage = getErrorMessage(error);
    await recordSourceError(options.store, {
      sourceRunId,
      source,
      sourceDate: options.sourceDate,
      context: "cais-file-listing",
      errorMessage
    });
  }

  await finishRun(options.store, sourceRunId, counts, errorMessage);
  return toSummary(source, options.sourceDate, counts);
}

export async function ingestTed(
  options: IngestSourceOptions & {
    client: TedNoticeClient;
    query: string;
    maxPages?: number;
  }
): Promise<SourceRunSummary> {
  const source: ProcurementSource = "ted";
  const sourceRunId = await options.store.createSourceRun({
    source,
    sourceDate: options.sourceDate
  });
  const counts = emptyCounts();
  let errorMessage: string | undefined;

  try {
    const response = await options.client.searchAllNotices(
      {
        query: options.query,
        fields: [...TED_SOFTWARE_FIELDS],
        limit: 250,
        scope: "ACTIVE",
        onlyLatestVersions: true,
        paginationMode: "ITERATION"
      },
      options.maxPages !== undefined ? { maxPages: options.maxPages } : {}
    );
    counts.fetchedCount = response.notices.length;
    const rawDocumentId = await options.store.insertRawDocument({
      sourceRunId,
      source,
      sourceDate: options.sourceDate,
      sourceUrl: "https://api.ted.europa.eu/v3/notices/search",
      contentType: "application/json",
      payload: {
        request: {
          query: options.query,
          fields: TED_SOFTWARE_FIELDS
        },
        response
      }
    });

    await persistOpportunities({
      source,
      payload: response.notices,
      rawDocumentId,
      counts,
      now: options.now,
      normalize: (record) => normalizeTedNoticeRecord(record, { now: options.now }),
      context: "ted-notice",
      store: options.store
    });
  } catch (error) {
    counts.failedCount += 1;
    errorMessage = getErrorMessage(error);
    await recordSourceError(options.store, {
      sourceRunId,
      source,
      sourceDate: options.sourceDate,
      context: "ted-search",
      errorMessage,
      payload: {
        query: options.query
      }
    });
  }

  await finishRun(options.store, sourceRunId, counts, errorMessage);
  return toSummary(source, options.sourceDate, counts);
}

async function createPostgresIngestionStore(options: {
  runMigrations: boolean;
}): Promise<IngestionStore> {
  const pool = createDatabasePool();

  if (options.runMigrations) {
    await runMigrations(pool);
  }

  return new PostgresIngestionStore(pool);
}

class PostgresIngestionStore implements IngestionStore {
  private readonly opportunityRepository: OpportunityRepository;

  public constructor(private readonly pool: ReturnType<typeof createDatabasePool>) {
    this.opportunityRepository = new OpportunityRepository(pool);
  }

  public createSourceRun(input: SourceRunInput): Promise<string> {
    return createSourceRun(this.pool, input);
  }

  public finishSourceRun(
    sourceRunId: string,
    input: SourceRunCompletionInput
  ): Promise<void> {
    return finishSourceRun(this.pool, sourceRunId, input);
  }

  public insertRawDocument(input: RawDocumentInput): Promise<string> {
    return insertRawDocument(this.pool, input);
  }

  public insertSourceError(input: SourceErrorInput): Promise<void> {
    return insertSourceError(this.pool, input);
  }

  public upsertOpportunity(
    opportunity: NormalizedOpportunityWithScore,
    rawDocumentId?: string
  ): Promise<UpsertOpportunityResult> {
    return this.opportunityRepository.upsertScored(opportunity, rawDocumentId);
  }

  public upsertDocumentIntelligence(
    opportunityId: string,
    input: DocumentIntelligenceInput
  ): Promise<void> {
    return upsertDocumentIntelligence(this.pool, opportunityId, input);
  }

  public upsertLot(
    lot: NormalizedOpportunityLot
  ): Promise<IngestionWriteResult | undefined> {
    return upsertOpportunityLot(this.pool, lot);
  }

  public upsertContract(
    contract: NormalizedContract,
    rawDocumentId?: string
  ): Promise<IngestionWriteResult> {
    return upsertContract(this.pool, contract, rawDocumentId);
  }

  public upsertContractAmendment(
    amendment: NormalizedContractAmendment,
    rawDocumentId?: string
  ): Promise<IngestionWriteResult> {
    return upsertContractAmendment(this.pool, amendment, rawDocumentId);
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

class DryRunIngestionStore implements IngestionStore {
  private sourceRunSequence = 0;
  private rawDocumentSequence = 0;
  private readonly opportunityIds = new Set<string>();

  public async createSourceRun(_input: SourceRunInput): Promise<string> {
    this.sourceRunSequence += 1;
    return `dry-run-source-run-${this.sourceRunSequence}`;
  }

  public async finishSourceRun(
    _sourceRunId: string,
    _input: SourceRunCompletionInput
  ): Promise<void> {
    return;
  }

  public async insertRawDocument(_input: RawDocumentInput): Promise<string> {
    this.rawDocumentSequence += 1;
    return `dry-run-raw-document-${this.rawDocumentSequence}`;
  }

  public async insertSourceError(_input: SourceErrorInput): Promise<void> {
    return;
  }

  public async upsertOpportunity(
    opportunity: NormalizedOpportunityWithScore
  ): Promise<UpsertOpportunityResult> {
    const key = `${opportunity.source}:${opportunity.externalId}`;
    const inserted = !this.opportunityIds.has(key);
    this.opportunityIds.add(key);

    return {
      id: key,
      inserted
    };
  }

  public async upsertLot(
    _lot: NormalizedOpportunityLot
  ): Promise<IngestionWriteResult | undefined> {
    return { inserted: true };
  }

  public async upsertContract(
    _contract: NormalizedContract,
    _rawDocumentId?: string
  ): Promise<IngestionWriteResult> {
    return { inserted: true };
  }

  public async upsertContractAmendment(
    _amendment: NormalizedContractAmendment,
    _rawDocumentId?: string
  ): Promise<IngestionWriteResult> {
    return { inserted: true };
  }

  public async close(): Promise<void> {
    return;
  }
}

async function persistOpportunities(input: {
  source: ProcurementSource;
  payload: unknown;
  rawDocumentId: string;
  counts: MutableRunCounts;
  now: Date;
  normalize(record: unknown): ReturnType<typeof normalizeCaisTenderRecord>;
  context: string;
  store: IngestionStore;
}): Promise<void> {
  if (!Array.isArray(input.payload)) {
    input.counts.skippedCount += 1;
    return;
  }

  for (const record of input.payload) {
    try {
      const opportunity = input.normalize(record);
      if (!opportunity) {
        input.counts.skippedCount += 1;
        continue;
      }

      const scored = scoreNormalizedOpportunity(opportunity, {
        now: input.now
      });
      const upsertResult = await input.store.upsertOpportunity(
        scored,
        input.rawDocumentId
      );
      await input.store.upsertDocumentIntelligence?.(
        upsertResult.id,
        buildDocumentIntelligence(scored, {
          now: input.now
        })
      );

      if (upsertResult.inserted) {
        input.counts.insertedCount += 1;
      } else {
        input.counts.updatedCount += 1;
      }
    } catch (error) {
      input.counts.failedCount += 1;
      await recordSourceError(input.store, {
        source: input.source,
        context: `${input.context}:record`,
        errorMessage: getErrorMessage(error),
        payload: record
      });
    }
  }
}

async function persistContracts(input: {
  payload: unknown;
  rawDocumentId: string;
  counts: MutableRunCounts;
  context: string;
  store: IngestionStore;
}): Promise<void> {
  await persistSourceRecords({
    payload: input.payload,
    counts: input.counts,
    context: input.context,
    normalize: normalizeCaisContractRecord,
    persist: (contract) => input.store.upsertContract(contract, input.rawDocumentId),
    store: input.store
  });
}

async function persistContractAmendments(input: {
  payload: unknown;
  rawDocumentId: string;
  counts: MutableRunCounts;
  context: string;
  store: IngestionStore;
}): Promise<void> {
  await persistSourceRecords({
    payload: input.payload,
    counts: input.counts,
    context: input.context,
    normalize: normalizeCaisAnnexRecord,
    persist: (amendment) =>
      input.store.upsertContractAmendment(amendment, input.rawDocumentId),
    store: input.store
  });
}

async function persistLots(input: {
  lots: NormalizedOpportunityLot[];
  counts: MutableRunCounts;
  context: string;
  store: IngestionStore;
}): Promise<void> {
  for (const lot of input.lots) {
    try {
      const result = await input.store.upsertLot(lot);
      if (!result) {
        input.counts.skippedCount += 1;
      } else if (result.inserted) {
        input.counts.insertedCount += 1;
      } else {
        input.counts.updatedCount += 1;
      }
    } catch (error) {
      input.counts.failedCount += 1;
      await recordSourceError(input.store, {
        source: lot.source,
        context: `${input.context}:lot`,
        errorMessage: getErrorMessage(error),
        payload: lot
      });
    }
  }
}

async function persistSourceRecords<T>(input: {
  payload: unknown;
  counts: MutableRunCounts;
  context: string;
  normalize(record: unknown): T | undefined;
  persist(record: T): Promise<IngestionWriteResult>;
  store: IngestionStore;
}): Promise<void> {
  if (!Array.isArray(input.payload)) {
    input.counts.skippedCount += 1;
    return;
  }

  for (const record of input.payload) {
    try {
      const normalized = input.normalize(record);
      if (!normalized) {
        input.counts.skippedCount += 1;
        continue;
      }

      const result = await input.persist(normalized);
      if (result.inserted) {
        input.counts.insertedCount += 1;
      } else {
        input.counts.updatedCount += 1;
      }
    } catch (error) {
      input.counts.failedCount += 1;
      await recordSourceError(input.store, {
        source: "cais-eop",
        context: `${input.context}:record`,
        errorMessage: getErrorMessage(error),
        payload: record
      });
    }
  }
}

async function recordSourceError(
  store: IngestionStore,
  input: SourceErrorInput
): Promise<void> {
  try {
    await store.insertSourceError(input);
  } catch {
    return;
  }
}

function sortCaisFiles(files: CaisOpenDataFile[]): CaisOpenDataFile[] {
  const priority: Record<CaisOpenDataFile["kind"], number> = {
    tenders: 1,
    "ocds-notices": 2,
    contracts: 3,
    annexes: 4,
    unknown: 5
  };

  return [...files].sort((first, second) => priority[first.kind] - priority[second.kind]);
}

async function finishRun(
  store: IngestionStore,
  sourceRunId: string,
  counts: MutableRunCounts,
  errorMessage: string | undefined
): Promise<void> {
  await store.finishSourceRun(sourceRunId, {
    ...counts,
    status: summarizeRunStatus(counts),
    ...(errorMessage ? { errorMessage } : {})
  });
}

function emptyCounts(): MutableRunCounts {
  return {
    fetchedCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    failedCount: 0
  };
}

function toSummary(
  source: ProcurementSource,
  sourceDate: string,
  counts: MutableRunCounts
): SourceRunSummary {
  return {
    source,
    sourceDate,
    ...counts
  };
}

function getPreviousDateIso(now: Date): string {
  const previousDay = new Date(now);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  return previousDay.toISOString().slice(0, 10);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown ingestion error";
}

function isDryRun(): boolean {
  return process.env.DRY_RUN === "true" || process.env.DRY_RUN === "1";
}

const entryPoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (import.meta.url === entryPoint || process.env.pm_id !== undefined) {
  runEntrypoint()
    .then((result) => {
      if (result) {
        console.info(JSON.stringify(result, null, 2));
      }
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}

async function runEntrypoint(): Promise<WorkerRunResult | WorkerRunResult[] | undefined> {
  if (process.env.WORKER_MODE === "scheduler") {
    await runSchedulerFromEnvironment();
    return undefined;
  }

  return runFromEnvironment();
}

async function runFromEnvironment(): Promise<WorkerRunResult | WorkerRunResult[]> {
  const sourceDates = getSourceDatesFromEnvironment(new Date());
  const tedMaxPages = process.env.TED_MAX_PAGES
    ? parsePositiveIntegerEnv("TED_MAX_PAGES")
    : undefined;
  const commonOptions = {
    includeCais: parseBooleanEnv("INCLUDE_CAIS", true),
    includeTed: parseBooleanEnv("INCLUDE_TED", true),
    ...(tedMaxPages !== undefined ? { tedMaxPages } : {})
  };

  if (sourceDates.length === 1) {
    const sourceDate = sourceDates[0];
    if (!sourceDate) {
      throw new Error("No source date resolved");
    }

    return runOnce({
      ...commonOptions,
      sourceDate
    });
  }

  return runBackfill({
    ...commonOptions,
    sourceDates
  });
}

async function runSchedulerFromEnvironment(): Promise<never> {
  const intervalMinutes = parsePositiveIntegerEnv("WORKER_INTERVAL_MINUTES") ?? 360;
  const intervalMs = intervalMinutes * 60 * 1000;

  for (;;) {
    const startedAt = new Date().toISOString();
    try {
      const result = await runFromEnvironment();
      console.info(JSON.stringify({ startedAt, result }, null, 2));
    } catch (error) {
      console.error(error);
    }

    await sleep(intervalMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getSourceDatesFromEnvironment(now: Date): string[] {
  if (process.env.SOURCE_DATE) {
    return [process.env.SOURCE_DATE];
  }

  if (process.env.SOURCE_DATE_FROM || process.env.SOURCE_DATE_TO) {
    const from = process.env.SOURCE_DATE_FROM ?? process.env.SOURCE_DATE_TO;
    const to = process.env.SOURCE_DATE_TO ?? process.env.SOURCE_DATE_FROM;

    if (!from || !to) {
      return [getPreviousDateIso(now)];
    }

    return enumerateDates(from, to);
  }

  const backfillDays = parsePositiveIntegerEnv("BACKFILL_DAYS") ?? 3;
  const dates: string[] = [];

  for (let offset = backfillDays; offset >= 1; offset -= 1) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - offset);
    dates.push(date.toISOString().slice(0, 10));
  }

  return dates;
}

function enumerateDates(from: string, to: string): string[] {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("SOURCE_DATE_FROM and SOURCE_DATE_TO must be YYYY-MM-DD dates");
  }

  const first = start.getTime() <= end.getTime() ? start : end;
  const last = start.getTime() <= end.getTime() ? end : start;
  const dates: string[] = [];
  const cursor = new Date(first);

  while (cursor.getTime() <= last.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function parseBooleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes"].includes(value.toLocaleLowerCase("en-US"));
}

function parsePositiveIntegerEnv(name: string): number | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
}

import {
  buildTenderDocumentPackage,
  getSourceCountryCodeForLegacySource,
  getSourceDisplayName,
  getSourceIdForLegacySource,
  normalizeCountryCode,
  normalizeSourceIds,
  SOURCE_CATALOG
} from "@public-scanner/domain";
import type {
  BuyerDashboardItem,
  ContractAmendmentSummary,
  ContractDashboardItem,
  ContractSummary,
  DocumentReviewItem,
  DocumentIntelligence,
  MatchReason,
  Money,
  NormalizedOpportunityWithScore,
  Opportunity,
  OpportunityKind,
  OpportunityDetail,
  OpportunityLot,
  PipelineDashboardItem,
  ProcurementDashboard,
  ProcurementSource,
  ProfileFitScore,
  SavedOpportunityState,
  SourceHealthItem,
  SupportedCountryCode,
  SupplierDashboardItem,
  TenderAiAnalysis
} from "@public-scanner/domain";
import type { QueryResultRow } from "pg";

import type { Queryable } from "../client.js";
import type {
  CompetitorInsightRow,
  ContractAmendmentRow,
  ContractSummaryRow,
  DocumentIntelligenceRow,
  OpportunityListFilters,
  OpportunityLotRow,
  OpportunityRepositoryPort,
  OpportunityRow,
  PipelineStateInput,
  SavedOpportunityRow,
  UpsertOpportunityResult
} from "../types.js";

interface UpsertOpportunityRow extends QueryResultRow {
  id: string;
  inserted: boolean;
}

interface DashboardDocumentColumns {
  document_status: DocumentIntelligence["status"] | null;
  document_summary: string | null;
  document_eligibility_criteria: string[] | null;
  document_required_documents: string[] | null;
  document_certifications: string[] | null;
  document_risks: string[] | null;
  document_extracted_at: Date | string | null;
  document_ai_analysis: unknown;
}

interface PipelineDashboardRow
  extends OpportunityRow, SavedOpportunityRow, DashboardDocumentColumns {}

interface DocumentReviewDashboardRow extends OpportunityRow, DashboardDocumentColumns {
  saved_stage: SavedOpportunityState["stage"] | null;
  saved_owner: string | null;
  saved_notes: string | null;
  saved_next_action: string | null;
  saved_due_date: Date | string | null;
  saved_decision_reason: string | null;
}

interface ContractDashboardRow extends QueryResultRow {
  id: string;
  source: ContractDashboardItem["source"];
  title: string;
  buyer_name: string;
  supplier_name: string | null;
  supplier_registry_number: string | null;
  contract_number: string | null;
  contract_date: Date | string | null;
  value: string | null;
  currency: string | null;
  opportunity_id: string | null;
  opportunity_title: string | null;
  cpv_codes: string[] | null;
}

interface BuyerDashboardRow extends QueryResultRow {
  buyer_name: string;
  opportunity_count: string;
  open_opportunity_count: string;
  contract_count: string;
  total_awarded_value: string | null;
  average_awarded_value: string | null;
  currency: string | null;
  last_activity_date: Date | string | null;
  top_suppliers: string[] | null;
  top_cpv_codes: string[] | null;
}

interface SupplierDashboardRow extends QueryResultRow {
  supplier_name: string;
  wins_count: string;
  buyer_count: string;
  total_value: string | null;
  average_value: string | null;
  currency: string | null;
  last_win_date: Date | string | null;
  top_buyers: string[] | null;
  top_cpv_codes: string[] | null;
}

interface SourceHealthRow extends QueryResultRow {
  source: SourceHealthItem["source"];
  source_display_name: string | null;
  source_country_code: string | null;
  status: SourceHealthItem["status"] | null;
  started_at: Date | string | null;
  finished_at: Date | string | null;
  fetched_count: number | null;
  inserted_count: number | null;
  updated_count: number | null;
  skipped_count: number | null;
  failed_count: number | null;
  recent_error_count: string | null;
  open_opportunity_count: number | null;
  high_fit_opportunity_count: number | null;
  ready_opportunity_count: number | null;
  document_url_count: number | null;
  submission_url_count: number | null;
  latest_opportunity_at: Date | string | null;
  error_message: string | null;
}

export class OpportunityRepository implements OpportunityRepositoryPort {
  public constructor(private readonly db: Queryable) {}

  public async list(filters: OpportunityListFilters = {}): Promise<Opportunity[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const profileIds = filters.profileIds?.length ? filters.profileIds : undefined;
    const profileIdsIndex = profileIds ? values.push(profileIds) : undefined;
    const selectedProfileScoreSql = profileIdsIndex
      ? `(
          SELECT MAX((profile_score->>'totalScore')::integer)
          FROM jsonb_array_elements(m.profile_scores) AS profile_score
          WHERE profile_score->>'profileId' = ANY($${profileIdsIndex}::text[])
        )`
      : "NULL::integer";
    const rankingScoreSql = `coalesce(${selectedProfileScoreSql}, m.score, 0)`;

    if (filters.status) {
      values.push(filters.status);
      conditions.push(`o.status = $${values.length}`);
    }

    if (filters.source) {
      values.push(filters.source);
      conditions.push(`o.source = $${values.length}`);
    }

    appendMarketConditions("o", filters, conditions, values);
    appendAiAnalysisConditions("o", filters, conditions, values);

    if (filters.minScore !== undefined) {
      values.push(filters.minScore);
      conditions.push(`${rankingScoreSql} >= $${values.length}`);
    }

    if (filters.search) {
      values.push(`%${filters.search}%`);
      const index = values.length;
      conditions.push(
        `(o.title ILIKE $${index} OR o.buyer_name ILIKE $${index} OR EXISTS (
          SELECT 1 FROM unnest(o.cpv_codes) AS cpv(code)
          WHERE cpv.code ILIKE replace($${index}, '%', '') || '%'
        ))`
      );
    }

    if (filters.buyer) {
      values.push(`%${filters.buyer}%`);
      conditions.push(`o.buyer_name ILIKE $${values.length}`);
    }

    if (filters.cpvPrefix) {
      values.push(`${filters.cpvPrefix}%`);
      conditions.push(`EXISTS (
        SELECT 1 FROM unnest(o.cpv_codes) AS cpv(code)
        WHERE cpv.code ILIKE $${values.length}
      )`);
    }

    if (filters.deadlineFrom) {
      values.push(filters.deadlineFrom);
      conditions.push(`o.submission_deadline >= $${values.length}`);
    }

    if (filters.deadlineTo) {
      values.push(filters.deadlineTo);
      conditions.push(`o.submission_deadline <= $${values.length}`);
    }

    values.push(clampLimit(filters.limit));
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await this.db.query<OpportunityRow>(
      `
        WITH filtered AS (
          SELECT
            o.*,
            m.score,
            m.reasons,
            m.profile_scores,
            di.ai_analysis,
            ${selectedProfileScoreSql} AS selected_profile_score,
            row_number() OVER (
              PARTITION BY o.deduplication_key
              ORDER BY
                CASE o.source
                  WHEN 'cais-eop' THEN 1
                  WHEN 'ted' THEN 2
                  ELSE 3
                END,
                ${rankingScoreSql} DESC,
                o.publication_date DESC NULLS LAST
            ) AS dedupe_rank
          FROM opportunities o
          LEFT JOIN opportunity_matches m ON m.opportunity_id = o.id
          LEFT JOIN document_intelligence di ON di.opportunity_id = o.id
          ${where}
        )
        SELECT *
        FROM filtered
        WHERE dedupe_rank = 1
        ORDER BY
          coalesce(selected_profile_score, score, 0) DESC,
          submission_deadline ASC NULLS LAST,
          publication_date DESC NULLS LAST
        LIMIT $${values.length}
      `,
      values
    );

    return result.rows.map(mapOpportunityRow);
  }

  public async getById(id: string): Promise<Opportunity | undefined> {
    const result = await this.db.query<OpportunityRow>(
      `
        SELECT
          o.*,
          m.score,
          m.reasons,
          m.profile_scores,
          di.ai_analysis
        FROM opportunities o
        LEFT JOIN opportunity_matches m ON m.opportunity_id = o.id
        LEFT JOIN document_intelligence di ON di.opportunity_id = o.id
        WHERE o.id = $1
      `,
      [id]
    );

    const row = result.rows[0];
    return row ? mapOpportunityRow(row) : undefined;
  }

  public async getDetailById(id: string): Promise<OpportunityDetail | undefined> {
    const opportunity = await this.getById(id);
    if (!opportunity) {
      return undefined;
    }

    const [
      lotsResult,
      contractsResult,
      amendmentsResult,
      savedResult,
      documentIntelligenceResult,
      competitorInsightsResult
    ] = await Promise.all([
      this.db.query<OpportunityLotRow>(
        `
          SELECT
            id,
            lot_identifier,
            title,
            cpv_codes,
            estimated_value,
            currency,
            submission_deadline
          FROM opportunity_lots
          WHERE opportunity_id = $1
          ORDER BY lot_identifier ASC NULLS LAST, title ASC NULLS LAST
        `,
        [id]
      ),
      this.db.query<ContractSummaryRow>(
        `
          SELECT
            id,
            supplier_name,
            supplier_registry_number,
            contract_number,
            contract_date,
            title,
            value,
            currency
          FROM contracts
          WHERE opportunity_id = $1
          ORDER BY contract_date DESC NULLS LAST
          LIMIT 20
        `,
        [id]
      ),
      this.db.query<ContractAmendmentRow>(
        `
          SELECT
            a.id,
            a.previous_value,
            a.current_value,
            a.currency,
            a.change_reason,
            a.change_description
          FROM contract_amendments a
          INNER JOIN contracts c ON c.id = a.contract_id
          WHERE c.opportunity_id = $1
          ORDER BY a.created_at DESC
          LIMIT 20
        `,
        [id]
      ),
      this.db.query<SavedOpportunityRow>(
        `
          SELECT
            stage,
            owner,
            notes,
            next_action,
            due_date,
            decision_reason
          FROM saved_opportunities
          WHERE opportunity_id = $1 AND user_key = 'default'
          LIMIT 1
        `,
        [id]
      ),
      this.db.query<DocumentIntelligenceRow>(
        `
          SELECT
            status,
            summary,
            eligibility_criteria,
            required_documents,
            certifications,
            risks,
            extracted_at,
            ai_analysis
          FROM document_intelligence
          WHERE opportunity_id = $1
          LIMIT 1
        `,
        [id]
      ),
      this.db.query<CompetitorInsightRow>(
        `
          SELECT
            supplier_name,
            count(*)::text AS wins_count,
            sum(value)::text AS total_value,
            currency,
            max(contract_date) AS last_win_date
          FROM contracts
          WHERE buyer_name = $1
            AND supplier_name IS NOT NULL
            AND supplier_name <> ''
          GROUP BY supplier_name, currency
          ORDER BY count(*) DESC, max(contract_date) DESC NULLS LAST
          LIMIT 8
        `,
        [opportunity.buyerName]
      )
    ]);

    const savedRow = savedResult.rows[0];
    const documentIntelligenceRow = documentIntelligenceResult.rows[0];
    const lots = lotsResult.rows.map(mapOpportunityLotRow);
    const contracts = contractsResult.rows.map(mapContractSummaryRow);
    const amendments = amendmentsResult.rows.map(mapContractAmendmentRow);
    const documentIntelligence = documentIntelligenceRow
      ? mapDocumentIntelligenceRow(documentIntelligenceRow)
      : emptyDocumentIntelligence();

    return {
      opportunity,
      lots,
      contracts,
      amendments,
      ...(savedRow ? { savedState: mapSavedOpportunityRow(savedRow) } : {}),
      documentIntelligence,
      documentPackage: buildTenderDocumentPackage({
        opportunity,
        lots,
        contracts,
        amendments,
        documentIntelligence
      }),
      competitorInsights: competitorInsightsResult.rows.map(mapCompetitorInsightRow)
    };
  }

  public async getDashboard(
    filters: OpportunityListFilters = {}
  ): Promise<ProcurementDashboard> {
    const pipelineWhere = buildOpportunityWhere(filters, "o", ["s.user_key = 'default'"]);
    const documentWhere = buildOpportunityWhere(filters, "o", [
      `(
        o.status IN ('forthcoming', 'open')
        OR s.stage IN ('watching', 'reviewing', 'preparing', 'submitted')
      )`
    ]);
    const contractWhere = buildOpportunityWhere(filters, "o");
    const buyerValues: unknown[] = [];
    const buyerOpportunityConditions: string[] = [];
    appendDashboardOpportunityConditions(
      "o",
      filters,
      buyerOpportunityConditions,
      buyerValues
    );
    const buyerContractConditions: string[] = [];
    appendDashboardOpportunityConditions(
      "o",
      filters,
      buyerContractConditions,
      buyerValues
    );
    const supplierValues: unknown[] = [];
    const supplierConditions = ["c.supplier_name IS NOT NULL", "c.supplier_name <> ''"];
    appendDashboardOpportunityConditions(
      "o",
      filters,
      supplierConditions,
      supplierValues
    );
    const sourceHealth = buildSourceHealthQuery(filters);

    const [
      pipelineResult,
      documentResult,
      contractResult,
      buyerResult,
      supplierResult,
      sourceResult
    ] = await Promise.all([
      this.db.query<PipelineDashboardRow>(
        `
          SELECT
            o.*,
            m.score,
            m.reasons,
            m.profile_scores,
            s.stage,
            s.owner,
            s.notes,
            s.next_action,
            s.due_date,
            s.decision_reason,
            di.status AS document_status,
            di.summary AS document_summary,
            di.eligibility_criteria AS document_eligibility_criteria,
            di.required_documents AS document_required_documents,
            di.certifications AS document_certifications,
            di.risks AS document_risks,
            di.extracted_at AS document_extracted_at,
            di.ai_analysis AS document_ai_analysis
          FROM saved_opportunities s
          INNER JOIN opportunities o ON o.id = s.opportunity_id
          LEFT JOIN opportunity_matches m ON m.opportunity_id = o.id
          LEFT JOIN document_intelligence di ON di.opportunity_id = o.id
          ${pipelineWhere.sql}
          ORDER BY
            CASE s.stage
              WHEN 'reviewing' THEN 1
              WHEN 'preparing' THEN 2
              WHEN 'submitted' THEN 3
              WHEN 'watching' THEN 4
              WHEN 'won' THEN 5
              WHEN 'lost' THEN 6
              ELSE 7
            END,
            s.due_date ASC NULLS LAST,
            o.submission_deadline ASC NULLS LAST,
            o.publication_date DESC NULLS LAST
          LIMIT 200
        `,
        pipelineWhere.values
      ),
      this.db.query<DocumentReviewDashboardRow>(
        `
          SELECT
            o.*,
            m.score,
            m.reasons,
            m.profile_scores,
            s.stage AS saved_stage,
            s.owner AS saved_owner,
            s.notes AS saved_notes,
            s.next_action AS saved_next_action,
            s.due_date AS saved_due_date,
            s.decision_reason AS saved_decision_reason,
            di.status AS document_status,
            di.summary AS document_summary,
            di.eligibility_criteria AS document_eligibility_criteria,
            di.required_documents AS document_required_documents,
            di.certifications AS document_certifications,
            di.risks AS document_risks,
            di.extracted_at AS document_extracted_at,
            di.ai_analysis AS document_ai_analysis
          FROM opportunities o
          LEFT JOIN opportunity_matches m ON m.opportunity_id = o.id
          LEFT JOIN saved_opportunities s
            ON s.opportunity_id = o.id AND s.user_key = 'default'
          LEFT JOIN document_intelligence di ON di.opportunity_id = o.id
          ${documentWhere.sql}
          ORDER BY
            CASE coalesce(di.status, 'not-available')
              WHEN 'failed' THEN 1
              WHEN 'pending' THEN 2
              WHEN 'not-available' THEN 3
              ELSE 4
            END,
            jsonb_array_length(coalesce(di.risks, '[]'::jsonb)) DESC,
            o.submission_deadline ASC NULLS LAST,
            coalesce(m.score, 0) DESC
          LIMIT 250
        `,
        documentWhere.values
      ),
      this.db.query<ContractDashboardRow>(
        `
          SELECT
            c.id,
            c.source,
            c.title,
            c.buyer_name,
            c.supplier_name,
            c.supplier_registry_number,
            c.contract_number,
            c.contract_date,
            c.value,
            c.currency,
            o.id AS opportunity_id,
            o.title AS opportunity_title,
            o.cpv_codes
          FROM contracts c
          LEFT JOIN opportunities o ON o.id = c.opportunity_id
          ${contractWhere.sql}
          ORDER BY c.contract_date DESC NULLS LAST, c.created_at DESC
          LIMIT 250
        `,
        contractWhere.values
      ),
      this.db.query<BuyerDashboardRow>(
        `
          WITH opportunity_stats AS (
            SELECT
              o.buyer_name,
              count(DISTINCT o.id)::text AS opportunity_count,
              count(DISTINCT o.id) FILTER (
                WHERE o.status IN ('forthcoming', 'open')
              )::text AS open_opportunity_count,
              max(coalesce(o.submission_deadline, o.publication_date, o.updated_at)) AS last_opportunity_at,
              array_remove(array_agg(DISTINCT cpv_code), NULL) AS top_cpv_codes
            FROM opportunities o
            LEFT JOIN LATERAL unnest(o.cpv_codes) AS cpv_code ON true
            ${toWhereSql(buyerOpportunityConditions)}
            GROUP BY o.buyer_name
          ),
          contract_stats AS (
            SELECT
              c.buyer_name,
              count(*)::text AS contract_count,
              CASE
                WHEN count(DISTINCT c.currency) FILTER (
                  WHERE c.value IS NOT NULL AND c.currency IS NOT NULL
                ) = 1
                THEN sum(c.value)::text
              END AS total_awarded_value,
              CASE
                WHEN count(DISTINCT c.currency) FILTER (
                  WHERE c.value IS NOT NULL AND c.currency IS NOT NULL
                ) = 1
                THEN avg(c.value)::text
              END AS average_awarded_value,
              CASE
                WHEN count(DISTINCT c.currency) FILTER (
                  WHERE c.value IS NOT NULL AND c.currency IS NOT NULL
                ) = 1
                THEN max(c.currency)
              END AS currency,
              max(c.contract_date) AS last_contract_date,
              array_remove(array_agg(DISTINCT c.supplier_name), NULL) AS top_suppliers
            FROM contracts c
            LEFT JOIN opportunities o ON o.id = c.opportunity_id
            ${toWhereSql(buyerContractConditions)}
            GROUP BY c.buyer_name
          ),
          buyers AS (
            SELECT buyer_name FROM opportunity_stats
            UNION
            SELECT buyer_name FROM contract_stats
          )
          SELECT
            b.buyer_name,
            coalesce(os.opportunity_count, '0') AS opportunity_count,
            coalesce(os.open_opportunity_count, '0') AS open_opportunity_count,
            coalesce(cs.contract_count, '0') AS contract_count,
            cs.total_awarded_value,
            cs.average_awarded_value,
            cs.currency,
            greatest(os.last_opportunity_at, cs.last_contract_date::timestamptz) AS last_activity_date,
            coalesce(cs.top_suppliers, ARRAY[]::text[]) AS top_suppliers,
            coalesce(os.top_cpv_codes, ARRAY[]::text[]) AS top_cpv_codes
          FROM buyers b
          LEFT JOIN opportunity_stats os ON os.buyer_name = b.buyer_name
          LEFT JOIN contract_stats cs ON cs.buyer_name = b.buyer_name
          ORDER BY
            coalesce(os.open_opportunity_count, '0')::integer DESC,
            coalesce(cs.contract_count, '0')::integer DESC,
            b.buyer_name ASC
          LIMIT 150
        `,
        buyerValues
      ),
      this.db.query<SupplierDashboardRow>(
        `
          SELECT
            c.supplier_name,
            count(*)::text AS wins_count,
            count(DISTINCT c.buyer_name)::text AS buyer_count,
            CASE
              WHEN count(DISTINCT c.currency) FILTER (
                WHERE c.value IS NOT NULL AND c.currency IS NOT NULL
              ) = 1
              THEN sum(c.value)::text
            END AS total_value,
            CASE
              WHEN count(DISTINCT c.currency) FILTER (
                WHERE c.value IS NOT NULL AND c.currency IS NOT NULL
              ) = 1
              THEN avg(c.value)::text
            END AS average_value,
            CASE
              WHEN count(DISTINCT c.currency) FILTER (
                WHERE c.value IS NOT NULL AND c.currency IS NOT NULL
              ) = 1
              THEN max(c.currency)
            END AS currency,
            max(c.contract_date) AS last_win_date,
            array_remove(array_agg(DISTINCT c.buyer_name), NULL) AS top_buyers,
            ARRAY(
              SELECT DISTINCT cpv_code
              FROM contracts c2
              INNER JOIN opportunities o2 ON o2.id = c2.opportunity_id
              CROSS JOIN LATERAL unnest(o2.cpv_codes) AS cpv_code
              WHERE c2.supplier_name = c.supplier_name
              LIMIT 8
            ) AS top_cpv_codes
          FROM contracts c
          LEFT JOIN opportunities o ON o.id = c.opportunity_id
          ${toWhereSql(supplierConditions)}
          GROUP BY c.supplier_name
          ORDER BY count(*) DESC, max(c.contract_date) DESC NULLS LAST
          LIMIT 150
        `,
        supplierValues
      ),
      this.db.query<SourceHealthRow>(
        `${sourceHealth.withSql}
          SELECT
            sources.source,
            sources.source_display_name,
            sources.source_country_code,
            latest.status,
            latest.started_at,
            latest.finished_at,
            latest.fetched_count,
            latest.inserted_count,
            latest.updated_count,
            latest.skipped_count,
            latest.failed_count,
            latest.error_message,
            coalesce(errors.recent_error_count, '0') AS recent_error_count,
            coalesce(metrics.open_opportunity_count, 0) AS open_opportunity_count,
            coalesce(metrics.high_fit_opportunity_count, 0) AS high_fit_opportunity_count,
            coalesce(metrics.ready_opportunity_count, 0) AS ready_opportunity_count,
            coalesce(metrics.document_url_count, 0) AS document_url_count,
            coalesce(metrics.submission_url_count, 0) AS submission_url_count,
            metrics.latest_opportunity_at
          FROM sources
          LEFT JOIN LATERAL (
            SELECT
              status,
              started_at,
              finished_at,
              fetched_count,
              inserted_count,
              updated_count,
              skipped_count,
              failed_count,
              error_message
            FROM source_runs
            WHERE source_runs.source = sources.source
               OR source_runs.source = sources.legacy_source
            ORDER BY started_at DESC
            LIMIT 1
          ) latest ON true
          LEFT JOIN LATERAL (
            SELECT count(*)::text AS recent_error_count
            FROM source_errors
            WHERE (
                source_errors.source = sources.source
                OR source_errors.source = sources.legacy_source
              )
              AND source_errors.created_at >= now() - interval '7 days'
          ) errors ON true
          LEFT JOIN LATERAL (
            SELECT
              count(*) FILTER (
                WHERE o.status IN ('forthcoming', 'open')
              )::integer AS open_opportunity_count,
              count(*) FILTER (
                WHERE o.status IN ('forthcoming', 'open')
                  AND coalesce(m.score, 0) >= 70
              )::integer AS high_fit_opportunity_count,
              count(*) FILTER (
                WHERE o.status IN ('forthcoming', 'open')
                  AND coalesce(m.score, 0) >= 70
                  AND (
                    coalesce(array_length(o.document_urls, 1), 0) > 0
                    OR coalesce(array_length(o.submission_urls, 1), 0) > 0
                  )
              )::integer AS ready_opportunity_count,
              count(*) FILTER (
                WHERE o.status IN ('forthcoming', 'open')
                  AND coalesce(array_length(o.document_urls, 1), 0) > 0
              )::integer AS document_url_count,
              count(*) FILTER (
                WHERE o.status IN ('forthcoming', 'open')
                  AND coalesce(array_length(o.submission_urls, 1), 0) > 0
              )::integer AS submission_url_count,
              max(coalesce(o.publication_date, o.updated_at)) AS latest_opportunity_at
            FROM opportunities o
            LEFT JOIN opportunity_matches m ON m.opportunity_id = o.id
            WHERE (
                ${sourceIdSql("o")} = sources.source
                OR (
                  sources.legacy_source IS NOT NULL
                  AND o.source = sources.legacy_source
                )
                OR (
                  sources.legacy_source IS NULL
                  AND sources.source_country_code IS NOT NULL
                  AND o.source = 'ted'
                  AND ${buyerCountrySql("o")} = sources.source_country_code
                )
              )
              ${sourceHealth.metricWhereSql}
          ) metrics ON true
          ORDER BY sources.source ASC
        `,
        sourceHealth.values
      )
    ]);

    return {
      pipeline: pipelineResult.rows.map(mapPipelineDashboardRow),
      documents: documentResult.rows.map(mapDocumentReviewDashboardRow),
      contracts: contractResult.rows.map(mapContractDashboardRow),
      buyers: buyerResult.rows.map(mapBuyerDashboardRow),
      suppliers: supplierResult.rows.map(mapSupplierDashboardRow),
      sources: sourceResult.rows.map(mapSourceHealthRow)
    };
  }

  public async savePipelineState(
    opportunityId: string,
    input: PipelineStateInput
  ): Promise<SavedOpportunityState> {
    const result = await this.db.query<SavedOpportunityRow>(
      `
        INSERT INTO saved_opportunities (
          opportunity_id,
          user_key,
          stage,
          owner,
          notes,
          next_action,
          due_date,
          decision_reason
        )
        VALUES ($1, 'default', $2, $3, $4, $5, $6, $7)
        ON CONFLICT (opportunity_id, user_key) DO UPDATE SET
          stage = excluded.stage,
          owner = excluded.owner,
          notes = excluded.notes,
          next_action = excluded.next_action,
          due_date = excluded.due_date,
          decision_reason = excluded.decision_reason,
          updated_at = now()
        RETURNING stage, owner, notes, next_action, due_date, decision_reason
      `,
      [
        opportunityId,
        input.stage,
        input.owner ?? null,
        input.notes ?? null,
        input.nextAction ?? null,
        input.dueDate ?? null,
        input.decisionReason ?? null
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to save opportunity pipeline state");
    }

    return mapSavedOpportunityRow(row);
  }

  public async upsertScored(
    opportunity: NormalizedOpportunityWithScore,
    rawDocumentId?: string
  ): Promise<UpsertOpportunityResult> {
    const sourceId =
      opportunity.sourceId ?? getSourceIdForLegacySource(opportunity.source);
    const sourceCountryCode =
      opportunity.sourceCountryCode ??
      getSourceCountryCodeForLegacySource(opportunity.source) ??
      null;
    const buyerCountryCode = normalizeOptionalCountryCode(opportunity.buyerCountryCode);
    const placeOfPerformanceCountryCodes = normalizeOptionalCountryCodes(
      opportunity.placeOfPerformanceCountryCodes ?? []
    );
    const opportunityKind = opportunity.opportunityKind ?? "procurement";

    const result = await this.db.query<UpsertOpportunityRow>(
      `
        INSERT INTO opportunities (
          source,
          source_id,
          source_country_code,
          place_of_performance_country_codes,
          opportunity_kind,
          language,
          external_id,
          deduplication_key,
          tender_id,
          unique_procurement_number,
          publication_number,
          title,
          description,
          buyer_name,
          buyer_registry_number,
          buyer_country_code,
          status,
          main_cpv_code,
          cpv_codes,
          cpv_description,
          estimated_value,
          currency,
          publication_date,
          submission_deadline,
          procedure_type,
          is_eu_funded,
          european_program,
          source_url,
          document_urls,
          submission_urls,
          ted_url,
          raw_document_id
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32
        )
        ON CONFLICT (source, external_id) DO UPDATE SET
          source_id = excluded.source_id,
          source_country_code = excluded.source_country_code,
          place_of_performance_country_codes = excluded.place_of_performance_country_codes,
          opportunity_kind = excluded.opportunity_kind,
          language = excluded.language,
          deduplication_key = excluded.deduplication_key,
          tender_id = excluded.tender_id,
          unique_procurement_number = excluded.unique_procurement_number,
          publication_number = excluded.publication_number,
          title = excluded.title,
          description = excluded.description,
          buyer_name = excluded.buyer_name,
          buyer_registry_number = excluded.buyer_registry_number,
          buyer_country_code = excluded.buyer_country_code,
          status = excluded.status,
          main_cpv_code = excluded.main_cpv_code,
          cpv_codes = excluded.cpv_codes,
          cpv_description = excluded.cpv_description,
          estimated_value = excluded.estimated_value,
          currency = excluded.currency,
          publication_date = excluded.publication_date,
          submission_deadline = excluded.submission_deadline,
          procedure_type = excluded.procedure_type,
          is_eu_funded = excluded.is_eu_funded,
          european_program = excluded.european_program,
          source_url = excluded.source_url,
          document_urls = excluded.document_urls,
          submission_urls = excluded.submission_urls,
          ted_url = excluded.ted_url,
          raw_document_id = excluded.raw_document_id,
          updated_at = now()
        RETURNING id, (xmax = 0) AS inserted
      `,
      [
        opportunity.source,
        sourceId,
        sourceCountryCode,
        placeOfPerformanceCountryCodes,
        opportunityKind,
        opportunity.language ?? null,
        opportunity.externalId,
        opportunity.deduplicationKey,
        opportunity.tenderId ?? null,
        opportunity.uniqueProcurementNumber ?? null,
        opportunity.publicationNumber ?? null,
        opportunity.title,
        opportunity.description ?? null,
        opportunity.buyerName,
        opportunity.buyerRegistryNumber ?? null,
        buyerCountryCode,
        opportunity.status,
        opportunity.mainCpvCode ?? opportunity.cpvCodes[0] ?? null,
        opportunity.cpvCodes,
        opportunity.cpvDescription ?? null,
        opportunity.estimatedValue?.amount ?? null,
        opportunity.estimatedValue?.currency ?? null,
        opportunity.publicationDate ?? null,
        opportunity.submissionDeadline ?? null,
        opportunity.procedureType ?? null,
        opportunity.isEuFunded ?? null,
        opportunity.europeanProgram ?? null,
        opportunity.sourceUrl,
        opportunity.documentUrls ?? [],
        opportunity.submissionUrls ?? [],
        opportunity.tedUrl ?? null,
        rawDocumentId ?? null
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to upsert opportunity");
    }

    await this.db.query(
      `
        INSERT INTO opportunity_matches (
          opportunity_id,
          score,
          reasons,
          profile_scores
        )
        VALUES ($1, $2, $3::jsonb, $4::jsonb)
        ON CONFLICT (opportunity_id) DO UPDATE SET
          score = excluded.score,
          reasons = excluded.reasons,
          profile_scores = excluded.profile_scores,
          scored_at = now()
      `,
      [
        row.id,
        opportunity.match.score,
        JSON.stringify(opportunity.match.reasons),
        JSON.stringify(opportunity.profileScores ?? [])
      ]
    );

    return {
      id: row.id,
      inserted: row.inserted
    };
  }
}

function mapOpportunityRow(row: OpportunityRow): Opportunity {
  const profileScores = mapProfileScores(row.profile_scores);
  const sourceId = row.source_id ?? getSourceIdForLegacySource(row.source);
  const sourceDisplayName = getSourceDisplayName(sourceId);
  const sourceCountryCode =
    normalizeOptionalCountryCode(row.source_country_code) ??
    getSourceCountryCodeForLegacySource(row.source);
  const buyerCountryCode = normalizeOptionalCountryCode(row.buyer_country_code);
  const placeOfPerformanceCountryCodes = normalizeOptionalCountryCodes(
    row.place_of_performance_country_codes ?? []
  );

  return {
    id: row.id,
    source: row.source,
    sourceId,
    ...(sourceDisplayName ? { sourceDisplayName } : {}),
    ...(sourceCountryCode ? { sourceCountryCode } : {}),
    ...(buyerCountryCode ? { buyerCountryCode } : {}),
    ...(placeOfPerformanceCountryCodes.length > 0
      ? { placeOfPerformanceCountryCodes }
      : {}),
    ...(row.opportunity_kind ? { opportunityKind: row.opportunity_kind } : {}),
    ...(row.language !== null ? { language: row.language } : {}),
    deduplicationKey: row.deduplication_key,
    title: row.title,
    ...(row.description !== null ? { description: row.description } : {}),
    buyerName: row.buyer_name,
    status: row.status,
    cpvCodes: row.cpv_codes,
    sourceUrl: row.source_url,
    ...(row.document_urls.length > 0 ? { documentUrls: row.document_urls } : {}),
    ...(row.submission_urls.length > 0 ? { submissionUrls: row.submission_urls } : {}),
    ...(row.publication_date
      ? { publicationDate: normalizeDbDate(row.publication_date) }
      : {}),
    ...(row.submission_deadline
      ? { submissionDeadline: normalizeDbDate(row.submission_deadline) }
      : {}),
    ...(row.estimated_value && row.currency
      ? {
          estimatedValue: {
            amount: Number(row.estimated_value),
            currency: row.currency
          }
        }
      : {}),
    ...(profileScores.length > 0 ? { profileScores } : {}),
    ...(row.is_eu_funded !== null ? { isEuFunded: row.is_eu_funded } : {}),
    ...mapOptionalAiAnalysis(row.ai_analysis),
    ...(row.score !== null
      ? {
          match: {
            score: row.score,
            reasons: Array.isArray(row.reasons) ? row.reasons : []
          }
        }
      : {})
  };
}

function mapPipelineDashboardRow(row: PipelineDashboardRow): PipelineDashboardItem {
  return {
    opportunity: mapOpportunityRow(row),
    savedState: mapSavedOpportunityRow(row),
    documentIntelligence: mapDashboardDocumentIntelligence(row)
  };
}

function mapDocumentReviewDashboardRow(
  row: DocumentReviewDashboardRow
): DocumentReviewItem {
  const opportunity = mapOpportunityRow(row);
  const documentIntelligence = mapDashboardDocumentIntelligence(row);
  const savedState = mapOptionalSavedOpportunityRow(row);

  return {
    opportunity,
    documentIntelligence,
    documentPackage: buildTenderDocumentPackage({
      opportunity,
      documentIntelligence
    }),
    ...(savedState ? { savedState } : {})
  };
}

function mapContractDashboardRow(row: ContractDashboardRow): ContractDashboardItem {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    buyerName: row.buyer_name,
    cpvCodes: row.cpv_codes ?? [],
    ...(row.supplier_name !== null ? { supplierName: row.supplier_name } : {}),
    ...(row.supplier_registry_number !== null
      ? { supplierRegistryNumber: row.supplier_registry_number }
      : {}),
    ...(row.contract_number !== null ? { contractNumber: row.contract_number } : {}),
    ...(row.contract_date ? { contractDate: normalizeDbDate(row.contract_date) } : {}),
    ...mapOptionalMoney("value", row.value, row.currency),
    ...(row.opportunity_id !== null ? { opportunityId: row.opportunity_id } : {}),
    ...(row.opportunity_title !== null ? { opportunityTitle: row.opportunity_title } : {})
  };
}

function mapBuyerDashboardRow(row: BuyerDashboardRow): BuyerDashboardItem {
  return {
    buyerName: row.buyer_name,
    opportunityCount: Number(row.opportunity_count),
    openOpportunityCount: Number(row.open_opportunity_count),
    contractCount: Number(row.contract_count),
    topSuppliers: safeStringArray(row.top_suppliers).slice(0, 8),
    topCpvCodes: safeStringArray(row.top_cpv_codes).slice(0, 8),
    ...mapOptionalMoney("totalAwardedValue", row.total_awarded_value, row.currency),
    ...mapOptionalMoney("averageAwardedValue", row.average_awarded_value, row.currency),
    ...(row.last_activity_date
      ? { lastActivityDate: normalizeDbDate(row.last_activity_date) }
      : {})
  };
}

function mapSupplierDashboardRow(row: SupplierDashboardRow): SupplierDashboardItem {
  return {
    supplierName: row.supplier_name,
    winsCount: Number(row.wins_count),
    buyerCount: Number(row.buyer_count),
    topBuyers: safeStringArray(row.top_buyers).slice(0, 8),
    topCpvCodes: safeStringArray(row.top_cpv_codes).slice(0, 8),
    ...mapOptionalMoney("totalValue", row.total_value, row.currency),
    ...mapOptionalMoney("averageValue", row.average_value, row.currency),
    ...(row.last_win_date ? { lastWinDate: normalizeDbDate(row.last_win_date) } : {})
  };
}

function mapSourceHealthRow(row: SourceHealthRow): SourceHealthItem {
  const sourceCountryCode = normalizeOptionalCountryCode(row.source_country_code);
  const fetchedCount = row.fetched_count ?? 0;
  const insertedCount = row.inserted_count ?? 0;
  const updatedCount = row.updated_count ?? 0;
  const skippedCount = row.skipped_count ?? 0;
  const failedCount = row.failed_count ?? 0;
  const recentErrorCount = Number(row.recent_error_count ?? 0);
  const openOpportunityCount = row.open_opportunity_count ?? 0;
  const highFitOpportunityCount = row.high_fit_opportunity_count ?? 0;
  const readyOpportunityCount = row.ready_opportunity_count ?? 0;
  const documentUrlCount = row.document_url_count ?? 0;
  const submissionUrlCount = row.submission_url_count ?? 0;
  const latestOpportunityAt = row.latest_opportunity_at
    ? normalizeDbDate(row.latest_opportunity_at)
    : undefined;

  return {
    source: row.source,
    ...(row.source_display_name !== null
      ? { sourceDisplayName: row.source_display_name }
      : {}),
    ...(sourceCountryCode ? { sourceCountryCode } : {}),
    fetchedCount,
    insertedCount,
    updatedCount,
    skippedCount,
    failedCount,
    recentErrorCount,
    openOpportunityCount,
    highFitOpportunityCount,
    readyOpportunityCount,
    documentUrlCount,
    submissionUrlCount,
    readinessScore: calculateSourceReadinessScore({
      status: row.status,
      failedCount,
      recentErrorCount,
      openOpportunityCount,
      highFitOpportunityCount,
      readyOpportunityCount,
      documentUrlCount,
      submissionUrlCount,
      ...(latestOpportunityAt ? { latestOpportunityAt } : {})
    }),
    ...(row.status ? { status: row.status } : {}),
    ...(row.started_at ? { startedAt: normalizeDbDate(row.started_at) } : {}),
    ...(row.finished_at ? { finishedAt: normalizeDbDate(row.finished_at) } : {}),
    ...(latestOpportunityAt ? { latestOpportunityAt } : {}),
    ...(row.error_message !== null ? { errorMessage: row.error_message } : {})
  };
}

function calculateSourceReadinessScore(input: {
  status: SourceHealthItem["status"] | null;
  failedCount: number;
  recentErrorCount: number;
  openOpportunityCount: number;
  highFitOpportunityCount: number;
  readyOpportunityCount: number;
  documentUrlCount: number;
  submissionUrlCount: number;
  latestOpportunityAt?: string;
}): number {
  let score = 0;

  if (input.status === "succeeded") {
    score += 30;
  } else if (input.status === "running" || input.status === "partial") {
    score += 18;
  } else if (!input.status) {
    score += 8;
  }

  if (input.failedCount === 0 && input.recentErrorCount === 0) {
    score += 15;
  } else if (input.recentErrorCount <= 2) {
    score += 8;
  }

  if (input.latestOpportunityAt) {
    const ageMs = Date.now() - new Date(input.latestOpportunityAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays <= 7) {
      score += 20;
    } else if (ageDays <= 30) {
      score += 12;
    } else {
      score += 5;
    }
  }

  if (input.openOpportunityCount > 0) {
    score += 10;
  }

  if (input.highFitOpportunityCount > 0) {
    score += 10;
  }

  if (input.readyOpportunityCount > 0) {
    score += 10;
  } else if (input.openOpportunityCount > 0) {
    const linkCoverage =
      (input.documentUrlCount + input.submissionUrlCount) /
      Math.max(input.openOpportunityCount * 2, 1);
    score += Math.round(Math.min(linkCoverage, 1) * 10);
  }

  return Math.min(score, 100);
}

function mapDashboardDocumentIntelligence(
  row: DashboardDocumentColumns
): DocumentIntelligence {
  if (!row.document_status) {
    return emptyDocumentIntelligence();
  }

  return {
    status: row.document_status,
    eligibilityCriteria: safeStringArray(row.document_eligibility_criteria),
    requiredDocuments: safeStringArray(row.document_required_documents),
    certifications: safeStringArray(row.document_certifications),
    risks: safeStringArray(row.document_risks),
    ...(row.document_summary !== null ? { summary: row.document_summary } : {}),
    ...(row.document_extracted_at
      ? { extractedAt: normalizeDbDate(row.document_extracted_at) }
      : {}),
    ...mapOptionalAiAnalysis(row.document_ai_analysis)
  };
}

function mapOptionalSavedOpportunityRow(
  row: DocumentReviewDashboardRow
): SavedOpportunityState | undefined {
  if (!row.saved_stage) {
    return undefined;
  }

  return {
    stage: row.saved_stage,
    ...(row.saved_owner !== null ? { owner: row.saved_owner } : {}),
    ...(row.saved_notes !== null ? { notes: row.saved_notes } : {}),
    ...(row.saved_next_action !== null ? { nextAction: row.saved_next_action } : {}),
    ...(row.saved_due_date
      ? { dueDate: normalizeDbDate(row.saved_due_date).slice(0, 10) }
      : {}),
    ...(row.saved_decision_reason !== null
      ? { decisionReason: row.saved_decision_reason }
      : {})
  };
}

function mapOpportunityLotRow(row: OpportunityLotRow): OpportunityLot {
  return {
    id: row.id,
    cpvCodes: row.cpv_codes,
    ...(row.lot_identifier !== null ? { lotIdentifier: row.lot_identifier } : {}),
    ...(row.title !== null ? { title: row.title } : {}),
    ...mapOptionalMoney("estimatedValue", row.estimated_value, row.currency),
    ...(row.submission_deadline
      ? { submissionDeadline: normalizeDbDate(row.submission_deadline) }
      : {})
  };
}

function mapContractSummaryRow(row: ContractSummaryRow): ContractSummary {
  return {
    id: row.id,
    title: row.title,
    ...(row.supplier_name !== null ? { supplierName: row.supplier_name } : {}),
    ...(row.supplier_registry_number !== null
      ? { supplierRegistryNumber: row.supplier_registry_number }
      : {}),
    ...(row.contract_number !== null ? { contractNumber: row.contract_number } : {}),
    ...(row.contract_date ? { contractDate: normalizeDbDate(row.contract_date) } : {}),
    ...mapOptionalMoney("value", row.value, row.currency)
  };
}

function mapContractAmendmentRow(row: ContractAmendmentRow): ContractAmendmentSummary {
  return {
    id: row.id,
    ...mapOptionalMoney("previousValue", row.previous_value, row.currency),
    ...mapOptionalMoney("currentValue", row.current_value, row.currency),
    ...(row.change_reason !== null ? { changeReason: row.change_reason } : {}),
    ...(row.change_description !== null
      ? { changeDescription: row.change_description }
      : {})
  };
}

function mapSavedOpportunityRow(row: SavedOpportunityRow): SavedOpportunityState {
  return {
    stage: row.stage,
    ...(row.owner !== null ? { owner: row.owner } : {}),
    ...(row.notes !== null ? { notes: row.notes } : {}),
    ...(row.next_action !== null ? { nextAction: row.next_action } : {}),
    ...(row.due_date ? { dueDate: normalizeDbDate(row.due_date).slice(0, 10) } : {}),
    ...(row.decision_reason !== null ? { decisionReason: row.decision_reason } : {})
  };
}

function mapDocumentIntelligenceRow(row: DocumentIntelligenceRow): DocumentIntelligence {
  return {
    status: row.status,
    eligibilityCriteria: safeStringArray(row.eligibility_criteria),
    requiredDocuments: safeStringArray(row.required_documents),
    certifications: safeStringArray(row.certifications),
    risks: safeStringArray(row.risks),
    ...(row.summary !== null ? { summary: row.summary } : {}),
    ...(row.extracted_at ? { extractedAt: normalizeDbDate(row.extracted_at) } : {}),
    ...mapOptionalAiAnalysis(row.ai_analysis)
  };
}

function emptyDocumentIntelligence(): DocumentIntelligence {
  return {
    status: "not-available",
    eligibilityCriteria: [],
    requiredDocuments: [],
    certifications: [],
    risks: []
  };
}

function mapCompetitorInsightRow(
  row: CompetitorInsightRow
): OpportunityDetail["competitorInsights"][number] {
  return {
    supplierName: row.supplier_name,
    winsCount: Number(row.wins_count),
    ...mapOptionalMoney("totalValue", row.total_value, row.currency),
    ...(row.last_win_date ? { lastWinDate: normalizeDbDate(row.last_win_date) } : {})
  };
}

function mapProfileScores(value: ProfileFitScore[] | null): ProfileFitScore[] {
  return Array.isArray(value) ? value : [];
}

function mapOptionalMoney<K extends string>(
  key: K,
  amount: string | null,
  currency: string | null
): { [P in K]: Money } | Record<string, never> {
  if (!amount || !currency) {
    return {};
  }

  return {
    [key]: {
      amount: Number(amount),
      currency
    }
  } as { [P in K]: Money };
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function mapOptionalAiAnalysis(
  value: unknown
): { aiAnalysis: TenderAiAnalysis } | Record<string, never> {
  const aiAnalysis = parseTenderAiAnalysis(value);
  return aiAnalysis ? { aiAnalysis } : {};
}

function parseTenderAiAnalysis(value: unknown): TenderAiAnalysis | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const provider = readString(value.provider);
  const model = readString(value.model);
  const analyzedAt = readString(value.analyzedAt);
  const businessFitScore = readScore(value.businessFitScore);
  const readinessScore = readScore(value.readinessScore);
  const commercialScore = readScore(value.commercialScore);
  const dataConfidenceScore = readScore(value.dataConfidenceScore);
  const complexity = readComplexity(value.complexity);

  if (
    !provider ||
    !model ||
    !analyzedAt ||
    businessFitScore === undefined ||
    readinessScore === undefined ||
    commercialScore === undefined ||
    dataConfidenceScore === undefined
  ) {
    return undefined;
  }

  return {
    provider,
    model,
    analyzedAt,
    businessFitScore,
    readinessScore,
    commercialScore,
    dataConfidenceScore,
    complexity,
    sectors: safeStringArray(value.sectors),
    missingData: safeStringArray(value.missingData)
  };
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readScore(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function readComplexity(value: unknown): TenderAiAnalysis["complexity"] {
  return value === "low" || value === "medium" || value === "high" || value === "unknown"
    ? value
    : "unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface SqlWhere {
  sql: string;
  values: unknown[];
}

interface SourceHealthQuery {
  withSql: string;
  values: unknown[];
  metricWhereSql: string;
}

type TenderAiScoreKey = keyof Pick<
  TenderAiAnalysis,
  "businessFitScore" | "readinessScore" | "commercialScore" | "dataConfidenceScore"
>;

function buildOpportunityWhere(
  filters: OpportunityListFilters,
  alias: string,
  baseConditions: string[] = []
): SqlWhere {
  const values: unknown[] = [];
  const conditions = [...baseConditions];
  appendDashboardOpportunityConditions(alias, filters, conditions, values);

  return {
    sql: toWhereSql(conditions),
    values
  };
}

function appendDashboardOpportunityConditions(
  alias: string,
  filters: OpportunityListFilters,
  conditions: string[],
  values: unknown[]
): void {
  if (filters.source) {
    values.push(filters.source);
    conditions.push(`${alias}.source = $${values.length}`);
  }

  appendMarketConditions(alias, filters, conditions, values);
  appendAiAnalysisConditions(alias, filters, conditions, values);
}

function appendMarketConditions(
  alias: string,
  filters: OpportunityListFilters,
  conditions: string[],
  values: unknown[]
): void {
  const sourceIds = normalizeSourceFilterIds(filters.sourceIds);
  if (sourceIds.length > 0) {
    values.push(sourceIds);
    conditions.push(`${sourceIdSql(alias)} = ANY($${values.length}::text[])`);
  }

  const countryCodes = normalizeOptionalCountryCodes(filters.countryCodes ?? []);
  const internationalSourceIds = filters.includeInternationalSources
    ? normalizeSourceFilterIds(
        filters.selectedInternationalSourceIds?.length
          ? filters.selectedInternationalSourceIds
          : SOURCE_CATALOG.filter((source) => source.isInternational).map(
              (source) => source.id
            )
      )
    : [];

  if (countryCodes.length > 0) {
    values.push(countryCodes);
    const countryIndex = values.length;
    const countryConditions = [
      `${buyerCountrySql(alias)} = ANY($${countryIndex}::text[])`,
      `${sourceCountrySql(alias)} = ANY($${countryIndex}::text[])`,
      `coalesce(${alias}.place_of_performance_country_codes, ARRAY[]::text[]) && $${countryIndex}::text[]`
    ];

    if (internationalSourceIds.length > 0) {
      values.push(internationalSourceIds);
      countryConditions.push(
        `(
          ${sourceIdSql(alias)} = ANY($${values.length}::text[])
          AND ${buyerCountrySql(alias)} IS NULL
          AND ${sourceCountrySql(alias)} IS NULL
          AND cardinality(coalesce(${alias}.place_of_performance_country_codes, ARRAY[]::text[])) = 0
        )`
      );
    }

    conditions.push(`(${countryConditions.join(" OR ")})`);
  } else if (internationalSourceIds.length > 0) {
    values.push(internationalSourceIds);
    conditions.push(`${sourceIdSql(alias)} = ANY($${values.length}::text[])`);
  }

  const opportunityKinds = normalizeOpportunityKinds(filters.opportunityKinds ?? []);
  if (opportunityKinds.length > 0) {
    values.push(opportunityKinds);
    conditions.push(
      `coalesce(${alias}.opportunity_kind, 'procurement') = ANY($${values.length}::text[])`
    );
  }
}

function toWhereSql(conditions: string[]): string {
  return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
}

function buildSourceHealthQuery(filters: OpportunityListFilters): SourceHealthQuery {
  const sources = getSourceHealthCatalogItems(filters);
  if (sources.length === 0) {
    return {
      withSql: `
          WITH sources(
            source,
            source_display_name,
            source_country_code,
            legacy_source
          ) AS (
            SELECT *
            FROM (
              VALUES (NULL::text, NULL::text, NULL::text, NULL::text)
            ) AS empty_sources(source, source_display_name, source_country_code, legacy_source)
            WHERE false
          )`,
      values: [],
      metricWhereSql: ""
    };
  }

  const values: unknown[] = [];
  const rows = sources.map((source) => {
    values.push(
      source.id,
      source.displayName,
      source.countryCode ?? null,
      source.legacySource ?? null
    );
    const startIndex = values.length - 3;

    return `($${startIndex}::text, $${startIndex + 1}::text, $${startIndex + 2}::text, $${startIndex + 3}::text)`;
  });

  const metricConditions: string[] = [];
  appendSourceMetricOpportunityConditions("o", filters, metricConditions, values);

  return {
    withSql: `
          WITH sources(
            source,
            source_display_name,
            source_country_code,
            legacy_source
          ) AS (
            VALUES ${rows.join(", ")}
          )`,
    values,
    metricWhereSql:
      metricConditions.length > 0 ? `AND ${metricConditions.join(" AND ")}` : ""
  };
}

function getSourceHealthCatalogItems(filters: OpportunityListFilters) {
  const sourceIds = normalizeSourceFilterIds(filters.sourceIds);
  const countryCodes = normalizeOptionalCountryCodes(filters.countryCodes ?? []);
  const internationalSourceIds = filters.includeInternationalSources
    ? normalizeSourceFilterIds(
        filters.selectedInternationalSourceIds?.length
          ? filters.selectedInternationalSourceIds
          : SOURCE_CATALOG.filter((source) => source.isInternational).map(
              (source) => source.id
            )
      )
    : [];

  let sources = SOURCE_CATALOG.filter((source) => {
    if (sourceIds.length > 0 && !sourceIds.includes(source.id)) {
      return false;
    }

    if (filters.source && source.legacySource !== filters.source) {
      return false;
    }

    if (sourceIds.length > 0 || filters.source) {
      return true;
    }

    if (countryCodes.length === 0) {
      return source.defaultEnabled;
    }

    return (
      (source.countryCode !== undefined && countryCodes.includes(source.countryCode)) ||
      internationalSourceIds.includes(source.id)
    );
  });

  if (sources.length === 0 && countryCodes.length === 0 && sourceIds.length === 0) {
    sources = SOURCE_CATALOG.filter((source) => source.defaultEnabled);
  }

  return sources;
}

function appendSourceMetricOpportunityConditions(
  alias: string,
  filters: OpportunityListFilters,
  conditions: string[],
  values: unknown[]
): void {
  const countryCodes = normalizeOptionalCountryCodes(filters.countryCodes ?? []);
  const internationalSourceIds = filters.includeInternationalSources
    ? normalizeSourceFilterIds(
        filters.selectedInternationalSourceIds?.length
          ? filters.selectedInternationalSourceIds
          : SOURCE_CATALOG.filter((source) => source.isInternational).map(
              (source) => source.id
            )
      )
    : [];

  if (countryCodes.length > 0) {
    values.push(countryCodes);
    const countryIndex = values.length;
    const countryConditions = [
      `${buyerCountrySql(alias)} = ANY($${countryIndex}::text[])`,
      `${sourceCountrySql(alias)} = ANY($${countryIndex}::text[])`,
      `coalesce(${alias}.place_of_performance_country_codes, ARRAY[]::text[]) && $${countryIndex}::text[]`
    ];

    if (internationalSourceIds.length > 0) {
      values.push(internationalSourceIds);
      countryConditions.push(
        `(
          ${sourceIdSql(alias)} = ANY($${values.length}::text[])
          AND ${buyerCountrySql(alias)} IS NULL
          AND ${sourceCountrySql(alias)} IS NULL
          AND cardinality(coalesce(${alias}.place_of_performance_country_codes, ARRAY[]::text[])) = 0
        )`
      );
    }

    conditions.push(`(${countryConditions.join(" OR ")})`);
  } else if (internationalSourceIds.length > 0) {
    values.push(internationalSourceIds);
    conditions.push(`${sourceIdSql(alias)} = ANY($${values.length}::text[])`);
  }

  const opportunityKinds = normalizeOpportunityKinds(filters.opportunityKinds ?? []);
  if (opportunityKinds.length > 0) {
    values.push(opportunityKinds);
    conditions.push(
      `coalesce(${alias}.opportunity_kind, 'procurement') = ANY($${values.length}::text[])`
    );
  }

  appendAiAnalysisConditions(alias, filters, conditions, values);
}

function appendAiAnalysisConditions(
  alias: string,
  filters: OpportunityListFilters,
  conditions: string[],
  values: unknown[]
): void {
  const aiConditions: string[] = [];

  appendAiScoreCondition(
    "businessFitScore",
    filters.minAiBusinessFit,
    aiConditions,
    values
  );
  appendAiScoreCondition("readinessScore", filters.minAiReadiness, aiConditions, values);
  appendAiScoreCondition(
    "commercialScore",
    filters.minAiCommercial,
    aiConditions,
    values
  );
  appendAiScoreCondition(
    "dataConfidenceScore",
    filters.minAiConfidence,
    aiConditions,
    values
  );

  if (aiConditions.length === 0) {
    return;
  }

  conditions.push(`EXISTS (
    SELECT 1
    FROM document_intelligence ai_di
    WHERE ai_di.opportunity_id = ${alias}.id
      AND ${aiConditions.join(" AND ")}
  )`);
}

function appendAiScoreCondition(
  key: TenderAiScoreKey,
  threshold: number | undefined,
  conditions: string[],
  values: unknown[]
): void {
  if (threshold === undefined) {
    return;
  }

  values.push(threshold);
  conditions.push(`${aiAnalysisScoreSql("ai_di.ai_analysis", key)} >= $${values.length}`);
}

function aiAnalysisScoreSql(columnSql: string, key: TenderAiScoreKey): string {
  return `CASE
    WHEN (${columnSql}->>'${key}') ~ '^[0-9]+(\\.[0-9]+)?$'
    THEN round((${columnSql}->>'${key}')::numeric)::integer
    ELSE NULL
  END`;
}

function sourceIdSql(alias: string): string {
  return `coalesce(
    ${alias}.source_id,
    CASE ${alias}.source
      WHEN 'cais-eop' THEN 'bg-cais-eop'
      WHEN 'ted' THEN 'eu-ted'
      WHEN 'sedia' THEN 'eu-sedia'
      ELSE ${alias}.source
    END
  )`;
}

function sourceCountrySql(alias: string): string {
  return `coalesce(
    nullif(${alias}.source_country_code, ''),
    CASE ${alias}.source
      WHEN 'cais-eop' THEN 'BG'
    END
  )`;
}

function buyerCountrySql(alias: string): string {
  return `nullif(${alias}.buyer_country_code, '')`;
}

function normalizeOptionalCountryCode(
  value: string | null | undefined
): SupportedCountryCode | undefined {
  return value ? normalizeCountryCode(value) : undefined;
}

function normalizeOptionalCountryCodes(
  values: readonly string[]
): SupportedCountryCode[] {
  const countryCodes: SupportedCountryCode[] = [];

  for (const value of values) {
    const countryCode = normalizeCountryCode(value);
    if (countryCode && !countryCodes.includes(countryCode)) {
      countryCodes.push(countryCode);
    }
  }

  return countryCodes;
}

function normalizeSourceFilterIds(values: readonly string[] | undefined): string[] {
  return normalizeSourceIds(values ?? []);
}

function normalizeOpportunityKinds(
  values: readonly OpportunityKind[]
): OpportunityKind[] {
  const validKinds: OpportunityKind[] = [
    "procurement",
    "funding",
    "framework",
    "award",
    "market-consultation"
  ];
  const normalized: OpportunityKind[] = [];

  for (const value of values) {
    if (validKinds.includes(value) && !normalized.includes(value)) {
      normalized.push(value);
    }
  }

  return normalized;
}

function normalizeDbDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return 100;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 500);
}

# Public Scanner Implementation Plan

## Goal

Build a dashboard that continuously checks official public procurement and funding
sources, finds software and IT opportunities, explains why each opportunity matched, and
helps decide whether to apply.

The first scope is Bulgaria and the EU.

## Product Principles

- Source-first: ingest official data sources before scraping rendered pages.
- Audit-friendly: store raw payloads unchanged, then normalize into application tables.
- Explainable matching: every recommendation must include match reasons.
- Incremental delivery: prove that the scanner finds real active tenders before adding
  advanced proposal tools.
- Conservative crawling: respect public APIs, cache raw files, retry carefully, and avoid
  unnecessary traffic.

## Monorepo Structure

```text
apps/
  api/
    HTTP API for the dashboard and admin views.
  web/
    React dashboard for browsing and tracking opportunities.
  worker/
    Scheduled ingestion and normalization jobs.
packages/
  connectors/
    CAIS EOP, TED, and SEDIA source clients.
  domain/
    Shared opportunity types, CPV filters, keywords, scoring, and utilities.
docs/
  IMPLEMENTATION_PLAN.md
```

## Phase 1: Usable Scanner MVP

### Data Sources

1. CAIS EOP / AOP Bulgaria
   - Read daily open-data bucket listings from
     `https://storage.eop.bg/open-data-YYYY-MM-DD/`.
   - Download JSON files for tenders, OCDS notices, contracts, and annexes.
   - Store raw files and checksums.
   - Normalize tender records into opportunities.

2. TED Search API
   - Use `POST https://api.ted.europa.eu/v3/notices/search`.
   - Query active notices with IT/software CPV filters.
   - Use iteration pagination for larger result sets.
   - Store publication numbers and TED links for de-duplication.

3. SEDIA / EU Funding & Tenders
   - Add after CAIS and TED are stable.
   - Query EU institution tenders first.
   - Add grants and competitive calls only if they are useful for the user workflow.

### Core Data Tables

- `source_runs`
  - Tracks each ingestion attempt, status, counts, failures, and source date.

- `raw_documents`
  - Stores unchanged source payloads, source URL, content type, checksum, and fetched
    timestamp.

- `opportunities`
  - Normalized tender/opportunity records.

- `buyers`
  - Public authorities and EU institutions.

- `opportunity_lots`
  - Lot-specific values, deadlines, CPV codes, and titles.

- `contracts`
  - Awarded contract intelligence for market research.

- `contract_amendments`
  - Annexes and value changes.

- `opportunity_matches`
  - Match score and explainable match reasons.

- `saved_opportunities`
  - User-tracked tenders.

- `document_intelligence`
  - Metadata and document-derived eligibility, document checklist, certification, and risk
    signals.

- `alert_rules`
  - Saved watches by business profile, CPV, score, buyer, deadline window, and channel.

- `alerts`
  - Email or chat notifications.

### Normalized Opportunity Fields

- source
- external ID
- tender ID
- unique procurement number
- title
- buyer name
- buyer registry number
- buyer country
- CPV code and description
- estimated value and currency
- publication date
- submission deadline
- procedure type
- status
- EU-funded flag
- European program
- lot identifier
- source URL
- TED URL
- raw document ID
- match score
- match reasons

## Phase 2: Dashboard Workflow

### Main Views

1. Opportunities
   - Active tenders sorted by score and deadline.
   - Filters for CPV, value, buyer, source, deadline, EU funding, and procedure type.

2. Opportunity Detail
   - Full normalized data.
   - Source links.
   - Profile score breakdown and match reasons.
   - Lots, deadlines, and values.
   - Contracts, amendments, and competitor history.
   - Document intelligence checklist and risks.
   - Raw payload/debug link for admins.

3. Saved Opportunities
   - Pipeline-style tracking for tenders being considered or prepared.
   - Owner, stage, next action, due date, notes, and decision reason.

4. Deadlines
   - Calendar/list of submission deadlines.

5. Buyers
   - Public bodies that frequently buy software and IT services.

6. Contracts Intelligence
   - Past winners, prices, amendments, and recurring buyers.

### Alerts

Add alerts after the opportunity list is reliable.

- New high-score opportunity.
- Deadline in 7, 3, and 1 days.
- New tender from watched buyer.
- New contract award in watched CPV family.
- Saved opportunity changed or was cancelled.

## Matching Strategy

### CPV Families

Use CPV as the strongest signal:

- `72*`: IT services
- `722*`: software programming, consultancy, and development
- `724*`: internet services
- `726*`: support and consultancy
- `727*`: network services
- `728*`: audit and testing
- `48*`: software packages and information systems
- `30*`: computer and office equipment, only as secondary signal
- `723*`: data services
- `793*`, `794*`: research and business consultancy, only as weak signals

### Keywords

Keep keyword matching configurable. Initial keyword groups:

- software development
- web portal
- mobile application
- information system
- API integration
- database
- support and maintenance
- cybersecurity
- cloud
- ERP
- CRM
- GIS
- BI
- dashboard
- artificial intelligence

Bulgarian keywords should be stored as UTF-8 data or escaped literals in code, then
managed through the database once an admin UI exists.

### Score Inputs

- CPV match strength
- keyword match strength
- open deadline
- deadline distance
- estimated value
- buyer history
- EU-funded flag
- framework agreement or dynamic purchasing system
- electronic auction flag
- similar historical contracts

### Business Profiles

The first profile set covers software development, maintenance and support, SaaS
licensing, hardware supply, networking, cybersecurity, cloud infrastructure, and
consulting/integration. Each profile has CPV prefixes, keywords, excluded keywords, and
preferred budget ranges.

## Phase 3: Persistence And Jobs

Recommended stack:

- PostgreSQL for normalized data.
- Redis and BullMQ for scheduled jobs once cron is not enough.
- Postgres full-text search for MVP search.
- Meilisearch or OpenSearch later if full-text search becomes limiting.

Job design:

1. Fetch source index.
2. Download raw payload.
3. Save raw document with checksum.
4. Parse source-specific records.
5. Normalize records.
6. Upsert by source-specific natural key.
7. Score opportunity.
8. Emit alerts for new or changed high-score records.

Every job run must record:

- source
- source date
- started time
- finished time
- status
- fetched count
- inserted count
- updated count
- skipped count
- failure reason

## Phase 4: Proposal Intelligence

After the scanner is reliable:

- Download and index tender documents.
- Summarize requirements.
- Extract eligibility requirements and mandatory documents.
- Generate a bid/no-bid recommendation.
- Track competitors and incumbent suppliers.
- Build a reusable proposal checklist.

## First Engineering Milestones

1. Add database schema and migrations.
2. Implement CAIS daily file ingestion end to end.
3. Implement TED active-notice ingestion.
4. Normalize opportunities and lots.
5. Add scoring and persisted match reasons.
6. Build dashboard list and detail views.
7. Add saved opportunities.
8. Add deadline alerts.

## Current Implementation Status

Completed:

- CAIS and TED ingestion with raw document storage.
- Opportunity, lot, contract, and amendment persistence.
- Profile-based scoring with explainable components.
- Metadata-based document intelligence persistence.
- Opportunity preview dashboard and application pipeline.
- Alert-rule storage and API foundation.
- Production PM2 processes, host Nginx, `publicauctions.jilanov.com` HTTPS config, and
  database-backed admin session login.

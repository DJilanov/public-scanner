# Multi-Country Source Expansion Plan

## Goal

Expand Public Scanner from a Bulgaria/EU tender monitor into a multi-country procurement
and funding intelligence product, while letting each user profile decide which countries
and international sources are visible.

The rule is simple: if a user is not interested in Greece, Greek opportunities should not
appear in discovery, overview metrics, document review, alerts, or apply workflows.

## Product Scope

This is a large feature, not a small connector task. It changes source ingestion,
normalization, user preferences, filters, scoring, dashboard UX, alerts, and operational
monitoring.

The feature should support:

- Country filters in profile settings.
- Source filters for advanced users.
- International organization sources that are not tied to a single country.
- Buyer country, source country, and place-of-performance country as separate concepts.
- Procurement opportunities, grant/funding calls, framework opportunities, awards, and
  historical contracts.
- Country-aware alerts and saved views.
- Source health per country/source.
- Connector-specific rate limits, schedules, and failure isolation.

## Source Expansion Targets

### Existing Sources

| Source                       | Coverage                           | Status   | Notes                                                                       |
| ---------------------------- | ---------------------------------- | -------- | --------------------------------------------------------------------------- |
| CAIS EOP / AOP               | Bulgaria                           | Existing | Keep as P0 and use as the quality baseline.                                 |
| TED                          | EU/EEA and above-threshold notices | Existing | Expand country query coverage beyond Bulgaria.                              |
| SEDIA / EU Funding & Tenders | EU institutions, grants, tenders   | Existing | Keep EU institution tenders first; grants need a separate opportunity type. |

### P0: Best Next Sources

| Source                                               | Coverage                                                          | Access shape                             | Why P0                                                                             |
| ---------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| OpenTender / OCDS via Open Contracting Data Registry | 35 jurisdictions including EU states, Serbia, North Macedonia, UK | OCDS API/download                        | Best source for buyer and competitor history across many countries.                |
| World Bank procurement notices                       | Global funded projects                                            | API                                      | Strong public-sector digitalization, consulting, and infrastructure opportunities. |
| UNGM                                                 | UN agencies                                                       | API/developer portal                     | Good for software, hardware, consulting, support, and cybersecurity opportunities. |
| EBRD / ECEPP                                         | EBRD-financed projects                                            | Portal/search crawl                      | Very relevant for Balkans and Eastern Europe public-sector projects.               |
| NATO / NSPA / NCIA                                   | NATO procurement                                                  | Portal crawl, registration for some docs | Relevant for hardware, cybersecurity, infrastructure, and software support.        |

### P1: Regional Country Portals

| Country                | Source                                   | Access shape                   | Notes                                                           |
| ---------------------- | ---------------------------------------- | ------------------------------ | --------------------------------------------------------------- |
| Romania                | SEAP/SICAP                               | Portal/API investigation       | Close-market EU country; large IT/hardware pipeline.            |
| Greece                 | ESIDIS/eProcurement and open-data search | Portal/open-data crawl         | Must be fully hidden when Greece is not selected.               |
| Serbia                 | Portal javnih nabavki                    | Portal crawl/API investigation | Not fully covered by TED; useful regional expansion.            |
| North Macedonia        | e-Nabavki ESPP                           | Portal crawl/API investigation | Useful for IPA-funded and local public tenders.                 |
| Croatia                | EOJN RH                                  | Portal crawl/API investigation | EU source, some TED overlap but local portal adds completeness. |
| Slovenia               | e-JN/eNaročanje                          | Portal/open current contracts  | EU source, useful for English/Balkan expansion.                 |
| Albania                | Public Procurement Agency                | Portal crawl                   | Western Balkans public tenders.                                 |
| Bosnia and Herzegovina | eJN                                      | Portal crawl                   | Multi-language portal with notices and award data.              |
| Montenegro             | CeJN                                     | Portal crawl                   | Smaller volume but relevant regional opportunities.             |

### P2: Optional Global Sources

| Source                              | Coverage                        | Access shape | Notes                                                                 |
| ----------------------------------- | ------------------------------- | ------------ | --------------------------------------------------------------------- |
| SAM.gov                             | United States federal contracts | API key/API  | Excellent API, but business applicability depends on eligibility.     |
| UK Contracts Finder / Find a Tender | United Kingdom                  | API/OCDS     | Good English-language tenders and awards.                             |
| CanadaBuys                          | Canada federal procurement      | Open data    | Useful if we want global English-language expansion.                  |
| AusTender                           | Australia federal procurement   | OCDS API     | Good structured award data.                                           |
| Grants.gov                          | US grants                       | API          | Funding, not procurement. Add only after opportunity type separation. |

## Key Product Decisions

### 1. Country Preference Is A First-Class Profile Setting

Add profile settings:

- `selectedCountryCodes`: ISO 3166-1 alpha-2 country codes.
- `selectedSourceIds`: optional advanced source allow-list.
- `includeInternationalSources`: boolean.
- `selectedInternationalSourceIds`: optional allow-list for World Bank, UNGM, EBRD, NATO,
  EU institutions.
- `opportunityKinds`: procurement, funding, framework, award, market-consultation.

Defaults:

- Bulgaria selected.
- EU/international sources enabled only when they can produce Bulgaria-relevant or
  selected country-relevant opportunities.
- No country outside the selected set should appear in user-facing lists unless it is an
  international source explicitly enabled by the user.

### 2. Use Country Semantics Carefully

Every opportunity can have multiple country dimensions:

- `sourceCountryCode`: where the source portal is based.
- `buyerCountryCode`: where the contracting authority is based.
- `placeOfPerformanceCountryCodes`: where the work/delivery happens.
- `fundingCountryCodes`: countries targeted by a funder or programme.

Filtering should use this rule:

1. Show if `buyerCountryCode` is selected.
2. Show if any `placeOfPerformanceCountryCodes` is selected.
3. Show if source is international and `includeInternationalSources` is true, then rank
   higher if the opportunity mentions selected countries.
4. Hide otherwise.

### 3. Source Identity Must Stop Being A Small Union

The current `ProcurementSource` union works for three sources but will not scale. Replace
it gradually with:

- `sourceId`: stable internal ID, for example `bg-cais-eop`, `eu-ted`, `worldbank`,
  `ungm`, `ro-seap`, `gr-esidis`.
- `sourceFamily`: `national-portal`, `eu`, `ifis`, `defence`, `grant`, `ocds`.
- `sourceCountryCode`: optional for national portals.
- `sourceDisplayName`.
- `sourceUrl`.

Keep backward compatibility in API responses during the migration by returning both
`source` and `sourceId` until the frontend is fully switched.

## Data Model Plan

### New Tables

#### `source_catalog`

Stores known source metadata and operational flags.

Fields:

- `id`
- `display_name`
- `family`
- `country_code`
- `base_url`
- `enabled`
- `schedule_cron`
- `default_priority`
- `requires_api_key`
- `requires_registration`
- `supports_documents`
- `supports_awards`
- `supports_changes`
- `metadata`

#### `user_source_preferences`

Can be embedded in the existing preferences JSON first, then normalized later if needed.

Fields:

- `user_id`
- `selected_country_codes`
- `selected_source_ids`
- `include_international_sources`
- `selected_international_source_ids`
- `opportunity_kinds`

#### `opportunity_countries`

Avoids forcing a single country on complex international records.

Fields:

- `opportunity_id`
- `country_code`
- `role`: `buyer`, `source`, `performance`, `funding`, `mentioned`

#### `source_connector_state`

Stores cursors, last successful pages, ETags, date windows, rate-limit data, and retry
state per source.

Fields:

- `source_id`
- `state`
- `last_successful_run_at`
- `last_cursor`
- `last_seen_publication_date`
- `backfill_completed_at`
- `updated_at`

### Existing Table Changes

#### `opportunities`

Add:

- `source_id`
- `source_country_code`
- `buyer_country_code`
- `place_of_performance_country_codes`
- `opportunity_kind`
- `language`
- `source_native_status`
- `source_native_procedure_type`
- `international_funding_org`

#### `raw_documents`

Add:

- `source_id`
- `source_country_code`
- `language`
- `remote_last_modified`
- `remote_etag`

#### `source_runs`

Add:

- `source_id`
- `country_code`
- `run_mode`: `incremental`, `backfill`, `repair`, `document-refresh`
- `cursor_before`
- `cursor_after`

## Connector Architecture

### Source Connector Contract

Each connector should implement:

```ts
interface SourceConnector {
  sourceId: string;
  fetchUpdates(input: SourceFetchInput): Promise<SourceFetchResult>;
  normalize(record: RawSourceRecord): NormalizedProcurementRecord[];
  fetchDocuments?(record: NormalizedProcurementRecord): Promise<RawAttachment[]>;
}
```

Key requirements:

- No database logic inside connectors.
- No user preference logic inside connectors.
- Source-specific retries and parsing errors are isolated.
- All raw payloads are stored before normalization.
- Every normalized record must carry source ID, source URL, source country, buyer country,
  language, and opportunity kind.

### Connector Families

#### API Connectors

Use for sources with official APIs or structured open data:

- TED
- SEDIA
- World Bank
- UNGM
- SAM.gov
- UK Contracts Finder
- AusTender
- CanadaBuys
- OpenTender/OCDS

#### Portal Crawlers

Use only where public API/open-data access is absent or incomplete:

- Romania SEAP/SICAP
- Greece ESIDIS
- Serbia
- North Macedonia
- Croatia
- Slovenia
- Albania
- Bosnia and Herzegovina
- Montenegro
- EBRD/ECEPP
- NATO/NSPA/NCIA

Portal crawler rules:

- Crawl search/list pages first.
- Fetch detail pages only for new or changed records.
- Fetch attachments only after metadata relevance passes a threshold.
- Store HTML snapshots/checksums.
- Respect robots, public terms, and rate limits.
- Add per-source throttle and circuit breaker.

## Country-Aware Product UX

### Profile Page

Add a new "Markets" section:

- Country multi-select grouped by:
  - Home market
  - Balkans
  - EU
  - Global
- Toggle: international organizations.
- Toggle: funding/grants.
- Advanced source selector collapsed by default.
- Coverage preview:
  - selected countries
  - enabled sources
  - last successful scan
  - expected daily volume

### Opportunities Page

Add filters:

- Country
- Source
- Source family
- Opportunity kind
- Language
- International only

Behavior:

- Defaults come from profile country settings.
- User can narrow inside the current profile selection.
- User cannot accidentally broaden beyond profile selection unless they explicitly open
  profile settings.

### Overview

Country-aware metrics:

- Opportunities by selected market.
- Best market this week.
- New high-fit tenders by country.
- Deadline pressure by country.
- Source health by country/source.

### Document Review

Country columns:

- Buyer country.
- Source.
- Language.
- Package coverage.
- Translation status.

### Alerts

Alert rules must inherit profile country filters by default.

Add:

- country condition
- source condition
- international source condition
- language condition
- funding organization condition

## Scoring Changes

### Country Fit Component

Add a country/market score component:

- `100`: buyer or performance country selected.
- `80`: international source explicitly enabled and mentions selected country.
- `60`: EU-wide opportunity with selected country eligibility.
- `30`: source country selected but buyer/performance unclear.
- `0`: outside selected markets.

Hidden opportunities should usually not be scored for the user at all.

### Language And Submission Risk

Add risk signals:

- Portal language not supported by our application team.
- Tender documents only in local language.
- Submission requires local e-signature or local registration.
- Bid submission requires national platform account.
- Opportunity may require local legal entity or local partner.

### International Eligibility

For World Bank, UNGM, EBRD, NATO, SAM.gov, and grants:

- Detect supplier registration requirements.
- Detect nationality restrictions.
- Detect security clearance requirements.
- Detect local partner requirements.
- Detect eligibility by organization type.

## Rollout Plan

### Phase 0: Foundation

Deliverables:

- Source catalog model.
- Country preference model in user preferences.
- Profile "Markets" section.
- API filtering by selected countries.
- UI country/source filters.
- Migration path from old `source` union to source catalog.

Acceptance criteria:

- Existing Bulgaria/EU behavior remains unchanged for default users.
- Selecting only Bulgaria hides Greece, Romania, Serbia, etc.
- Selected country list affects opportunities, dashboard, alerts, document review, and
  apply studio.

### Phase 1: API/Open-Data Sources

Deliverables:

- OpenTender/OCDS connector for historical buyer/competitor data.
- World Bank procurement connector.
- UNGM connector.
- TED expanded to multiple selected countries.
- SEDIA country/funding-aware filtering.

Acceptance criteria:

- Connector runs are source-isolated.
- Dashboard shows only selected countries.
- Buyer/competitor analysis improves from OpenTender history.
- International opportunities are shown only when international sources are enabled.

### Phase 2: Regional Portals

Deliverables:

- Romania SEAP/SICAP connector.
- Greece ESIDIS connector.
- Serbia connector.
- North Macedonia connector.
- Croatia and Slovenia connectors.
- Albania, Bosnia and Herzegovina, Montenegro connectors.

Acceptance criteria:

- Each source has source health, record counts, and parser error tracking.
- Each source supports incremental refresh.
- At least metadata-level deduplication against TED where applicable.
- Attachments are fetched only for relevant/high-score tenders.

### Phase 3: International/Defence/Global

Deliverables:

- EBRD/ECEPP connector.
- NATO/NSPA/NCIA connector.
- SAM.gov connector.
- UK Contracts Finder/Find a Tender connector.
- CanadaBuys connector.
- AusTender connector.
- Grants.gov connector if funding opportunities are enabled as a separate flow.

Acceptance criteria:

- Eligibility risks identify registration, nationality, clearance, and local presence
  requirements.
- Global opportunities do not pollute local country-focused dashboards.
- Users can choose international sources individually.

### Phase 4: Document And Translation Layer

Deliverables:

- Attachment downloader for all supported sources.
- OCR/text extraction pipeline.
- Language detection.
- Machine translation cache for titles, summaries, clauses, and requirements.
- Page-level citations in document package analysis.

Acceptance criteria:

- Official document package has source file hashes.
- Clause extraction links back to source document and page/snippet.
- Bulgarian UI can show translated summaries while preserving original text.

### Phase 5: Intelligence And Operations

Deliverables:

- Country/source coverage dashboard.
- Parser health dashboard.
- Backfill jobs.
- Duplicate cluster inspection.
- Country-specific eligibility rules.
- Market comparison by country.

Acceptance criteria:

- Admin can see which sources are stale or failing.
- Admin can pause a source without code deploy.
- User can compare countries by volume, fit, average value, buyer risk, and deadline
  pressure.

## Deduplication Strategy

Deduplication must happen across national portals, TED, and OCDS historical data.

Use a composite strategy:

- TED publication number.
- National tender ID.
- Buyer registry number.
- Buyer name normalized.
- Title fingerprint.
- CPV codes.
- Publication date.
- Estimated value.
- Deadline.

Store duplicate clusters:

- `duplicate_group_id`
- `canonical_opportunity_id`
- source-specific external IDs
- confidence score
- reason

TED should usually be canonical for above-threshold EU notices, but national portals often
have better documents and local metadata. Keep both raw sources linked.

## Operational Risks

| Risk                                            | Mitigation                                                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Some portals are JavaScript-heavy               | Prefer APIs/open data; use browser crawler only when necessary.                                      |
| Source schemas change                           | Store raw payloads, add parser tests with fixtures, track source errors.                             |
| Too many low-quality global results             | Country preference gating and source-family filters.                                                 |
| Duplicate notices from TED and national portals | Duplicate clustering and canonical records.                                                          |
| Attachments create storage load                 | Fetch attachments only for high-score or user-saved opportunities first.                             |
| Legal/terms issues                              | Use official APIs/open data first, throttle crawlers, avoid authenticated scraping unless permitted. |
| Language noise                                  | Language detection, translation cache, and original-text preservation.                               |

## Testing Strategy

### Unit Tests

- Country preference filtering.
- Country role matching.
- Source catalog validation.
- Normalization per source fixture.
- Deduplication confidence scoring.
- Source-specific date/currency parsing.

### Integration Tests

- Worker source run writes raw payload and normalized records.
- API list respects user selected countries.
- Dashboard does not leak unselected countries.
- Alerts inherit country preferences.
- Saved views keep country/source filters.

### Smoke Tests

- Profile: select Bulgaria only, verify Greece/Serbia/Romania are absent.
- Profile: add Greece, verify Greek source appears after ingest.
- Enable international sources, verify World Bank/UNGM opportunities appear.
- Disable international sources, verify they disappear.
- Detail: source country, buyer country, language, and documents are visible.

## Implementation Order

1. Add source catalog and country preference model.
2. Add profile markets UI and API preference persistence.
3. Add country-aware API filtering across opportunities/dashboard/apply studio/alerts.
4. Refactor `ProcurementSource` usage toward `sourceId` while keeping compatibility.
5. Expand TED by selected country list.
6. Add OpenTender/OCDS for history and competitor intelligence.
7. Add World Bank and UNGM.
8. Add regional portal connectors in priority order.
9. Add international/defence/global connectors.
10. Add document downloader, OCR, translation, and citations.

## Recommended First Build Slice

The first PR should not add 15 connectors. It should add the platform capability:

- Source catalog.
- Country preferences.
- Country-aware filters everywhere.
- UI "Markets" profile section.
- API/server-side filtering.
- Tests proving unselected countries are hidden.

After that, connector PRs become repeatable and lower-risk.

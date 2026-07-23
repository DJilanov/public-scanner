# Architecture

## System Shape

Public Scanner is split into small applications and shared packages.

- `apps/worker` owns source ingestion, raw payload storage, normalization, and scoring.
- `apps/api` exposes normalized opportunities to the dashboard.
- `apps/web` provides the user workflow.
- `packages/connectors` owns HTTP clients for official external sources.
- `packages/domain` owns shared types and scoring rules.
- `packages/db` owns database migrations.

The worker should be the only runtime that talks directly to external procurement sources.
The API should read from PostgreSQL and avoid re-fetching source systems during user
requests.

## Data Flow

1. A scheduled worker starts a `source_runs` record.
2. The connector fetches source indexes and payloads.
3. Raw payloads are stored with checksum and source metadata.
4. Source records are normalized into `opportunities`, `opportunity_lots`, `contracts`,
   and `contract_amendments`.
5. Scoring writes `opportunity_matches`.
6. The API serves dashboard queries from normalized tables.
7. Alerts are emitted only after a successful upsert and score comparison.

## Source Boundaries

Connector packages must not know about PostgreSQL, UI state, or user preferences. They
only fetch and minimally validate source payloads.

Domain packages must not perform I/O. They should stay deterministic so scoring and
normalization can be tested without network access.

Applications can compose packages, but shared packages should not import from `apps/*`.

## Reliability Rules

- Source payloads are immutable once stored.
- Every external request is attributable to a `source_runs` row.
- Ingestion must be idempotent by source-specific natural key.
- Normalizers must tolerate missing optional fields.
- Failed records should not fail the entire source run when they can be isolated.
- Alerts must be based on persisted state, not transient in-memory results.

## Initial Runtime Stack

- Node.js 20
- TypeScript strict mode
- PostgreSQL
- Redis for future queued jobs
- Fastify API
- Vite React dashboard

# Public Scanner

Public Scanner is a monorepo for collecting, normalizing, scoring, and browsing public
procurement opportunities that are relevant for software and IT services.

The dashboard is intended to run privately at `publicauctions.jilanov.com` behind
database-backed admin login sessions.

The initial scope is Bulgaria and the EU:

- Bulgarian CAIS EOP / AOP open-data files
- EU TED Search API
- EU Funding & Tenders / SEDIA search API

## Repository Layout

```text
apps/
  api/       Fastify API service
  web/       Vite React dashboard
  worker/    ingestion worker entry point
packages/
  connectors/ official-source clients
  db/         PostgreSQL migrations and repositories
  domain/     shared opportunity types, profile scoring, and analysis
docs/
  IMPLEMENTATION_PLAN.md
```

## Commands

```bash
npm install
npm run typecheck
npm run test
npm run build
npm run check
npm run db:migrate
npm run admin:upsert
npm run ingest:once
npm run ingest:dry-run
npm run dev:api
npm run dev:web
npm run dev:worker
npm run deploy:prod
```

For local infrastructure:

```bash
ssh -fN -L 5454:localhost:5432 root@89.167.46.193
```

Local MVP flow:

```bash
npm run db:migrate
npm run ingest:once
npm run dev:api
npm run dev:web
```

Use `npm run ingest:dry-run` to validate source availability without writing to
PostgreSQL.

Deployment instructions are in `docs/DEPLOYMENT.md`.

For the same staging database location used by the referenced `ai-cv` project, use the SSH
tunnel on local port `5454` and the separate database `public_scanner_dev`.

## Current Status

The product now includes source connector clients, persisted ingestion, profile-based fit
scoring, opportunity preview, application-stage tracking, metadata-based document
intelligence, contract and competitor context, alert-rule storage, PM2 deployment assets,
admin session authentication, and a light/dark dashboard UI.

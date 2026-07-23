CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE source_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('cais-eop', 'ted', 'sedia')),
  source_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'partial')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  fetched_count integer NOT NULL DEFAULT 0 CHECK (fetched_count >= 0),
  inserted_count integer NOT NULL DEFAULT 0 CHECK (inserted_count >= 0),
  updated_count integer NOT NULL DEFAULT 0 CHECK (updated_count >= 0),
  skipped_count integer NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  error_message text
);

CREATE INDEX source_runs_source_date_idx ON source_runs (source, source_date DESC);
CREATE INDEX source_runs_status_idx ON source_runs (status, started_at DESC);

CREATE TABLE raw_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_run_id uuid REFERENCES source_runs (id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('cais-eop', 'ted', 'sedia')),
  source_date date,
  source_url text NOT NULL,
  content_type text NOT NULL DEFAULT 'application/json',
  checksum_sha256 text NOT NULL,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_url, checksum_sha256)
);

CREATE INDEX raw_documents_source_date_idx ON raw_documents (source, source_date DESC);
CREATE INDEX raw_documents_payload_gin_idx ON raw_documents USING gin (payload);

CREATE TABLE buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('cais-eop', 'ted', 'sedia')),
  external_id text,
  registry_number text,
  country_code text,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id),
  UNIQUE (source, registry_number, name)
);

CREATE INDEX buyers_name_idx ON buyers USING gin (to_tsvector('simple', name));

CREATE TABLE opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('cais-eop', 'ted', 'sedia')),
  external_id text NOT NULL,
  deduplication_key text NOT NULL,
  tender_id text,
  unique_procurement_number text,
  publication_number text,
  title text NOT NULL,
  buyer_id uuid REFERENCES buyers (id) ON DELETE SET NULL,
  buyer_name text NOT NULL,
  buyer_registry_number text,
  buyer_country_code text,
  status text NOT NULL DEFAULT 'unknown' CHECK (
    status IN ('forthcoming', 'open', 'closed', 'awarded', 'cancelled', 'unknown')
  ),
  main_cpv_code text,
  cpv_codes text[] NOT NULL DEFAULT '{}',
  cpv_description text,
  estimated_value numeric(18, 2),
  currency text,
  publication_date timestamptz,
  submission_deadline timestamptz,
  procedure_type text,
  is_eu_funded boolean,
  european_program text,
  source_url text NOT NULL,
  ted_url text,
  raw_document_id uuid REFERENCES raw_documents (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE INDEX opportunities_status_deadline_idx
  ON opportunities (status, submission_deadline)
  WHERE status IN ('forthcoming', 'open');

CREATE INDEX opportunities_cpv_codes_gin_idx ON opportunities USING gin (cpv_codes);
CREATE INDEX opportunities_deduplication_key_idx ON opportunities (deduplication_key);
CREATE INDEX opportunities_buyer_idx ON opportunities (buyer_name);
CREATE INDEX opportunities_publication_date_idx ON opportunities (publication_date DESC);
CREATE INDEX opportunities_search_idx
  ON opportunities USING gin (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(buyer_name, ''))
  );

CREATE TABLE opportunity_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities (id) ON DELETE CASCADE,
  external_id text NOT NULL,
  lot_identifier text,
  title text,
  cpv_codes text[] NOT NULL DEFAULT '{}',
  estimated_value numeric(18, 2),
  currency text,
  submission_deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, external_id)
);

CREATE INDEX opportunity_lots_cpv_codes_gin_idx ON opportunity_lots USING gin (cpv_codes);

CREATE TABLE contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('cais-eop', 'ted', 'sedia')),
  external_id text NOT NULL,
  opportunity_id uuid REFERENCES opportunities (id) ON DELETE SET NULL,
  buyer_name text NOT NULL,
  supplier_name text,
  supplier_registry_number text,
  contract_number text,
  contract_date date,
  title text NOT NULL,
  value numeric(18, 2),
  currency text,
  raw_document_id uuid REFERENCES raw_documents (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE INDEX contracts_supplier_idx ON contracts (supplier_name);
CREATE INDEX contracts_contract_date_idx ON contracts (contract_date DESC);

CREATE TABLE contract_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('cais-eop', 'ted', 'sedia')),
  external_id text NOT NULL,
  contract_id uuid REFERENCES contracts (id) ON DELETE SET NULL,
  previous_value numeric(18, 2),
  current_value numeric(18, 2),
  currency text,
  change_reason text,
  change_description text,
  raw_document_id uuid REFERENCES raw_documents (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE TABLE opportunity_matches (
  opportunity_id uuid PRIMARY KEY REFERENCES opportunities (id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  profile_scores jsonb NOT NULL DEFAULT '[]'::jsonb,
  scored_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX opportunity_matches_score_idx ON opportunity_matches (score DESC, scored_at DESC);

CREATE TABLE saved_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities (id) ON DELETE CASCADE,
  user_key text NOT NULL DEFAULT 'default',
  stage text NOT NULL DEFAULT 'watching' CHECK (
    stage IN ('watching', 'reviewing', 'preparing', 'submitted', 'won', 'lost', 'archived')
  ),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, user_key)
);

CREATE TABLE alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid REFERENCES opportunities (id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  target text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'failed', 'suppressed')
  ),
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX alerts_status_scheduled_idx ON alerts (status, scheduled_for);

CREATE TABLE source_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_run_id uuid REFERENCES source_runs (id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('cais-eop', 'ted', 'sedia')),
  source_date date,
  context text NOT NULL,
  error_message text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX source_errors_source_date_idx ON source_errors (source, source_date DESC);
CREATE INDEX source_errors_run_idx ON source_errors (source_run_id);

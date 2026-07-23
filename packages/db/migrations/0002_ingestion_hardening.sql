ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS deduplication_key text;

UPDATE opportunities
SET deduplication_key = source || ':' || external_id
WHERE deduplication_key IS NULL;

ALTER TABLE opportunities
  ALTER COLUMN deduplication_key SET NOT NULL;

CREATE INDEX IF NOT EXISTS opportunities_deduplication_key_idx
  ON opportunities (deduplication_key);

CREATE TABLE IF NOT EXISTS source_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_run_id uuid REFERENCES source_runs (id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('cais-eop', 'ted', 'sedia')),
  source_date date,
  context text NOT NULL,
  error_message text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS source_errors_source_date_idx
  ON source_errors (source, source_date DESC);

CREATE INDEX IF NOT EXISTS source_errors_run_idx
  ON source_errors (source_run_id);

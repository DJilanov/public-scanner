ALTER TABLE opportunity_matches
  ADD COLUMN IF NOT EXISTS profile_scores jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE saved_opportunities
  ADD COLUMN IF NOT EXISTS owner text,
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS decision_reason text;

CREATE TABLE IF NOT EXISTS document_intelligence (
  opportunity_id uuid PRIMARY KEY REFERENCES opportunities (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'ready', 'failed', 'not-available')
  ),
  summary text,
  eligibility_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  certifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  extracted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key text NOT NULL DEFAULT 'default',
  name text NOT NULL,
  profile_id text,
  min_score integer NOT NULL DEFAULT 70 CHECK (min_score >= 0 AND min_score <= 100),
  watched_buyer text,
  cpv_prefix text,
  deadline_days integer,
  channel text NOT NULL DEFAULT 'email',
  target text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alert_rules_enabled_idx
  ON alert_rules (enabled, min_score DESC);

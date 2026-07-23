CREATE TABLE IF NOT EXISTS evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key text NOT NULL DEFAULT 'default',
  title text NOT NULL,
  type text NOT NULL CHECK (
    type IN (
      'certificate',
      'reference',
      'team-cv',
      'vendor-authorization',
      'company-document',
      'methodology',
      'other'
    )
  ),
  profile_ids text[] NOT NULL DEFAULT '{}',
  issuer text,
  valid_until date,
  summary text,
  storage_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evidence_items_type_idx
  ON evidence_items (user_key, type, valid_until);

CREATE INDEX IF NOT EXISTS evidence_items_profile_ids_gin_idx
  ON evidence_items USING gin (profile_ids);

CREATE TABLE IF NOT EXISTS compliance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities (id) ON DELETE CASCADE,
  user_key text NOT NULL DEFAULT 'default',
  requirement_type text NOT NULL CHECK (
    requirement_type IN ('eligibility', 'required-document', 'certification', 'risk')
  ),
  requirement text NOT NULL,
  status text NOT NULL DEFAULT 'missing' CHECK (
    status IN ('missing', 'in-progress', 'ready', 'not-applicable', 'blocked')
  ),
  owner text,
  evidence_item_ids uuid[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, user_key, requirement_type, requirement)
);

CREATE INDEX IF NOT EXISTS compliance_items_opportunity_idx
  ON compliance_items (opportunity_id, user_key, status);

CREATE INDEX IF NOT EXISTS compliance_items_evidence_ids_gin_idx
  ON compliance_items USING gin (evidence_item_ids);

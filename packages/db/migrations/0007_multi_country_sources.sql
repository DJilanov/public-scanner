ALTER TABLE source_runs DROP CONSTRAINT IF EXISTS source_runs_source_check;
ALTER TABLE raw_documents DROP CONSTRAINT IF EXISTS raw_documents_source_check;
ALTER TABLE buyers DROP CONSTRAINT IF EXISTS buyers_source_check;
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_source_check;
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_source_check;
ALTER TABLE contract_amendments DROP CONSTRAINT IF EXISTS contract_amendments_source_check;
ALTER TABLE source_errors DROP CONSTRAINT IF EXISTS source_errors_source_check;

CREATE TABLE IF NOT EXISTS source_catalog (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  family text NOT NULL CHECK (
    family IN ('national-portal', 'eu', 'ifis', 'defence', 'grant', 'ocds')
  ),
  base_url text NOT NULL,
  country_code text,
  legacy_source text,
  is_international boolean NOT NULL DEFAULT false,
  supports_documents boolean NOT NULL DEFAULT false,
  supports_awards boolean NOT NULL DEFAULT false,
  supports_changes boolean NOT NULL DEFAULT false,
  requires_api_key boolean NOT NULL DEFAULT false,
  requires_registration boolean NOT NULL DEFAULT false,
  default_enabled boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO source_catalog (
  id,
  display_name,
  family,
  base_url,
  country_code,
  legacy_source,
  is_international,
  supports_documents,
  supports_awards,
  supports_changes,
  requires_api_key,
  requires_registration,
  default_enabled
)
VALUES
  ('bg-cais-eop', 'CAIS EOP / AOP Bulgaria', 'national-portal', 'https://app.eop.bg', 'BG', 'cais-eop', false, true, true, true, false, false, true),
  ('eu-ted', 'TED', 'eu', 'https://ted.europa.eu', NULL, 'ted', true, true, true, true, false, false, true),
  ('eu-sedia', 'EU Funding & Tenders', 'eu', 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/', NULL, 'sedia', true, true, false, true, false, false, true),
  ('opentender-ocds', 'OpenTender / OCDS', 'ocds', 'https://data.open-contracting.org', NULL, NULL, true, false, true, true, false, false, false),
  ('worldbank', 'World Bank Procurement', 'ifis', 'https://projects.worldbank.org/en/projects-operations/procurement', NULL, NULL, true, true, true, true, false, false, false),
  ('ungm', 'UNGM', 'ifis', 'https://www.ungm.org/public/notice', NULL, NULL, true, true, true, true, false, false, false),
  ('ebrd-ecepp', 'EBRD / ECEPP', 'ifis', 'https://ecepp.ebrd.com', NULL, NULL, true, true, true, true, false, true, false),
  ('nato-procurement', 'NATO Procurement', 'defence', 'https://www.nato.int/en/work-with-us/business-and-project-opportunities/procurement-opportunities', NULL, NULL, true, true, true, true, false, true, false),
  ('ro-seap', 'Romania SEAP/SICAP', 'national-portal', 'https://www.e-licitatie.ro/', 'RO', NULL, false, true, true, true, false, false, false),
  ('gr-esidis', 'Greece ESIDIS', 'national-portal', 'https://www.eprocurement.gov.gr/', 'GR', NULL, false, true, true, true, false, false, false),
  ('rs-jnportal', 'Serbia Public Procurement Portal', 'national-portal', 'https://jnportal.ujn.gov.rs/', 'RS', NULL, false, true, true, true, false, false, false),
  ('mk-enabavki', 'North Macedonia e-Nabavki', 'national-portal', 'https://e-nabavki.gov.mk/', 'MK', NULL, false, true, true, true, false, false, false),
  ('hr-eojn', 'Croatia EOJN RH', 'national-portal', 'https://eojn.nn.hr/', 'HR', NULL, false, true, true, true, false, false, false),
  ('si-ejn', 'Slovenia e-JN', 'national-portal', 'https://ejn.gov.si/en/', 'SI', NULL, false, true, true, true, false, false, false),
  ('al-app', 'Albania Public Procurement Agency', 'national-portal', 'https://app.gov.al/home/', 'AL', NULL, false, true, true, true, false, false, false),
  ('ba-ejn', 'Bosnia and Herzegovina eJN', 'national-portal', 'https://www.ejn.gov.ba/', 'BA', NULL, false, true, true, true, false, false, false),
  ('me-cejn', 'Montenegro CeJN', 'national-portal', 'https://cejn.gov.me/', 'ME', NULL, false, true, true, true, false, false, false),
  ('uk-contracts-finder', 'UK Contracts Finder', 'national-portal', 'https://www.contractsfinder.service.gov.uk/', 'GB', NULL, false, true, true, true, false, false, false),
  ('sam-gov', 'SAM.gov Opportunities', 'national-portal', 'https://sam.gov/opportunities', 'US', NULL, false, true, true, true, false, false, false),
  ('canadabuys', 'CanadaBuys', 'national-portal', 'https://canadabuys.canada.ca/en', 'CA', NULL, false, true, true, true, false, false, false),
  ('austender', 'AusTender', 'national-portal', 'https://www.tenders.gov.au/', 'AU', NULL, false, true, true, true, false, false, false),
  ('grants-gov', 'Grants.gov', 'grant', 'https://grants.gov', 'US', NULL, false, true, false, true, true, false, false)
ON CONFLICT (id) DO UPDATE SET
  display_name = excluded.display_name,
  family = excluded.family,
  base_url = excluded.base_url,
  country_code = excluded.country_code,
  legacy_source = excluded.legacy_source,
  is_international = excluded.is_international,
  supports_documents = excluded.supports_documents,
  supports_awards = excluded.supports_awards,
  supports_changes = excluded.supports_changes,
  requires_api_key = excluded.requires_api_key,
  requires_registration = excluded.requires_registration,
  default_enabled = excluded.default_enabled,
  updated_at = now();

CREATE INDEX IF NOT EXISTS source_catalog_country_idx
  ON source_catalog (country_code)
  WHERE country_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS source_catalog_family_idx ON source_catalog (family);
CREATE INDEX IF NOT EXISTS source_catalog_international_idx ON source_catalog (is_international);

CREATE TABLE IF NOT EXISTS source_connector_state (
  source_id text PRIMARY KEY REFERENCES source_catalog (id) ON DELETE CASCADE,
  cursor_value text,
  cursor_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_successful_run_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS selected_country_codes text[] NOT NULL DEFAULT ARRAY['BG']::text[],
  ADD COLUMN IF NOT EXISTS include_international_sources boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS selected_international_source_ids text[] NOT NULL DEFAULT ARRAY['eu-ted', 'eu-sedia', 'opentender-ocds', 'worldbank', 'ungm', 'ebrd-ecepp', 'nato-procurement']::text[];

ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_selected_country_codes_check;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_selected_country_codes_check CHECK (
  cardinality(selected_country_codes) > 0
  AND selected_country_codes <@ ARRAY[
    'AL', 'AU', 'BA', 'BG', 'CA', 'GB', 'GR', 'HR', 'ME', 'MK', 'RO', 'RS', 'SI', 'US'
  ]::text[]
);

ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_selected_international_source_ids_check;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_selected_international_source_ids_check CHECK (
  cardinality(selected_international_source_ids) > 0
  AND selected_international_source_ids <@ ARRAY[
    'eu-ted',
    'eu-sedia',
    'opentender-ocds',
    'worldbank',
    'ungm',
    'ebrd-ecepp',
    'nato-procurement'
  ]::text[]
);

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS source_id text,
  ADD COLUMN IF NOT EXISTS source_country_code text,
  ADD COLUMN IF NOT EXISTS place_of_performance_country_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS opportunity_kind text NOT NULL DEFAULT 'procurement',
  ADD COLUMN IF NOT EXISTS language text;

ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_opportunity_kind_check;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_opportunity_kind_check CHECK (
  opportunity_kind IN ('procurement', 'funding', 'framework', 'award', 'market-consultation')
);

UPDATE opportunities
SET source_id = CASE source
  WHEN 'cais-eop' THEN 'bg-cais-eop'
  WHEN 'ted' THEN 'eu-ted'
  WHEN 'sedia' THEN 'eu-sedia'
  ELSE source
END
WHERE source_id IS NULL;

UPDATE opportunities
SET source_country_code = CASE source
  WHEN 'cais-eop' THEN 'BG'
  ELSE source_country_code
END
WHERE source_country_code IS NULL;

UPDATE opportunities
SET buyer_country_code = CASE buyer_country_code
  WHEN 'ALB' THEN 'AL'
  WHEN 'AUS' THEN 'AU'
  WHEN 'BIH' THEN 'BA'
  WHEN 'BGR' THEN 'BG'
  WHEN 'CAN' THEN 'CA'
  WHEN 'GBR' THEN 'GB'
  WHEN 'UK' THEN 'GB'
  WHEN 'EL' THEN 'GR'
  WHEN 'GRC' THEN 'GR'
  WHEN 'HRV' THEN 'HR'
  WHEN 'MNE' THEN 'ME'
  WHEN 'MKD' THEN 'MK'
  WHEN 'ROU' THEN 'RO'
  WHEN 'RSR' THEN 'RS'
  WHEN 'SRB' THEN 'RS'
  WHEN 'SVN' THEN 'SI'
  WHEN 'USA' THEN 'US'
  ELSE buyer_country_code
END
WHERE buyer_country_code IS NOT NULL;

UPDATE opportunities
SET buyer_country_code = 'BG'
WHERE buyer_country_code IS NULL
  AND source = 'cais-eop';

ALTER TABLE opportunities ALTER COLUMN source_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS opportunities_source_id_idx ON opportunities (source_id);
CREATE INDEX IF NOT EXISTS opportunities_source_country_idx
  ON opportunities (source_country_code)
  WHERE source_country_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS opportunities_buyer_country_idx
  ON opportunities (buyer_country_code)
  WHERE buyer_country_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS opportunities_performance_countries_gin_idx
  ON opportunities USING gin (place_of_performance_country_codes);
CREATE INDEX IF NOT EXISTS opportunities_kind_idx ON opportunities (opportunity_kind);

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
  ('at-usp', 'Austria USP Tender Search', 'national-portal', 'https://www.usp.gv.at/', 'AT', NULL, false, true, true, true, false, false, false),
  ('be-eproc', 'Belgium e-Procurement', 'national-portal', 'https://www.publicprocurement.be/', 'BE', NULL, false, true, true, true, false, false, false),
  ('de-evergabe', 'Germany e-Vergabe / service.bund', 'national-portal', 'https://www.evergabe-online.de/', 'DE', NULL, false, true, true, true, false, false, false),
  ('dk-udbud', 'Denmark Udbud.dk', 'national-portal', 'https://udbud.dk/', 'DK', NULL, false, true, true, true, false, false, false),
  ('es-place', 'Spain Public Sector Procurement Platform', 'national-portal', 'https://contrataciondelestado.es/', 'ES', NULL, false, true, true, true, false, false, false),
  ('fi-hilma', 'Finland Hilma', 'national-portal', 'https://www.hankintailmoitukset.fi/en/', 'FI', NULL, false, true, true, true, false, false, false),
  ('fr-boamp', 'France BOAMP / PLACE', 'national-portal', 'https://www.boamp.fr/', 'FR', NULL, false, true, true, true, false, false, false),
  ('ie-etenders', 'Ireland eTenders', 'national-portal', 'https://www.etenders.gov.ie/', 'IE', NULL, false, true, true, true, false, false, false),
  ('it-anac-bdncp', 'Italy ANAC BDNCP', 'national-portal', 'https://dati.anticorruzione.it/opendata/ocds_en', 'IT', NULL, false, true, true, true, false, false, false),
  ('lu-pmp', 'Luxembourg Portail des marches publics', 'national-portal', 'https://pmp.b2g.etat.lu/', 'LU', NULL, false, true, true, true, false, false, false),
  ('nl-tenderned', 'Netherlands TenderNed', 'national-portal', 'https://www.tenderned.nl/', 'NL', NULL, false, true, true, true, false, false, false),
  ('pt-base', 'Portugal BASE', 'national-portal', 'https://www.base.gov.pt/Base4/en/', 'PT', NULL, false, true, true, true, false, false, false),
  ('se-procurement-authority', 'Sweden Procurement Authority / TED', 'national-portal', 'https://www.upphandlingsmyndigheten.se/en/', 'SE', NULL, false, true, true, true, false, false, false)
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
  default_enabled = excluded.default_enabled;

ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_selected_country_codes_check;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_selected_country_codes_check CHECK (
  cardinality(selected_country_codes) > 0
  AND selected_country_codes <@ ARRAY[
    'AL', 'AT', 'AU', 'BA', 'BE', 'BG', 'CA', 'DE', 'DK', 'ES', 'FI', 'FR', 'GB',
    'GR', 'HR', 'IE', 'IT', 'LU', 'ME', 'MK', 'NL', 'PT', 'RO', 'RS', 'SE', 'SI',
    'US'
  ]::text[]
);

UPDATE opportunities
SET buyer_country_code = CASE buyer_country_code
  WHEN 'AUT' THEN 'AT'
  WHEN 'BEL' THEN 'BE'
  WHEN 'DEU' THEN 'DE'
  WHEN 'DNK' THEN 'DK'
  WHEN 'ESP' THEN 'ES'
  WHEN 'FIN' THEN 'FI'
  WHEN 'FRA' THEN 'FR'
  WHEN 'IRL' THEN 'IE'
  WHEN 'ITA' THEN 'IT'
  WHEN 'LUX' THEN 'LU'
  WHEN 'NLD' THEN 'NL'
  WHEN 'PRT' THEN 'PT'
  WHEN 'SWE' THEN 'SE'
  ELSE buyer_country_code
END
WHERE buyer_country_code IS NOT NULL;

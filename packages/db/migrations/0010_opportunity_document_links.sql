ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS document_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS submission_urls text[] NOT NULL DEFAULT '{}';

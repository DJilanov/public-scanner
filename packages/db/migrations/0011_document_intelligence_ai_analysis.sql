ALTER TABLE document_intelligence
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb;

CREATE INDEX IF NOT EXISTS document_intelligence_ai_analysis_gin_idx
  ON document_intelligence USING gin (ai_analysis)
  WHERE ai_analysis IS NOT NULL;

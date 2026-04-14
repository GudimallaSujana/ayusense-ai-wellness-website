
DROP INDEX IF EXISTS idx_herbs_name_trgm;
DROP EXTENSION IF EXISTS pg_trgm CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;
CREATE INDEX idx_herbs_name_trgm ON public.herbs USING gin (name extensions.gin_trgm_ops);

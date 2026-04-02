-- Adiciona coluna is_public e mode na tabela image_jobs
ALTER TABLE image_jobs ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;
ALTER TABLE image_jobs ADD COLUMN IF NOT EXISTS mode text DEFAULT 'simulacao';

-- Index para feed público
CREATE INDEX IF NOT EXISTS idx_image_jobs_public_feed
  ON image_jobs (created_at DESC)
  WHERE is_public = true AND status = 'done';

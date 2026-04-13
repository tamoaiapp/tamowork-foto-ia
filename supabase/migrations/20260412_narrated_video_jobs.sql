-- Tabela para jobs de vídeo com narração
CREATE TABLE IF NOT EXISTS narrated_video_jobs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'queued',
  -- queued | submitting | generating_scenes | assembling | done | failed | canceled

  -- Input
  input_image_url    TEXT NOT NULL,
  roteiro            TEXT NOT NULL,          -- roteiro original do usuário
  roteiro_melhorado  TEXT,                   -- roteiro após melhoria pela IA

  -- Progresso interno (não exposto ao frontend)
  scene_comfy_ids    TEXT[],                 -- prompt_ids do ComfyUI
  scene_comfy_index  INTEGER DEFAULT 0,      -- índice do COMFY_BASES usado
  scene_urls         TEXT[],                 -- URLs das cenas geradas

  -- Output
  output_video_url   TEXT,
  error_message      TEXT,
  attempts           INTEGER DEFAULT 0,

  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE narrated_video_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own narrated_video_jobs"
  ON narrated_video_jobs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role bypasses RLS (para o cron e API interna)
CREATE POLICY "Service role full access narrated_video_jobs"
  ON narrated_video_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Índices para o cron
CREATE INDEX IF NOT EXISTS idx_narrated_video_jobs_status
  ON narrated_video_jobs (status, updated_at);

CREATE INDEX IF NOT EXISTS idx_narrated_video_jobs_user
  ON narrated_video_jobs (user_id, created_at DESC);

-- Tabelas para o sistema de feedback e agente de melhoria de prompts

CREATE TABLE IF NOT EXISTS prompt_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  job_id uuid,
  rating int2 CHECK (rating >= 1 AND rating <= 5),
  feedback_text text,
  product_name text,
  prompt_slot text,
  input_url text,
  output_url text,
  analyzed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE prompt_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can insert own feedback"
  ON prompt_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can read own feedback"
  ON prompt_feedback FOR SELECT
  USING (auth.uid() = user_id);

-- Sugestões de melhoria geradas pelo agente
CREATE TABLE IF NOT EXISTS prompt_suggestions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source text,                    -- 'user_feedback' | 'auto_scan'
  feedback_id uuid,
  product_name text,
  inferred_slot text,
  issue_category text,
  issue_keywords text[],
  suggestion text,
  priority int2 DEFAULT 1,
  applied boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE prompt_suggestions ENABLE ROW LEVEL SECURITY;

-- Só leitura para service role (sem acesso público)
CREATE POLICY "service role only"
  ON prompt_suggestions FOR ALL
  USING (false);

-- Log de qualidade — histórico das análises do agente
CREATE TABLE IF NOT EXISTS prompt_quality_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  run_at timestamptz DEFAULT now(),
  total_jobs_analyzed int4,
  total_feedback int4,
  avg_rating numeric(3,2),
  bad_rating_count int4,
  new_suggestions int4,
  top_issues jsonb,
  summary text
);

ALTER TABLE prompt_quality_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only log"
  ON prompt_quality_log FOR ALL
  USING (false);

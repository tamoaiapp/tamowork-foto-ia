-- Rodar no Supabase Dashboard > SQL Editor

-- 1. Perfil de estilo global por usuário
CREATE TABLE IF NOT EXISTS user_prompt_profiles (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lighting      TEXT NOT NULL DEFAULT '',
  background    TEXT NOT NULL DEFAULT '',
  style_pref    TEXT NOT NULL DEFAULT '',
  extra_context TEXT NOT NULL DEFAULT '',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE user_prompt_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_prompt_profiles_self ON user_prompt_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Correções de âncora por produto (específicas por usuário + tipo de produto)
CREATE TABLE IF NOT EXISTS photo_product_corrections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_keywords TEXT[] NOT NULL,        -- ex: ['buquê','flor','bouquet']
  anchor_correction TEXT NOT NULL,         -- ex: 'held in both hands by the bride'
  notes            TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE photo_product_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY photo_product_corrections_self ON photo_product_corrections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Índice para busca por user_id
CREATE INDEX IF NOT EXISTS idx_product_corrections_user ON photo_product_corrections(user_id);

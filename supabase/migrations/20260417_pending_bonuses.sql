-- Tabela de bônus pendentes: emails pré-cadastrados recebem PRO automático ao criar conta
CREATE TABLE IF NOT EXISTS pending_bonuses (
  email TEXT PRIMARY KEY,
  days  INT NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Função que dispara quando um novo usuário é criado no Supabase Auth
CREATE OR REPLACE FUNCTION apply_pending_bonus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_days INT;
BEGIN
  -- Busca bônus pendente pelo email (case-insensitive)
  SELECT days INTO v_days
  FROM public.pending_bonuses
  WHERE lower(email) = lower(NEW.email);

  -- Se encontrou, aplica plano PRO com period_end = agora + X dias
  IF v_days IS NOT NULL THEN
    INSERT INTO public.user_plans (user_id, plan, period_end, updated_at)
    VALUES (
      NEW.id,
      'pro',
      NOW() + (v_days || ' days')::INTERVAL,
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan       = 'pro',
      period_end = NOW() + (v_days || ' days')::INTERVAL,
      updated_at = NOW();

    -- Remove da fila após aplicar
    DELETE FROM public.pending_bonuses WHERE lower(email) = lower(NEW.email);
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger em auth.users (executa após cada INSERT de novo usuário)
DROP TRIGGER IF EXISTS trg_apply_pending_bonus ON auth.users;
CREATE TRIGGER trg_apply_pending_bonus
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION apply_pending_bonus();

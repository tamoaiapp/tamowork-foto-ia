import { NextRequest, NextResponse } from "next/server";

// Rota interna — só acessível com a service role key no header
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-migrate-secret");
  if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const steps: { name: string; ok: boolean; error?: string }[] = [];

  const pgUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`;

  async function runSQL(name: string, sql: string) {
    try {
      const res = await fetch(pgUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
        body: JSON.stringify({ sql }),
      });
      if (!res.ok) {
        const txt = await res.text();
        steps.push({ name, ok: false, error: txt });
      } else {
        steps.push({ name, ok: true });
      }
    } catch (e) {
      steps.push({ name, ok: false, error: String(e) });
    }
  }

  // Migrations
  await runSQL("user_prompt_profiles", `
    CREATE TABLE IF NOT EXISTS user_prompt_profiles (
      user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      lighting TEXT NOT NULL DEFAULT '',
      background TEXT NOT NULL DEFAULT '',
      style_pref TEXT NOT NULL DEFAULT '',
      extra_context TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await runSQL("user_prompt_profiles_rls", `
    ALTER TABLE user_prompt_profiles ENABLE ROW LEVEL SECURITY;
  `);

  await runSQL("user_prompt_profiles_policy", `
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='user_prompt_profiles' AND policyname='user_prompt_profiles_self'
      ) THEN
        CREATE POLICY user_prompt_profiles_self ON user_prompt_profiles
          FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
      END IF;
    END $$;
  `);

  await runSQL("photo_product_corrections", `
    CREATE TABLE IF NOT EXISTS photo_product_corrections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      product_keywords TEXT[] NOT NULL,
      anchor_correction TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await runSQL("photo_product_corrections_rls", `
    ALTER TABLE photo_product_corrections ENABLE ROW LEVEL SECURITY;
  `);

  await runSQL("photo_product_corrections_policy", `
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='photo_product_corrections' AND policyname='photo_product_corrections_self'
      ) THEN
        CREATE POLICY photo_product_corrections_self ON photo_product_corrections
          FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
      END IF;
    END $$;
  `);

  await runSQL("photo_product_corrections_index", `
    CREATE INDEX IF NOT EXISTS idx_product_corrections_user ON photo_product_corrections(user_id);
  `);

  return NextResponse.json({ ok: true, steps });
}

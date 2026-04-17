/**
 * POST /api/internal/migrate
 * Rota de migração interna — só funciona com CRON_SECRET.
 * Cria tabelas do sistema de feedback de prompts.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabaseAdmin = createSupabaseAdminClient();
  const secret = req.headers.get("x-secret") ?? "";
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: string[] = [];

  const sqls = [
    `CREATE TABLE IF NOT EXISTS prompt_feedback (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id uuid,
      job_id uuid,
      rating int2 CHECK (rating >= 1 AND rating <= 5),
      feedback_text text,
      product_name text,
      prompt_slot text,
      input_url text,
      output_url text,
      analyzed boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    )`,
    `ALTER TABLE IF EXISTS prompt_feedback ENABLE ROW LEVEL SECURITY`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prompt_feedback' AND policyname='users can insert own feedback') THEN
         CREATE POLICY "users can insert own feedback" ON prompt_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
       END IF;
     END $$`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prompt_feedback' AND policyname='users can read own feedback') THEN
         CREATE POLICY "users can read own feedback" ON prompt_feedback FOR SELECT USING (auth.uid() = user_id);
       END IF;
     END $$`,
    `CREATE TABLE IF NOT EXISTS prompt_suggestions (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      source text,
      feedback_id uuid,
      product_name text,
      inferred_slot text,
      issue_category text,
      issue_keywords text[],
      suggestion text,
      priority int2 DEFAULT 1,
      applied boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    )`,
    `ALTER TABLE IF EXISTS prompt_suggestions ENABLE ROW LEVEL SECURITY`,
    `CREATE TABLE IF NOT EXISTS prompt_quality_log (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      run_at timestamptz DEFAULT now(),
      total_jobs_analyzed int4,
      total_feedback int4,
      avg_rating numeric(3,2),
      bad_rating_count int4,
      new_suggestions int4,
      top_issues jsonb,
      summary text
    )`,
    `ALTER TABLE IF EXISTS prompt_quality_log ENABLE ROW LEVEL SECURITY`,
  ];

  for (const sql of sqls) {
    try {
      const { error } = await (supabaseAdmin as any).rpc("exec_sql", { sql });
      if (error) {
        results.push(`⚠️ ${sql.slice(0, 60)}... → ${error.message}`);
      } else {
        results.push(`✅ ${sql.slice(0, 60)}...`);
      }
    } catch (e) {
      results.push(`❌ ${sql.slice(0, 60)}... → ${String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, results });
}

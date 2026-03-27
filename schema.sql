-- ============================================================
-- TamoWork Foto IA — Schema Supabase
-- Rodar no SQL Editor do Supabase Dashboard
-- ============================================================

create table image_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  tool text not null default 'photo_ai',
  prompt text,
  input_image_url text,
  status text not null default 'queued',
  provider text default 'comfyui',
  external_job_id text,
  output_image_url text,
  error_message text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices
create index image_jobs_user_id_idx on image_jobs (user_id);
create index image_jobs_status_created_at_idx on image_jobs (status, created_at desc);

-- Trigger updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger image_jobs_updated_at
  before update on image_jobs
  for each row execute function update_updated_at();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
alter table image_jobs enable row level security;

-- Usuário só vê os próprios jobs
create policy "user sees own jobs"
  on image_jobs for select
  using (auth.uid() = user_id);

-- Usuário só insere com seu próprio user_id
create policy "user inserts own jobs"
  on image_jobs for insert
  with check (auth.uid() = user_id);

-- Usuário pode cancelar o próprio job (update limitado)
create policy "user updates own jobs"
  on image_jobs for update
  using (auth.uid() = user_id);

-- Service role (backend) tem acesso total — sem RLS via service_role_key

-- ============================================================
-- Storage buckets
-- Criar manualmente no painel: Storage > New bucket
-- ============================================================
-- Bucket: "input-images"  → público (para ComfyUI ler a URL)
-- Bucket: "image-jobs"    → privado (resultado final do usuário)

-- ============================================================
-- Realtime
-- Habilitar em: Database > Replication > image_jobs
-- ============================================================

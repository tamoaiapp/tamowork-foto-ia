-- Onboarding do TamoBot (1 linha por usuário)
create table if not exists bot_onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_name text,
  business_type text,
  products text,
  tone text,
  context text, -- resumo gerado pela IA
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Mensagens do chat
create table if not exists bot_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);
create index if not exists bot_messages_user_created on bot_messages(user_id, created_at desc);

-- Memória condensada (atualizada todo dia pelo cron)
create table if not exists bot_memory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  summary text not null default '',
  updated_at timestamptz default now()
);

-- Preferência: ativou IA 24h?
alter table user_plans add column if not exists bot_active boolean default false;

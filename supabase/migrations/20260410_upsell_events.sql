create table if not exists upsell_events (
  id         uuid        primary key default gen_random_uuid(),
  event      text        not null,   -- 'impression' | 'click'
  variant    text        not null,   -- e.g. 'v1_escassez'
  created_at timestamptz default now()
);

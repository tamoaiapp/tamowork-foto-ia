create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null unique,
  display_name text,
  commission_rate numeric(5,4) not null default 0.3000,
  stripe_account_id text unique,
  stripe_account_status text not null default 'not_connected'
    check (stripe_account_status in ('not_connected', 'pending', 'active', 'restricted')),
  stripe_onboarding_complete boolean not null default false,
  stripe_charges_enabled boolean not null default false,
  stripe_payouts_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  referral_code text not null,
  visitor_id text not null,
  landing_path text,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create table if not exists affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  referred_user_id uuid unique references auth.users(id) on delete set null,
  visitor_id text,
  referral_code text not null,
  referred_email text,
  status text not null default 'clicked'
    check (status in ('clicked', 'signed_up', 'checkout_started', 'active', 'canceled')),
  first_clicked_at timestamptz not null default now(),
  signed_up_at timestamptz,
  checkout_started_at timestamptz,
  converted_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  latest_invoice_id text,
  last_paid_at timestamptz,
  next_billing_at timestamptz,
  total_paid_cents bigint not null default 0,
  total_commission_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  referral_id uuid references affiliate_referrals(id) on delete set null,
  referred_user_id uuid references auth.users(id) on delete set null,
  stripe_invoice_id text not null unique,
  stripe_subscription_id text,
  gross_amount_cents bigint not null default 0,
  commission_amount_cents bigint not null default 0,
  currency text not null default 'brl',
  status text not null default 'pending'
    check (status in ('pending', 'transferred', 'paid', 'canceled', 'failed')),
  earned_at timestamptz not null default now(),
  available_at timestamptz,
  transferred_at timestamptz,
  paid_at timestamptz,
  payout_estimated_at timestamptz,
  stripe_transfer_id text,
  stripe_payout_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_affiliates_code on affiliates(code);
create index if not exists idx_affiliate_clicks_affiliate_created on affiliate_clicks(affiliate_id, created_at desc);
create index if not exists idx_affiliate_clicks_visitor on affiliate_clicks(visitor_id, created_at desc);
create index if not exists idx_affiliate_referrals_affiliate on affiliate_referrals(affiliate_id, created_at desc);
create index if not exists idx_affiliate_referrals_user on affiliate_referrals(referred_user_id);
create index if not exists idx_affiliate_referrals_subscription on affiliate_referrals(stripe_subscription_id);
create index if not exists idx_affiliate_commissions_affiliate on affiliate_commissions(affiliate_id, created_at desc);
create index if not exists idx_affiliate_commissions_status_available on affiliate_commissions(status, available_at);
create index if not exists idx_affiliate_commissions_transfer on affiliate_commissions(stripe_transfer_id);

drop trigger if exists affiliates_set_updated_at on affiliates;
create trigger affiliates_set_updated_at
before update on affiliates
for each row execute function update_updated_at();

drop trigger if exists affiliate_referrals_set_updated_at on affiliate_referrals;
create trigger affiliate_referrals_set_updated_at
before update on affiliate_referrals
for each row execute function update_updated_at();

drop trigger if exists affiliate_commissions_set_updated_at on affiliate_commissions;
create trigger affiliate_commissions_set_updated_at
before update on affiliate_commissions
for each row execute function update_updated_at();

alter table affiliates enable row level security;
alter table affiliate_clicks enable row level security;
alter table affiliate_referrals enable row level security;
alter table affiliate_commissions enable row level security;

drop policy if exists "Users can manage own affiliate profile" on affiliates;
create policy "Users can manage own affiliate profile"
  on affiliates
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Affiliate owners can read clicks" on affiliate_clicks;
create policy "Affiliate owners can read clicks"
  on affiliate_clicks
  for select
  using (
    exists (
      select 1 from affiliates
      where affiliates.id = affiliate_clicks.affiliate_id
        and affiliates.user_id = auth.uid()
    )
  );

drop policy if exists "Affiliate owners can read referrals" on affiliate_referrals;
create policy "Affiliate owners can read referrals"
  on affiliate_referrals
  for select
  using (
    exists (
      select 1 from affiliates
      where affiliates.id = affiliate_referrals.affiliate_id
        and affiliates.user_id = auth.uid()
    )
  );

drop policy if exists "Affiliate owners can read commissions" on affiliate_commissions;
create policy "Affiliate owners can read commissions"
  on affiliate_commissions
  for select
  using (
    exists (
      select 1 from affiliates
      where affiliates.id = affiliate_commissions.affiliate_id
        and affiliates.user_id = auth.uid()
    )
  );

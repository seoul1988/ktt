-- Supabase SQL Editor: run once. No existing business/website data is changed.
create table if not exists public.restaurant_order_domains (
  hostname text primary key check (hostname = lower(hostname) and length(hostname) <= 253),
  business_id bigint not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('platform','custom')),
  status text not null default 'pending' check (status in ('pending','verified','error')),
  enabled boolean not null default true,
  dns_records jsonb not null default '[]'::jsonb,
  last_error text,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.restaurant_order_domains enable row level security;
revoke all on public.restaurant_order_domains from anon, authenticated;
grant all on public.restaurant_order_domains to service_role;
create index if not exists restaurant_order_domains_business_idx on public.restaurant_order_domains(business_id);

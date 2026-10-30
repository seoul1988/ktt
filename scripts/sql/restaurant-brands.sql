-- Run after order-domains.sql. Existing business/menu/order data is retained.
begin;
alter table public.businesses add column if not exists brand_code text;
create index if not exists businesses_brand_code_idx on public.businesses(brand_code) where brand_code is not null;
do $$ begin
 if not exists (select 1 from pg_constraint where conname='businesses_brand_code_format' and conrelid='public.businesses'::regclass) then
  alter table public.businesses add constraint businesses_brand_code_format check (brand_code is null or (length(brand_code)<=60 and brand_code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'));
 end if;
end $$;
alter table public.restaurant_order_domains add column if not exists brand_code text;
alter table public.restaurant_order_domains alter column business_id drop not null;
do $$ begin
 if not exists (select 1 from pg_constraint where conname='order_domain_target' and conrelid='public.restaurant_order_domains'::regclass) then
  alter table public.restaurant_order_domains add constraint order_domain_target check (
   (business_id is not null and brand_code is null) or
   (business_id is null and brand_code is not null and length(brand_code)<=60 and brand_code ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
  );
 end if;
end $$;
commit;

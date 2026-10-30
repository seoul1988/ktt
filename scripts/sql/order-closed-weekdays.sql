begin;
alter table public.restaurant_order_settings
 add column if not exists order_closed_weekdays integer[] not null default '{}';
do $$ begin
 if not exists (select 1 from pg_constraint where conname='restaurant_order_closed_weekdays_valid' and conrelid='public.restaurant_order_settings'::regclass) then
  alter table public.restaurant_order_settings add constraint restaurant_order_closed_weekdays_valid check (
   order_closed_weekdays <@ array[0,1,2,3,4,5,6]::integer[]
   and cardinality(order_closed_weekdays)<=7
   and array_position(order_closed_weekdays,null) is null
   and (cardinality(order_closed_weekdays)=0 or array_ndims(order_closed_weekdays)=1)
  );
 end if;
end $$;
commit;

begin;
alter table public.businesses
 add column if not exists google_hours_auto_enabled boolean not null default false,
 add column if not exists google_hours_manual text,
 add column if not exists google_hours_source text not null default 'manual',
 add column if not exists google_hours_checked_at timestamptz,
 add column if not exists google_hours_run_date date,
 add column if not exists google_hours_claimed_at timestamptz,
 add column if not exists google_hours_claim_token uuid,
 add column if not exists google_hours_result text,
 add column if not exists google_hours_last_error text;
update public.businesses set google_hours_manual=hours where google_hours_manual is null and hours is not null and google_hours_source='manual';
create index if not exists businesses_google_hours_due_idx on public.businesses(google_hours_run_date,id) where google_hours_auto_enabled;

-- Capture normal edits from ALL existing editors; background writes use the private RPC below.
create or replace function public.capture_business_manual_hours() returns trigger
language plpgsql set search_path=public as $$
begin
 if current_setting('app.google_hours_writer',true) is distinct from 'sync' then
  if TG_OP='INSERT' then new.google_hours_manual:=new.hours; new.google_hours_source:='manual';
  elsif new.hours is distinct from old.hours then new.google_hours_manual:=new.hours;new.google_hours_source:='manual';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists capture_business_manual_hours on public.businesses;
create trigger capture_business_manual_hours before insert or update of hours on public.businesses
 for each row execute function public.capture_business_manual_hours();

create or replace function public.google_hours_due_ids(p_shard integer,p_day date,p_limit integer default 12)
 returns table(id bigint) language sql stable security definer set search_path=public as $$
 select b.id::bigint from public.businesses b where b.google_hours_auto_enabled
 and mod(b.id,8)=p_shard and b.google_hours_run_date is distinct from p_day
 and (b.google_hours_claimed_at is null or b.google_hours_claimed_at<now()-interval '10 minutes')
 order by b.id limit least(greatest(p_limit,1),24)
$$;
create or replace function public.claim_google_hours(p_id bigint,p_day date,p_force boolean default false)
 returns table(id bigint,current_hours text,manual_hours text,place_id text,claim_token uuid)
 language sql security definer set search_path=public as $$
 update public.businesses b set google_hours_run_date=p_day,google_hours_claimed_at=now(),google_hours_claim_token=gen_random_uuid(),google_hours_result='running'
 where b.id=p_id and b.google_hours_auto_enabled and (p_force or b.google_hours_run_date is distinct from p_day)
 and (b.google_hours_claimed_at is null or b.google_hours_claimed_at<now()-interval '10 minutes')
 returning b.id::bigint,b.hours,b.google_hours_manual,b.google_place_id,b.google_hours_claim_token
$$;
create or replace function public.finish_google_hours(p_id bigint,p_token uuid,p_expected text,p_hours text,p_source text,p_result text,p_error text default null)
 returns text language plpgsql security definer set search_path=public as $$
declare b public.businesses%rowtype; outcome text;
begin
 select * into b from public.businesses where id=p_id for update;
 if not found or b.google_hours_claim_token is distinct from p_token then return 'claim_lost';end if;
 outcome:=p_result;
 if not b.google_hours_auto_enabled then outcome:='disabled';
 elsif b.hours is distinct from p_expected then outcome:='edited_during_sync';
 elsif p_hours is not null then
  if p_source not in ('google','manual_fallback') then raise exception 'invalid hours source';end if;
  perform set_config('app.google_hours_writer','sync',true);
  update public.businesses set hours=p_hours,google_hours_source=p_source where id=p_id;
  perform set_config('app.google_hours_writer','',true);
 end if;
 update public.businesses set google_hours_checked_at=now(),google_hours_claimed_at=null,google_hours_claim_token=null,
 google_hours_result=outcome,google_hours_last_error=p_error where id=p_id;
 return outcome;
end $$;
revoke all on function public.google_hours_due_ids(integer,date,integer) from public,anon,authenticated;
revoke all on function public.claim_google_hours(bigint,date,boolean) from public,anon,authenticated;
revoke all on function public.finish_google_hours(bigint,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.google_hours_due_ids(integer,date,integer) to service_role;
grant execute on function public.claim_google_hours(bigint,date,boolean) to service_role;
grant execute on function public.finish_google_hours(bigint,uuid,text,text,text,text,text) to service_role;
commit;

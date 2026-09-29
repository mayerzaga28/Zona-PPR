begin;
create table if not exists zona_private.identities (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text unique not null check(username ~ '^[a-z0-9_]{3,24}$'),
 recovery_hash text not null check(recovery_hash ~ '^[0-9a-f]{64}$')
);
create table if not exists zona_private.auth_limits (
 key text primary key, started_at timestamptz not null, attempts integer not null
);
alter table zona_private.identities enable row level security;
alter table zona_private.auth_limits enable row level security;
create or replace function public.zona_auth_limit(p_keys text[],p_max integer,p_seconds integer) returns boolean language plpgsql security definer set search_path='' as $$
declare k text; a integer; allowed boolean:=true;
begin
 if cardinality(p_keys) not between 1 and 3 or p_max not between 1 and 100 or p_seconds not between 60 and 86400 then raise exception 'Invalid rate limit';end if;
 for k in select unnest(p_keys) order by 1 loop
  insert into zona_private.auth_limits values(k,clock_timestamp(),1)
  on conflict(key) do update set started_at=case when zona_private.auth_limits.started_at<clock_timestamp()-make_interval(secs=>p_seconds) then clock_timestamp() else zona_private.auth_limits.started_at end,
  attempts=case when zona_private.auth_limits.started_at<clock_timestamp()-make_interval(secs=>p_seconds) then 1 else zona_private.auth_limits.attempts+1 end
  returning attempts into a;
  if a>p_max then allowed:=false;end if;
 end loop;
 delete from zona_private.auth_limits where started_at<clock_timestamp()-interval '2 days';
 return allowed;
end $$;
create or replace function public.zona_identity_create(p_user uuid,p_username text,p_hash text) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into zona_private.identities values(p_user,p_username,p_hash);
 insert into zona_private.profiles(user_id,nickname) values(p_user,p_username);
end $$;
create or replace function public.zona_recovery_claim(p_username text,p_hash text,p_new_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 update zona_private.identities set recovery_hash=p_new_hash where username=p_username and recovery_hash=p_hash returning user_id into u;
 return u;
end $$;
create or replace function public.zona_recovery_restore(p_user uuid,p_hash text,p_previous text) returns void language plpgsql security definer set search_path='' as $$
begin
 update zona_private.identities set recovery_hash=p_previous where user_id=p_user and recovery_hash=p_hash;
end $$;
revoke all on function public.zona_auth_limit(text[],integer,integer),public.zona_identity_create(uuid,text,text),public.zona_recovery_claim(text,text,text),public.zona_recovery_restore(uuid,text,text) from public,anon,authenticated;
grant execute on function public.zona_auth_limit(text[],integer,integer),public.zona_identity_create(uuid,text,text),public.zona_recovery_claim(text,text,text),public.zona_recovery_restore(uuid,text,text) to service_role;
commit;

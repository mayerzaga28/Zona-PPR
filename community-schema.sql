-- Zona PPR: apply once using Supabase SQL Editor (project owner).
-- All user tables are private; public RPCs enforce verified identity and membership.
begin;
create schema if not exists zona_private;
revoke all on schema zona_private from public, anon, authenticated;
create table if not exists zona_private.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 nickname text not null check(char_length(nickname) between 2 and 30),
 created_at timestamptz not null default now()
);
create table if not exists zona_private.groups (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references zona_private.profiles(user_id),
 name text not null check(char_length(name) between 2 and 50),
 invite_code text unique not null default replace(gen_random_uuid()::text,'-',''),
 season integer not null default 2026 check(season=2026),
 start_week integer not null check(start_week between 1 and 18),
 created_at timestamptz not null default now()
);
create table if not exists zona_private.members (
 group_id uuid not null references zona_private.groups(id) on delete cascade,
 user_id uuid not null references zona_private.profiles(user_id),
 joined_at timestamptz not null default now(),
 primary key(group_id,user_id)
);
create table if not exists zona_private.games (
 week integer not null check(week between 1 and 18),
 home text not null, away text not null,
 kickoff timestamptz not null,
 home_score integer, away_score integer,
 primary key(week,home),
 check(home<>away),
 check((home_score is null)=(away_score is null))
);
create table if not exists zona_private.schedule_meta (
 id integer primary key check(id=1),current_week integer not null check(current_week between 1 and 18),
 source_at timestamptz not null
);
create table if not exists zona_private.picks (
 group_id uuid not null,user_id uuid not null,week integer not null check(week between 1 and 18),
 team text not null,chosen_at timestamptz not null default now(),
 primary key(group_id,user_id,week),
 unique(group_id,user_id,team),
 foreign key(group_id,user_id) references zona_private.members(group_id,user_id)
);
create index if not exists zona_members_user on zona_private.members(user_id);
alter table zona_private.profiles enable row level security;
alter table zona_private.groups enable row level security;
alter table zona_private.members enable row level security;
alter table zona_private.games enable row level security;
alter table zona_private.schedule_meta enable row level security;
alter table zona_private.picks enable row level security;

create or replace function zona_private.require_user() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null or not exists(select 1 from auth.users where id=u and email_confirmed_at is not null) then raise exception 'Inicia sesión y confirma tu correo.';end if;
 return u;
end $$;
create or replace function zona_private.require_schedule() returns integer language plpgsql security definer set search_path='' as $$
declare w integer;
begin
 select current_week into w from zona_private.schedule_meta where id=1 and source_at>clock_timestamp()-interval '6 minutes' and source_at<=clock_timestamp()+interval '1 minute';
 if w is null then raise exception 'El calendario necesita actualizarse. Inténtalo de nuevo.';end if;
 return w;
end $$;
create or replace function zona_private.member_status(g uuid,u uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare first_week integer;w integer;chosen text;gm zona_private.games%rowtype;deadline timestamptz;wins integer:=0;
begin
 select start_week into first_week from zona_private.groups where id=g;
 for w in first_week..18 loop
  select team into chosen from zona_private.picks where group_id=g and user_id=u and week=w;
  select max(kickoff) into deadline from zona_private.games where week=w;
  if chosen is null then
   if deadline<=clock_timestamp() then return jsonb_build_object('state','eliminated','week',w,'reason','Sin elección','wins',wins);end if;
  else
   select * into gm from zona_private.games where week=w and (home=chosen or away=chosen);
   if gm.home_score is not null then
    if (gm.home=chosen and gm.home_score>gm.away_score) or (gm.away=chosen and gm.away_score>gm.home_score) then wins:=wins+1;
    else return jsonb_build_object('state','eliminated','week',w,'reason','Derrota o empate','wins',wins);end if;
   end if;
  end if;
 end loop;
 return jsonb_build_object('state',case when wins=19-first_week then 'completed' else 'alive' end,'wins',wins);
end $$;

-- Only the Vercel backend service key may ingest the authoritative NFL schedule.
create or replace function public.zona_sync_schedule(p_games jsonb,p_week integer,p_source_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
 if jsonb_typeof(p_games)<>'array' or jsonb_array_length(p_games)<>272 or p_week not between 1 and 18 or p_source_at<clock_timestamp()-interval '6 minutes' or p_source_at>clock_timestamp()+interval '1 minute' then raise exception 'Calendario inválido';end if;
 perform pg_advisory_xact_lock(20260001);
 if exists(select 1 from zona_private.schedule_meta where source_at>p_source_at) then return;end if;
 insert into zona_private.games(week,home,away,kickoff,home_score,away_score)
 select (x->>'week')::integer,x->>'home',x->>'away',(x->>'date')::timestamptz,(x->>'homeScore')::integer,(x->>'awayScore')::integer from jsonb_array_elements(p_games) x
 on conflict(week,home) do update set away=excluded.away,kickoff=excluded.kickoff,home_score=excluded.home_score,away_score=excluded.away_score;
 insert into zona_private.schedule_meta values(1,p_week,p_source_at) on conflict(id) do update set current_week=excluded.current_week,source_at=excluded.source_at;
end $$;
create or replace function public.zona_profile(p_nickname text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=zona_private.require_user();n text:=trim(p_nickname);
begin
 if n is null or char_length(n) not between 2 and 30 or n~'[[:cntrl:]]' then raise exception 'Usa un apodo de 2 a 30 caracteres.';end if;
 insert into zona_private.profiles(user_id,nickname) values(u,n) on conflict(user_id) do update set nickname=excluded.nickname;
 return jsonb_build_object('nickname',n);
end $$;
create or replace function public.zona_create_group(p_name text,p_start_week integer) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=zona_private.require_user();g uuid;n text:=trim(p_name);deadline timestamptz;
begin
 perform zona_private.require_schedule();
 perform 1 from zona_private.profiles where user_id=u for update;
 if not found then raise exception 'Guarda primero tu apodo.';end if;
 if (select count(*) from zona_private.members where user_id=u)>=30 then raise exception 'Límite de 30 grupos por cuenta.';end if;
 if (select count(*) from zona_private.groups where owner_id=u)>=20 then raise exception 'Límite de 20 grupos por cuenta.';end if;
 if n is null or char_length(n) not between 2 and 50 then raise exception 'El nombre debe tener entre 2 y 50 caracteres.';end if;
 select min(kickoff) into deadline from zona_private.games where week=p_start_week;
 if deadline is null or deadline<=clock_timestamp() then raise exception 'Elige una semana que aún no haya comenzado.';end if;
 insert into zona_private.groups(owner_id,name,start_week) values(u,n,p_start_week) returning id into g;
 insert into zona_private.members(group_id,user_id) values(g,u);
 return g;
end $$;
create or replace function public.zona_join_group(p_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=zona_private.require_user();g zona_private.groups%rowtype;deadline timestamptz;
begin
 perform zona_private.require_schedule();
 perform 1 from zona_private.profiles where user_id=u for update;
 if not found then raise exception 'Guarda primero tu apodo.';end if;
 select * into g from zona_private.groups where invite_code=lower(trim(p_code)) for update;
 if not found then raise exception 'Invitación inválida.';end if;
 if exists(select 1 from zona_private.members where group_id=g.id and user_id=u) then return g.id;end if;
 select min(kickoff) into deadline from zona_private.games where week=g.start_week;
 if deadline is null or deadline<=clock_timestamp() then raise exception 'El grupo ya comenzó; no admite participantes nuevos.';end if;
 if (select count(*) from zona_private.members where group_id=g.id)>=50 then raise exception 'El grupo está lleno (50 personas).';end if;
 if (select count(*) from zona_private.members where user_id=u)>=30 then raise exception 'Límite de 30 grupos por cuenta.';end if;
 insert into zona_private.members(group_id,user_id) values(g.id,u);
 return g.id;
end $$;
create or replace function public.zona_pick(p_group uuid,p_week integer,p_team text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=zona_private.require_user();w integer;start_w integer;gm zona_private.games%rowtype;old_team text;old_kickoff timestamptz;
begin
 w:=zona_private.require_schedule();
 -- Serialize all picks for this membership, including requests for different weeks.
 perform 1 from zona_private.members where group_id=p_group and user_id=u for update;
 if not found then raise exception 'No perteneces a este grupo.';end if;
 select start_week into start_w from zona_private.groups where id=p_group;
 if p_week<>greatest(w,start_w) then raise exception 'Solo puedes elegir para la semana habilitada.';end if;
 if zona_private.member_status(p_group,u)->>'state'<>'alive' then raise exception 'Tu participación ya terminó.';end if;
 select * into gm from zona_private.games where week=p_week and (home=p_team or away=p_team);
 if not found or gm.kickoff<=clock_timestamp() or gm.home_score is not null then raise exception 'Ese partido ya comenzó o no está disponible.';end if;
 select team into old_team from zona_private.picks where group_id=p_group and user_id=u and week=p_week;
 select kickoff into old_kickoff from zona_private.games where week=p_week and (home=old_team or away=old_team);
 if old_kickoff<=clock_timestamp() then raise exception 'Tu elección ya está bloqueada.';end if;
 if exists(select 1 from zona_private.picks where group_id=p_group and user_id=u and week<>p_week and team=p_team) then raise exception 'Ya usaste ese equipo.';end if;
 insert into zona_private.picks(group_id,user_id,week,team) values(p_group,u,p_week,p_team)
 on conflict(group_id,user_id,week) do update set team=excluded.team,chosen_at=clock_timestamp();
end $$;
create or replace function public.zona_dashboard(p_group uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=zona_private.require_user();w integer;g zona_private.groups%rowtype;result jsonb;
begin
 select current_week into w from zona_private.schedule_meta where id=1;
 result:=jsonb_build_object('userId',u,'serverTime',now(),'currentWeek',w,'scheduleAt',(select source_at from zona_private.schedule_meta where id=1),'profile',(select jsonb_build_object('nickname',nickname) from zona_private.profiles where user_id=u),'groups',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'startWeek',x.start_week) order by x.created_at desc) from zona_private.groups x join zona_private.members m on m.group_id=x.id where m.user_id=u),'[]'::jsonb),'games',coalesce((select jsonb_agg(jsonb_build_object('week',week,'home',home,'away',away,'date',kickoff,'homeScore',home_score,'awayScore',away_score) order by week,kickoff) from zona_private.games),'[]'::jsonb));
 if p_group is null then return result;end if;
 if not exists(select 1 from zona_private.members where group_id=p_group and user_id=u) then raise exception 'No perteneces a este grupo.';end if;
 select * into g from zona_private.groups where id=p_group;
 return result||jsonb_build_object('group',jsonb_build_object('id',g.id,'name',g.name,'startWeek',g.start_week,'owner',g.owner_id=u,'inviteCode',case when g.owner_id=u then g.invite_code else null end,'week',greatest(w,g.start_week),'joinClosesAt',(select min(kickoff) from zona_private.games where week=g.start_week),'members',(select jsonb_agg(jsonb_build_object('userId',m.user_id,'nickname',p.nickname,'status',zona_private.member_status(g.id,m.user_id),'picks',coalesce((select jsonb_agg(jsonb_build_object('week',pk.week,'team',case when pk.user_id=u or gm.kickoff<=clock_timestamp() then pk.team else null end,'locked',gm.kickoff<=clock_timestamp(),'submitted',true,'result',case when gm.home_score is null then 'pending' when (gm.home=pk.team and gm.home_score>gm.away_score) or (gm.away=pk.team and gm.away_score>gm.home_score) then 'win' else 'loss' end) order by pk.week) from zona_private.picks pk join zona_private.games gm on gm.week=pk.week and (gm.home=pk.team or gm.away=pk.team) where pk.group_id=g.id and pk.user_id=m.user_id),'[]'::jsonb)) order by p.nickname,m.user_id) from zona_private.members m join zona_private.profiles p on p.user_id=m.user_id where m.group_id=g.id)));
end $$;
revoke all on all functions in schema zona_private from public,anon,authenticated;
revoke all on function public.zona_sync_schedule(jsonb,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.zona_sync_schedule(jsonb,integer,timestamptz) to service_role;
revoke all on function public.zona_profile(text),public.zona_create_group(text,integer),public.zona_join_group(text),public.zona_pick(uuid,integer,text),public.zona_dashboard(uuid) from public,anon;
grant execute on function public.zona_profile(text),public.zona_create_group(text,integer),public.zona_join_group(text),public.zona_pick(uuid,integer,text),public.zona_dashboard(uuid) to authenticated;
commit;

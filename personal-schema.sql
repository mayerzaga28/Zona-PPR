-- Apply AFTER community-schema.sql, only after publication approval.
-- Private personal bests, not a verified competitive leaderboard.
begin;
create table if not exists zona_private.personal (
 user_id uuid primary key references auth.users(id) on delete cascade,
 favorites jsonb not null default '[]',
 best_hits integer not null default 0, best_points integer not null default 0,
 best_streak integer not null default 0, games integer not null default 0
);
create table if not exists zona_private.quiz_results (
 user_id uuid not null references auth.users(id) on delete cascade,
 run_id uuid not null, hits integer not null check(hits between 0 and 5),
 streak integer not null check(streak between 0 and 5),
 points integer not null check(points between 0 and 650),
 primary key(user_id,run_id)
);
alter table zona_private.personal enable row level security;
alter table zona_private.quiz_results enable row level security;
revoke all on zona_private.personal,zona_private.quiz_results from public,anon,authenticated;
create or replace function public.zona_personal() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=zona_private.require_user();r zona_private.personal%rowtype;
begin
 insert into zona_private.personal(user_id) values(u) on conflict do nothing;
 select * into r from zona_private.personal where user_id=u;
 return jsonb_build_object('favorites',r.favorites,'bestHits',r.best_hits,'bestPoints',r.best_points,'bestStreak',r.best_streak,'games',r.games);
end $$;
create or replace function public.zona_favorite(p_player jsonb,p_remove boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=zona_private.require_user();f jsonb;pid text:=p_player->>'id';
begin
 if p_remove is null or pid is null or pid !~ '^[A-Za-z0-9_-]{1,60}$' or char_length(coalesce(p_player->>'name','')) not between 2 and 100 then raise exception 'Jugador inválido.';end if;
 perform public.zona_personal();
 select favorites into f from zona_private.personal where user_id=u for update;
 select coalesce(jsonb_agg(x),'[]') into f from jsonb_array_elements(f) x where x->>'id'<>pid;
 if not p_remove then
  if jsonb_array_length(f)>=20 then raise exception 'Puedes seguir hasta 20 jugadores.';end if;
  f:=f||jsonb_build_array(jsonb_build_object('id',pid,'name',p_player->>'name','position',left(p_player->>'position',5),'team',left(p_player->>'team',5)));
 end if;
 update zona_private.personal set favorites=f where user_id=u;
 return public.zona_personal();
end $$;
create or replace function public.zona_quiz_result(p_run uuid,p_hits integer,p_streak integer,p_points integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=zona_private.require_user();n integer;
begin
 if p_run is null or p_hits is null or p_streak is null or p_points is null or p_hits not between 0 and 5 or p_streak not between 0 and p_hits or p_points not between p_hits*100 and p_hits*100+150 or (p_hits=0 and (p_points<>0 or p_streak<>0)) then raise exception 'Resultado inválido.';end if;
 perform public.zona_personal();
 insert into zona_private.quiz_results values(u,p_run,p_hits,p_streak,p_points) on conflict do nothing;
 get diagnostics n=row_count;
 if n=1 then update zona_private.personal set best_hits=greatest(best_hits,p_hits),best_points=greatest(best_points,p_points),best_streak=greatest(best_streak,p_streak),games=games+1 where user_id=u;end if;
 return public.zona_personal();
end $$;
revoke all on function public.zona_personal(),public.zona_favorite(jsonb,boolean),public.zona_quiz_result(uuid,integer,integer,integer) from public,anon;
grant execute on function public.zona_personal(),public.zona_favorite(jsonb,boolean),public.zona_quiz_result(uuid,integer,integer,integer) to authenticated;
commit;

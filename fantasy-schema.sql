-- Private 2026 PPR leagues. Apply after community-schema.sql. No production writes required for development.
begin;
create table if not exists zona_private.f_leagues(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),name text not null check(length(name) between 2 and 50),code text unique not null default replace(gen_random_uuid()::text,'-',''),capacity int not null check(capacity in(4,6,8,10,12)),start_week int not null check(start_week between 1 and 14),state text not null default 'lobby' check(state in('lobby','draft','active')),pick_no int not null default 0,deadline timestamptz,created_at timestamptz default now());
alter table zona_private.f_leagues add column if not exists deleted_at timestamptz;
create table if not exists zona_private.f_members(league_id uuid references zona_private.f_leagues(id),user_id uuid references auth.users(id),name text not null check(length(name) between 2 and 40),seat int not null,primary key(league_id,user_id),unique(league_id,seat));
create table if not exists zona_private.f_players(id text primary key,name text not null,position text not null,team text not null,adp numeric not null);
create table if not exists zona_private.f_rosters(league_id uuid,player_id text references zona_private.f_players(id),user_id uuid,primary key(league_id,player_id),foreign key(league_id,user_id) references zona_private.f_members(league_id,user_id));
create table if not exists zona_private.f_picks(league_id uuid references zona_private.f_leagues(id),pick_no int,player_id text references zona_private.f_players(id),user_id uuid,automatic boolean not null default false,created_at timestamptz default now(),primary key(league_id,pick_no),unique(league_id,player_id));
create table if not exists zona_private.f_lineups(league_id uuid,user_id uuid,week int check(week between 1 and 18),slot text check(slot in('QB','RB1','RB2','WR1','WR2','TE','FLEX','K','DEF')),player_id text references zona_private.f_players(id),primary key(league_id,user_id,week,slot),unique(league_id,user_id,week,player_id),foreign key(league_id,user_id) references zona_private.f_members(league_id,user_id));
create table if not exists zona_private.f_stats(player_id text,week int,points numeric,projection numeric,kickoff timestamptz,final boolean not null default false,bye boolean not null default false,primary key(player_id,week));
create table if not exists zona_private.f_sync(id int primary key check(id=1),updated_at timestamptz not null);
create table if not exists zona_private.f_messages(id bigint generated always as identity primary key,league_id uuid references zona_private.f_leagues(id),user_id uuid references auth.users(id),body text not null check(length(body) between 1 and 500),created_at timestamptz default now());
create table if not exists zona_private.f_moves(id bigint generated always as identity primary key,league_id uuid references zona_private.f_leagues(id),user_id uuid,description text,created_at timestamptz default now());
create table if not exists zona_private.f_trades(id uuid primary key default gen_random_uuid(),league_id uuid references zona_private.f_leagues(id),sender uuid,receiver uuid,give_id text,take_id text,state text not null default 'pending' check(state in('pending','accepted','rejected','cancelled')),created_at timestamptz default now());
create table if not exists zona_private.f_claims(id bigint generated always as identity primary key,league_id uuid references zona_private.f_leagues(id),user_id uuid,player_id text references zona_private.f_players(id),drop_id text,week int,status text not null default 'pending',created_at timestamptz default now());
alter table zona_private.f_claims enable row level security;
alter table zona_private.f_members add column if not exists waiver_priority int;
create index if not exists f_member_user on zona_private.f_members(user_id);
create index if not exists f_chat_league on zona_private.f_messages(league_id,id desc);
do $$declare t text;begin foreach t in array array['f_leagues','f_members','f_players','f_rosters','f_picks','f_lineups','f_stats','f_sync','f_messages','f_moves','f_trades'] loop execute format('alter table zona_private.%I enable row level security',t);end loop;end$$;

create or replace function zona_private.f_fresh() returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from zona_private.f_sync where updated_at>clock_timestamp()-interval '6 minutes') then raise exception 'Actualiza los datos antes de hacer cambios.';end if;
end$$;
create or replace function zona_private.f_eligible(p text,s text) returns boolean language sql immutable set search_path='' as $$select case when s='FLEX' then p in('RB','WR','TE') when s in('RB1','RB2') then p='RB' when s in('WR1','WR2') then p='WR' else p=s end$$;
create or replace function zona_private.f_turn(n int,c int) returns int language sql immutable set search_path='' as $$select case when (n/c)%2=0 then n%c+1 else c-n%c end$$;
create or replace function zona_private.f_open(p text,w int) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from zona_private.f_stats where player_id=p and week=w and (bye or kickoff>now()))$$;
create or replace function public.zona_fantasy_sync(p_players jsonb,p_stats jsonb) returns void language plpgsql security definer set search_path='' as $$begin
 insert into zona_private.f_players select id,name,position,team,adp from jsonb_to_recordset(p_players) as x(id text,name text,position text,team text,adp numeric) on conflict(id) do update set name=excluded.name,position=excluded.position,team=excluded.team,adp=excluded.adp;
 insert into zona_private.f_stats select player_id,week,points,projection,kickoff,final,bye from jsonb_to_recordset(p_stats) as x(player_id text,week int,points numeric,projection numeric,kickoff timestamptz,final boolean,bye boolean) on conflict(player_id,week) do update set points=excluded.points,projection=excluded.projection,kickoff=excluded.kickoff,final=excluded.final,bye=excluded.bye;
 insert into zona_private.f_sync values(1,now()) on conflict(id) do update set updated_at=excluded.updated_at;
end$$;

-- Every mutation serializes on the league row; no client may choose an owner or score.
create or replace function public.zona_fantasy_action(p_action text,p_body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=zona_private.require_user();g zona_private.f_leagues%rowtype;lid uuid;nm text;seat_no int;pid text;old_pid text;w int;sl text;turn_user uuid;tr zona_private.f_trades%rowtype;
begin
 if p_action='create' then
  perform 1 from auth.users where id=u for update;
  if (select count(*) from zona_private.f_leagues where owner_id=u and deleted_at is null)>=10 then raise exception 'Máximo 10 ligas propias.';end if;
  perform zona_private.f_fresh();nm:=trim(p_body->>'name');w:=(p_body->>'week')::int;
  if not exists(select 1 from zona_private.games where week=w) or (select min(kickoff) from zona_private.games where week=w)<=now() then raise exception 'Elige una semana que no haya empezado.';end if;
  insert into zona_private.f_leagues(owner_id,name,capacity,start_week) values(u,nm,(p_body->>'capacity')::int,w) returning id into lid;
  insert into zona_private.f_members(league_id,user_id,name,seat,waiver_priority) values(lid,u,trim(p_body->>'team'),1,1);return jsonb_build_object('id',lid);
 elsif p_action='join' then
  select * into g from zona_private.f_leagues where code=lower(trim(p_body->>'code')) and deleted_at is null for update;
  if not found then raise exception 'Invitación no válida.';end if;
  if exists(select 1 from zona_private.f_members where league_id=g.id and user_id=u) then return jsonb_build_object('id',g.id);end if;
  if g.state<>'lobby' then raise exception 'El draft ya comenzó.';end if;
  select count(*)+1 into seat_no from zona_private.f_members where league_id=g.id;
  if seat_no>g.capacity then raise exception 'La liga está llena.';end if;
  insert into zona_private.f_members(league_id,user_id,name,seat,waiver_priority) values(g.id,u,trim(p_body->>'team'),seat_no,seat_no);return jsonb_build_object('id',g.id);
 end if;
 lid:=(p_body->>'league')::uuid;select * into g from zona_private.f_leagues where id=lid and deleted_at is null for update;
 if not found or not exists(select 1 from zona_private.f_members where league_id=lid and user_id=u) then raise exception 'No perteneces a esta liga.';end if;
 if p_action='delete' then
  if g.owner_id<>u then raise exception 'Solo el creador puede borrar la liga.';end if;
  update zona_private.f_leagues set deleted_at=now(),deadline=null where id=lid;
  return '{}'::jsonb;
 end if;
 if p_action='message' then
  if exists(select 1 from zona_private.f_messages where user_id=u and created_at>now()-interval '2 seconds') then raise exception 'Espera un momento antes de enviar otro mensaje.';end if;
  insert into zona_private.f_messages(league_id,user_id,body) values(lid,u,trim(p_body->>'text'));return '{}'::jsonb;
 end if;
 perform zona_private.f_fresh();
 if p_action='start' then
  if g.owner_id<>u or g.state<>'lobby' then raise exception 'Solo el comisionado puede iniciar el draft pendiente.';end if;
  if (select count(*) from zona_private.f_members where league_id=lid)<>g.capacity then raise exception 'Invita a todos los equipos antes de empezar.';end if;
  if (select count(*) from zona_private.f_players)<g.capacity*15 then raise exception 'Faltan jugadores para el draft.';end if;
  if (select min(kickoff) from zona_private.games where week=g.start_week)<=now()+interval '2 hours' then raise exception 'El draft debe empezar al menos 2 horas antes de la semana inicial.';end if;
  update zona_private.f_leagues set state='draft',deadline=now()+interval '90 seconds' where id=lid;
 elsif p_action in('pick','autopick') then
  if g.state<>'draft' then raise exception 'El draft no está activo.';end if;
  select user_id into turn_user from zona_private.f_members where league_id=lid and seat=zona_private.f_turn(g.pick_no,g.capacity);
  if p_action='pick' then
   if turn_user<>u then raise exception 'Es el turno de otro equipo.';end if;
   if now()>=g.deadline then raise exception 'Terminó tu tiempo; actualiza el draft.';end if;
   pid:=p_body->>'player';
  else
   if now()<g.deadline then raise exception 'El turno aún no vence.';end if;
   -- Prefer missing starters, then ADP. All candidates come from the trusted server catalog.
   select p.id into pid from zona_private.f_players p where not exists(select 1 from zona_private.f_rosters r where r.league_id=lid and r.player_id=p.id)
   order by case when (select count(*) from zona_private.f_rosters r join zona_private.f_players q on q.id=r.player_id where r.league_id=lid and r.user_id=turn_user and q.position=p.position)<case when p.position in('RB','WR') then 2 else 1 end then 0 else 1 end,case when p.position in('K','DEF') and g.pick_no/g.capacity<7 then 1 else 0 end,p.adp,p.id limit 1;
  end if;
  if not exists(select 1 from zona_private.f_players where id=pid) or exists(select 1 from zona_private.f_rosters where league_id=lid and player_id=pid) then raise exception 'El jugador ya fue elegido o no está disponible.';end if;
  insert into zona_private.f_rosters values(lid,pid,turn_user);insert into zona_private.f_picks(league_id,pick_no,player_id,user_id,automatic) values(lid,g.pick_no,pid,turn_user,p_action='autopick');
  update zona_private.f_leagues set pick_no=pick_no+1,deadline=now()+interval '90 seconds',state=case when pick_no+1=capacity*15 then 'active' else 'draft' end where id=lid;
 elsif p_action='lineup' then
  if g.state<>'active' then raise exception 'Termina el draft primero.';end if;
  w:=(p_body->>'week')::int;sl:=p_body->>'slot';pid:=nullif(p_body->>'player','');
  if w<g.start_week or w>17 or w<(select current_week from zona_private.schedule_meta where id=1) then raise exception 'Semana no editable.';end if;
  select player_id into old_pid from zona_private.f_lineups where league_id=lid and user_id=u and week=w and slot=sl;
  if old_pid is not null and not zona_private.f_open(old_pid,w) then raise exception 'Tu titular ya está bloqueado.';end if;
  if pid is not null then
   if not exists(select 1 from zona_private.f_rosters r join zona_private.f_players p on p.id=r.player_id where r.league_id=lid and r.user_id=u and r.player_id=pid and zona_private.f_eligible(p.position,sl)) then raise exception 'Jugador o posición inválidos.';end if;
   if not zona_private.f_open(pid,w) then raise exception 'Jugador bloqueado o calendario no confirmado.';end if;
  end if;
  delete from zona_private.f_lineups where league_id=lid and user_id=u and week=w and slot=sl;
  if pid is not null then insert into zona_private.f_lineups values(lid,u,w,sl,pid);end if;
 elsif p_action='add' then
  if g.state<>'active' then raise exception 'Termina el draft primero.';end if;
  perform zona_private.f_process_claims(lid);
  w:=greatest(g.start_week,(select current_week from zona_private.schedule_meta where id=1));pid:=p_body->>'player';old_pid:=nullif(p_body->>'drop','');
  if not zona_private.f_open(pid,w) then raise exception 'El jugador está bloqueado hasta la próxima semana.';end if;
  if old_pid is not null then
   if not exists(select 1 from zona_private.f_rosters where league_id=lid and user_id=u and player_id=old_pid) or not zona_private.f_open(old_pid,w) then raise exception 'No puedes liberar ese jugador.';end if;
   delete from zona_private.f_lineups where league_id=lid and user_id=u and week>=w and player_id=old_pid;
   delete from zona_private.f_rosters where league_id=lid and user_id=u and player_id=old_pid;
  end if;
  if (select count(*) from zona_private.f_rosters where league_id=lid and user_id=u)>=15 then raise exception 'Elige un jugador para liberar; máximo 15.';end if;
  insert into zona_private.f_rosters values(lid,pid,u);
  insert into zona_private.f_moves(league_id,user_id,description) select lid,u,'Alta: '||name from zona_private.f_players where id=pid;
 elsif p_action='claim' then
  if g.state<>'active' then raise exception 'Termina el draft primero.';end if;
  w:=(select current_week from zona_private.schedule_meta where id=1);pid:=p_body->>'player';old_pid:=nullif(p_body->>'drop','');
  if zona_private.f_open(pid,w) then raise exception 'Ese jugador está libre: usa Añadir.';end if;
  if exists(select 1 from zona_private.f_rosters where league_id=lid and player_id=pid) then raise exception 'Ese jugador ya tiene equipo.';end if;
  if (select count(*) from zona_private.f_claims where league_id=lid and user_id=u and status='pending')>=10 then raise exception 'Máximo 10 solicitudes pendientes.';end if;
  if exists(select 1 from zona_private.f_claims where league_id=lid and user_id=u and player_id=pid and status='pending') then raise exception 'Ya solicitaste ese jugador.';end if;
  if old_pid is not null and not exists(select 1 from zona_private.f_rosters where league_id=lid and user_id=u and player_id=old_pid) then raise exception 'No puedes liberar ese jugador.';end if;
  insert into zona_private.f_claims(league_id,user_id,player_id,drop_id,week) values(lid,u,pid,old_pid,w);
 elsif p_action='cancel_claim' then
  update zona_private.f_claims set status='cancelled' where id=(p_body->>'claim')::bigint and league_id=lid and user_id=u and status='pending';
 elsif p_action='trade' then
  if g.state<>'active' then raise exception 'Termina el draft primero.';end if;
  pid:=p_body->>'give';old_pid:=p_body->>'take';
  if not exists(select 1 from zona_private.f_rosters where league_id=lid and user_id=u and player_id=pid) then raise exception 'No tienes ese jugador.';end if;
  select user_id into turn_user from zona_private.f_rosters where league_id=lid and user_id<>u and player_id=old_pid;
  if turn_user is null then raise exception 'Elige un jugador de otro equipo.';end if;
  if (select count(*) from zona_private.f_trades where league_id=lid and sender=u and state='pending')>=10 then raise exception 'Máximo 10 propuestas pendientes.';end if;
  insert into zona_private.f_trades(league_id,sender,receiver,give_id,take_id) values(lid,u,turn_user,pid,old_pid);
 elsif p_action in('accept','reject','cancel') then
  select * into tr from zona_private.f_trades where id=(p_body->>'trade')::uuid and league_id=lid and state='pending' for update;
  if not found or (p_action='cancel' and tr.sender<>u) or (p_action<>'cancel' and tr.receiver<>u) then raise exception 'Propuesta no disponible.';end if;
  if p_action='accept' then
   w:=greatest(g.start_week,(select current_week from zona_private.schedule_meta where id=1));
   if not zona_private.f_open(tr.give_id,w) or not zona_private.f_open(tr.take_id,w) then raise exception 'Intercambio bloqueado: un jugador ya inició su partido.';end if;
   if not exists(select 1 from zona_private.f_rosters where league_id=lid and user_id=tr.sender and player_id=tr.give_id) or not exists(select 1 from zona_private.f_rosters where league_id=lid and user_id=tr.receiver and player_id=tr.take_id) then raise exception 'Los jugadores cambiaron de equipo; cancela esta propuesta.';end if;
   delete from zona_private.f_lineups where league_id=lid and week>=w and player_id in(tr.give_id,tr.take_id);
   update zona_private.f_rosters set user_id=case when player_id=tr.give_id then tr.receiver else tr.sender end where league_id=lid and player_id in(tr.give_id,tr.take_id);
   insert into zona_private.f_moves(league_id,user_id,description) values(lid,u,'Intercambio aceptado. Revisa tu alineación.');
  end if;
  update zona_private.f_trades set state=case p_action when 'accept' then 'accepted' when 'reject' then 'rejected' else 'cancelled' end where id=tr.id;
 else raise exception 'Acción inválida.';
 end if;
 return jsonb_build_object('id',lid);
end$$;
create or replace function zona_private.f_process_claims(lid uuid) returns void language plpgsql security definer set search_path='' as $$
declare c zona_private.f_claims%rowtype;w int;max_priority int;
begin
 if not exists(select 1 from zona_private.f_sync where updated_at>now()-interval '6 minutes') then return;end if;
 perform 1 from zona_private.f_leagues where id=lid and deleted_at is null for update;
 select current_week into w from zona_private.schedule_meta where id=1;
 loop
  select x.* into c from zona_private.f_claims x join zona_private.f_members m on m.league_id=x.league_id and m.user_id=x.user_id where x.league_id=lid and x.status='pending' and x.week<w and exists(select 1 from zona_private.games where week=x.week) and not exists(select 1 from zona_private.games where week=x.week and home_score is null) order by m.waiver_priority,x.created_at,x.id limit 1;
  exit when not found;
  if exists(select 1 from zona_private.f_rosters where league_id=lid and player_id=c.player_id) or not zona_private.f_open(c.player_id,w) or (c.drop_id is not null and (not exists(select 1 from zona_private.f_rosters where league_id=lid and user_id=c.user_id and player_id=c.drop_id) or not zona_private.f_open(c.drop_id,w))) or (c.drop_id is null and (select count(*) from zona_private.f_rosters where league_id=lid and user_id=c.user_id)>=15) then
   update zona_private.f_claims set status='unsuccessful' where id=c.id;continue;
  end if;
  delete from zona_private.f_lineups where league_id=lid and user_id=c.user_id and week>=w and player_id=c.drop_id;
  delete from zona_private.f_rosters where league_id=lid and user_id=c.user_id and player_id=c.drop_id;
  insert into zona_private.f_rosters values(lid,c.player_id,c.user_id);
  select max(waiver_priority)+1 into max_priority from zona_private.f_members where league_id=lid;
  update zona_private.f_members set waiver_priority=max_priority where league_id=lid and user_id=c.user_id;
  update zona_private.f_claims set status='awarded' where id=c.id;
  insert into zona_private.f_moves(league_id,user_id,description) select lid,c.user_id,'Waiver: '||name from zona_private.f_players where id=c.player_id;
 end loop;
end$$;
create or replace function public.zona_fantasy_dashboard(p_league uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=zona_private.require_user();result jsonb;g zona_private.f_leagues%rowtype;
begin
 result:=jsonb_build_object('userId',u,'serverTime',now(),'updatedAt',(select updated_at from zona_private.f_sync where id=1),'currentWeek',(select current_week from zona_private.schedule_meta where id=1),'leagues',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'state',l.state,'capacity',l.capacity,'startWeek',l.start_week,'members',(select count(*) from zona_private.f_members where league_id=l.id)) order by l.created_at desc) from zona_private.f_leagues l join zona_private.f_members m on m.league_id=l.id where m.user_id=u and l.deleted_at is null),'[]'::jsonb));
 if p_league is null then return result;end if;
 select * into g from zona_private.f_leagues where id=p_league and deleted_at is null;
 if not found or not exists(select 1 from zona_private.f_members where league_id=p_league and user_id=u) then raise exception 'No perteneces a esta liga.';end if;
 perform zona_private.f_process_claims(g.id);
 return result||jsonb_build_object('claims',coalesce((select jsonb_agg(to_jsonb(c) order by id desc) from zona_private.f_claims c where league_id=g.id and user_id=u),'[]'::jsonb),'league',jsonb_build_object('id',g.id,'name',g.name,'owner',g.owner_id=u,'code',g.code,'state',g.state,'capacity',g.capacity,'startWeek',g.start_week,'pickNo',g.pick_no,'deadline',g.deadline,'members',(select jsonb_agg(to_jsonb(m) order by seat) from zona_private.f_members m where league_id=g.id),'rosters',coalesce((select jsonb_agg(to_jsonb(r)) from zona_private.f_rosters r where league_id=g.id),'[]'::jsonb),'picks',coalesce((select jsonb_agg(to_jsonb(p) order by pick_no) from zona_private.f_picks p where league_id=g.id),'[]'::jsonb),'lineups',coalesce((select jsonb_agg(to_jsonb(l)) from zona_private.f_lineups l where league_id=g.id),'[]'::jsonb),'trades',coalesce((select jsonb_agg(to_jsonb(t) order by created_at desc) from zona_private.f_trades t where league_id=g.id and (sender=u or receiver=u)),'[]'::jsonb),'messages',coalesce((select jsonb_agg(to_jsonb(x) order by id) from(select * from zona_private.f_messages where league_id=g.id order by id desc limit 80)x),'[]'::jsonb),'moves',coalesce((select jsonb_agg(to_jsonb(x) order by id desc) from(select * from zona_private.f_moves where league_id=g.id order by id desc limit 50)x),'[]'::jsonb)), 'players',(select jsonb_agg(to_jsonb(p) order by adp) from zona_private.f_players p),'stats',coalesce((select jsonb_agg(to_jsonb(s)) from zona_private.f_stats s where week>=g.start_week),'[]'::jsonb),'games',coalesce((select jsonb_agg(to_jsonb(x)) from zona_private.games x),'[]'::jsonb));
end$$;
revoke all on function public.zona_fantasy_sync(jsonb,jsonb),public.zona_fantasy_action(text,jsonb),public.zona_fantasy_dashboard(uuid) from public,anon,authenticated;
grant execute on function public.zona_fantasy_sync(jsonb,jsonb) to service_role;
grant execute on function public.zona_fantasy_action(text,jsonb),public.zona_fantasy_dashboard(uuid) to authenticated;
revoke all on all functions in schema zona_private from public,anon,authenticated;
commit;

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {PGlite} from '@electric-sql/pglite';import {validateAction} from '../lib/community.js';
test('league deletion is owner-only; leaving preserves picks and revokes access',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
 for(const f of ['community-schema.sql','fantasy-schema.sql'])await db.exec(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'));
 const users=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];for(const u of users)await db.query('insert into auth.users values($1,now())',[u]);
 await db.exec("insert into zona_private.schedule_meta values(1,4,now());insert into zona_private.f_sync values(1,now());insert into zona_private.games values(4,'KC','BUF',now()+interval '2 days',null,null)");
 const as=async(u,sql,args=[])=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[u]);await db.exec('set role authenticated');return (await db.query(sql,args)).rows[0]?.d};
 const act=(u,a,b)=>as(u,'select public.zona_fantasy_action($1,$2) as d',[a,JSON.stringify(b)]);
 const {id}=await act(users[0],'create',{name:'Delete test',capacity:4,week:4,team:'Owner'});let d=await as(users[0],'select public.zona_fantasy_dashboard($1) as d',[id]);const code=d.league.code;
 await act(users[1],'join',{code,team:'Friend'});await assert.rejects(act(users[1],'delete',{league:id}),/Solo el creador/);
 await act(users[0],'delete',{league:id});for(const u of users){await assert.rejects(as(u,'select public.zona_fantasy_dashboard($1) as d',[id]),/No perteneces/);assert.equal((await as(u,'select public.zona_fantasy_dashboard() as d')).leagues.length,0);}
 await assert.rejects(act(users[1],'join',{code,team:'Friend'}),/Invitación/);await assert.rejects(act(users[0],'message',{league:id,text:'test'}),/No perteneces/);
 for(const u of users)await as(u,"select public.zona_profile('Friend') as d");const group=await as(users[0],"select public.zona_create_group('Exit test',4) as d");d=await as(users[0],'select public.zona_dashboard($1) as d',[group]);const invite=d.group.inviteCode;
 await as(users[1],'select public.zona_join_group($1)',[invite]);await as(users[0],"select public.zona_pick($1,4,'KC')",[group]);
 await as(users[0],'select public.zona_leave_group($1)',[group]);await assert.rejects(as(users[0],'select public.zona_dashboard($1)',[group]),/No perteneces/);await assert.rejects(as(users[0],"select public.zona_pick($1,4,'BUF')",[group]),/No perteneces/);await assert.rejects(as(users[0],'select public.zona_join_group($1)',[invite]),/Ya saliste/);
 assert.equal((await as(users[0],'select public.zona_dashboard() as d')).groups.length,0);d=await as(users[1],'select public.zona_dashboard($1) as d',[group]);assert.equal(d.group.owner,true);assert.equal(d.group.members.find(m=>m.userId===users[0]).status.state,'left');assert.equal(d.group.members.find(m=>m.userId===users[0]).picks.length,1);
 await as(users[1],'select public.zona_leave_group($1)',[group]);assert.deepEqual(validateAction('leave',{group,userId:users[1]}),['zona_leave_group',{p_group:group}]);
 }finally{await db.close();}
});

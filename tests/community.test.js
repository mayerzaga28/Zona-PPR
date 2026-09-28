import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {PGlite} from '@electric-sql/pglite';import {configuration,validateAction} from '../lib/community.js';import handler from '../api/community.js';
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
let db;async function as(user,sql,params=[]){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec('set role authenticated');return db.query(sql,params)}
async function owner(sql,params=[]){await db.exec('reset role');return db.query(sql,params)}
const tomorrow=()=>new Date(Date.now()+86400000).toISOString();
test('private accounts, group membership, hidden picks, deadlines, elimination and data permissions',async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`);for(const u of ids)await db.query('insert into auth.users values($1,now())',[u]);await db.exec(fs.readFileSync(new URL('../community-schema.sql',import.meta.url),'utf8'));
 await owner('insert into zona_private.schedule_meta values(1,3,now())');for(const [w,h,a] of [[3,'KC','BUF'],[3,'NYJ','MIA'],[4,'KC','NYJ'],[4,'BUF','MIA']])await owner('insert into zona_private.games(week,home,away,kickoff) values($1,$2,$3,$4)',[w,h,a,tomorrow()]);
 for(let i=0;i<ids.length;i++)await as(ids[i],'select public.zona_profile($1)',['Amigo '+i]);
 const g=(await as(ids[0],"select public.zona_create_group('Amigos',3) as id")).rows[0].id;const code=(await owner('select invite_code from zona_private.groups where id=$1',[g])).rows[0].invite_code;
 await as(ids[1],'select public.zona_join_group($1)',[code]);
 await assert.rejects(as(ids[2],'select public.zona_dashboard($1)',[g]),/No perteneces/);
 await assert.rejects(as(ids[2],"select public.zona_pick($1,3,'KC')",[g]),/No perteneces/);
 await assert.rejects(as(ids[1],'select * from zona_private.picks'),/permission denied/);
 await assert.rejects(as(ids[1],"select public.zona_sync_schedule('[]',3,now())"),/permission denied/);
 await as(ids[0],"select public.zona_pick($1,3,'KC')",[g]);await as(ids[1],"select public.zona_pick($1,3,'MIA')",[g]);
 let d=(await as(ids[1],'select public.zona_dashboard($1) as d',[g])).rows[0].d;
 assert.equal(d.group.inviteCode,null);assert.equal(d.group.members.find(m=>m.userId===ids[0]).picks[0].team,null);assert.equal(d.group.members.find(m=>m.userId===ids[1]).picks[0].team,'MIA');
 await as(ids[0],"select public.zona_pick($1,3,'BUF')",[g]);await as(ids[0],"select public.zona_pick($1,3,'KC')",[g]);
 await owner("update zona_private.games set kickoff=now()-interval '1 hour',home_score=20,away_score=10 where week=3 and home='KC'");
 await assert.rejects(as(ids[0],"select public.zona_pick($1,3,'NYJ')",[g]),/bloqueada/);
 await assert.rejects(as(ids[2],'select public.zona_join_group($1)',[code]),/ya comenzó/);
 d=(await as(ids[1],'select public.zona_dashboard($1) as d',[g])).rows[0].d;assert.equal(d.group.members.find(m=>m.userId===ids[0]).picks[0].team,'KC');
 await owner("update zona_private.games set kickoff=now()-interval '1 hour',home_score=14,away_score=14 where week=3 and home='NYJ'");await owner('update zona_private.schedule_meta set current_week=4');
 await assert.rejects(as(ids[1],"select public.zona_pick($1,4,'BUF')",[g]),/participación ya terminó/);
 await assert.rejects(as(ids[0],"select public.zona_pick($1,4,'KC')",[g]),/Ya usaste/);
 await as(ids[0],"select public.zona_pick($1,4,'BUF')",[g]);
 await owner("update zona_private.schedule_meta set source_at=now()-interval '10 minutes'");await assert.rejects(as(ids[0],"select public.zona_pick($1,4,'MIA')",[g]),/actualizarse/);
 await owner('update auth.users set email_confirmed_at=null where id=$1',[ids[2]]);await assert.rejects(as(ids[2],'select public.zona_dashboard()'),/confirma tu correo/);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select public.zona_dashboard()'),/permission denied/);
 await db.close();
});
test('server does not activate without complete config or reveal service secret',async()=>{assert.equal(configuration({}).enabled,false);assert.equal(configuration({COMMUNITY_ENABLED:'true',SUPABASE_URL:'http://evil',SUPABASE_ANON_KEY:'pub',SUPABASE_SERVICE_ROLE_KEY:'private'}).enabled,false);const old={...process.env};Object.assign(process.env,{COMMUNITY_ENABLED:'true',SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'public-key',SUPABASE_SERVICE_ROLE_KEY:'never-publish'});const res={setHeader(){},status(n){this.code=n;return this},json(x){this.body=x;return this}};await handler({method:'GET',query:{action:'config'},headers:{}},res);assert.equal(res.body.key,'public-key');assert.ok(!JSON.stringify(res.body).includes('never-publish'));await handler({method:'POST',query:{action:'pick'},headers:{},body:{}},res);assert.equal(res.code,401);for(const k of ['COMMUNITY_ENABLED','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY']){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k]}});
test('API rejects malformed picks and ignores client-supplied identity',()=>{assert.throws(()=>validateAction('pick',{group:ids[0],week:3,team:'KC;DROP'}));const [,b]=validateAction('pick',{group:ids[0],week:3,team:'KC',userId:ids[1]});assert.equal(b.userId,undefined);assert.throws(()=>validateAction('create',{name:'Hola',week:19}))});

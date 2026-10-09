import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {PGlite} from '@electric-sql/pglite';import {pairings,turnSeat,matchups,standings} from '../public/fantasy-core.js';
test('private league flow: invitations, draft ownership, locks, trades and chat',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
 await db.exec(fs.readFileSync(new URL('../community-schema.sql',import.meta.url),'utf8'));await db.exec(fs.readFileSync(new URL('../fantasy-schema.sql',import.meta.url),'utf8'));
 const users=Array.from({length:5},(_,i)=>`${i+1}1111111-1111-4111-8111-111111111111`);for(const u of users)await db.query('insert into auth.users values($1,now())',[u]);
 await db.exec("insert into zona_private.schedule_meta values(1,4,now());insert into zona_private.f_sync values(1,now());insert into zona_private.games values(4,'KC','BUF',now()+interval '2 days',null,null)");
 const positions=['QB','RB','RB','WR','WR','TE','RB','K','DEF','WR','RB','QB','TE','WR','RB'];
 for(let i=0;i<80;i++){await db.query('insert into zona_private.f_players values($1,$2,$3,$4,$5)',[String(i),'Player '+i,positions[Math.floor(i/4)%15],'KC',i+1]);await db.query("insert into zona_private.f_stats values($1,4,null,10,now()+interval '2 days',false,false)",[String(i)]);}
 const as=async(u,sql,args=[])=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[u]);await db.exec('set role authenticated');return db.query(sql,args);};
 const act=async(u,a,b)=>(await as(u,'select public.zona_fantasy_action($1,$2) as d',[a,JSON.stringify(b)])).rows[0].d;
 const read=async(u,l)=>(await as(u,'select public.zona_fantasy_dashboard($1) as d',[l])).rows[0].d;
 const own=async(sql,args=[])=>{await db.exec('reset role');return args.length?db.query(sql,args):db.exec(sql);};
 const {id}=await act(users[0],'create',{name:'Sunday Club',capacity:4,week:4,team:'Zaga'});let d=await read(users[0],id);const code=d.league.code;
 await assert.rejects(read(users[4],id),/No perteneces/);await assert.rejects(as(users[0],'select * from zona_private.f_rosters'),/permission denied/);
 await assert.rejects(act(users[0],'start',{league:id}),/Invita/);
 for(let i=1;i<4;i++)await act(users[i],'join',{code,team:'Team '+i});
 await assert.rejects(act(users[4],'join',{code,team:'Extra'}),/llena/);
 await assert.rejects(act(users[1],'start',{league:id}),/comisionado/);
 await act(users[0],'start',{league:id});await assert.rejects(act(users[1],'pick',{league:id,player:'0'}),/turno/);await assert.rejects(act(users[0],'autopick',{league:id}),/vence/);
 await own("update zona_private.f_leagues set deadline=now()-interval '1 second' where id='"+id+"'");await act(users[2],'autopick',{league:id});d=await read(users[0],id);assert.equal(d.league.picks[0].automatic,true);assert.equal(d.league.picks[0].player_id,'0');
 for(let n=1;n<60;n++)await act(users[turnSeat(n,4)-1],'pick',{league:id,player:String(n)});
 d=await read(users[0],id);assert.equal(d.league.state,'active');assert.equal(d.league.rosters.length,60);assert.equal(new Set(d.league.rosters.map(p=>p.player_id)).size,60);
 await act(users[0],'lineup',{league:id,week:4,slot:'QB',player:'0'});await assert.rejects(act(users[1],'lineup',{league:id,week:4,slot:'QB',player:'0'}),/inválidos/);await assert.rejects(act(users[0],'lineup',{league:id,week:4,slot:'TE',player:'0'}),/inválidos/);
 await own("update zona_private.f_stats set kickoff=now()-interval '1 minute' where player_id='0'");await assert.rejects(act(users[0],'lineup',{league:id,week:4,slot:'QB',player:''}),/bloqueado/);
 await act(users[0],'trade',{league:id,give:'7',take:'6'});d=await read(users[1],id);const trade=d.league.trades[0];assert.ok(trade);await assert.rejects(act(users[2],'accept',{league:id,trade:trade.id}),/disponible/);await act(users[1],'accept',{league:id,trade:trade.id});d=await read(users[0],id);assert.equal(d.league.rosters.find(r=>r.player_id==='6').user_id,users[0]);await assert.rejects(act(users[1],'accept',{league:id,trade:trade.id}),/disponible/);
 await act(users[0],'add',{league:id,player:'60',drop:'6'});await assert.rejects(act(users[1],'add',{league:id,player:'60',drop:'7'}),/duplicate/);
 await act(users[0],'message',{league:id,text:'Buen draft'});await assert.rejects(act(users[0],'message',{league:id,text:'Spam'}),/Espera/);d=await read(users[1],id);assert.equal(d.league.messages[0].body,'Buen draft');
 await own("insert into zona_private.games values(5,'KC','BUF',now()+interval '9 days',null,null);update zona_private.f_stats set kickoff=now()-interval '1 hour' where player_id in('61','62')");
 await act(users[0],'claim',{league:id,player:'61',drop:'60'});await act(users[1],'claim',{league:id,player:'61',drop:'7'});
 await own("update zona_private.schedule_meta set current_week=5;update zona_private.games set home_score=20,away_score=10 where week=4;insert into zona_private.f_stats select player_id,5,null,10,now()+interval '9 days',false,false from zona_private.f_stats where week=4");
 d=await read(users[0],id);assert.equal(d.league.rosters.find(r=>r.player_id==='61').user_id,users[0]);assert.equal(d.claims[0].status,'awarded');d=await read(users[1],id);assert.equal(d.claims[0].status,'unsuccessful');assert.equal(d.league.members.find(m=>m.user_id===users[0]).waiver_priority,5);
 await own("update zona_private.f_sync set updated_at=now()-interval '1 hour'");await assert.rejects(act(users[0],'add',{league:id,player:'61',drop:'60'}),/Actualiza/);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select public.zona_fantasy_dashboard()'),/permission denied/);
 }finally{await db.close();}
});
test('round robin has unique opponents and playoffs wait for complete results',()=>{const members=Array.from({length:8},(_,i)=>({seat:i+1,user_id:String(i)}));const seen=new Set();for(let w=0;w<7;w++){const pairs=pairings(members,w);assert.equal(new Set(pairs.flat().map(m=>m.user_id)).size,8);for(const [a,b]of pairs){const key=[a.user_id,b.user_id].sort().join('-');assert.ok(!seen.has(key));seen.add(key);}}assert.equal(seen.size,28);const data={league:{members,startWeek:14,lineups:[]},stats:[],games:[]};assert.deepEqual(matchups(data,15),[]);data.games=[{week:14,home_score:20,away_score:10}];assert.equal(matchups(data,15).length,2);assert.equal(standings(data)[0].ties,1);});

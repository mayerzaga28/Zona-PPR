import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {PGlite} from '@electric-sql/pglite';import {credentials} from '../api/account.js';
test('username registration rejects email, invalid names and weak passwords',()=>{assert.deepEqual(credentials({username:' ZAGA_1 ',password:'un-password-muy-largo'}),{username:'zaga_1',password:'un-password-muy-largo'});for(const username of ['ab','a@b.com','<script>','a'.repeat(25)])assert.throws(()=>credentials({username,password:'un-password-muy-largo'}));assert.throws(()=>credentials({username:'zaga',password:'short'}))});
test('recovery is single-use, private and rate limits persist atomically',async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
 await db.exec(fs.readFileSync(new URL('../community-schema.sql',import.meta.url),'utf8'));await db.exec(fs.readFileSync(new URL('../account-identity.sql',import.meta.url),'utf8'));
 const u='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',h='a'.repeat(64),n='b'.repeat(64);await db.query('insert into auth.users values($1,now())',[u]);
 await db.query('select zona_identity_create($1,$2,$3)',[u,'zaga',h]);
 assert.equal((await db.query('select zona_recovery_claim($1,$2,$3) as id',['zaga','c'.repeat(64),n])).rows[0].id,null);
 assert.equal((await db.query('select zona_recovery_claim($1,$2,$3) as id',['zaga',h,n])).rows[0].id,u);
 assert.equal((await db.query('select zona_recovery_claim($1,$2,$3) as id',['zaga',h,n])).rows[0].id,null);
 await db.query('select zona_recovery_restore($1,$2,$3)',[u,n,h]);
 assert.equal((await db.query('select zona_recovery_claim($1,$2,$3) as id',['zaga',h,n])).rows[0].id,u);
 for(const expected of [true,true,false])assert.equal((await db.query("select zona_auth_limit(array['ip','username'],2,60) as ok")).rows[0].ok,expected);
 await db.exec("update zona_private.auth_limits set started_at=now()-interval '2 minutes'");assert.equal((await db.query("select zona_auth_limit(array['ip','username'],2,60) as ok")).rows[0].ok,true);
 await db.exec('set role anon');await assert.rejects(db.query('select * from zona_private.identities'),/permission denied/);await assert.rejects(db.query('select zona_identity_create($1,$2,$3)',[u,'other',h]),/permission denied/);
 await db.exec('reset role;set role authenticated');await assert.rejects(db.query('select zona_recovery_claim($1,$2,$3)',['zaga',n,h]),/permission denied/);await assert.rejects(db.query("select zona_auth_limit(array['ip'],2,60)"),/permission denied/);await db.close();
});

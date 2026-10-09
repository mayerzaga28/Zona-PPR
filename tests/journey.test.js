import test from 'node:test';
import assert from 'node:assert/strict';
import {journeyScore,findTeamGame} from '../public/journey-core.js';
const fixture=()=>({league:{lineups:[{user_id:'a',week:4,slot:'QB',player_id:'1'},{user_id:'b',week:4,slot:'RB1',player_id:'2'}]},stats:[]});
test('missing points are not zero, and other rosters do not fill vacancies',()=>{const d=fixture(),s=journeyScore(d,'a',4);assert.equal(s.points,null);assert.equal(s.projection,null);assert.equal(s.filled,1);assert.equal(s.vacancies.length,8);assert.ok(s.vacancies.includes('RB1'));});
test('zero is a real score and projections stay distinct',()=>{const d=fixture();d.stats=[{player_id:'1',week:4,points:0,projection:22}];const s=journeyScore(d,'a',4);assert.equal(s.points,0);assert.equal(s.projection,22);assert.equal(s.partial,false);assert.equal(journeyScore(d,'a',5).points,null);});
test('bye counts as zero and flags the lineup',()=>{const d=fixture();d.stats=[{player_id:'1',week:4,bye:true}];assert.equal(journeyScore(d,'a',4).byes,1);assert.equal(journeyScore(d,'a',4).points,0);});
test('follow a team resolves aliases and the selected week only',()=>{const games=[{id:'x',week:4,home:{code:'WSH'},away:{code:'JAX'}}];assert.equal(findTeamGame(games,'WAS',4).id,'x');assert.equal(findTeamGame(games,'JAC',4).id,'x');assert.equal(findTeamGame(games,'WAS',5),undefined);});

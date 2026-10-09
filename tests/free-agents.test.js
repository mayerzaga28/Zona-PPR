import test from 'node:test';
import assert from 'node:assert/strict';
import {recentParticipantIds,freeAgentCandidate,assignment} from '../lib/free-agents.js';
import {advice,lineupTotal} from '../lib/scoring.js';
test('unsigned candidates require recent participation, not just an active flag',()=>{
 const ids=recentParticipantIds([{player_id:'recent',season:2025,season_type:'regular',category:'stat',week:null,stats:{gp:2}},{player_id:'old',season:2022,season_type:'regular',category:'stat',week:null,stats:{gp:16}}],2025);
 const p={player_id:'recent',active:true,position:'WR',team:null};
 assert.equal(freeAgentCandidate(p,ids),true);
 assert.equal(freeAgentCandidate({...p,player_id:'old'},ids),false);
 assert.equal(freeAgentCandidate({...p,status:'Retired'},ids),false);
 assert.equal(freeAgentCandidate({...p,team:'BUF'},ids),false);
});
test('release overrides stale projection team; signing and historical teams are preserved',()=>{
 assert.deepEqual(assignment({team:null},{team:'BUF'}),{team:'FA',freeAgent:true});
 assert.deepEqual(assignment({team:'KC'},{team:'BUF'}),{team:'KC',freeAgent:false});
 assert.deepEqual(assignment({team:null},{team:'BUF'},{team:'DET'}),{team:'DET',freeAgent:false});
 const p={id:'x',position:'WR',freeAgent:true,points:null,bye:false};
 assert.match(advice(p,5,5),/Sin equipo/);
 assert.equal(lineupTotal({WR1:'x'},[p],5,5).find(s=>s.slot==='WR1').value,null);
});

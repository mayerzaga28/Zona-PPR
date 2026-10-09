import {STARTERS} from './fantasy-core.js';
export function journeyScore(data,user,week){
 const rows=data.league.lineups.filter(r=>r.user_id===user&&r.week===week);
 let points=0,projection=0,known=0,estimated=0;
 for(const r of rows){const s=data.stats.find(s=>s.player_id===r.player_id&&s.week===week);if(s?.points!=null||s?.bye){points+=Number(s.points||0);known++;}if(s?.projection!=null||s?.bye){projection+=Number(s.projection||0);estimated++;}}
 return {points:known?points:null,projection:estimated?projection:null,partial:known<rows.length,projectionPartial:estimated<rows.length,filled:rows.length,vacancies:STARTERS.filter(slot=>!rows.some(r=>r.slot===slot)),byes:rows.filter(r=>data.stats.some(s=>s.player_id===r.player_id&&s.week===week&&s.bye)).length};
}
export const teamCode=code=>({WSH:'WAS',JAC:'JAX',LA:'LAR'}[code]||code);
export const findTeamGame=(games,team,week)=>games.find(g=>g.week===week&&[g.home?.code,g.away?.code].some(c=>teamCode(c)===teamCode(team)));

import {POSITIONS} from './scoring.js';
// A source's "active" flag alone includes long-retired players. Require recent games.
export function recentParticipantIds(rows, season) {
 return new Set(rows.filter(r=>Number(r.season)===season&&r.season_type==='regular'&&r.category==='stat'&&r.week==null&&Number(r.stats?.gp)>0).map(r=>String(r.player_id)));
}
export function freeAgentCandidate(player, recentIds) {
 return !!player?.active&&!player.team&&player.position!=='DEF'&&POSITIONS.includes(player.position)&&!/(retired|deceased)/i.test(player.status||'')&&recentIds.has(String(player.player_id));
}
// Do not resurrect an old team from projections after a player is released.
export function assignment(catalog, projection, historical) {
 const team=historical?.team||(catalog?catalog.team:projection?.team)||'FA';
 return {team,freeAgent:team==='FA'};
}

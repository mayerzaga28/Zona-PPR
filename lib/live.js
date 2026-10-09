import {normalizeOdds} from './live-odds.js';
import {normalizeRoster} from './live-roster.js';
const cache=new Map(),pending=new Map();
const number=x=>x==null||x===''?null:Number.isFinite(Number(x))?Number(x):null;
const logo=x=>/^https:\/\/a\.espncdn\.com\//.test(x||'')?x:null;
export function liveGame(e){const c=e.competitions?.[0];if(!c)return null;const s=c.status||e.status||{},state=s.type?.completed?'post':s.type?.state||'pre';const team=t=>({id:t.id,code:t.team?.abbreviation,name:t.team?.displayName,logo:logo(t.team?.logo||t.team?.logos?.[0]?.href),record:t.records?.find(r=>r.type==='total')?.summary||null,score:state==='pre'?null:number(t.score),quarters:(t.linescores||[]).map(q=>number(q.value))});const a=c.competitors?.find(t=>t.homeAway==='away'),h=c.competitors?.find(t=>t.homeAway==='home');if(!a||!h)return null;return {id:e.id,date:e.date||c.date,week:e.week?.number,state,period:s.period||null,clock:s.displayClock||null,status:s.type?.shortDetail||s.type?.description||'',away:team(a),home:team(h),venue:c.venue?.fullName||'',possession:c.situation?.possession||null,situation:c.situation?.downDistanceText||'',lastPlay:c.situation?.lastPlay?.text||null};}
export function liveDetail(d){return {odds:normalizeOdds(d.pickcenter||d.odds),game:(()=>{const g=liveGame(d.header||{});return g?{...g,venue:g.venue||d.gameInfo?.venue?.fullName||''}:null})(),plays:(d.scoringPlays||[]).map(p=>({id:p.id,text:p.text,clock:p.clock?.displayValue,period:p.period?.number,away:number(p.awayScore),home:number(p.homeScore)})).reverse(),recent:[...new Map([...(d.drives?.previous||[]).flatMap(x=>x.plays||[]),...(d.drives?.current?.plays||[])].map(p=>[p.id,p])).values()].slice(-80).reverse().map(p=>({id:p.id,text:p.text,clock:p.clock?.displayValue,period:p.period?.number,kind:p.type?.text||'',yards:number(p.statYardage),penalty:!!p.isPenalty,team:p.start?.team?.id||null,at:p.wallclock||null})),stats:(d.boxscore?.teams||[]).map(t=>({id:t.team?.id,code:t.team?.abbreviation,values:(t.statistics||[]).map(s=>({name:s.label||s.name,value:s.displayValue}))}))};}
async function fetchData(key,url,parse,ttl=20000){const old=cache.get(key);if(old&&Date.now()-old.time<ttl)return {...old.data,stale:false};if(pending.has(key))return pending.get(key);const promise=(async()=>{try{const r=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Source unavailable');const raw=await r.json();const data={...parse(raw),updatedAt:new Date().toISOString(),source:'ESPN'};cache.set(key,{time:Date.now(),data});if(cache.size>60)cache.delete(cache.keys().next().value);return {...data,stale:false};}catch(e){if(old&&Date.now()-old.time<15*60000)return {...old.data,stale:true};throw e;}finally{pending.delete(key)}})();pending.set(key,promise);return promise;}
export function getLive(event,week){const base='https://site.api.espn.com/apis/site/v2/sports/football/nfl/';return event?fetchData('e'+event,base+'summary?event='+event,d=>{if(!d.header?.competitions)throw Error();return liveDetail(d)}):fetchData('w'+(week||'current'),base+'scoreboard'+(week?'?dates=2026&seasontype=2&week='+week:''),d=>{if(!Array.isArray(d.events))throw Error();return {week:d.week?.number,season:d.season?.year,games:d.events.map(liveGame).filter(Boolean)}});}

export async function getSeasonLive(){
 const base='https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
 const years=await Promise.all([2026,2027].map(year=>fetchData('calendar'+year,base+'?dates='+year+'&seasontype=2&limit=1000',d=>{if(!Array.isArray(d.events))throw Error();return {games:d.events.filter(e=>e.season?.year===2026&&e.season?.type===2).map(liveGame).filter(Boolean)}},300000)));
 const map=new Map(years.flatMap(x=>x.games).map(g=>[g.id,g]));
 if(map.size!==272)throw Error('Calendario incompleto');
 let current=null;try{current=await getLive();for(const g of current.games)if(map.has(g.id))map.set(g.id,g)}catch{}
 return {season:2026,week:current?.week||null,games:[...map.values()].sort((a,b)=>new Date(a.date)-new Date(b.date)),updatedAt:current?.updatedAt||years[0].updatedAt,stale:years.some(x=>x.stale)||!current||current.stale,source:'ESPN'};
}

export async function getGameRosters(event){
 const detail=await getLive(event);if(!detail.game)throw Error('Partido no disponible');
 const teams=await Promise.all([detail.game.away,detail.game.home].map(async team=>{try{const data=await fetchData('roster'+team.id,'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/'+encodeURIComponent(team.id)+'/roster',normalizeRoster,60000);return {...team,...data};}catch{return {...team,players:[],error:'No se pudo consultar este roster.'}}}));
 return {event,teams,scope:'current',updatedAt:new Date().toISOString()};
}

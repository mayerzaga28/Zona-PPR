export const slotNeeds={QB:1,RB:2,WR:2,TE:1,K:1,DEF:1};
export function draftTeam(index,teams){const round=Math.floor(index/teams);return round%2?teams-1-index%teams:index%teams}
export function botChoice(pool,picks,teams,rounds){
 const owner=draftTeam(picks.length,teams),mine=picks.filter((_,i)=>draftTeam(i,teams)===owner),counts={};mine.forEach(p=>counts[p.position]=(counts[p.position]||0)+1);
 const used=new Set(picks.map(p=>p.id)),left=pool.filter(p=>!used.has(p.id)),missing=Object.entries(slotNeeds).filter(([pos,n])=>(counts[pos]||0)<n),required=missing.reduce((s,[pos,n])=>s+n-(counts[pos]||0),0),turns=rounds-mine.length;
 const candidates=left.filter(p=>turns<=required?missing.some(([pos])=>pos===p.position):!['K','DEF'].includes(p.position)&&(counts[p.position]||0)<({QB:2,RB:6,WR:6,TE:2}[p.position]||1));
 return candidates.map(p=>{const rank=Number.isFinite(p.adp)?p.adp:left.indexOf(p)+1,count=counts[p.position]||0,need=count<(slotNeeds[p.position]||0);return {p,value:rank*(need?.88:1.2)*(count>0&&['QB','TE'].includes(p.position)?1.45:1)*(1+((owner%3)-1)*(['WR','RB'][owner%2]===p.position?.06:0))}}).sort((a,b)=>a.value-b.value)[0]?.p||left[0];
}
export function survivorResult(team,games,week){const g=games.find(g=>g.week===week&&(g.home===team||g.away===team));if(!g||g.homeScore==null||g.awayScore==null)return 'pending';return (g.home===team?g.homeScore>g.awayScore:g.awayScore>g.homeScore)?'win':'loss'}
export function canChoose(team,games,week,picks,now=Date.now()){const g=games.find(g=>g.week===week&&(g.home===team||g.away===team));const old=picks[week],previous=games.find(g=>g.week===week&&(g.home===old||g.away===old));return !!g&&Number.isFinite(Date.parse(g.date))&&Date.parse(g.date)>now&&g.homeScore==null&&!Object.entries(picks).some(([w,t])=>Number(w)!==week&&t===team)&&(!previous||Date.parse(previous.date)>now)}
export function quizRound(pool,random=Math.random){const unique=[...new Map(pool.map(p=>[p.name,p])).values()];if(unique.length<4)return null;const target=unique[Math.floor(random()*unique.length)];const others=unique.filter(p=>p.id!==target.id);const choices=[target];while(choices.length<4){const i=Math.floor(random()*others.length);choices.push(others.splice(i,1)[0])}for(let i=choices.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]]}return {target,choices}}

export function quizMatch(pool,random=Math.random){
 const available=[...new Map(pool.map(p=>[p.name,p])).values()],rounds=[];
 while(rounds.length<5&&available.length>=4){const round=quizRound(available,random);rounds.push(round);available.splice(available.findIndex(p=>p.id===round.target.id),1)}
 return rounds.length===5?rounds:[];
}
export function quizScore(answers){let hits=0,streak=0,bestStreak=0,points=0;for(const win of answers.slice(0,5)){streak=win?streak+1:0;if(win){hits++;points+=100+streak*10}bestStreak=Math.max(bestStreak,streak)}return {hits,streak,bestStreak,points}}
export function newsMatches(article,favorites){const normalize=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();const text=' '+normalize(article.title+' '+(article.description||''))+' ';return favorites.filter(p=>{const name=normalize(p.name);return name&&text.includes(' '+name+' ')})}

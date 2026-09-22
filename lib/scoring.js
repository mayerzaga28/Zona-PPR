export const POSITIONS=['QB','RB','WR','TE','K','DEF'];
export const SLOTS=['QB','RB1','RB2','WR1','WR2','TE','FLEX','K','DEF'];
export const canPlay=(slot,pos)=>slot==='FLEX'?['RB','WR','TE'].includes(pos):slot.replace(/[12]/g,'')===pos;
export const out=p=>/^(out|ir|injured reserve|suspended|sus|pup)$/i.test(p.injury||'');
export function score(s,pos){
 const fields=pos==='K'?['fgm','fgm_0_19','fgm_20_29','fgm_30_39','fgm_40_49','fgm_50p','xpm','xpmiss','fgmiss','fgmiss_0_19','fgmiss_20_29','fgmiss_30_39','fgmiss_40_49','fgmiss_50p']:pos==='DEF'?['sack','int','fum_rec','def_td','st_td','safe','blk_kick','pts_allow','pts_allow_0','pts_allow_1_6','pts_allow_7_13','pts_allow_14_20','pts_allow_21_27','pts_allow_28_34','pts_allow_35p']:['pass_yd','pass_td','pass_int','rush_yd','rush_td','rec','rec_yd','rec_td','fum_lost','pass_2pt','rush_2pt','rec_2pt'];
 if(!s||!fields.some(k=>Number.isFinite(s[k])))return null;
 const n=k=>Number.isFinite(s[k])?s[k]:0;let parts;
 if(pos==='K')parts={fieldGoals:3*(n('fgm_0_19')+n('fgm_20_29')+n('fgm_30_39'))+4*n('fgm_40_49')+5*n('fgm_50p'),extraPoints:n('xpm'),misses:-n('fgmiss')-n('xpmiss')};
 else if(pos==='DEF'){
  const tiers={'pts_allow_0':10,'pts_allow_1_6':7,'pts_allow_7_13':4,'pts_allow_14_20':1,'pts_allow_21_27':0,'pts_allow_28_34':-1,'pts_allow_35p':-4};
  let allowed=Object.keys(tiers).some(k=>Number.isFinite(s[k]))?Object.entries(tiers).reduce((t,[k,v])=>t+n(k)*v,0):Number.isFinite(s.pts_allow)?s.pts_allow===0?10:s.pts_allow<=6?7:s.pts_allow<=13?4:s.pts_allow<=20?1:s.pts_allow<=27?0:s.pts_allow<=34?-1:-4:0;
  parts={sacks:n('sack'),takeaways:2*(n('int')+n('fum_rec')),touchdowns:6*(n('def_td')+n('st_td')),special:2*(n('safe')+n('blk_kick')),pointsAllowed:allowed};
 }else parts={passing:n('pass_yd')/25+4*n('pass_td'),rushing:n('rush_yd')/10+6*n('rush_td'),receiving:n('rec')+n('rec_yd')/10+6*n('rec_td'),turnovers:-2*(n('pass_int')+n('fum_lost')),conversions:2*(n('pass_2pt')+n('rush_2pt')+n('rec_2pt'))};
 if(pos==='K'&&!Number.isFinite(s.fgmiss))parts.misses=-(n('fgmiss_0_19')+n('fgmiss_20_29')+n('fgmiss_30_39')+n('fgmiss_40_49')+n('fgmiss_50p'))-n('xpmiss');
 return {points:Math.round(Object.values(parts).reduce((a,b)=>a+b,0)*100)/100,parts};
}
export function advice(p,week,current){if(p.bye)return 'Descanso';if(p.game?.state==='final')return 'Finalizado';if(p.game?.state==='started')return 'Inicio transcurrido';if(week===current&&out(p))return 'No alinear';if(p.injury)return 'Revisar lesión';if(p.points==null)return 'Sin proyección';return p.posRank<=(['RB','WR'].includes(p.position)?24:12)?'Opción titular':'Revisar alternativas'}
export function lineupTotal(lineup,players,week,current){const seen=new Set;return SLOTS.map(slot=>{const id=lineup[slot];const p=players.find(p=>p.id===id);const valid=p&&canPlay(slot,p.position)&&!seen.has(id);if(id)seen.add(id);return {slot,player:p,assigned:!!id,value:valid?(p.bye||week===current&&out(p)?0:p.points):null}})}
export function compare(a,b,week,current){if(!a||!b||a.id===b.id||a.position!==b.position)return {winner:null,reason:'Elige dos jugadores distintos de la misma posición.'};if(a.game?.state!=='pre'||b.game?.state!=='pre')return {winner:null,reason:'Uno de los partidos ya empezó, terminó o no tiene calendario confirmado. No es una recomendación previa al partido.'};if(a.points==null||b.points==null||a.bye||b.bye||week===current&&(out(a)||out(b)))return {winner:null,reason:'No hay dos opciones disponibles con proyección para esta semana.'};const diff=Math.abs(a.points-b.points);if(diff<0.5)return {winner:null,reason:'Empate técnico: menos de 0.5 puntos de diferencia. Revisa los reportes finales.'};return {winner:a.points>b.points?a:b,difference:diff,reason:'Ventaja según la proyección semanal de la fuente. El rival se presenta como contexto; no se añade un ajuste arbitrario que podría contarlo dos veces.'}}

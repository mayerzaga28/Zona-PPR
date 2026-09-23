import {canPlay,SLOTS} from './scoring.js';
const text=(v,n=100)=>typeof v==='string'?v.trim().slice(0,n):'';
export function validateImport(raw){
 if(!raw||raw.version!==1||raw.season!==2026||!Number.isInteger(raw.week)||raw.week<1||raw.week>18)throw Error('Archivo incompatible: se requiere temporada 2026 y semana 1–18.');
 const date=new Date(raw.importedAt);if(!Number.isFinite(date.getTime())||date.getTime()>Date.now()+300000)throw Error('Fecha de consulta inválida.');
 const teams=['mine','opponent'].map(key=>{
  const t=raw[key];if(!t||!text(t.name)||!Array.isArray(t.players)||t.players.length<1||t.players.length>40)throw Error('Falta uno de los equipos o su plantilla.');
  const slots=new Set,names=new Set;
  const players=t.players.map(p=>{
   const name=text(p.name),position=text(p.position,4),slot=text(p.slot,5);
   if(!name||!['QB','RB','WR','TE','K','DEF'].includes(position)||![...SLOTS,'BE','IR'].includes(slot))throw Error('Jugador, posición o puesto inválido.');
   if(names.has(name.toLowerCase()))throw Error('Hay jugadores duplicados en un equipo.');names.add(name.toLowerCase());
   if(SLOTS.includes(slot)){if(slots.has(slot)||!canPlay(slot,position))throw Error('Alineación incompatible o puesto duplicado.');slots.add(slot)}
   if(p.projection!==null&&(!Number.isFinite(p.projection)||p.projection < -100||p.projection>200))throw Error('Proyección inválida: usa un número o null cuando falte.');
   return {name,position,slot,projection:p.projection,opponent:text(p.opponent,24),injury:text(p.injury,40)};
  });
  return {name:text(t.name),players};
 });
 return {version:1,season:2026,week:raw.week,importedAt:date.toISOString(),mine:teams[0],opponent:teams[1]};
}
export function total(team){const starters=team.players.filter(p=>SLOTS.includes(p.slot)),known=starters.filter(p=>p.projection!==null);return {value:known.reduce((s,p)=>s+p.projection,0),complete:starters.length===9&&known.length===9,count:known.length}}
export function findPlayer(p,players){const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');const matches=players.filter(x=>x.position===p.position&&(norm(x.name)===norm(p.name)||(p.position==='DEF'&&norm(x.name).includes(norm(p.name)))));return matches.length===1?matches[0]:null}
export function alternatives(team){return team.players.filter(p=>p.slot==='BE'&&p.projection!==null&&!p.injury).flatMap(b=>team.players.filter(s=>SLOTS.includes(s.slot)&&canPlay(s.slot,b.position)&&s.projection!==null&&b.projection-s.projection>=.5).map(s=>({bench:b,starter:s,gain:b.projection-s.projection}))).sort((a,b)=>b.gain-a.gain)}

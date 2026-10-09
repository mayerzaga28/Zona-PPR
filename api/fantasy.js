import {configuration,supabase} from '../lib/community.js';
import {getBoard,getDraft,syncCommunitySchedule} from '../lib/data.js';
const actions=new Set(['delete','create','join','start','pick','autopick','lineup','add','trade','accept','reject','cancel','message','claim','cancel_claim']);
let lastSync=0,inflight;
async function sync(){
 if(Date.now()-lastSync<60000)return;
 if(inflight)return inflight;
 inflight=(async()=>{const [board,draft]=await Promise.all([getBoard(),getDraft()]);
 if(board.stale||draft.stale||board.warnings.some(x=>x.includes('Resultados')))throw Error('Fuentes incompletas');
 await syncCommunitySchedule(d=>supabase('/rest/v1/rpc/zona_sync_schedule',{admin:true,body:{p_games:d.games,p_week:d.currentWeek,p_source_at:d.sourceAt}}));
 const rows=[];for(const p of board.players){for(let w=1;w<=18;w++){const h=p.history.find(h=>h.week===w);const team=h?.team||p.team;const game=board.games.find(g=>g.week===w&&(g.home===team||g.away===team));rows.push({player_id:p.id,week:w,points:h?.points??null,projection:w===board.week?p.points:null,kickoff:game?.date??null,final:!!h?.final,bye:team!=='FA'&&board.games.length===272&&!game});}}
 await supabase('/rest/v1/rpc/zona_fantasy_sync',{admin:true,body:{p_players:draft.players,p_stats:rows}});lastSync=Date.now();})().finally(()=>{inflight=null});return inflight;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Authorization');res.setHeader('X-Content-Type-Options','nosniff');
 if(!configuration().enabled||process.env.FANTASY_ENABLED!=='true')return res.status(503).json({error:'Las ligas fantasy están pendientes de activación. Eliminator sigue disponible.'});
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método no permitido.'});
 const token=/^Bearer ([A-Za-z0-9._-]+)$/.exec(req.headers.authorization||'')?.[1];if(!token||token.length>10000)return res.status(401).json({error:'Inicia sesión para ver tus ligas.'});
 try{
 const user=await supabase('/auth/v1/user',{method:'GET',token});if(!user?.email_confirmed_at)return res.status(401).json({error:'Inicia sesión de nuevo.'});
 let warning=null;try{await sync()}catch{warning='No se pudo actualizar la fuente deportiva. Las acciones deportivas están pausadas.';if(req.method==='POST'&&!['delete','join','message','trade','reject','cancel'].includes(req.query?.action))return res.status(503).json({error:warning});}
 if(req.method==='GET'){
 const id=req.query?.league||null;if(id&&!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:'Liga inválida.'});
 const d=await supabase('/rest/v1/rpc/zona_fantasy_dashboard',{token,body:{p_league:id}});return res.status(200).json({...d,warning});
 }
 const action=req.query?.action;if(!actions.has(action))return res.status(400).json({error:'Acción inválida.'});
 if(!/^application\/json\b/i.test(req.headers['content-type']||''))return res.status(415).json({error:'Envía JSON.'});
 if(Number(req.headers['content-length'])>4096)return res.status(413).json({error:'Solicitud demasiado grande.'});
 const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
 if(!body||Array.isArray(body)||JSON.stringify(body).length>4096)return res.status(400).json({error:'Solicitud inválida.'});
 const d=await supabase('/rest/v1/rpc/zona_fantasy_action',{token,body:{p_action:action,p_body:body}});return res.status(200).json(d);
 }catch(e){return res.status(e.dbCode==='P0001'||['23505','23514','22P02'].includes(e.dbCode)?400:e.status===401?401:503).json({error:e.dbCode==='P0001'?e.message:e.dbCode==='23505'?'Ese jugador o selección ya está ocupado. Actualiza la liga.':['23514','22P02'].includes(e.dbCode)?'Revisa los datos de la solicitud.':'No se pudo completar la operación. Intenta actualizar.'});}
}

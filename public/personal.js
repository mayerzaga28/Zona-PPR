// Account-scoped state: no authenticated profile data is copied into guest storage.
let client=null,userId=null,revision=0,pending=0,writes=0,queue=Promise.resolve();
const empty=()=>({favorites:[],bestHits:0,bestPoints:0,bestStreak:0,games:0});
let profile=empty(),error='';
export const personalState=()=>({userId,profile,error,pending:pending>0});
const emit=()=>window.dispatchEvent(new Event('zona:personal'));
async function request(action,body){
 if(!client||!userId)throw Error('Inicia sesión para guardar en tu perfil.');
 const owner=userId,{data,error:e}=await client.auth.getSession();
 if(e||data.session?.user.id!==owner)throw Error('La sesión cambió. Vuelve a intentarlo.');
 const r=await fetch('/api/community?action='+action,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+data.session.access_token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(15000)});
 const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo guardar. Inténtalo otra vez.');return d.value??d;
}
export async function connectPersonal(auth,session){
 client=auth;const next=session?.user.id||null;if(next===userId)return;
 userId=next;profile=empty();error='';pending=0;const seq=++revision,startedWrites=writes;emit();if(!next)return;
 try{const d=await request('personal');if(seq!==revision||writes!==startedWrites)return;profile=d;emit()}catch(e){if(seq===revision){error='No se pudo cargar tu perfil. '+e.message;emit()}}
}
export function savePersonal(action,body){
 const seq=revision;pending++;writes++;error='';emit();
 const task=queue.catch(()=>{}).then(async()=>{
  if(seq!==revision)throw Error('La sesión cambió. Vuelve a intentarlo.');
  try{const d=await request(action,body);if(seq!==revision)throw Error('La sesión cambió; el resultado no se aplicó a la nueva cuenta.');profile=d;return d}
  catch(e){if(seq===revision)error=e.message;throw e}
  finally{if(seq===revision){pending--;emit()}}
 });queue=task;return task;
}

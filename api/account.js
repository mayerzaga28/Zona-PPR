import {createHash,randomBytes} from 'node:crypto';
import {configuration,supabase} from '../lib/community.js';
const digest=x=>createHash('sha256').update(x).digest('hex');
const userEmail=username=>username+'@accounts.zonappr.invalid';
export function credentials(body){
 const username=typeof body?.username==='string'?body.username.trim().toLowerCase():'';
 const password=body?.password;
 if(!/^[a-z0-9_]{3,24}$/.test(username))throw Error('Usa un usuario de 3 a 24 caracteres: letras, números o guion bajo.');
 if(typeof password!=='string'||password.length<12||password.length>128)throw Error('Usa una contraseña de 12 a 128 caracteres.');
 return {username,password};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido.'});
 const config=configuration();if(!config.enabled)return res.status(503).json({error:'Las cuentas aún no están disponibles.'});
 const origin=req.headers.origin;
 if(origin&&origin!=='https://zona-ppr.vercel.app'&&!(process.env.NODE_ENV!=='production'&&/^http:\/\/localhost:\d+$/.test(origin)))return res.status(403).json({error:'Origen no permitido.'});
 if(!/^application\/json\b/i.test(req.headers['content-type']||''))return res.status(415).json({error:'Formato no admitido.'});
 if(Number(req.headers['content-length'])>4096)return res.status(413).json({error:'Solicitud demasiado grande.'});
 let b,creds;try{b=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!b||Array.isArray(b)||JSON.stringify(b).length>4096)throw Error('Solicitud inválida.');creds=credentials(b)}catch(e){return res.status(400).json({error:e.message})}
 const action=req.query?.action;if(!['signup','login','recover'].includes(action))return res.status(400).json({error:'Acción inválida.'});
 const {username,password}=creds;
 const rpc=(name,body)=>supabase('/rest/v1/rpc/'+name,{admin:true,body});
 try{
  const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
  const keys=[digest(config.service+':'+action+':ip:'+ip),digest(config.service+':'+action+':user:'+username)];
  const allowed=await rpc('zona_auth_limit',{p_keys:keys,p_max:action==='login'?20:action==='signup'?10:5,p_seconds:action==='login'?900:3600});
  if(!allowed){res.setHeader('Retry-After',action==='login'?'900':'3600');return res.status(429).json({error:'Demasiados intentos. Inténtalo más tarde.'})}
  let recoveryCode;
  if(action==='signup'){
   recoveryCode=randomBytes(24).toString('hex');let user;
   try{user=await supabase('/auth/v1/admin/users',{admin:true,body:{email:userEmail(username),password,email_confirm:true,user_metadata:{account_type:'username'}}})}
   catch(e){if(e.status===422||e.status===400)return res.status(400).json({error:'No se pudo crear la cuenta. Prueba otro usuario y una contraseña más segura.'});throw e}
   if(!user?.id)throw Error('Invalid registration response');
   try{await rpc('zona_identity_create',{p_user:user.id,p_username:username,p_hash:digest(recoveryCode)})}
   catch(e){await supabase('/auth/v1/admin/users/'+user.id,{admin:true,method:'DELETE'}).catch(()=>{});throw e}
  }
  if(action==='recover'){
   const code=typeof b.code==='string'?b.code.replace(/[\s-]/g,'').toLowerCase():'';
   if(!/^[0-9a-f]{48}$/.test(code))return res.status(400).json({error:'Usuario o código de recuperación incorrectos.'});
   recoveryCode=randomBytes(24).toString('hex');const oldHash=digest(code),newHash=digest(recoveryCode);
   const id=await rpc('zona_recovery_claim',{p_username:username,p_hash:oldHash,p_new_hash:newHash});
   if(!id)return res.status(400).json({error:'Usuario o código de recuperación incorrectos.'});
   try{await supabase('/auth/v1/admin/users/'+id,{admin:true,method:'PUT',body:{password}})}catch(e){await rpc('zona_recovery_restore',{p_user:id,p_hash:newHash,p_previous:oldHash}).catch(()=>{});throw e}
  }
  let session;
  try{session=await supabase('/auth/v1/token?grant_type=password',{body:{email:userEmail(username),password}})}
  catch(e){if(recoveryCode)return res.status(200).json({ok:true,recoveryCode,session:null,username,message:'Tu cuenta está lista. Guarda el código y entra con tu usuario y contraseña.'});if(e.status===400||e.status===422)return res.status(401).json({error:'Usuario o contraseña incorrectos.'});throw e}
  return res.status(200).json({ok:true,username,recoveryCode,session:{access_token:session.access_token,refresh_token:session.refresh_token}});
 }catch{return res.status(503).json({error:'No se pudo completar la operación. Inténtalo nuevamente.'})}
}

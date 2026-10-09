export function rosterStatus(p){
 const injury=[...(p.injuries||[])].sort((a,b)=>Date.parse(b.date||0)-Date.parse(a.date||0))[0];
 const raw=injury?.status||p.status?.name||'';
 const labels={Out:'Baja reportada','Injured Reserve':'Reserva de lesionados',Suspended:'Suspendido',Questionable:'En duda',Doubtful:'Poco probable','Physically Unable to Perform':'No apto físicamente','Practice Squad':'Equipo de práctica',Inactive:'Inactivo',Active:'Sin baja reportada','Day-To-Day':'Día a día'};
 const status=/^(out|injured reserve|suspended|physically unable to perform|inactive)$/i.test(raw)?'out':/questionable|doubtful|day.to.day/i.test(raw)?'doubt':'unknown';
 return {status,label:labels[raw]||raw||'Sin confirmación',reportedAt:injury?.date||null};
}
export function normalizeRoster(d){if(!Array.isArray(d.athletes))throw Error('Roster unavailable');return {players:[...new Map(d.athletes.flatMap(g=>(g.items||[]).map(p=>({id:p.id,name:p.displayName||p.fullName,position:p.position?.abbreviation||'—',unit:g.position,number:p.jersey||'—',bio:{age:p.age??null,birth:p.dateOfBirth||null,height:p.displayHeight||null,weight:p.displayWeight||null,college:p.college?.name||null,experience:p.experience?.years??null,debut:p.debutYear??null,birthplace:[p.birthPlace?.city,p.birthPlace?.state,p.birthPlace?.country].filter(Boolean).join(', ')||null},photo:/^https:\/\/a\.espncdn\.com\//.test(p.headshot?.href||'')?p.headshot.href:null,...rosterStatus(p)}))).map(p=>[p.id,p])).values()]};}

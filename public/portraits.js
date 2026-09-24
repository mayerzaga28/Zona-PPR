const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function portrait(p,large=false){
 if(!p)return '';
 const id=String(p.id||''),def=p.position==='DEF',valid=def?/^[A-Z]{2,3}$/.test(id):/^\d+$/.test(id);
 const initials=p.name.split(/\s+/).filter(Boolean).slice(0,2).map(n=>n[0]).join('');
 const url=valid?(def?'https://sleepercdn.com/images/team_logos/nfl/'+id.toLowerCase()+'.png':'https://sleepercdn.com/content/nfl/players/'+id+'.jpg'):'';
 return `<span class="portrait ${large?'portrait-large':''} ${def?'portrait-team':''}" aria-hidden="true"><span>${esc(initials)}</span>${url?`<img src="${url}" alt="" loading="lazy" decoding="async" width="80" height="80" referrerpolicy="no-referrer">`:''}</span>`;
}
document.addEventListener('error',e=>{if(e.target.matches?.('.portrait img')){e.target.remove()}},true);

// Fill dedicated positions before FLEX, preserving draft order within each position.
export const MOCK_SLOTS=['QB','RB1','RB2','WR1','WR2','TE','FLEX','K','DEF'];
export function arrangeRoster(players){
 const remaining=[...players],slots=MOCK_SLOTS.map(slot=>({slot,player:null}));
 for(const row of slots.filter(r=>r.slot!=='FLEX')){const pos=row.slot.replace(/[12]$/,'');const i=remaining.findIndex(p=>p.position===pos);if(i>=0)row.player=remaining.splice(i,1)[0];}
 const flex=remaining.findIndex(p=>['RB','WR','TE'].includes(p.position));if(flex>=0)slots.find(r=>r.slot==='FLEX').player=remaining.splice(flex,1)[0];
 return {slots,bench:remaining,filled:slots.filter(r=>r.player).length};
}
export function destination(players,candidate){const roster=arrangeRoster([...players,candidate]);return roster.slots.find(r=>r.player?.id===candidate.id)?.slot||'Banca';}

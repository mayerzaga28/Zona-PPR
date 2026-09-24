const motionButton=document.getElementById('motionToggle');
let motionOff=matchMedia('(prefers-reduced-motion: reduce)').matches;
try{const saved=localStorage.getItem('zona-motion');if(saved)motionOff=saved==='off'}catch{}
function applyMotion(){document.documentElement.dataset.motion=motionOff?'off':'on';motionButton.textContent=motionOff?'Animaciones: no':'Animaciones: sí';motionButton.setAttribute('aria-pressed',String(!motionOff))}
motionButton.addEventListener('click',()=>{motionOff=!motionOff;try{localStorage.setItem('zona-motion',motionOff?'off':'on')}catch{}applyMotion()});applyMotion();
document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)))}));

// Position shortcuts keep the existing filter as the single source of truth.
const positionSelect=document.getElementById('position');
const shortcuts=document.createElement('div');
shortcuts.className='position-shortcuts';
shortcuts.setAttribute('role','group');
shortcuts.setAttribute('aria-label','Elegir posición rápidamente');
for(const [value,label] of [['','Todos'],['QB','Quarterbacks'],['RB','Corredores'],['WR','Receptores'],['TE','Tight ends'],['K','Kickers'],['DEF','Defensivas']]){
 const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.position=value;
 button.addEventListener('click',()=>{positionSelect.value=value;positionSelect.dispatchEvent(new Event('change',{bubbles:true}))});shortcuts.append(button);
}
positionSelect.closest('.filters').before(shortcuts);
function syncShortcuts(){shortcuts.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.position===positionSelect.value)))}
positionSelect.addEventListener('change',syncShortcuts);syncShortcuts();
document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.classList.contains('active'))));

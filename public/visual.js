const preference=matchMedia('(prefers-reduced-motion: reduce)');
const sync=()=>document.documentElement.dataset.motion=preference.matches?'off':'on';
sync();preference.addEventListener('change',sync);
document.addEventListener('click',event=>{if(event.target.closest('[data-tab]'))document.querySelector('.more-nav').open=false});

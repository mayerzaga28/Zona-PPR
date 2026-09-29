// Exactly one pending pick. Pausing/resetting invalidates an already scheduled callback.
export function draftClock(step,{schedule=setTimeout,cancel=clearTimeout,delay=1400}={}){
 let timer=null,generation=0;
 return {stop(){generation++;if(timer!==null)cancel(timer);timer=null},start(){if(timer!==null)return;const ticket=generation;timer=schedule(()=>{timer=null;if(ticket===generation)step()},delay)},get pending(){return timer!==null}};
}

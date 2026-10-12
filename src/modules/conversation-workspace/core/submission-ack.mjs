// One pending native Send acknowledgement, driven by the existing DOM observer.
// No network calls, retries, or transcript persistence.
const normalize=text=>String(text||'').replace(/\s+/g,' ').trim();
export function createSubmissionTracker({schedule=setTimeout,cancelSchedule=clearTimeout}={}) {
  let pending=null;
  function begin({text,messages=[],route,timeoutMs=6000}) {
    if(pending)throw new Error('A message is already awaiting ChatGPT acknowledgement.');
    const wanted=normalize(text);
    if(!wanted)throw new Error('Write a message first.');
    const known=new Set(messages.filter(row=>row.role==='user').map(row=>row.id));
    const lastUserIndex=messages.reduce((i,row,index)=>row.role==='user'?index:i,-1);
    let finish;
    const promise=new Promise(resolve=>{finish=resolve;});
    const task={route,wanted,known,lastUserIndex,promise,timer:null,
      finish(status){
        if(pending!==task)return;
        cancelSchedule(task.timer);pending=null;finish({status});
      }};
    pending=task;
    task.timer=schedule(()=>task.finish('uncertain'),timeoutMs);
    return {promise,cancel:()=>task.finish('cancelled')};
  }
  function observe(messages=[],route,observation={}) {
    const task=pending;
    if(!task)return;
    if(route!==task.route && !task.route.startsWith('route:')){
      task.finish('uncertain');return;
    }
    // Older-history scans are not evidence of a newly sent message.
    if(observation.moved===true || observation.direction==='up' || observation.direction==='down')return;
    const isNewChatRoute=route!==task.route;
    for(let i=0;i<messages.length;i++){
      const row=messages[i];
      if(row.role!=='user'||task.known.has(row.id)||(!isNewChatRoute&&i<=task.lastUserIndex))continue;
      if(normalize(row.text)===task.wanted){task.finish('observed');return;}
    }
  }
  function cancel(){pending?.finish('uncertain');}
  return {begin,observe,cancel,get pending(){return !!pending;}};
}

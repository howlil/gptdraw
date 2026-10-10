// Native DOM windows can be virtualized and recycled. Never treat a
// positional data-testid as chronology. A scroll-observed disjoint window may
// join the display in the observed direction, but carries a DISCONNECTED edge.
export function mergeVisibleMessages(known,visible,loadingEarlier=false) {
  if(!known.length)return visible.slice();
  if(!visible.length)return known.slice();
  const oldIds=new Set(known.map(item=>item.id));
  const updated=new Map(visible.map(item=>[item.id,item]));
  const before=new Map(),after=new Map();
  let waiting=[],previous=null,hasOverlap=false;
  for(const item of visible){
    if(oldIds.has(item.id)){
      hasOverlap=true;
      if(waiting.length){
        before.set(item.id,[...(before.get(item.id)||[]),...waiting]);waiting=[];
      }
      previous=item.id;
    }else waiting.push(item);
  }
  if(waiting.length){
    if(hasOverlap && previous!==null)after.set(previous,waiting);
    else if(loadingEarlier)before.set(known[0].id,waiting);
    else after.set(known[known.length-1].id,waiting);
  }
  const merged=[];
  for(const existing of known){
    if(before.has(existing.id))merged.push(...before.get(existing.id));
    merged.push(updated.get(existing.id)||existing);
    if(after.has(existing.id))merged.push(...after.get(existing.id));
  }
  return merged;
}
function canAnchor(old,now) {
  if(old.id!==now.id || old.role!==now.role)return false;
  if(old.identity==='stable' && now.identity==='stable')return true;
  // Turn keys or session-only observed IDs need content corroboration. A
  // recycled positional index with the same ID is never enough.
  return (old.identity==='candidate'||old.identity==='ephemeral'||
    now.identity==='candidate'||now.identity==='ephemeral')
    && old.text===now.text;
}

// A scroll step is directional evidence that one DOM window was reached
// before/after another, but NOT evidence of a contiguous chronological edge.
export function mergeAnchoredHistory(known,visible,previousUnresolved=[],
    loadingEarlier=false,observation={}) {
  let messages=known.slice(),unresolved=[...previousUnresolved];
  const merge=page=>{
    if(!page.length)return true;
    if(!messages.length){messages=page.slice();return true;}
    const previous=new Map(messages.map(row=>[row.id,row]));
    const anchored=page.some(row=>{
      const old=previous.get(row.id);
      return old&&canAnchor(old,row);
    });
    if(!anchored)return false;
    messages=mergeVisibleMessages(messages,page,loadingEarlier);
    return true;
  };
  if(!merge(visible)&&visible.length){
    const validScan=observation?.moved===true &&
      (observation.direction==='up'||observation.direction==='down');
    const knownIds=new Set(messages.map(row=>row.id));
    const newRows=visible.filter(row=>!knownIds.has(row.id));
    if(validScan && newRows.length && messages.length){
      if(observation.direction==='up'){
        // The join is not proven adjacent. Suppress its SVG connector.
        const first={...messages[0],breakBefore:true};
        messages=[...newRows,first,...messages.slice(1)];
      }else{
        messages=[...messages,{...newRows[0],breakBefore:true},...newRows.slice(1)];
      }
    }else if(!unresolved.some(page=>page.length===visible.length &&
      page.every((row,i)=>row.id===visible[i].id))){
      unresolved.push(visible.slice());
    }
  }
  // A newly anchored/observed window may resolve a former pending window.
  let progress=true;
  while(progress){
    progress=false;
    const rest=[];
    for(const page of unresolved){
      if(merge(page))progress=true;
      else rest.push(page);
    }
    unresolved=rest;
  }
  if(unresolved.length>40)unresolved=unresolved.slice(-40);
  return {messages,unresolved};
}

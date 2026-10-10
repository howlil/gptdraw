// Merge virtualized DOM pages while retaining their observed chronological
// order in volatile memory. Linear in existing+visible messages.
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
        // New items immediately preceding a known item belong before it.
        before.set(item.id,[...(before.get(item.id)||[]),...waiting]);
        waiting=[];
      }
      previous=item.id;
    } else waiting.push(item);
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


// Do not fabricate chronological order between two disjoint virtualized
// windows. Unanchored pages stay in memory until a later scan overlaps one.
export function mergeAnchoredHistory(known,visible,previousUnresolved=[],loadingEarlier=false) {
  let messages=known.slice(),unresolved=[...previousUnresolved];
  const merge=page=>{
    if(!page.length)return true;
    if(!messages.length){messages=page.slice();return true;}
    // Recycled data-testid or unverified turn-key overlap is not ordering
    // evidence. It can refer to an entirely different virtualized message.
    const safe=new Set(messages.filter(x=>!x.identity||x.identity==='stable').map(x=>x.id));
    const anchored=page.some(x=>(!x.identity||x.identity==='stable')&&safe.has(x.id));
    if(!anchored)return false;
    messages=mergeVisibleMessages(messages,page,loadingEarlier);
    return true;
  };
  if(!merge(visible)&&visible.length&&!unresolved.some(p=>p.length===visible.length &&
    p.every((row,i)=>row.id===visible[i].id)))unresolved.push(visible.slice());
  // Iterate until no more anchored segments can be resolved.
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
  // Cap unresolved UI-only pages; no sequential edges for these messages.
  if(unresolved.length>40)unresolved=unresolved.slice(-40);
  return {messages,unresolved};
}

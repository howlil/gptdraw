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

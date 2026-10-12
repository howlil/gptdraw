// Uniform spatial hash. Structural loads rebuild; ordinary card resize/drag
// updates only the cells intersected by the changed card.
export function buildSpatialIndex(entries,cell=800) {
  if(!Number.isFinite(cell)||cell<=0)throw new Error('Invalid cell size.');
  const grid=new Map(),items=new Map(),membership=new Map();
  const key=(x,y)=>x+':'+y;
  const cellsFor=item=>{
    const width=item.w||400,height=item.h||600;
    const left=Math.floor(item.x/cell),right=Math.floor((item.x+width)/cell);
    const top=Math.floor(item.y/cell),bottom=Math.floor((item.y+height)/cell);
    const keys=[];
    for(let x=left;x<=right;x++)for(let y=top;y<=bottom;y++)keys.push(key(x,y));
    return keys;
  };
  function remove(id) {
    const old=membership.get(id);
    if(!old)return false;
    for(const cellKey of old){
      const bucket=grid.get(cellKey);
      bucket?.delete(id);
      if(bucket?.size===0)grid.delete(cellKey);
    }
    membership.delete(id);items.delete(id);return true;
  }
  function upsert(item) {
    if(!item || item.id==null || !Number.isFinite(item.x)||!Number.isFinite(item.y)){
      if(item?.id!=null)remove(item.id);
      return false;
    }
    const old=items.get(item.id);
    if(old && old.x===item.x && old.y===item.y && old.w===item.w && old.h===item.h)return false;
    const nextCells=cellsFor(item),oldCells=membership.get(item.id);
    const sameCells=oldCells && oldCells.length===nextCells.length &&
      oldCells.every((cellKey,i)=>cellKey===nextCells[i]);
    if(!sameCells){
      remove(item.id);
      for(const cellKey of nextCells){
        if(!grid.has(cellKey))grid.set(cellKey,new Set());
        grid.get(cellKey).add(item.id);
      }
      membership.set(item.id,nextCells);
    }
    items.set(item.id,item);
    return true;
  }
  for(const item of entries)upsert(item);
  return {
    get count(){return items.size;},
    upsert,remove,
    query({panX,panY,scale,width,height},margin=520){
      if(!scale||width<=0||height<=0)return [...items.keys()];
      const left=Math.floor((-panX/scale-margin)/cell);
      const top=Math.floor((-panY/scale-margin)/cell);
      const right=Math.floor(((width-panX)/scale+margin)/cell);
      const bottom=Math.floor(((height-panY)/scale+margin)/cell);
      const result=new Set();
      for(let x=left;x<=right;x++)for(let y=top;y<=bottom;y++)
        for(const id of grid.get(key(x,y))||[])result.add(id);
      return [...result];
    }
  };
}

// Grid index of projected card bounds. Build on structure/layout changes,
// query on pan/zoom without rescanning every turn or rereading the DOM.
export function buildSpatialIndex(entries,cell=800) {
  if(!Number.isFinite(cell)||cell<=0)throw new Error('Invalid cell size.');
  const grid=new Map();
  const key=(x,y)=>x+':'+y;
  for(const item of entries){
    if(!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;
    const left=Math.floor(item.x/cell),right=Math.floor((item.x+(item.w||400))/cell);
    const top=Math.floor(item.y/cell),bottom=Math.floor((item.y+(item.h||600))/cell);
    for(let x=left;x<=right;x++)for(let y=top;y<=bottom;y++){
      const k=key(x,y);
      if(!grid.has(k))grid.set(k,new Set());
      grid.get(k).add(item.id);
    }
  }
  return {
    count:entries.length,
    query({panX,panY,scale,width,height},margin=520){
      if(!scale||width<=0||height<=0)return entries.map(x=>x.id);
      const left=Math.floor((-panX/scale-margin)/cell);
      const top=Math.floor((-panY/scale-margin)/cell);
      const right=Math.floor(((width-panX)/scale+margin)/cell);
      const bottom=Math.floor(((height-panY)/scale+margin)/cell);
      const result=new Set();
      for(let x=left;x<=right;x++)for(let y=top;y<=bottom;y++){
        for(const id of grid.get(key(x,y))||[])result.add(id);
      }
      return [...result];
    }
  };
}

// Presentation-only state: never infer that an empty existing route is a new chat.
export function deriveWorkspaceMode(state={}) {
  const turns=state.turns||[];
  if(turns.length>0) {
    return (state.branches||[]).some(b=>b.status==='confirmed')?'branched':
      turns.length===1?'single':'multi';
  }
  if(!String(state.route||'').startsWith('conversation:'))return 'new';
  return ['unavailable','limited'].includes(state.history?.status)?'unavailable':'loading';
}
export function centerEntryCamera(viewportWidth,viewportHeight,cardWidth,cardHeight) {
  return {scale:1,panX:(viewportWidth-cardWidth)/2,panY:(viewportHeight-cardHeight)/2};
}
// Cache once on layout/size change. Camera frames compare only four numbers.
export function calculateGraphBounds(points=[]) {
  const bounds={count:0,minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  for(const point of points){
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y))continue;
    bounds.count++;
    bounds.minX=Math.min(bounds.minX,point.x);
    bounds.minY=Math.min(bounds.minY,point.y);
    bounds.maxX=Math.max(bounds.maxX,point.x+(point.w||366));
    bounds.maxY=Math.max(bounds.maxY,point.y+(point.h||190));
  }
  return bounds;
}
export function shouldShowMinimap(pointsOrBounds,camera) {
  const bounds=Array.isArray(pointsOrBounds)?calculateGraphBounds(pointsOrBounds):pointsOrBounds;
  if(!bounds || bounds.count<2 || !camera || !(camera.width>0) ||
      !(camera.height>0) || !(camera.scale>0))return false;
  const visibleLeft=-camera.panX/camera.scale;
  const visibleTop=-camera.panY/camera.scale;
  const visibleRight=(camera.width-camera.panX)/camera.scale;
  const visibleBottom=(camera.height-camera.panY)/camera.scale;
  return bounds.minX<visibleLeft-1 || bounds.minY<visibleTop-1 ||
    bounds.maxX>visibleRight+1 || bounds.maxY>visibleBottom+1;
}

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
export function shouldShowMinimap(points,camera) {
  if(points.length<2 || !camera || !(camera.width>0) || !(camera.height>0) ||
      !(camera.scale>0))return false;
  const left=Math.min(...points.map(p=>p.x));
  const top=Math.min(...points.map(p=>p.y));
  const right=Math.max(...points.map(p=>p.x+(p.w||366)));
  const bottom=Math.max(...points.map(p=>p.y+(p.h||190)));
  const visibleLeft=-camera.panX/camera.scale;
  const visibleTop=-camera.panY/camera.scale;
  const visibleRight=(camera.width-camera.panX)/camera.scale;
  const visibleBottom=(camera.height-camera.panY)/camera.scale;
  return left<visibleLeft-1 || top<visibleTop-1 ||
    right>visibleRight+1 || bottom>visibleBottom+1;
}

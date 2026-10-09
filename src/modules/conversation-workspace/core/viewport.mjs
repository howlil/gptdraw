// Pure camera projection for lightweight, click-to-navigate minimap.
export function minimapProjection(points,width=196,height=114,padding=9) {
  const valid=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  if(!valid.length)return {left:0,top:0,scale:1,project:p=>({x:p.x,y:p.y})};
  const left=Math.min(...valid.map(p=>p.x)),top=Math.min(...valid.map(p=>p.y));
  const right=Math.max(...valid.map(p=>p.x+(p.w||366)));
  const bottom=Math.max(...valid.map(p=>p.y+(p.h||190)));
  const s=Math.min((width-2*padding)/Math.max(right-left,1),(height-2*padding)/Math.max(bottom-top,1));
  return {left,top,scale:s,project:p=>({x:(p.x-left)*s+padding,y:(p.y-top)*s+padding}),
    unproject:(x,y)=>({x:(x-padding)/s+left,y:(y-padding)/s+top})};
}
export function cameraRect(camera,projection) {
  if(!camera||!camera.scale)return {x:0,y:0,width:0,height:0};
  const {panX,panY,scale,width,height}=camera;
  const p=projection.project({x:-panX/scale,y:-panY/scale});
  return {x:p.x,y:p.y,width:Math.max(1,width/scale*projection.scale),
    height:Math.max(1,height/scale*projection.scale)};
}

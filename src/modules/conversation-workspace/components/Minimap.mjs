import {minimapProjection,cameraRect} from '../core/viewport.mjs';

// One SVG for the overview, no chart dependency. All text/content stays out.
export function createMinimap({onNavigate}) {
  const container=document.createElement('div');container.className='g-minimap';
  container.setAttribute('aria-label','Conversation minimap');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 196 114');
  svg.setAttribute('role','img');
  svg.setAttribute('aria-label','Spatial navigation overview');
  const markers=document.createElementNS('http://www.w3.org/2000/svg','g');
  const viewportBox=document.createElementNS('http://www.w3.org/2000/svg','rect');
  viewportBox.setAttribute('class','g-minimap-visible');
  svg.append(markers,viewportBox);container.append(svg);
  let points=[],projection=minimapProjection([]),camera=null,signature='';
  const markerPool=[];
  const setCamera=next=>{
    camera=next;
    const rect=cameraRect(next,projection);
    viewportBox.setAttribute('x',String(rect.x));
    viewportBox.setAttribute('y',String(rect.y));
    viewportBox.setAttribute('width',String(rect.width));
    viewportBox.setAttribute('height',String(rect.height));
  };
  const setPoints=next=>{
    // Structural/layout changes only. Identical snapshots preserve SVG markers.
    const nextSignature=next.map(p=>[p.x,p.y,p.w,p.h,p.branch?1:0].join(':')).join('|');
    if(nextSignature===signature)return;
    signature=nextSignature;points=next;projection=minimapProjection(points);
    const stride=Math.max(1,Math.ceil(points.length/320));
    let used=0;
    for(let i=0;i<points.length;i+=stride){
      const p=points[i],q=projection.project(p);
      let box=markerPool[used];
      if(!box){
        box=document.createElementNS('http://www.w3.org/2000/svg','rect');
        markerPool.push(box);markers.append(box);
      }
      box.setAttribute('x',String(q.x));box.setAttribute('y',String(q.y));
      box.setAttribute('width',String(Math.max(2,Math.min(12,(p.w||366)*projection.scale))));
      box.setAttribute('height',String(Math.max(2,Math.min(7,(p.h||190)*projection.scale))));
      box.setAttribute('class',p.branch?'g-minimap-branch':'g-minimap-turn');
      box.hidden=false;used++;
    }
    for(let i=used;i<markerPool.length;i++)markerPool[i].remove();
    markerPool.length=used;
    if(camera)setCamera(camera);
  };
  svg.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    const rect=svg.getBoundingClientRect();
    const world=projection.unproject((event.clientX-rect.left)/rect.width*196,
      (event.clientY-rect.top)/rect.height*114);
    onNavigate(world);
  });
  return {element:container,setCamera,setPoints};
}

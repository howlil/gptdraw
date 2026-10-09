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
  let points=[],projection=minimapProjection([]),camera=null;
  const setCamera=next=>{
    camera=next;
    const rect=cameraRect(next,projection);
    viewportBox.setAttribute('x',String(rect.x));
    viewportBox.setAttribute('y',String(rect.y));
    viewportBox.setAttribute('width',String(rect.width));
    viewportBox.setAttribute('height',String(rect.height));
  };
  const setPoints=next=>{
    points=next;
    projection=minimapProjection(points);
    markers.replaceChildren();
    const stride=Math.max(1,Math.ceil(points.length/320));
    for(let i=0;i<points.length;i+=stride){
      const p=points[i],q=projection.project(p);
      const box=document.createElementNS('http://www.w3.org/2000/svg','rect');
      box.setAttribute('x',String(q.x));box.setAttribute('y',String(q.y));
      box.setAttribute('width',String(Math.max(2,Math.min(12,(p.w||366)*projection.scale))));
      box.setAttribute('height',String(Math.max(2,Math.min(7,(p.h||190)*projection.scale))));
      box.setAttribute('class',p.branch?'g-minimap-branch':'g-minimap-turn');
      markers.append(box);
    }
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

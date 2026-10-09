import { createChatCard } from './ChatCard.mjs';
import { control } from '../../../components/ui/icons.mjs';
import { layoutPoint } from '../core/graph.mjs';

export function createGraphCanvas({ onSource, onMove, onEmpty }) {
  const viewport = document.createElement('section');
  viewport.className = 'g-viewport'; viewport.setAttribute('aria-label','Conversation canvas');
  const stage = document.createElement('div'); stage.className = 'g-world';
  const edgeLayer = document.createElementNS('http://www.w3.org/2000/svg','svg');
  edgeLayer.setAttribute('class','g-edges');
  edgeLayer.setAttribute('aria-hidden','true');
  stage.append(edgeLayer); viewport.append(stage);
  const controls = document.createElement('div');
  controls.className = 'g-zoom-controls';
  const zoomLabel = document.createElement('span'); zoomLabel.className = 'g-zoom-value';
  controls.append(control('Zoom out','minus',()=>zoom(scale-.12)),zoomLabel,
    control('Zoom in','plus',()=>zoom(scale+.12)),
    control('Fit conversation','fit',()=>fit()));
  viewport.append(controls);

  let scale = 1, panX = 0, panY = 0, positions = {}, turns = [], dragging = null;
  let autoFit = true, edgesQueued = false, previousRoute = null;
  const cards = new Map();
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const renderTransform = () => {
    stage.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + scale + ')';
    zoomLabel.textContent = Math.round(scale*100) + '%';
    queueEdges();
  };
  const point = (turn,index) => positions[turn.id] || layoutPoint(index);
  const drawEdges = () => {
    edgesQueued = false;
    edgeLayer.replaceChildren();
    for (let i=1;i<turns.length;i++) {
      const left = cards.get(turns[i-1].id), right = cards.get(turns[i].id);
      if (!left || !right) continue;
      const a = point(turns[i-1],i-1), b = point(turns[i],i);
      const x1=a.x+left.offsetWidth, y1=a.y+43, x2=b.x, y2=b.y+43;
      const c=Math.max(60,Math.abs(x2-x1)*.42);
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d','M'+x1+' '+y1+' C'+(x1+c)+' '+y1+' '+(x2-c)+' '+y2+' '+x2+' '+y2);
      path.setAttribute('fill','none'); path.setAttribute('stroke','var(--g-edge)');
      path.setAttribute('stroke-width','1.7'); edgeLayer.append(path);
    }
  };
  const queueEdges = () => { if (!edgesQueued) { edgesQueued=true; requestAnimationFrame(drawEdges); } };
  const fit = () => {
    const bounds = turns.map((turn,i)=>{
      const p=point(turn,i); return { x:p.x,y:p.y,w:cards.get(turn.id)?.offsetWidth||420,h:cards.get(turn.id)?.offsetHeight||260 };
    });
    if (!bounds.length) { scale=1;panX=80;panY=70;renderTransform();return; }
    const l=Math.min(...bounds.map(x=>x.x)),t=Math.min(...bounds.map(x=>x.y));
    const r=Math.max(...bounds.map(x=>x.x+x.w)),b=Math.max(...bounds.map(x=>x.y+x.h));
    scale=clamp(Math.min((viewport.clientWidth-80)/(r-l),(viewport.clientHeight-100)/(b-t)),.42,1.1);
    panX=(viewport.clientWidth-(l+r)*scale)/2;
    panY=(viewport.clientHeight-(t+b)*scale)/2;renderTransform();
  };
  const zoom = (value,cx=viewport.clientWidth/2,cy=viewport.clientHeight/2)=>{
    const next=clamp(value,.4,1.5);
    panX=cx-(cx-panX)*next/scale;panY=cy-(cy-panY)*next/scale;
    scale=next;autoFit=false;renderTransform();
  };
  viewport.addEventListener('wheel',event=>{
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect=viewport.getBoundingClientRect();
    zoom(scale+(event.deltaY<0?.08:-.08),event.clientX-rect.left,event.clientY-rect.top);
  },{passive:false});
  viewport.addEventListener('pointerdown',event=>{
    if (event.button!==0 || event.target.closest?.('button,input,textarea,a')) return;
    const head=event.target.closest?.('.g-card-head');
    if (head) {
      const card=head.closest('.g-card');
      const turn=turns.find(t=>t.id===card?.dataset.turnId);
      if(!turn)return;
      const p=point(turn,turns.indexOf(turn));
      dragging={kind:'card',id:turn.id,element:card,x:p.x,y:p.y,clientX:event.clientX,clientY:event.clientY,pointerId:event.pointerId};
    } else if (event.target===viewport||event.target===stage||event.target===edgeLayer) {
      dragging={kind:'pan',x:panX,y:panY,clientX:event.clientX,clientY:event.clientY,pointerId:event.pointerId};
    }
    if(dragging)viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener('pointermove',event=>{
    if(!dragging || event.pointerId!==dragging.pointerId)return;
    const dx=event.clientX-dragging.clientX,dy=event.clientY-dragging.clientY;
    if(dragging.kind==='pan'){panX=dragging.x+dx;panY=dragging.y+dy;renderTransform();}
    else {
      dragging.element.style.left=dragging.x+dx/scale+'px';
      dragging.element.style.top=dragging.y+dy/scale+'px';
      queueEdges();
    }
  });
  const end=event=>{
    if(!dragging||event.pointerId!==dragging.pointerId)return;
    if(dragging.kind==='card'){
      autoFit=false;
      const p={x:parseFloat(dragging.element.style.left),y:parseFloat(dragging.element.style.top)};
      onMove(dragging.id,p);
    }
    dragging=null;
  };
  viewport.addEventListener('pointerup',end);
  viewport.addEventListener('pointercancel',end);
  function focus(id){
    const idx=turns.findIndex(turn=>turn.id===id);
    if(idx<0)return;
    const p=point(turns[idx],idx);
    const card=cards.get(id);if(!card)return;
    zoom(1);
    panX=viewport.clientWidth/2-(p.x+card.offsetWidth/2)*scale;
    panY=viewport.clientHeight/2-(p.y+Math.min(card.offsetHeight,400)/2)*scale;
    renderTransform();card.focus({preventScroll:true});
  }
  return {
    element:viewport,
    reconcile(state){
      const routeChanged=previousRoute!==state.route;
      if(routeChanged){previousRoute=state.route;autoFit=true;}
      positions=state.positions;turns=state.turns;
      const active=new Set(turns.map(t=>t.id));
      for(const [id,card] of cards) if(!active.has(id)){card.remove();cards.delete(id);}
      turns.forEach((turn,index)=>{
        let card=cards.get(turn.id);
        if(!card){
          card=createChatCard(turn,{index,onSource,onFocus:focus});
          card.tabIndex=-1;
          cards.set(turn.id,card);stage.append(card);
        } else card._update(turn);
        if(!dragging||dragging.id!==turn.id){
          const p=point(turn,index);
          card.style.left=p.x+'px';card.style.top=p.y+'px';
        }
      });
      onEmpty(turns.length===0);
      queueEdges();
      if(routeChanged && viewport.clientWidth){autoFit=false;requestAnimationFrame(fit);}
    },
    fit,focus
  };
}

import { createChatCard } from './ChatCard.mjs';
import { createStartCard } from './StartCard.mjs';
import { control } from '../../../components/ui/icons.mjs';
import { layoutPoint, stabilizeLayout, isCardNearViewport } from '../core/graph.mjs';

export function createGraphCanvas({ onSource, onMove, onStart, onCompose, onSend, onFork, onOpenConversation }) {
  const viewport = document.createElement('section');
  viewport.className = 'g-viewport'; viewport.setAttribute('aria-label','Conversation canvas');
  const stage = document.createElement('div'); stage.className = 'g-world';
  const edgeLayer = document.createElementNS('http://www.w3.org/2000/svg','svg');
  edgeLayer.setAttribute('class','g-edges');
  edgeLayer.setAttribute('aria-hidden','true');
  stage.append(edgeLayer); viewport.append(stage);
  const startCard = createStartCard(onStart);
  stage.append(startCard.element);
  const controls = document.createElement('div');
  controls.className = 'g-zoom-controls';
  const zoomLabel = document.createElement('span'); zoomLabel.className = 'g-zoom-value';
  const firstButton=control('Go to earliest loaded turn','back',()=>turns[0] && focus(turns[0].id));
  const latestButton=control('Go to latest turn','navigate',()=>turns.length && focus(turns[turns.length-1].id));
  controls.append(firstButton,control('Zoom out','minus',()=>zoom(scale-.12)),zoomLabel,
    control('Zoom in','plus',()=>zoom(scale+.12)),
    control('Fit conversation','fit',()=>fit()),latestButton);
  viewport.append(controls);
  const outline=document.createElement('aside');outline.className='g-outline';outline.hidden=true;
  const outlineHead=document.createElement('div');outlineHead.className='g-outline-head';
  const outlineTitle=document.createElement('strong');outlineTitle.textContent='Conversation outline';
  const outlineClose=control('Close outline','close',()=>toggleOutline());
  outlineHead.append(outlineTitle,outlineClose);
  const outlineItems=document.createElement('div');outlineItems.className='g-outline-items';
  outline.append(outlineHead,outlineItems);viewport.append(outline);
  let query='',outlineOpen=false;
  const searchable=turn=>((turn.prompt||'')+' '+(turn.answer||'')).toLowerCase();
  const turnById=new Map(),turnIndexById=new Map();
  const applySearch=()=>{
    for(const [id,card] of cards){
      const turn=turnById.get(id);
      if(!turn)continue;
      const hit=!query||searchable(turn).includes(query);
      card.classList.toggle('g-search-dim',!!query&&!hit);
      card.classList.toggle('g-search-hit',!!query&&hit);
    }
  };
  function renderOutline(){
    if(!outlineOpen)return;
    outlineItems.replaceChildren();
    turns.forEach((turn,i)=>{
      if(query&&!searchable(turn).includes(query))return;
      const btn=document.createElement('button');btn.type='button';
      btn.className='g-outline-item';
      const number=document.createElement('span');number.className='g-outline-number';
      number.textContent=String(i+1).padStart(2,'0');
      const text=document.createElement('span');text.textContent=turn.prompt;
      btn.append(number,text);
      btn.addEventListener('click',()=>{focus(turn.id);toggleOutline();});
      outlineItems.append(btn);
    });
    if(!outlineItems.childElementCount){
      const empty=document.createElement('p');empty.className='g-outline-empty';
      empty.textContent='No matching cards';outlineItems.append(empty);
    }
  }
  function toggleOutline(){
    outlineOpen=!outlineOpen;
    outline.hidden=!outlineOpen;
    if(outlineOpen)renderOutline();
  }

  let scale = 1, panX = 0, panY = 0, positions = {}, turns = [], dragging = null;
  let autoFit = true, edgesQueued = false, previousRoute = null, initialFocusPending = true;
  let stablePositions = new Map();
  const cards = new Map();
  const branchNodes=new Map();
  let branchPositions=new Map(),visibleQueued=false;
  const cardResize=typeof ResizeObserver==='function'?new ResizeObserver(()=>queueEdges()):null;
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const renderTransform = () => {
    stage.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + scale + ')';
    zoomLabel.textContent = Math.round(scale*100) + '%';
    queueEdges();scheduleVisible();
  };
  const point = (turn,index) => positions[turn.id] || stablePositions.get(turn.id) || layoutPoint(index);

  const shouldMount=(turn,index)=>{
    if(turns.length<80)return true;
    return isCardNearViewport(point(turn,index),
      {panX,panY,scale,width:viewport.clientWidth,height:viewport.clientHeight});
  };
  function syncVisibleCards(){
    visibleQueued=false;
    const active=new Set(turns.map(t=>t.id));
    for(const [id,card] of cards){
      const index=turnIndexById.get(id);
      if(!active.has(id) || (index!==undefined && !shouldMount(turns[index],index)
          && !(dragging?.id===id)
          && !card.contains(card.getRootNode()?.activeElement))){
        cardResize?.unobserve(card);card.remove();cards.delete(id);
      }
    }
    turns.forEach((turn,index)=>{
      if(!shouldMount(turn,index) && !cards.has(turn.id))return;
      let card=cards.get(turn.id);
      if(!card){
        card=createChatCard(turn,{index,onSource,onFocus:focus,onCompose,onSend,onFork,
          isLatest:index===turns.length-1});
        card.tabIndex=-1;cards.set(turn.id,card);stage.append(card);
        cardResize?.observe(card);
        card._lastTurn=turn;card._lastIndex=index;card._lastLatest=index===turns.length-1;
      } else if(card._lastTurn!==turn || card._lastIndex!==index ||
          card._lastLatest!==(index===turns.length-1)){
        card._update(turn,index,index===turns.length-1);
        card._lastTurn=turn;card._lastIndex=index;card._lastLatest=index===turns.length-1;
      }
      card._turnIndex=index;
      if(!dragging || dragging.id!==turn.id){
        const p=point(turn,index);
        card.style.left=p.x+'px';card.style.top=p.y+'px';
      }
    });
    applySearch();queueEdges();
  }
  function scheduleVisible(){
    if(!visibleQueued){visibleQueued=true;requestAnimationFrame(syncVisibleCards);}
  }
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
    const first=turns[0],last=turns[turns.length-1];
    for(const [key,entry] of branchPositions){
      const node=branchNodes.get(key);
      if(!node)continue;
      const target=entry.kind==='parent'?first:last;
      const targetCard=target?cards.get(target.id):startCard.element;
      const p=target?point(target,entry.kind==='parent'?0:turns.length-1):{x:130,y:140};
      const x1=entry.kind==='parent'?entry.x+node.offsetWidth:p.x+targetCard.offsetWidth;
      const y1=entry.kind==='parent'?entry.y+node.offsetHeight/2:p.y+30;
      const x2=entry.kind==='parent'?p.x:entry.x;
      const y2=entry.kind==='parent'?p.y+30:entry.y+node.offsetHeight/2;
      const curve=document.createElementNS('http://www.w3.org/2000/svg','path');
      const bend=Math.max(40,Math.abs(x2-x1)*.4);
      curve.setAttribute('d','M'+x1+' '+y1+' C'+(x1+bend)+' '+y1+' '+(x2-bend)+' '+y2+' '+x2+' '+y2);
      curve.setAttribute('fill','none');curve.setAttribute('stroke','var(--g-text)');
      curve.setAttribute('stroke-dasharray','4 5');curve.setAttribute('stroke-width','1.5');
      edgeLayer.append(curve);
    }
  };

  function renderBranchNodes(relations) {
    const first=turns[0],last=turns[turns.length-1];
    const left=first?point(first,0):{x:130,y:140};
    const right=last?point(last,turns.length-1):left;
    const next=new Map();
    if(relations?.parent){
      const record=relations.parent;
      next.set('parent:'+record.id,{conversationId:record.parentConversationId,
        title:'Parent conversation',x:left.x-430,y:left.y+8,kind:'parent'});
    }
    for(const [i,record] of (relations?.children||[]).entries()){
      next.set('child:'+record.id,{conversationId:record.childConversationId,
        title:'Child branch '+(i+1),x:right.x+470,y:right.y+i*110,kind:'child'});
    }
    for(const [key,node] of branchNodes)if(!next.has(key)){
      node.remove();branchNodes.delete(key);
    }
    branchPositions=next;
    for(const [key,entry] of next){
      let node=branchNodes.get(key);
      if(!node){
        node=document.createElement('button');node.type='button';
        node.className='g-branch-node';
        node.addEventListener('click',()=>onOpenConversation(node.dataset.conversationId));
        branchNodes.set(key,node);stage.append(node);
      }
      node.dataset.conversationId=entry.conversationId;
      node.replaceChildren();
      const tag=document.createElement('strong');tag.textContent=entry.title;
      const caption=document.createElement('span');caption.textContent='Open ChatGPT conversation';
      node.append(tag,caption);
      node.style.left=entry.x+'px';node.style.top=entry.y+'px';
    }
  }
  const queueEdges = () => { if (!edgesQueued) { edgesQueued=true; requestAnimationFrame(drawEdges); } };
  const fit = () => {
    const bounds = turns.map((turn,i)=>{
      const p=point(turn,i); return { x:p.x,y:p.y,w:cards.get(turn.id)?.offsetWidth||420,h:cards.get(turn.id)?.offsetHeight||260 };
    });
    if (!bounds.length) bounds.push({x:130,y:140,w:startCard.element.offsetWidth||420,h:startCard.element.offsetHeight||260});
    for(const [key,p] of branchPositions)bounds.push({x:p.x,y:p.y,w:branchNodes.get(key)?.offsetWidth||230,h:branchNodes.get(key)?.offsetHeight||78});
    const l=Math.min(...bounds.map(x=>x.x)),t=Math.min(...bounds.map(x=>x.y));
    const r=Math.max(...bounds.map(x=>x.x+x.w)),b=Math.max(...bounds.map(x=>x.y+x.h));
    if(viewport.clientWidth < 600) {
      // Narrow screens enter a readable single-card focus instead of shrinking
      // a long conversation spine into unreadable miniature text.
      const first=bounds[0];
      scale=clamp((viewport.clientWidth-24)/first.w,.72,1);
      panX=(viewport.clientWidth-(first.x+first.w/2)*scale)/2;
      panY=(viewport.clientHeight-(first.y+Math.min(first.h,430)/2)*scale)/2;
      renderTransform();return;
    }
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
    const p=point(turns[idx],idx),card=cards.get(id);
    scale=1;autoFit=false;
    panX=viewport.clientWidth/2-(p.x+(card?.offsetWidth||366)/2);
    panY=viewport.clientHeight/2-(p.y+Math.min(card?.offsetHeight||270,400)/2);
    renderTransform();syncVisibleCards();
    requestAnimationFrame(()=>cards.get(id)?.focus({preventScroll:true}));
  }
  return {
    element:viewport,
    reconcile(state, change){
      const routeChanged=previousRoute!==state.route;
      if(routeChanged){previousRoute=state.route;initialFocusPending=true;stablePositions.clear();}
      positions=state.positions;turns=state.turns;
      firstButton.disabled=!turns.length;latestButton.disabled=!turns.length;
      if(routeChanged){turnById.clear();turnIndexById.clear();}
      if(!routeChanged && change?.type==='patch'){
        const card=cards.get(change.turnId);
        const index=turnIndexById.get(change.turnId);
        if(index!==undefined)turnById.set(change.turnId,turns[index]);
        if(card) {
          const turn=turns[card._turnIndex];
          card._update(turn,card._turnIndex,card._turnIndex===turns.length-1);
          card._lastTurn=turn;
          turnById.set(change.turnId,turn);
        }
        if(query)applySearch();
        return; // Constant-work streaming update: no layout scan, edge rebuild or DOM churn.
      }
      if(!routeChanged && change?.type==='position'){
        const card=cards.get(change.turnId);
        const p=positions[change.turnId];
        if(card && p){
          card.style.left=p.x+'px';card.style.top=p.y+'px';
          queueEdges();
        }
        return;
      }
      stablePositions=stabilizeLayout(turns,stablePositions,positions);
      turnById.clear();turnIndexById.clear();
      turns.forEach((turn,index)=>{turnById.set(turn.id,turn);turnIndexById.set(turn.id,index);});
      syncVisibleCards();
      renderOutline();
      renderBranchNodes(state.relations);
      startCard.element.hidden = turns.length !== 0;
      if(!turns.length)startCard.setRoute(state.route);
      queueEdges();
      if(initialFocusPending && (turns.length>0 || state.history?.status==='unavailable') && viewport.clientWidth){
        initialFocusPending=false;
        const latest=turns[turns.length-1];
        requestAnimationFrame(()=>latest?focus(latest.id):fit());
      }
    },
    fit,focus,
    search(value) {query=String(value||'').trim().toLowerCase();applySearch();if(query)outlineOpen=true;outline.hidden=!outlineOpen;renderOutline();},
    toggleOutline
  };
}

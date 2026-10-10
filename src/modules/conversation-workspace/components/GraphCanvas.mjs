import { createChatCard } from './ChatCard.mjs';
import { createStartCard } from './StartCard.mjs';
import { createMinimap } from './Minimap.mjs';
import { createInspectionPanel } from './InspectionPanel.mjs';
import { selectCompareId, comparisonTurns } from '../core/compare.mjs';
import { buildBranchWorkspace } from '../core/branch-workspace.mjs';
import { control } from '../../../components/ui/icons.mjs';
import { layoutPoint, stabilizeLayout } from '../core/graph.mjs';
import { buildSpatialIndex } from '../core/spatial-index.mjs';

export function createGraphCanvas({ onSource, onMove, onStart, onCompose, onSend, onFork, onBookmark, onOpenConversation }) {
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
  const branchesButton=control('Focus branch family','graph',()=>focusBranches());
  controls.append(branchesButton);
  viewport.append(controls);
  const minimap=createMinimap({onNavigate:world=>{
    panX=viewport.clientWidth/2-world.x*scale;
    panY=viewport.clientHeight/2-world.y*scale;
    autoFit=false;renderTransform();
  }});
  viewport.append(minimap.element);
  const inspector=createInspectionPanel();viewport.append(inspector.element);
  const outline=document.createElement('aside');outline.className='g-outline';outline.hidden=true;
  const outlineHead=document.createElement('div');outlineHead.className='g-outline-head';
  const outlineTitle=document.createElement('strong');outlineTitle.textContent='Conversation outline';
  const outlineClose=control('Close outline','close',()=>toggleOutline());
  outlineHead.append(outlineTitle,outlineClose);
  const outlineItems=document.createElement('div');outlineItems.className='g-outline-items';
  outline.append(outlineHead,outlineItems);viewport.append(outline);
  let query='',outlineOpen=false,bookmarks=[],selectedCompare=[],focusedId=null;
  const searchable=turn=>((turn.prompt||'')+' '+(turn.answer||'')).toLowerCase();
  const turnById=new Map(),turnIndexById=new Map();
  const readTurn=id=>{
    const turn=turnById.get(id);
    if(turn){focusedId=id;inspector.openRead(turn);}
  };
  const selectForCompare=id=>{
    selectedCompare=selectCompareId(selectedCompare,id,turns.map(t=>t.id));
    for(const [key,card] of cards)card._setCompare(selectedCompare.includes(key));
    const pair=comparisonTurns(turns,selectedCompare);
    if(pair)inspector.openCompare(pair.left,pair.right);
    return selectedCompare;
  };
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
      if(bookmarks.includes(turn.id))btn.prepend(document.createTextNode('◈ '));
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
  let autoFit = true, edgesQueued = false, cameraQueued=false, previousRoute = null, initialFocusPending = true;
  let stablePositions = new Map();
  const cards = new Map();
  const branchNodes=new Map();
  let branchPositions=new Map(),branchEdges=[],branchCurrent=null,visibleQueued=false;
  let spatialIndex=buildSpatialIndex([]),lastViewportUpdateMs=0,maxViewportUpdateMs=0;
  const measuredBounds=new Map();
  const edgePaths=new Map();
  const cardResize=typeof ResizeObserver==='function'?new ResizeObserver(entries=>{
    let geometryChanged=false;
    for(const entry of entries){
      const id=entry.target?.dataset?.turnId;
      if(!id)continue;
      const box=entry.borderBoxSize?.[0]||entry.borderBoxSize;
      const width=box?.inlineSize??entry.contentRect?.width;
      const height=box?.blockSize??entry.contentRect?.height;
      if(!Number.isFinite(width)||!Number.isFinite(height))continue;
      const before=measuredBounds.get(id);
      if(before?.width===width&&before?.height===height)continue;
      measuredBounds.set(id,{width,height});
      geometryChanged=true;
    }
    if(geometryChanged){rebuildIndex();queueEdges();}
  }):null;
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  // Camera movement changes no world-space edge geometry. Coalesce all
  // pointer/wheel input into a single frame; visibility diff owns mount edges.
  const renderTransform = () => {
    if(cameraQueued)return;
    cameraQueued=true;
    requestAnimationFrame(()=>{
      cameraQueued=false;
      stage.style.transform='translate('+panX+'px,'+panY+'px) scale('+scale+')';
      zoomLabel.textContent=Math.round(scale*100)+'%';
      minimap.setCamera({panX,panY,scale,width:viewport.clientWidth,height:viewport.clientHeight});
      scheduleVisible();
    });
  };
  const point = (turn,index) => positions[turn.id] || stablePositions.get(turn.id) || layoutPoint(index);

  function rebuildIndex(){
    spatialIndex=buildSpatialIndex(turns.map((turn,i)=>{
      const p=point(turn,i);
      const size=measuredBounds.get(turn.id);
      return {id:turn.id,x:p.x,y:p.y,w:size?.width||400,h:size?.height||600};
    }));
  }
  function syncVisibleCards(){
    const started=performance.now();
    visibleQueued=false;
    const visible=turns.length<80?turns.map(t=>t.id):spatialIndex.query({
      panX,panY,scale,width:viewport.clientWidth,height:viewport.clientHeight
    });
    const active=new Set(visible);
    let mountedChanged=false;
    for(const [id,card] of cards) {
      if(!active.has(id)&&!(dragging?.id===id)&&
          !card.contains(card.getRootNode()?.activeElement)){
        cardResize?.unobserve(card);card.remove();cards.delete(id);mountedChanged=true;
      }
    }
    for(const id of visible) {
      const index=turnIndexById.get(id);
      if(index===undefined)continue;
      const turn=turns[index];
      let card=cards.get(id);
      if(!card){
        card=createChatCard(turn,{index,onSource,onFocus:focus,onCompose,onSend,onFork,
          onRead:readTurn,onCompare:selectForCompare,onBookmark,
          isLatest:index===turns.length-1});
        card.tabIndex=-1;cards.set(id,card);stage.append(card);mountedChanged=true;
        cardResize?.observe(card);
        card._lastTurn=turn;card._lastIndex=index;card._lastLatest=index===turns.length-1;
      } else if(card._lastTurn!==turn || card._lastIndex!==index ||
          card._lastLatest!==(index===turns.length-1)){
        card._update(turn,index,index===turns.length-1);
        card._lastTurn=turn;card._lastIndex=index;card._lastLatest=index===turns.length-1;
      }
      card._turnIndex=index;
      card._setBookmark(bookmarks.includes(id));
      card._setCompare(selectedCompare.includes(id));
      if(!dragging || dragging.id!==id){
        const p=point(turn,index);card.style.left=p.x+'px';card.style.top=p.y+'px';
      }
    }
    applySearch();if(mountedChanged)queueEdges();
    lastViewportUpdateMs=Math.round((performance.now()-started)*100)/100;
    maxViewportUpdateMs=Math.max(maxViewportUpdateMs,lastViewportUpdateMs);
  }
  function scheduleVisible(){
    if(!visibleQueued){visibleQueued=true;requestAnimationFrame(syncVisibleCards);}
  }
  function drawEdges(){
    edgesQueued=false;
    const geometry=new Map();
    for(const [id,card] of cards){
      const i=turnIndexById.get(id);
      if(!i)continue;
      const previous=turns[i-1],first=cards.get(previous.id);
      if(!first)continue;
      const a=point(previous,i-1),b=point(turns[i],i);
      const x1=a.x+(measuredBounds.get(previous.id)?.width||366),y1=a.y+43;
      const x2=b.x,y2=b.y+43;
      const bend=Math.max(60,Math.abs(x2-x1)*.42);
      geometry.set('seq:'+previous.id+':'+id,{
        d:'M'+x1+' '+y1+' C'+(x1+bend)+' '+y1+' '+(x2-bend)+' '+y2+' '+x2+' '+y2,
        branch:false
      });
    }
    for(const edge of branchEdges){
      const a=branchPositions.get(edge.from),b=branchPositions.get(edge.to);
      if(!a||!b)continue;
      const x1=a.x+230,y1=a.y+39,x2=b.x,y2=b.y+39;
      const bend=Math.max(50,(x2-x1)*.45);
      geometry.set('branch:'+edge.id,{
        d:'M'+x1+' '+y1+' C'+(x1+bend)+' '+y1+' '+(x2-bend)+' '+y2+' '+x2+' '+y2,
        branch:true
      });
    }
    for(const [id,old] of edgePaths) {
      if(geometry.has(id))continue;
      old.element.remove();edgePaths.delete(id);
    }
    for(const [id,entry] of geometry){
      let existing=edgePaths.get(id);
      if(!existing){
        const element=document.createElementNS('http://www.w3.org/2000/svg','path');
        element.setAttribute('fill','none');
        element.setAttribute('stroke',entry.branch?'var(--g-text)':'var(--g-edge)');
        element.setAttribute('stroke-width',entry.branch?'1.5':'1.7');
        if(entry.branch)element.setAttribute('stroke-dasharray','4 5');
        edgeLayer.append(element);
        existing={element,d:null};edgePaths.set(id,existing);
      }
      if(existing.d!==entry.d){
        existing.d=entry.d;
        existing.element.setAttribute('d',entry.d);
      }
    }
  }
  function renderBranchNodes(records,route,previews={}) {
    const tree=buildBranchWorkspace(records,route);
    const last=turns[turns.length-1];
    const base=last?point(last,turns.length-1):{x:130,y:140};
    const origin={x:base.x+535,y:base.y+210};
    const entries=tree.nodes.length>1?tree.nodes:[];
    const active=new Set(entries.map(n=>n.id));
    branchCurrent=entries.find(n=>n.isCurrent)?.id||null;
    branchEdges=tree.edges;
    for(const [id,el] of branchNodes) {
      if(!active.has(id)){el.remove();branchNodes.delete(id);}
    }
    branchPositions=new Map();
    for(const [index,entry] of entries.entries()) {
      const x=origin.x+entry.x,y=origin.y+entry.y;
      branchPositions.set(entry.id,{x,y,branch:true,w:230,h:90});
      let node=branchNodes.get(entry.id);
      if(!node) {
        node=document.createElement('div');node.className='g-branch-node';
        branchNodes.set(entry.id,node);stage.append(node);
      }
      node.classList.toggle('g-current-branch',entry.isCurrent);
      node.replaceChildren();
      const open=document.createElement('button');
      open.type='button';open.className='g-branch-open';
      const title=document.createElement('strong');
      title.textContent=entry.isCurrent?'Current conversation':
        entry.parentId===null?'Root conversation':'Branch '+index;
      const caption=document.createElement('span');
      caption.textContent=entry.isCurrent?'Loaded on this canvas':
        previews[entry.id]?'Latest answer available for comparison':'Metadata only · Open to load';
      open.append(title,caption);
      open.addEventListener('click',()=>entry.isCurrent?focusBranches():onOpenConversation(entry.id));
      node.append(open);
      const current=previews[tree.current],other=previews[entry.id];
      if(!entry.isCurrent && current?.answer && other?.answer) {
        const compare=document.createElement('button');compare.type='button';
        compare.className='g-branch-compare';
        compare.textContent='Compare loaded answers';
        compare.addEventListener('click',()=>inspector.openCompare(current,other));
        node.append(compare);
      }
      node.style.left=x+'px';node.style.top=y+'px';
    }
    branchesButton.disabled=entries.length===0;
  }
  function focusBranches(){
    const current=branchPositions.get(branchCurrent)
      ||branchPositions.values().next().value;
    if(!current)return;
    scale=1;autoFit=false;
    panX=viewport.clientWidth/2-(current.x+115);
    panY=viewport.clientHeight/2-(current.y+39);
    renderTransform();
  }
  function updateMinimap(){
    const points=turns.map((turn,i)=>({...point(turn,i),w:366,h:230}));
    points.push(...branchPositions.values());
    minimap.setPoints(points.length?points:[{x:130,y:140,w:366,h:230}]);
    minimap.setCamera({panX,panY,scale,width:viewport.clientWidth,height:viewport.clientHeight});
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
      const index=turnIndexById.get(card?.dataset.turnId);
      if(index===undefined)return;
      const turn=turns[index];
      const p=point(turn,index);
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
    rebuildIndex();scheduleVisible();
  };
  viewport.addEventListener('pointerup',end);
  viewport.addEventListener('pointercancel',end);
  function focus(id){
    const idx=turnIndexById.get(id);
    if(idx===undefined)return;
    focusedId=id;
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
      if(routeChanged){previousRoute=state.route;initialFocusPending=true;stablePositions.clear();
        selectedCompare=[];focusedId=null;inspector.hide();}
      positions=state.positions;turns=state.turns;bookmarks=state.bookmarks||[];
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
        inspector.updateTurn(turnById.get(change.turnId));
        if(query)applySearch();
        return; // Constant-work streaming update: no layout scan, edge rebuild or DOM churn.
      }
      if(!routeChanged && change?.type==='bookmark'){
        cards.get(change.turnId)?._setBookmark(bookmarks.includes(change.turnId));
        renderOutline();
        return;
      }
      if(!routeChanged && change?.type==='position'){
        const card=cards.get(change.turnId);
        const p=positions[change.turnId];
        if(card && p){
          card.style.left=p.x+'px';card.style.top=p.y+'px';
          rebuildIndex();queueEdges();
        }
        return;
      }
      stablePositions=stabilizeLayout(turns,stablePositions,positions);
      turnById.clear();turnIndexById.clear();
      turns.forEach((turn,index)=>{turnById.set(turn.id,turn);turnIndexById.set(turn.id,index);});
      rebuildIndex();syncVisibleCards();
      renderOutline();
      renderBranchNodes(state.branches,state.route,state.previews);
      updateMinimap();
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
    closeInspector:()=>inspector.hide(),
    inspectorOpen:()=>inspector.visible,
    stats:()=>({mountedCards:cards.size,canvasTurns:turns.length,
      renderedEdges:edgePaths.size,branchNodes:branchNodes.size,
      lastViewportUpdateMs,maxViewportUpdateMs,spatialIndexEntries:spatialIndex.count}),
    nextTurn(step=1){
      if(!turns.length)return;
      const index=turnIndexById.get(focusedId);
      const next=Math.max(0,Math.min(turns.length-1,(index??turns.length-1)+step));
      focus(turns[next].id);
    },
    readFocused(){const id=focusedId||turns[turns.length-1]?.id;if(id)readTurn(id);},
    focusBranches,
    search(value) {query=String(value||'').trim().toLowerCase();applySearch();if(query)outlineOpen=true;outline.hidden=!outlineOpen;renderOutline();},
    toggleOutline
  };
}

import { createChatCard } from './ChatCard.mjs';
import { quoteAnchor } from '../core/branch.mjs';
import { createStartCard } from './StartCard.mjs';
import { createDialogueCard } from './DialogueCard.mjs';
import {centerEntryCamera,shouldShowMinimap,calculateGraphBounds} from '../core/view-mode.mjs';
import { createMinimap } from './Minimap.mjs';
import { createInspectionPanel } from './InspectionPanel.mjs';
import { selectCompareId, comparisonTurns } from '../core/compare.mjs';
import { buildBranchWorkspace } from '../core/branch-workspace.mjs';
import { control } from '../../../components/ui/icons.mjs';
import { layoutPoint, stabilizeLayout } from '../core/graph.mjs';
import { buildSpatialIndex } from '../core/spatial-index.mjs';

export function createGraphCanvas({ onSource, onMove, onStart, onCompose, onSend, onFork, onBookmark, onOpenConversation, onAskQuote, onActivity=()=>{}, onSearchChange=()=>{} }) {
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
  const inspector=createInspectionPanel(quote=>handleSelection(quote));
  viewport.append(inspector.element);
  // Single contextual action surface; never a permanent page launcher.
  const selectionToolbar=document.createElement('div');
  selectionToolbar.className='g-selection-toolbar';selectionToolbar.hidden=true;
  selectionToolbar.setAttribute('role','toolbar');
  selectionToolbar.setAttribute('aria-label','Actions for selected answer text');
  const askSelection=document.createElement('button');
  askSelection.type='button';askSelection.textContent='Ask GPT';
  askSelection.title='Prepare this excerpt in the native ChatGPT composer; nothing is sent';
  const forkSelection=document.createElement('button');
  forkSelection.type='button';forkSelection.textContent='Fork';
  forkSelection.title='Branch from this answer using the native ChatGPT action';
  const selectionStatus=document.createElement('span');
  selectionStatus.className='g-selection-status';
  selectionStatus.setAttribute('role','status');selectionStatus.hidden=true;
  selectionToolbar.append(askSelection,forkSelection,selectionStatus);
  selectionToolbar.addEventListener('pointerdown',event=>{
    // Keep the source range intact when tapping its action menu.
    event.stopPropagation();event.preventDefault();
  });
  viewport.append(selectionToolbar);
  const outline=document.createElement('aside');outline.className='g-outline';outline.hidden=true;
  const outlineHead=document.createElement('div');outlineHead.className='g-outline-head';
  const outlineTitle=document.createElement('strong');outlineTitle.textContent='Conversation outline';
  const outlineClose=control('Close outline','close',()=>toggleOutline());
  outlineHead.append(outlineTitle,outlineClose);
  const outlineSearch=document.createElement('input');
  outlineSearch.type='search';
  outlineSearch.className='g-outline-search';
  outlineSearch.placeholder='Search conversation…';
  outlineSearch.setAttribute('aria-label','Search conversation outline');
  outlineSearch.addEventListener('input',()=>search(outlineSearch.value));
  const outlineItems=document.createElement('div');outlineItems.className='g-outline-items';
  const moreOutline=document.createElement('button');
  moreOutline.type='button';moreOutline.className='g-outline-item';
  moreOutline.textContent='Show more results';
  moreOutline.hidden=true;
  moreOutline.addEventListener('click',()=>{outlineLimit+=60;renderOutline();});
  outline.append(outlineHead,outlineSearch,outlineItems,moreOutline);viewport.append(outline);
  let query='',outlineOpen=false,bookmarks=[],selectedCompare=[],focusedId=null;
  let activeSelection=null;
  function hideSelection(){
    activeSelection=null;selectionToolbar.hidden=true;selectionStatus.hidden=true;
    selectionStatus.textContent='';
  }
  function handleSelection(quote){
    if(!quote || !turnById.has(quote.turnId)){hideSelection();return;}
    const bounds=viewport.getBoundingClientRect(),rect=quote.rect;
    // Only show for a visible range within the canvas/Reading panel.
    if(rect.bottom<bounds.top||rect.top>bounds.bottom){hideSelection();return;}
    activeSelection=quote;
    const toolbarWidth=154;
    const x=Math.min(Math.max(10,(rect.left+rect.right)/2-bounds.left-toolbarWidth/2),
      Math.max(10,bounds.width-toolbarWidth-10));
    const above=rect.top-bounds.top-48;
    const y=above>=10?above:Math.min(bounds.height-48,rect.bottom-bounds.top+8);
    selectionToolbar.style.left=x+'px';selectionToolbar.style.top=Math.max(8,y)+'px';
    selectionToolbar.hidden=false;selectionStatus.hidden=true;
  }
  async function performSelection(action){
    const quote=activeSelection;if(!quote)return;
    askSelection.disabled=true;forkSelection.disabled=true;
    selectionStatus.hidden=false;
    selectionStatus.textContent=action==='ask'?'Preparing ChatGPT draft…':'Opening native Branch…';
    try{
      if(action==='ask'){
        await onAskQuote(quote.text,quote.turnId);
      }else{
        const anchor=await quoteAnchor(quote);
        // This is an explicit user gesture. Copy is best-effort, never stored.
        try{await navigator.clipboard.writeText(quote.text);}catch{}
        await onFork(quote.turnId,anchor);
      }
      hideSelection();
    }catch(error){
      selectionStatus.hidden=false;
      selectionStatus.textContent=error?.message||'Action unavailable.';
    }finally{askSelection.disabled=false;forkSelection.disabled=false;}
  }
  askSelection.addEventListener('click',()=>performSelection('ask'));
  forkSelection.addEventListener('click',()=>performSelection('fork'));
  const searchCache=new Map();
  let outlineLimit=60;
  const searchable=turn=>{
    const known=searchCache.get(turn.id);
    if(known?.prompt===turn.prompt && known?.answer===turn.answer)return known.text;
    const value=((turn.prompt||'')+' '+(turn.answer||'')).toLowerCase();
    searchCache.set(turn.id,{prompt:turn.prompt,answer:turn.answer,text:value});
    return value;
  };
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
    let matches=0;
    const fragment=document.createDocumentFragment();
    for(let i=0;i<turns.length;i++){
      const turn=turns[i];
      if(query&&!searchable(turn).includes(query))continue;
      matches++;
      if(matches>outlineLimit)continue;
      const btn=document.createElement('button');btn.type='button';
      btn.className='g-outline-item';
      const number=document.createElement('span');number.className='g-outline-number';
      number.textContent=String(i+1).padStart(2,'0');
      const label=document.createElement('span');label.textContent=turn.prompt;
      btn.append(number,label);
      if(bookmarks.includes(turn.id))btn.prepend(document.createTextNode('◈ '));
      btn.addEventListener('click',()=>{focus(turn.id);toggleOutline();});
      fragment.append(btn);
    }
    outlineTitle.textContent=query?'Matches · '+matches:'Conversation outline · '+matches;
    outlineItems.append(fragment);
    moreOutline.hidden=matches<=outlineLimit;
    if(!matches){
      const empty=document.createElement('p');empty.className='g-outline-empty';
      empty.textContent='No matching cards';outlineItems.append(empty);
    }
  }
  function toggleOutline(){
    outlineOpen=!outlineOpen;
    outline.hidden=!outlineOpen;
    if(outlineOpen)renderOutline();
  }
  function search(value){
    const next=String(value||'').trim().toLowerCase();
    if(next===query)return;
    query=next;outlineSearch.value=query;
    onSearchChange(query);
    outlineLimit=60;applySearch();
    if(query)outlineOpen=true;
    outline.hidden=!outlineOpen;renderOutline();
  }

  let scale = 1, panX = 0, panY = 0, positions = {}, turns = [], dragging = null;
  let autoFit = true, edgesQueued = false, cameraQueued=false, previousRoute = null, initialFocusPending = true;
  let emptyCameraLocked=true, minimapPoints=[],minimapBounds=calculateGraphBounds([]);
  const responsiveCardWidth=()=>Math.max(240,Math.min(viewport.clientWidth-24,
    viewport.clientWidth<=430?320:viewport.clientWidth<=760?350:366));
  function centerEntry(){
    if(!viewport.clientWidth||!emptyCameraLocked||turns.length)return;
    startCard.element.style.width=responsiveCardWidth()+'px';
    const camera=centerEntryCamera(viewport.clientWidth,viewport.clientHeight,
      startCard.element.offsetWidth||responsiveCardWidth(),startCard.element.offsetHeight||235);
    scale=camera.scale;panX=camera.panX;panY=camera.panY;
    renderTransform();
  }
  function refreshMinimapVisibility(){
    minimap.element.hidden=!shouldShowMinimap(minimapBounds,{
      panX,panY,scale,width:viewport.clientWidth,height:viewport.clientHeight});
  }
  let stablePositions = new Map();
  const cards = new Map();
  const branchNodes=new Map();
  let branchPositions=new Map(),branchEdges=[],branchCurrent=null,visibleQueued=false;
  let spatialIndex=buildSpatialIndex([]),lastViewportUpdateMs=0,maxViewportUpdateMs=0;
  let lastCameraFrameMs=0,maxCameraFrameMs=0,lastEdgeUpdateMs=0,maxEdgeUpdateMs=0;
  let edgeDOMCreates=0,edgeDOMRemoves=0;
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
      updateSpatialEntry(id);
      geometryChanged=true;
    }
    if(geometryChanged){updateMinimap();queueEdges();}
  }):null;
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  // Camera movement changes no world-space edge geometry. Coalesce all
  // pointer/wheel input into a single frame; visibility diff owns mount edges.
  const renderTransform = () => {
    if(cameraQueued)return;
    cameraQueued=true;
    requestAnimationFrame(()=>{
      const started=performance.now();
      cameraQueued=false;
      stage.style.transform='translate('+panX+'px,'+panY+'px) scale('+scale+')';
      zoomLabel.textContent=Math.round(scale*100)+'%';
      minimap.setCamera({panX,panY,scale,width:viewport.clientWidth,height:viewport.clientHeight});
      refreshMinimapVisibility();
      scheduleVisible();
      lastCameraFrameMs=Math.round((performance.now()-started)*100)/100;
      maxCameraFrameMs=Math.max(maxCameraFrameMs,lastCameraFrameMs);
    });
  };
  const point = (turn,index) => {
    // During a card drag, its visible position is the geometry source.
    if(dragging?.kind==='card'&&dragging.id===turn.id){
      return {x:parseFloat(dragging.element.style.left)||0,
        y:parseFloat(dragging.element.style.top)||0};
    }
    return positions[turn.id]||stablePositions.get(turn.id)||layoutPoint(index);
  };

  function spatialEntry(id){
    const i=turnIndexById.get(id);
    if(i===undefined)return null;
    const p=point(turns[i],i),size=measuredBounds.get(id);
    return {id,x:p.x,y:p.y,w:size?.width||responsiveCardWidth(),h:size?.height||600};
  }
  function updateSpatialEntry(id){
    const entry=spatialEntry(id);
    if(entry)spatialIndex.upsert(entry);
    else spatialIndex.remove(id);
  }
  function rebuildIndex(){
    spatialIndex=buildSpatialIndex(turns.map(turn=>spatialEntry(turn.id)).filter(Boolean));
  }
  function syncVisibleCards(){
    const started=performance.now();
    visibleQueued=false;
    // Even 20 rich responses can be expensive to mount simultaneously.
    const visible=viewport.clientWidth>0&&viewport.clientHeight>0
      ?spatialIndex.query({panX,panY,scale,
        width:viewport.clientWidth,height:viewport.clientHeight})
      :[];
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
          onSelection:handleSelection,
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
      card.style.width=responsiveCardWidth()+'px';
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
    const started=performance.now();
    edgesQueued=false;
    const geometry=new Map();
    for(const [id,card] of cards){
      const i=turnIndexById.get(id);
      if(!i)continue;
      const previous=turns[i-1],first=cards.get(previous.id);
      if(!first || turns[i].breakBefore)continue;
      const a=point(previous,i-1),b=point(turns[i],i);
      const x1=a.x+(measuredBounds.get(previous.id)?.width||responsiveCardWidth()),y1=a.y+19;
      const x2=b.x,y2=b.y+19;
      const bend=Math.max(60,Math.abs(x2-x1)*.42);
      geometry.set('seq:'+previous.id+':'+id,{
        d:'M'+x1+' '+y1+' C'+(x1+bend)+' '+y1+' '+(x2-bend)+' '+y2+' '+x2+' '+y2,
        branch:false
      });
    }
    for(const edge of branchEdges){
      const a=branchPositions.get(edge.from),b=branchPositions.get(edge.to);
      if(!a||!b)continue;
      const x1=a.x+(a.w||responsiveCardWidth()),y1=a.y+19,x2=b.x,y2=b.y+19;
      const bend=Math.max(50,(x2-x1)*.45);
      geometry.set('branch:'+edge.id,{
        d:'M'+x1+' '+y1+' C'+(x1+bend)+' '+y1+' '+(x2-bend)+' '+y2+' '+x2+' '+y2,
        branch:true
      });
    }
    for(const [id,old] of edgePaths) {
      if(geometry.has(id))continue;
      old.element.remove();edgePaths.delete(id);edgeDOMRemoves++;
    }
    for(const [id,entry] of geometry){
      let existing=edgePaths.get(id);
      if(!existing){
        const element=document.createElementNS('http://www.w3.org/2000/svg','path');
        element.setAttribute('fill','none');
        element.setAttribute('stroke',entry.branch?'var(--g-text)':'var(--g-edge)');
        element.setAttribute('stroke-width',entry.branch?'1.5':'1.7');
        if(entry.branch)element.setAttribute('stroke-dasharray','4 5');
        edgeLayer.append(element);edgeDOMCreates++;
        existing={element,d:null};edgePaths.set(id,existing);
      }
      if(existing.d!==entry.d){
        existing.d=entry.d;
        existing.element.setAttribute('d',entry.d);
      }
    }
    lastEdgeUpdateMs=Math.round((performance.now()-started)*100)/100;
    maxEdgeUpdateMs=Math.max(maxEdgeUpdateMs,lastEdgeUpdateMs);
  }
  function renderBranchNodes(records,route,previews={}) {
    const tree=buildBranchWorkspace(records,route);
    const last=turns[turns.length-1];
    const base=last?point(last,turns.length-1):{x:0,y:0};
    const origin={x:base.x+535,y:base.y+240};
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
      let node=branchNodes.get(entry.id);
      if(!node) {
        const shell=createDialogueCard({variant:'branch',number:'↳',origin:'Confirmed branch'});
        node=shell.element;
        node.className+=' g-branch-node';
        node._shell=shell;
        branchNodes.set(entry.id,node);stage.append(node);
      }
      node.style.width=responsiveCardWidth()+'px';
      node._shell.setHeader('↳',entry.isCurrent?'Current branch':'Confirmed branch');
      node.classList.toggle('g-current-branch',entry.isCurrent);
      node._shell.body.replaceChildren();
      branchPositions.set(entry.id,{x,y,branch:true,w:responsiveCardWidth(),h:node.offsetHeight||155});
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
      node._shell.body.append(open);
      const current=previews[tree.current],other=previews[entry.id];
      if(!entry.isCurrent && current?.answer && other?.answer) {
        const compare=document.createElement('button');compare.type='button';
        compare.className='g-branch-compare';
        compare.textContent='Compare loaded answers';
        compare.addEventListener('click',()=>inspector.openCompare(current,other));
        node._shell.body.append(compare);
      }
      node.style.left=x+'px';node.style.top=y+'px';
      branchPositions.get(entry.id).h=node.offsetHeight||155;
    }
    branchesButton.disabled=entries.length===0;
    branchesButton.hidden=entries.length===0;
  }
  function focusBranches(){
    const current=branchPositions.get(branchCurrent)
      ||branchPositions.values().next().value;
    if(!current)return;
    scale=1;autoFit=false;
    panX=viewport.clientWidth/2-(current.x+(current.w||responsiveCardWidth())/2);
    panY=viewport.clientHeight/2-(current.y+78);
    renderTransform();
  }
  function updateMinimap(){
    minimapPoints=turns.map((turn,i)=>({...point(turn,i),
      w:measuredBounds.get(turn.id)?.width||responsiveCardWidth(),
      h:measuredBounds.get(turn.id)?.height||230}));
    minimapPoints.push(...branchPositions.values());
    minimapBounds=calculateGraphBounds(minimapPoints);
    minimap.setPoints(minimapPoints);
    minimap.setCamera({panX,panY,scale,width:viewport.clientWidth,height:viewport.clientHeight});
    refreshMinimapVisibility();
  }
  const queueEdges = () => { if (!edgesQueued) { edgesQueued=true; requestAnimationFrame(drawEdges); } };
  const fit = () => {
    const bounds = turns.map((turn,i)=>{
      const p=point(turn,i); return { x:p.x,y:p.y,w:cards.get(turn.id)?.offsetWidth||responsiveCardWidth(),h:cards.get(turn.id)?.offsetHeight||260 };
    });
    if (!bounds.length) bounds.push({x:0,y:0,w:startCard.element.offsetWidth||responsiveCardWidth(),h:startCard.element.offsetHeight||260});
    for(const [key,p] of branchPositions)bounds.push({x:p.x,y:p.y,w:branchNodes.get(key)?.offsetWidth||responsiveCardWidth(),h:branchNodes.get(key)?.offsetHeight||78});
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
    scale=next;autoFit=false;emptyCameraLocked=false;renderTransform();
  };
  viewport.addEventListener('wheel',event=>{
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();onActivity();
    const rect=viewport.getBoundingClientRect();
    zoom(scale+(event.deltaY<0?.08:-.08),event.clientX-rect.left,event.clientY-rect.top);
  },{passive:false});
  viewport.addEventListener('pointerdown',event=>{
    if(!selectionToolbar.contains(event.target) &&
       !event.target.closest?.('.g-answer,.g-inspect-response'))hideSelection();
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
    if(dragging){if(dragging.kind==='pan')emptyCameraLocked=false;
      hideSelection();onActivity();viewport.setPointerCapture(event.pointerId);}
  });
  viewport.addEventListener('pointermove',event=>{
    if(!dragging || event.pointerId!==dragging.pointerId)return;
    onActivity();
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
    const changedId=dragging.kind==='card'?dragging.id:null;
    dragging=null;
    if(changedId)updateSpatialEntry(changedId);
    scheduleVisible();
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
  const viewportResize=typeof ResizeObserver==='function'?new ResizeObserver(()=>{
    startCard.element.style.width=responsiveCardWidth()+'px';
    for(const card of cards.values())card.style.width=responsiveCardWidth()+'px';
    for(const node of branchNodes.values())node.style.width=responsiveCardWidth()+'px';
    for(const position of branchPositions.values())position.w=responsiveCardWidth();
    rebuildIndex();updateMinimap();queueEdges();
    if(!turns.length)centerEntry();
    else if(initialFocusPending&&viewport.clientWidth){
      initialFocusPending=false;emptyCameraLocked=false;
      requestAnimationFrame(()=>focus(turns[turns.length-1].id));
    }else renderTransform();
  }):null;
  viewportResize?.observe(viewport);
  return {
    element:viewport,
    reconcile(state, change){
      const routeChanged=previousRoute!==state.route;
      if(routeChanged){hideSelection();previousRoute=state.route;initialFocusPending=true;
        emptyCameraLocked=true;stablePositions.clear();
        selectedCompare=[];focusedId=null;inspector.hide();}
      positions=state.positions;turns=state.turns;bookmarks=state.bookmarks||[];
      firstButton.disabled=!turns.length;latestButton.disabled=!turns.length;
      firstButton.hidden=turns.length<2;latestButton.hidden=turns.length<2;
      controls.hidden=turns.length===0;
      startCard.element.style.width=responsiveCardWidth()+'px';
      if(routeChanged){
        turnById.clear();turnIndexById.clear();searchCache.clear();outlineLimit=60;
        query='';outlineSearch.value='';onSearchChange('');
        outlineOpen=false;outline.hidden=true;
      }
      if(!routeChanged && change?.type==='patch'){
        const card=cards.get(change.turnId);
        const index=turnIndexById.get(change.turnId);
        if(index!==undefined)turnById.set(change.turnId,turns[index]);
        searchCache.delete(change.turnId);
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
        if(p){
          if(card){card.style.left=p.x+'px';card.style.top=p.y+'px';}
          updateSpatialEntry(change.turnId);updateMinimap();queueEdges();
        }
        return;
      }
      stablePositions=stabilizeLayout(turns,stablePositions,positions);
      turnById.clear();turnIndexById.clear();
      const current=new Set();
      turns.forEach((turn,index)=>{turnById.set(turn.id,turn);turnIndexById.set(turn.id,index);current.add(turn.id);});
      for(const id of searchCache.keys())if(!current.has(id))searchCache.delete(id);
      rebuildIndex();syncVisibleCards();
      renderOutline();
      renderBranchNodes(state.branches,state.route,state.previews);
      updateMinimap();
      startCard.element.hidden = turns.length !== 0;
      if(!turns.length)startCard.setRoute(state.route,state.history?.status);
      queueEdges();
      if(!turns.length && viewport.clientWidth) {
        initialFocusPending=false;
        requestAnimationFrame(centerEntry);
      } else if(initialFocusPending && turns.length && viewport.clientWidth) {
        initialFocusPending=false;emptyCameraLocked=false;
        const latest=turns[turns.length-1];
        requestAnimationFrame(()=>focus(latest.id));
      }
    },
    fit,focus,
    closeInspector:()=>{hideSelection();inspector.hide();},
    hideSelection,
    selectionOpen:()=>!selectionToolbar.hidden,
    inspectorOpen:()=>inspector.visible,
    stats:()=>({mountedCards:cards.size,canvasTurns:turns.length,
      renderedEdges:edgePaths.size,branchNodes:branchNodes.size,
      lastViewportUpdateMs,maxViewportUpdateMs,spatialIndexEntries:spatialIndex.count,
      lastCameraFrameMs,maxCameraFrameMs,lastEdgeUpdateMs,maxEdgeUpdateMs,
      edgeDOMCreates,edgeDOMRemoves}),
    nextTurn(step=1){
      if(!turns.length)return;
      const index=turnIndexById.get(focusedId);
      const next=Math.max(0,Math.min(turns.length-1,(index??turns.length-1)+step));
      focus(turns[next].id);
    },
    readFocused(){const id=focusedId||turns[turns.length-1]?.id;if(id)readTurn(id);},
    focusBranches,
    search,
    focusSearch(){
      if(!outlineOpen)toggleOutline();
      outlineSearch.focus();
    },
    get outlineOpen(){return outlineOpen;},
    closeOutline(){if(outlineOpen)toggleOutline();},
    toggleOutline
  };
}

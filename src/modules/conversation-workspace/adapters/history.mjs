// Progressive, cancellable reading of *native* ChatGPT scrolling history.
// No undocumented API calls. Never scroll navigation sidebar.
const TURN_MARKER='[data-testid^="conversation-turn-"],[data-turn-id],[data-turn-key],[data-message-author-role]';
const SCROLL_SELECTORS='[data-testid="conversation-scroll-container"],[data-testid="conversation-panel"],[class*="overflow-y-auto"],[class*="overflow-auto"],[role="log"]';
function scrollable(node, view) {
  if(!node || typeof node.scrollTop!=='number')return false;
  if(!(node.scrollHeight>node.clientHeight+48 && node.clientHeight>100))return false;
  const overflow=view?.getComputedStyle?.(node)?.overflowY||'';
  return /auto|scroll|overlay/.test(overflow)||node.scrollTop>0;
}
export function findHistoryScroller(doc, main) {
  if(!main)return null;
  const view=doc.defaultView;
  let node=main.querySelector?.(TURN_MARKER);
  while(node && node!==doc.body){
    if(scrollable(node,view))return node;
    node=node.parentElement;
  }
  for(const candidate of main.querySelectorAll?.(SCROLL_SELECTORS)||[]){
    if(scrollable(candidate,view))return candidate;
  }
  node=main;
  while(node && node!==doc.body){
    if(scrollable(node,view))return node;
    node=node.parentElement;
  }
  // Some ChatGPT layouts use the document's own scroller while main contains
  // all conversation turns. This must be the actual document scroller, not a
  // sidebar or any arbitrary element outside main.
  const page=doc.scrollingElement;
  if(main.querySelector?.(TURN_MARKER) && scrollable(page,view))return page;
  return null;
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Yield background parsing while the tab is hidden or the user is interacting.
// Never execute a scan after cancellation, even when the idle callback is late.
export async function yieldForHistory(doc,signal,{
  isInteracting=()=>false,wait=delay
}={}) {
  while(!signal?.aborted &&
      (doc?.visibilityState==='hidden' || isInteracting())){
    await wait(100);
  }
  if(signal?.aborted)return false;
  const view=doc?.defaultView;
  if(typeof view?.requestIdleCallback==='function'){
    await new Promise(resolve=>{
      const handle=view.requestIdleCallback(resolve,{timeout:180});
      if(signal?.aborted && typeof view.cancelIdleCallback==='function')
        view.cancelIdleCallback(handle);
    });
  }
  return !signal?.aborted;
}
export async function backfillHistory({
  document,root,onScan,onStatus=()=>{},signal,
  findScroller=findHistoryScroller,wait=delay,
  maxSteps=300,idleLimit=12,waitMs=100,
  yieldForScan=()=>yieldForHistory(document,signal)
}) {
  const scroller=findScroller(document,root);
  if(!scroller){onStatus({status:'unavailable',steps:0});return 'unavailable';}
  const bottomGap=Math.max(0,scroller.scrollHeight-scroller.clientHeight-scroller.scrollTop);
  let outcome='limited',steps=0,lastCount=-1,lastHeight=-1,lastHead=null,stable=0;
  let count=0;
  const abort=()=>signal?.aborted||scroller.isConnected===false;
  onStatus({status:'loading',phase:'up',steps:0,count:0});
  try {
    // Phase 1: page toward the earliest rendered turn. One large jump often
    // misses virtualization sentinels, so cross the scrollport in increments.
    for(;steps<maxSteps;steps++){
      if(abort()){outcome=signal?.aborted?'cancelled':'unavailable';break;}
      const before=scroller.scrollTop;
      const step=Math.max(220,Math.min(scroller.clientHeight*.82,900));
      scroller.scrollTop=Math.max(0,before-step);
      await wait(waitMs);
      if(!(await yieldForScan()) || abort()){outcome=signal?.aborted?'cancelled':'unavailable';break;}
      const current=await onScan({direction:'up',moved:scroller.scrollTop<before-1,scrollTop:scroller.scrollTop});
      count=Math.max(count,current?.count||0);
      const head=current?.firstId||null,height=scroller.scrollHeight;
      const atTop=scroller.scrollTop<=2;
      const unchanged=atTop && lastHead===head && lastHeight===height && lastCount===count;
      stable=unchanged?stable+1:0;
      lastHead=head;lastHeight=height;lastCount=count;
      if(steps%4===0||!unchanged)onStatus({status:'loading',phase:'up',steps:steps+1,count});
      // Remain at top for multiple delayed loading rounds; stability is not
      // proof of complete account history, only the currently reachable DOM.
      if(stable>=idleLimit){outcome='reached-top';steps++;break;}
    }
    if(!abort() && outcome!=='unavailable'){
      // Phase 2: traverse down through the now expanded document as well.
      // Virtualized pages can unmount/reuse earlier rows; scan each viewport
      // and accumulate IDs in the in-memory controller.
      stable=0;
      onStatus({status:'loading',phase:'down',steps,count});
      for(;steps<maxSteps;steps++){
        if(abort()){outcome=signal?.aborted?'cancelled':'unavailable';break;}
        const max=Math.max(0,scroller.scrollHeight-scroller.clientHeight);
        const before=scroller.scrollTop;
        scroller.scrollTop=Math.min(max,before+Math.max(220,Math.min(scroller.clientHeight*.82,900)));
        await wait(waitMs);
        if(!(await yieldForScan()) || abort()){outcome=signal?.aborted?'cancelled':'unavailable';break;}
        const info=await onScan({direction:'down',moved:scroller.scrollTop>before+1,scrollTop:scroller.scrollTop});
        count=Math.max(count,info?.count||0);
        const end=scroller.scrollTop>=Math.max(0,scroller.scrollHeight-scroller.clientHeight-2);
        stable=end?stable+1:0;
        if(steps%4===0)onStatus({status:'loading',phase:'down',steps:steps+1,count});
        if(stable>=3){outcome='reached-top';steps++;break;}
      }
    }
    if(signal?.aborted)outcome='cancelled';
    // "reached-top" means the *DOM's* loadable top, not full server history.
    onStatus({status:outcome,steps,count});
    return outcome;
  } finally {
    if(!signal?.aborted && scroller.isConnected!==false)
      scroller.scrollTop=Math.max(0,scroller.scrollHeight-scroller.clientHeight-bottomGap);
  }
}

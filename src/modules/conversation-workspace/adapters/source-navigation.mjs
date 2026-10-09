import {collectMessages,findChatMain} from './chatgpt-dom.mjs';
import {findHistoryScroller} from './history.mjs';
import {stableMessageId} from '../core/branch.mjs';

// Explicit user navigation, not background scraping. Scroll only the open
// conversation's actual scrollport. Do not mistake recycled positional IDs.
export async function revealNativeSource(doc,messageId,{
  findScroller=findHistoryScroller,scan=collectMessages,
  wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
  maxSteps=160,signal
}={}) {
  const main=findChatMain(doc);
  const seek=()=>{
    const match=scan(main).find(row=>row.id===messageId);
    return match?.element?.isConnected!==false ? match?.element || null : null;
  };
  const immediate=seek();
  if(immediate)return immediate;
  if(!stableMessageId(messageId))return null;
  const scroller=findScroller(doc,main);
  if(!scroller)return null;
  const route=doc.defaultView?.location?.pathname;
  const original=Math.max(0,scroller.scrollHeight-scroller.clientHeight-scroller.scrollTop);
  let found=null;
  const changed=()=>signal?.aborted || scroller.isConnected===false ||
    doc.defaultView?.location?.pathname!==route;
  try{
    // Traverse both directions: virtualized sources may not exist at the
    // position where a simple jump to top would land.
    for(const direction of [-1,1]){
      for(let i=0;i<maxSteps;i++){
        if(changed())return null;
        const step=Math.max(200,Math.min(scroller.clientHeight*.78,800));
        const before=scroller.scrollTop;
        const max=Math.max(0,scroller.scrollHeight-scroller.clientHeight);
        scroller.scrollTop=Math.max(0,Math.min(max,before+direction*step));
        await wait(90);
        if(changed())return null;
        found=seek();
        if(found){found.scrollIntoView?.({block:'center'});return found;}
        // Give lazy/virtualized roots a few rounds after reaching an edge.
        if(Math.abs(scroller.scrollTop-before)<2 && i>5)break;
      }
    }
    return null;
  } finally {
    if(!found&&!changed())
      scroller.scrollTop=Math.max(0,scroller.scrollHeight-scroller.clientHeight-original);
  }
}

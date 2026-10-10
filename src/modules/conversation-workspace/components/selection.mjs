// Resolve selections inside gptdraw's closed Shadow DOM. Chromium exposes
// ShadowRoot.getSelection(); composed ranges are the standards-based fallback.
export function selectionForAnswer(answer){
  const shadow=answer?.getRootNode?.();
  const local=shadow?.getSelection?.();
  if(local?.rangeCount && !local.isCollapsed)return local;
  const doc=answer?.ownerDocument||globalThis.document;
  const global=doc?.getSelection?.();
  if(global?.getComposedRanges && shadow?.host && doc?.createRange){
    try {
      const source=global.getComposedRanges({shadowRoots:[shadow]})?.[0];
      if(source){
        const range=doc.createRange();
        range.setStart(source.startContainer,source.startOffset);
        range.setEnd(source.endContainer,source.endOffset);
        return {rangeCount:1,isCollapsed:range.collapsed,getRangeAt:()=>range};
      }
    }catch{/* Fall through to the conventional document selection. */}
  }
  return local?.rangeCount?local:global;
}

// Ephemeral selection metadata from gptdraw's rendered answer, never a
// native ChatGPT DOM scraper. Supports selections crossing multiple blocks.
export function readAnswerSelection(answer,selection){
  if(!answer||!selection||selection.isCollapsed||!selection.rangeCount)return null;
  const range=selection.getRangeAt(0);
  const element=node=>node?.nodeType===1?node:node?.parentElement;
  const startElement=element(range.startContainer),endElement=element(range.endContainer);
  if(!startElement||!endElement || !answer.contains(startElement)||!answer.contains(endElement))return null;
  const first=startElement.closest?.('.g-answer-block');
  const last=endElement.closest?.('.g-answer-block');
  if(!first||!last||!answer.contains(first)||!answer.contains(last))return null;
  const blocks=[...answer.children];
  const blockIndex=blocks.indexOf(first),endBlockIndex=blocks.indexOf(last);
  if(blockIndex<0||endBlockIndex<blockIndex)return null;
  const text=range.toString();
  if(!text?.trim()||text.length>10000)return null;
  const prefix=range.cloneRange();
  prefix.selectNodeContents(first);
  prefix.setEnd(range.startContainer,range.startOffset);
  const start=prefix.toString().length;
  if(!Number.isInteger(start)||start<0)return null;
  const rect=range.getBoundingClientRect?.();
  if(!rect||!Number.isFinite(rect.left)||!Number.isFinite(rect.top))return null;
  // The end index is the quote extent from the first block, including
  // intervening text when a user selects across block boundaries.
  return {text,blockIndex,endBlockIndex,start,end:start+text.length,
    rect:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom}};
}

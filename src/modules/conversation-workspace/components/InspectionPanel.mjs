import {createResponseBlock} from './ResponseBlock.mjs';
import {control} from '../../../components/ui/icons.mjs';
import {readAnswerSelection} from './selection.mjs';

// Read-only live lens. Preserve column identity and scroll during streaming.
function column(turn,label,onSelection){
  const element=document.createElement('section');element.className='g-inspect-column';
  const heading=document.createElement('h3');heading.textContent=label;
  const prompt=document.createElement('div');prompt.className='g-inspect-prompt';
  const response=document.createElement('div');response.className='g-inspect-response';
  element.append(heading,prompt,response);
  const state={element,prompt,response,blocks:[],id:turn.id};
  const announce=()=>{
    const rootSelection=response.getRootNode()?.getSelection?.();
    const selection=rootSelection?.rangeCount?rootSelection:document.getSelection?.();
    const quote=readAnswerSelection(response,selection);
    onSelection?.(quote?{...quote,turnId:turn.id}:null);
  };
  response.addEventListener('mouseup',announce);
  response.addEventListener('keyup',announce);
  response.addEventListener('touchend',()=>requestAnimationFrame(announce));
  patchColumn(state,turn);
  return state;
}
function selectionInside(node){
  const selected=node.getRootNode()?.getSelection?.() || document.getSelection?.();
  return !!selected && !selected.isCollapsed &&
    (node.contains(selected.anchorNode)||node.contains(selected.focusNode));
}
function patchColumn(state,turn) {
  if(state.prompt.textContent!==turn.prompt)state.prompt.textContent=turn.prompt||'';
  const next=turn.answerBlocks?.length?turn.answerBlocks:
    [{kind:'paragraph',text:turn.answer||'No assistant text rendered yet.'}];
  // If the user is actively selecting/copying from the response, defer the
  // patch until selection ends, instead of destroying the selection range.
  if(selectionInside(state.response)){state.pending=turn;return;}
  state.pending=null;
  for(let i=0;i<next.length;i++){
    const block=next[i],old=state.blocks[i];
    if(old?.data===block)continue;
    if(old && old.kind===block.kind && block.kind==='paragraph' && !block.inline){
      old.element.textContent=block.text||'';
      state.blocks[i]={element:old.element,kind:block.kind,data:block};
      continue;
    }
    if(old && old.kind==='code' && block.kind==='code' &&
      old.language===block.language){
      const code=old.element.querySelector('code');
      if(code)code.textContent=block.text||'';
      state.blocks[i]={...old,data:block};continue;
    }
    const element=createResponseBlock(block);
    if(old)old.element.replaceWith(element);
    else state.response.append(element);
    state.blocks[i]={element,kind:block.kind,language:block.language,data:block};
  }
  while(state.blocks.length>next.length)state.blocks.pop().element.remove();
}
export function createInspectionPanel(onSelection=()=>{}){
  const overlay=document.createElement('section');overlay.className='g-inspection';overlay.hidden=true;
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label','Focused conversation reading');
  const header=document.createElement('header');header.className='g-inspection-head';
  const title=document.createElement('strong');
  const close=control('Close reading panel','close',()=>hide());
  header.append(title,close);
  const content=document.createElement('div');content.className='g-inspection-columns';
  overlay.append(header,content);
  let restore=null,columns=[];
  const selectionChange=()=>{
    if(overlay.hidden)return;
    for(const col of columns)if(col.pending&&!selectionInside(col.response))
      patchColumn(col,col.pending);
  };
  function hide(){
    if(overlay.hidden)return;
    overlay.hidden=true;content.replaceChildren();columns=[];
    document.removeEventListener('selectionchange',selectionChange);
    const element=restore;restore=null;element?.focus?.({preventScroll:true});
  }
  function open(items,heading,labels){
    if(overlay.hidden)restore=overlay.getRootNode()?.activeElement;
    title.textContent=heading;
    columns=items.map((turn,i)=>column(turn,labels[i],onSelection));
    content.replaceChildren(...columns.map(c=>c.element));
    overlay.classList.toggle('g-compare-mode',items.length===2);
    overlay.hidden=false;
    document.addEventListener('selectionchange',selectionChange);
    close.focus({preventScroll:true});
  }
  function openRead(turn){open([turn],'Focus reading · '+(turn.id||''),['Current ChatGPT answer']);}
  function openCompare(left,right){open([left,right],'Compare loaded turns · Read only',['Turn A','Turn B']);}
  function updateTurn(turn){
    if(overlay.hidden)return;
    for(const col of columns)if(col.id===turn.id)patchColumn(col,turn);
  }
  overlay.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();hide();}
  });
  return {element:overlay,openRead,openCompare,updateTurn,hide,get visible(){return !overlay.hidden;}};
}

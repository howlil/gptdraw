import {createResponseBlock} from './ResponseBlock.mjs';
import {control} from '../../../components/ui/icons.mjs';

// Read-only lens over actual ChatGPT DOM-derived, in-memory turn content.
function section(turn,title){
  const section=document.createElement('section');section.className='g-inspect-column';
  const heading=document.createElement('h3');heading.textContent=title;
  const prompt=document.createElement('div');prompt.className='g-inspect-prompt';
  prompt.textContent=turn.prompt||'';
  const response=document.createElement('div');response.className='g-inspect-response';
  const blocks=turn.answerBlocks?.length?turn.answerBlocks:
    [{kind:'paragraph',text:turn.answer||'No assistant text rendered yet.'}];
  for(const block of blocks)response.append(createResponseBlock(block));
  section.append(heading,prompt,response);
  return section;
}
export function createInspectionPanel(){
  const overlay=document.createElement('section');overlay.className='g-inspection';overlay.hidden=true;
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label','Focused conversation reading');
  const header=document.createElement('header');header.className='g-inspection-head';
  const title=document.createElement('strong');
  const close=control('Close reading panel','close',()=>hide());
  header.append(title,close);
  const content=document.createElement('div');content.className='g-inspection-columns';
  overlay.append(header,content);
  let restore=null;
  function hide(){
    overlay.hidden=true;content.replaceChildren();
    const element=restore;restore=null;
    element?.focus?.({preventScroll:true});
  }
  function openRead(turn){
    restore=overlay.getRootNode()?.activeElement;
    title.textContent='Focus reading · '+(turn.id||'');
    content.replaceChildren(section(turn,'Current ChatGPT answer'));
    overlay.classList.remove('g-compare-mode');overlay.hidden=false;
    close.focus({preventScroll:true});
  }
  function openCompare(left,right){
    restore=overlay.getRootNode()?.activeElement;
    title.textContent='Compare loaded turns · Read only';
    content.replaceChildren(section(left,'Turn A'),section(right,'Turn B'));
    overlay.classList.add('g-compare-mode');overlay.hidden=false;
    close.focus({preventScroll:true});
  }
  overlay.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();hide();}
  });
  return {element:overlay,openRead,openCompare,hide,get visible(){return !overlay.hidden;}};
}

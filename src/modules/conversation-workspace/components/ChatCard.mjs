import { control,icon } from '../../../components/ui/icons.mjs';
import { quoteAnchor } from '../core/branch.mjs';

// Dialogue-style card from the supplied spatial HTML prototype. All content
// is generated through DOM textContent: no untrusted ChatGPT HTML injection.
function createBlock(block) {
  const tag=block.kind==='heading'?'h3':block.kind==='code'?'pre':
    block.kind==='quote'?'blockquote':block.kind==='list'?'p':
    block.kind==='divider'?'hr':block.kind==='table'?'pre':'p';
  const element=document.createElement(tag);
  element.className='g-answer-block g-block-'+block.kind;
  element.textContent=block.kind==='list' && block.ordered
    ? block.text : block.text;
  return element;
}
export function createChatCard(turn,{index,onSource,onFocus,onCompose,onSend,onFork,isLatest=false}) {
  const card=document.createElement('article');
  card.className='g-card';
  card.dataset.turnId=turn.id;card.tabIndex=-1;
  const head=document.createElement('header');head.className='g-card-head';
  const label=document.createElement('span');label.className='g-card-label';
  const origin=document.createElement('span');origin.className='g-card-origin';
  const actions=document.createElement('div');actions.className='g-card-actions';
  const focus=control('Center card','focus',()=>onFocus(turn.id));
  const collapse=control('Collapse or expand card','back',()=> {
    const collapsed=!card.classList.contains('g-collapsed');
    card.classList.toggle('g-collapsed',collapsed);
    collapse.setAttribute('aria-label',collapsed?'Expand card':'Collapse card');
  });
  actions.append(focus,collapse);head.append(label,origin,actions);
  const body=document.createElement('div');body.className='g-card-body';
  const row=document.createElement('div');row.className='g-user-row';
  const question=document.createElement('div');question.className='g-user-bubble';
  row.append(question);
  const answer=document.createElement('div');answer.className='g-answer';
  answer.setAttribute('role','region');answer.setAttribute('aria-label','Assistant response');
  const placeholder=document.createElement('p');placeholder.className='g-placeholder';
  body.append(row,answer,placeholder);
  const footer=document.createElement('div');footer.className='g-node-footer';
  const source=document.createElement('button');source.type='button';source.className='g-text-action';
  source.append(icon('arrow',13),document.createTextNode(' Open source'));
  source.addEventListener('click',()=>onSource(turn.userId));
  const continueButton=document.createElement('button');continueButton.type='button';
  continueButton.className='g-text-action';
  continueButton.append(icon('navigate',13),document.createTextNode(' Continue'));
  continueButton.addEventListener('click',()=>{
    if(card.classList.contains('g-latest'))composerInput.focus();
    else onSource(turn.userId);
  });
  const fork=document.createElement('button');fork.type='button';
  fork.className='g-text-action';fork.textContent='Fork';
  fork.title='Use ChatGPT native Branch in new chat';
  const forkQuote=document.createElement('button');forkQuote.type='button';
  forkQuote.className='g-text-action';forkQuote.textContent='Fork selected quote';
  forkQuote.hidden=true;
  const forkStatus=document.createElement('span');forkStatus.className='g-fork-status';
  forkStatus.setAttribute('role','status');
  let selected=null;
  const updateSelection=()=>{
    const selection=card.getRootNode()?.getSelection?.() || document.getSelection?.();
    if(!selection||selection.isCollapsed||!selection.rangeCount){selected=null;forkQuote.hidden=true;return;}
    const range=selection.getRangeAt(0);
    const parent=range.startContainer?.nodeType===1?range.startContainer:range.startContainer?.parentElement;
    const block=parent?.closest?.('.g-answer-block');
    const end=range.endContainer?.nodeType===1?range.endContainer:range.endContainer?.parentElement;
    if(!block||!block.contains(end) || !answer.contains(block)){
      selected=null;forkQuote.hidden=true;return;
    }
    const blockIndex=[...answer.children].indexOf(block);
    const prefix=range.cloneRange();
    prefix.selectNodeContents(block);prefix.setEnd(range.startContainer,range.startOffset);
    const start=prefix.toString().length, text=range.toString();
    if(!text.trim()){selected=null;forkQuote.hidden=true;return;}
    selected={blockIndex,start,end:start+text.length,text};
    forkQuote.hidden=false;
  };
  answer.addEventListener('mouseup',updateSelection);
  answer.addEventListener('keyup',updateSelection);
  async function runFork(anchor) {
    forkStatus.textContent='Opening native ChatGPT Branch…';
    fork.disabled=true;forkQuote.disabled=true;
    try {await onFork(turn.id,anchor);forkStatus.textContent='Create the branch in ChatGPT; confirm it when opened.';}
    catch(error){forkStatus.textContent=error.message||'Native Branch unavailable.';}
    finally{fork.disabled=false;forkQuote.disabled=false;}
  }
  fork.addEventListener('click',()=>runFork(null));
  forkQuote.addEventListener('click',async()=>{
    if(!selected)return;
    try{
      const anchor=await quoteAnchor(selected);
      await runFork(anchor);
      // The anchor is a reference, not a reduction of ChatGPT's model context.
      forkStatus.textContent='Quote anchor recorded. Paste the quote into the new chat to focus the branch.';
    }catch(error){forkStatus.textContent=error.message||'Selection is no longer valid.';}
  });
  footer.append(source,continueButton,fork,forkQuote);
  body.append(forkStatus);
  const composer=document.createElement('form');composer.className='g-node-composer';
  const composerInput=document.createElement('textarea');composerInput.rows=1;
  composerInput.maxLength=12000;composerInput.placeholder='Ask a follow-up…';
  composerInput.setAttribute('aria-label','Follow-up prompt in ChatGPT');
  const send=document.createElement('button');send.type='submit';send.className='g-node-send';
  send.title='Send through ChatGPT';send.setAttribute('aria-label','Send in ChatGPT');
  send.append(icon('navigate',15));
  send.disabled=true;
  composer.append(composerInput,send);
  composerInput.addEventListener('input',()=>{
    send.disabled=!composerInput.value.trim();
    composer.classList.toggle('expanded',composerInput.value.includes('\n')||composerInput.scrollHeight>39);
    composerInput.style.height='auto';
    composerInput.style.height=Math.min(118,Math.max(24,composerInput.scrollHeight))+'px';
  });
  composerInput.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){
      event.preventDefault();composer.requestSubmit();
    }
  });
  composer.addEventListener('submit',async event=>{
    event.preventDefault();
    const prompt=composerInput.value.trim();
    if(!prompt||!card.classList.contains('g-latest'))return;
    send.disabled=true;
    try{
      const response=await onSend(prompt);
      if(response?.status==='activated')composerInput.value='';
      else if(response?.status==='prepared')composerInput.value='';
    }catch(error){
      composerInput.title=error?.message||'Failed to use native ChatGPT composer';
    }finally{send.disabled=!composerInput.value.trim();}
  });
  card.append(head,body,footer,composer);
  let blocks=[],lastAnswer='';
  card._update=(next,idx,latest)=>{
    if(Number.isInteger(idx))label.textContent=String(idx+1).padStart(2,'0');
    origin.textContent=latest?'Latest':'';
    card.classList.toggle('g-latest',!!latest);
    continueButton.lastChild.textContent=latest?' Continue':' Open in ChatGPT';
    if(question.textContent!==next.prompt)question.textContent=next.prompt;
    // Reconcile one individual answer block at a time. Streaming doesn't
    // replace the card or reset user selection elsewhere in the graph.
    if(next.answer!==lastAnswer) {
      lastAnswer=next.answer;
      const nextBlocks=next.answerBlocks?.length?next.answerBlocks:
        next.answer?[{kind:'paragraph',text:next.answer}]:[];
      for(let i=0;i<nextBlocks.length;i++){
        const data=nextBlocks[i];const prev=blocks[i];
        if(!prev||prev.kind!==data.kind){
          const element=createBlock(data);
          if(prev)prev.element.replaceWith(element);else answer.append(element);
          blocks[i]={element,kind:data.kind,text:data.text};
        }else if(prev.text!==data.text){
          prev.text=data.text;prev.element.textContent=data.text;
        }
      }
      while(blocks.length>nextBlocks.length)blocks.pop().element.remove();
    }
    placeholder.textContent=next.pending?'Waiting for ChatGPT response…':'';
    placeholder.hidden=!next.pending;
  };
  card._update(turn,index,isLatest);
  return card;
}

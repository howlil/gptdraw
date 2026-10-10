import { control,icon } from '../../../components/ui/icons.mjs';
import {readAnswerSelection,selectionForAnswer} from './selection.mjs';

import { createResponseBlock } from './ResponseBlock.mjs';

export function createChatCard(turn,{index,onSource,onFocus,onCompose,onSend,onFork,onRead,onCompare,onBookmark,onSelection,isLatest=false}) {
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
  source.addEventListener('click',async()=>{
    source.disabled=true;forkStatus.textContent='Locating original message…';
    try{await onSource(turn.userId);forkStatus.textContent='';}
    catch(error){forkStatus.textContent=error.message;}
    finally{source.disabled=false;}
  });
  const continueButton=document.createElement('button');continueButton.type='button';
  continueButton.className='g-text-action';
  continueButton.append(icon('navigate',13),document.createTextNode(' Continue'));
  continueButton.addEventListener('click',()=>{
    if(card.classList.contains('g-latest'))composerInput.focus();
    else runFork(null); // Earlier path must create a real native child first.
  });
  const fork=document.createElement('button');fork.type='button';
  fork.className='g-text-action';fork.textContent='Fork';
  fork.title='Use ChatGPT native Branch in new chat';
  const forkStatus=document.createElement('span');forkStatus.className='g-fork-status';
  forkStatus.setAttribute('role','status');
  const announceSelection=()=>{
    const selection=selectionForAnswer(answer);
    const quote=readAnswerSelection(answer,selection);
    onSelection?.(quote?{...quote,turnId:turn.id}:null);
  };
  answer.addEventListener('mouseup',announceSelection);
  answer.addEventListener('keyup',announceSelection);
  answer.addEventListener('touchend',()=>requestAnimationFrame(announceSelection));
  async function runFork(anchor) {
    forkStatus.textContent='Opening native ChatGPT Branch…';
    fork.disabled=true;
    try {
      await onFork(turn.id,anchor);
      forkStatus.textContent='Create the branch in ChatGPT; confirm it when opened.';
      return true;
    } catch(error){
      forkStatus.textContent=error.message||'Native Branch unavailable.';
      return false;
    } finally {fork.disabled=false;}
  }
  fork.addEventListener('click',()=>runFork(null));
  const read=control('Read full answer','book',()=>onRead(turn.id));
  read.classList.add('g-card-footer-icon');
  const compare=control('Select card for comparison','columns',()=>onCompare(turn.id));
  compare.classList.add('g-card-footer-icon');
  const bookmark=control('Bookmark card','bookmark',async()=>{
    bookmark.disabled=true;
    try{await onBookmark(turn.id);}
    catch(error){forkStatus.textContent=error?.message||'Bookmark failed.';}
    finally{bookmark.disabled=false;}
  });
  bookmark.classList.add('g-card-footer-icon');
  footer.append(source,continueButton,fork,read,compare,bookmark);
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
  let blocks=[],lastAnswer='',lastBlockRefs=[];
  card._setBookmark=enabled=>{
    bookmark.classList.toggle('g-is-bookmarked',!!enabled);
    bookmark.title=enabled?'Remove bookmark':'Bookmark card';
    bookmark.setAttribute('aria-label',bookmark.title);
  };
  card._setCompare=enabled=>{
    compare.classList.toggle('g-is-comparing',!!enabled);
    compare.title=enabled?'Remove from comparison':'Select card for comparison';
  };
  card._update=(next,idx,latest)=>{
    if(Number.isInteger(idx))label.textContent=String(idx+1).padStart(2,'0');
    origin.textContent=latest?'Latest':'';
    card.classList.toggle('g-latest',!!latest);
    continueButton.lastChild.textContent=latest?' Continue':' Continue as branch';
    if(question.textContent!==next.prompt)question.textContent=next.prompt;
    // Reconcile one individual answer block at a time. Streaming doesn't
    // replace the card or reset user selection elsewhere in the graph.
    const nextBlocks=next.answerBlocks?.length?next.answerBlocks:
      next.answer?[{kind:'paragraph',text:next.answer}]:[];
    if(next.answer!==lastAnswer || nextBlocks.length!==lastBlockRefs.length ||
        nextBlocks.some((block,i)=>block!==lastBlockRefs[i])){
      lastAnswer=next.answer;
      for(let i=0;i<nextBlocks.length;i++){
        const data=nextBlocks[i],prev=blocks[i];
        if(prev?.data===data)continue;
        if(prev?.data?.kind==='paragraph' && data.kind==='paragraph' &&
            !prev.data.inline && !data.inline){
          if(prev.element.textContent!==data.text)prev.element.textContent=data.text||'';
          blocks[i]={element:prev.element,data};continue;
        }
        if(prev?.data?.kind==='code' && data.kind==='code' &&
            prev.data.language===data.language){
          const code=prev.element.querySelector('code');
          if(code)code.textContent=data.text||'';
          blocks[i]={element:prev.element,data};continue;
        }
        const element=createResponseBlock(data);
        if(prev)prev.element.replaceWith(element);else answer.append(element);
        blocks[i]={element,data};
      }
      while(blocks.length>nextBlocks.length)blocks.pop().element.remove();
      lastBlockRefs=nextBlocks.slice();
    }
    placeholder.textContent=next.pending?'Waiting for ChatGPT response…':'';
    placeholder.hidden=!next.pending;
  };
  card._update(turn,index,isLatest);
  return card;
}

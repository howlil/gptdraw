import { icon } from '../../../components/ui/icons.mjs';

// Empty-route state is a variation of the same Dialogue card used for turns.
// An existing conversation with no DOM messages is LOADING, not a new chat.
export function createStartCard(onStart) {
  const card=document.createElement('article');
  card.className='g-card g-start-card g-latest';
  card.style.left='130px';card.style.top='140px';

  const head=document.createElement('header');head.className='g-card-head';
  const number=document.createElement('span');number.className='g-card-label';number.textContent='01';
  const origin=document.createElement('span');origin.className='g-card-origin';
  head.append(number,origin);

  const body=document.createElement('div');body.className='g-card-body';
  const title=document.createElement('h2');title.className='g-start-heading';
  const description=document.createElement('p');description.className='g-start-hint';
  const status=document.createElement('p');status.className='g-start-status';
  status.setAttribute('role','status');
  body.append(title,description,status);

  const form=document.createElement('form');form.className='g-node-composer g-start-composer';
  const input=document.createElement('textarea');input.rows=1;input.maxLength=12000;
  input.placeholder='Message ChatGPT…';input.setAttribute('aria-label','Message to ChatGPT');
  const send=document.createElement('button');send.type='submit';send.className='g-node-send';
  send.setAttribute('aria-label','Send in ChatGPT');send.title='Send through ChatGPT';
  send.append(icon('navigate',15));send.disabled=true;
  form.append(input,send);card.append(head,body,form);

  function setRoute(route,historyStatus='idle') {
    const existing=route.startsWith('conversation:');
    card.classList.toggle('g-start-loading',existing);
    origin.textContent=existing?'Conversation':'New conversation';
    const unavailable=existing&&['unavailable','limited'].includes(historyStatus);
    title.textContent=existing
      ? unavailable?'Conversation not detected yet':'Loading conversation…'
      : 'Start a conversation';
    description.textContent=existing
      ? unavailable
        ? 'ChatGPT has not exposed compatible message turns. Try Sync or return to ChatGPT.'
        : 'Waiting for ChatGPT to render the conversation. Available history will appear as cards.'
      : 'Ask ChatGPT. Your messages will appear as connected cards.';
    form.hidden=existing;
    status.textContent='';
  }
  input.addEventListener('input',()=>{
    send.disabled=!input.value.trim();status.textContent='';
    form.classList.toggle('expanded',input.value.includes('\n')||input.scrollHeight>39);
    input.style.height='auto';
    input.style.height=Math.min(118,Math.max(24,input.scrollHeight))+'px';
  });
  input.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){
      event.preventDefault();form.requestSubmit();
    }
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const draft=input.value.trim();if(!draft||form.hidden)return;
    send.disabled=true;status.textContent='Sending through ChatGPT…';
    try {
      const result=await onStart(draft);
      status.textContent=result?.status==='activated'
        ? 'Waiting for the conversation to appear…'
        : 'Draft prepared in ChatGPT. Finish sending there.';
    }catch(error){
      status.textContent=error?.message||'Unable to use the native ChatGPT composer.';
    }finally{send.disabled=!input.value.trim();}
  });
  setRoute('route:/');
  return {element:card,setRoute,focus(){if(!form.hidden)input.focus({preventScroll:true});}};
}

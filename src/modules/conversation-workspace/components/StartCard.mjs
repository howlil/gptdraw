import { icon } from '../../../components/ui/icons.mjs';

export function createStartCard(onStart) {
  const card=document.createElement('article');
  card.className='g-card g-start-card';
  card.style.left='130px';card.style.top='140px';
  const head=document.createElement('header');
  head.className='g-card-head';
  head.append(icon('message',15));
  const label=document.createElement('span');label.className='g-card-label';
  label.textContent='New conversation';head.append(label);
  const content=document.createElement('div');content.className='g-card-body';
  const intro=document.createElement('p');intro.className='g-start-heading';
  intro.textContent='What would you like to explore?';
  const hint=document.createElement('p');hint.className='g-start-hint';
  hint.textContent='Uses the ChatGPT model and conversation in this tab.';
  const form=document.createElement('form');form.className='g-start-composer';
  const input=document.createElement('textarea');
  input.rows=2;input.maxLength=12000;
  input.placeholder='Ask ChatGPT…';input.setAttribute('aria-label','Message to ChatGPT');
  const actions=document.createElement('div');actions.className='g-start-actions';
  const status=document.createElement('span');status.className='g-start-status';
  status.setAttribute('role','status');
  const send=document.createElement('button');send.type='submit';
  send.className='g-primary-control';send.textContent='Send';send.disabled=true;
  actions.append(status,send);form.append(input,actions);
  content.append(intro,hint,form);card.append(head,content);
  input.addEventListener('input',()=>{send.disabled=!input.value.trim();status.textContent='';});
  input.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing) {
      event.preventDefault();form.requestSubmit();
    }
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const draft=input.value.trim();if(!draft)return;
    send.disabled=true;status.textContent='Connecting to ChatGPT…';
    try {
      const result=await onStart(draft);
      if(result?.status==='activated') {
        status.textContent='Waiting for ChatGPT to create the conversation…';
        // Retain text until a native turn is seen, in case submit fails.
      } else if(result?.status==='prepared') {
        status.textContent='Draft prepared in ChatGPT. Finish sending there.';
      }
    } catch(error) {
      status.textContent=error?.message || 'Unable to send through ChatGPT.';
    } finally {send.disabled=!input.value.trim();}
  });
  return {
    element:card,
    setRoute(route) {
      label.textContent=route.startsWith('conversation:')?'ChatGPT conversation':'New conversation';
      hint.textContent=route.startsWith('conversation:')
        ? 'No compatible message turns were detected yet. Sync the page or send a new message through ChatGPT.'
        : 'Uses the ChatGPT model and composer in this tab.';
    },
    focus() {input.focus({preventScroll:true});}
  };
}

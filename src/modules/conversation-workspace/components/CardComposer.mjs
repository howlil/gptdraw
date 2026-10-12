import { icon } from '../../../components/ui/icons.mjs';

// Shared, native-composer-backed input for entry and latest conversation card.
// No model/runtime ownership: callers implement user-initiated native handoff.
export function createCardComposer({placeholder='Message ChatGPT…',label='Message to ChatGPT',onSubmit}={}) {
  const element=document.createElement('form');
  element.className='g-node-composer';
  const input=document.createElement('textarea');
  input.rows=1;
  input.maxLength=12000;
  input.placeholder=placeholder;
  input.setAttribute('aria-label',label);
  const hint=document.createElement('span');
  hint.className='g-compose-hint';
  hint.textContent='Enter to send · Shift+Enter for a line';
  const send=document.createElement('button');
  send.type='submit';
  send.className='g-node-send';
  send.title='Send through ChatGPT';
  send.setAttribute('aria-label','Send in ChatGPT');
  send.append(icon('navigate',15));
  send.disabled=true;
  const status=document.createElement('p');
  status.className='g-composer-status';
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  status.hidden=true;
  element.append(input,hint,send,status);
  let busy=false;
  function setStatus(message='') {
    status.textContent=message;
    status.hidden=!message;
  }
  function resize() {
    input.style.height='auto';
    input.style.height=Math.min(96,Math.max(23,input.scrollHeight||23))+'px';
    element.classList.toggle('expanded',input.value.includes('\n')||(input.scrollHeight||23)>39);
  }
  function sync() {
    send.disabled=busy||!input.value.trim();
    resize();
  }
  input.addEventListener('input',()=>{setStatus();sync();});
  input.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){
      event.preventDefault();
      element.requestSubmit();
    }
  });
  element.addEventListener('submit',async event=>{
    event.preventDefault();
    const draft=input.value.trim();
    if(!draft||busy||element.hidden)return;
    busy=true;sync();
    try {
      await onSubmit?.(draft,{setStatus});
    } catch(error) {
      setStatus(error?.message||'ChatGPT composer is unavailable.');
    } finally {
      busy=false;sync();
    }
  });
  return {element,input,send,status,setStatus,sync,focus:()=>input.focus(),clear(){
    input.value='';setStatus();sync();
  }};
}

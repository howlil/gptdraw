import { createDialogueCard } from './DialogueCard.mjs';
import { createCardComposer } from './CardComposer.mjs';

// Empty and unavailable conversation are states of the SAME DialogueCard as a real turn.
export function createStartCard(onStart) {
  const shell=createDialogueCard({variant:'start',number:'01',origin:'New conversation'});
  const card=shell.element;
  card.className+=' g-start-card g-latest';
  card.style.left='0px';
  card.style.top='0px';
  shell.headActions.hidden=true;

  const title=document.createElement('h2');
  title.className='g-start-heading';
  const description=document.createElement('p');
  description.className='g-start-hint';
  shell.body.append(title,description);

  const composer=createCardComposer({
    placeholder:'Message ChatGPT…',
    label:'Message to ChatGPT',
    onSubmit:async(draft,{setStatus})=>{
      setStatus('Sending through ChatGPT…');
      const result=await onStart(draft);
      if(result?.status==='activated'){
        setStatus('Waiting for the conversation to appear…');
      }else{
        setStatus('Draft prepared in ChatGPT. Finish sending there.');
      }
    }
  });
  composer.element.className+=' g-start-composer';
  card.append(composer.element);

  function setRoute(route,historyStatus='idle') {
    const existing=route.startsWith('conversation:');
    const unavailable=existing&&['unavailable','limited'].includes(historyStatus);
    shell.setVariant(existing?(unavailable?'unavailable':'loading'):'start');
    shell.setHeader('01',existing?'Conversation':'New conversation');
    title.textContent=existing
      ? unavailable?'Conversation not detected yet':'Loading conversation…'
      : 'What would you like to explore?';
    description.textContent=existing
      ? unavailable
        ? 'ChatGPT has not exposed compatible message turns. Try Sync or return to ChatGPT.'
        : 'Waiting for ChatGPT to render the conversation. Available history will appear as cards.'
      : 'Your conversation will grow into connected cards.';
    composer.element.hidden=existing;
    composer.setStatus();
  }
  setRoute('route:/');
  return {element:card,setRoute,focus(){if(!composer.element.hidden)composer.focus();}};
}

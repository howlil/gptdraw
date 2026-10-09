import { createGraphCanvas } from './components/GraphCanvas.mjs';
import { control, icon } from '../../components/ui/icons.mjs';

export function createConversationWorkspace({ onClose, onSource, onCompose, onRefresh, onMove, onStart }) {
  const wrapper=document.createElement('div'); wrapper.className='g-workspace'; wrapper.hidden=true;
  const header=document.createElement('header'); header.className='g-topbar';
  const branding=document.createElement('div'); branding.className='g-brand';
  branding.append(icon('graph',22));
  const brandingText=document.createElement('div');
  const title=document.createElement('strong');title.textContent='gptdraw';
  const subtitle=document.createElement('span');subtitle.textContent='Conversation graph';
  brandingText.append(title,subtitle);branding.append(brandingText);
  const tools=document.createElement('div');tools.className='g-toolbar';
  const count=document.createElement('span');count.className='g-turn-count';
  tools.append(count,control('Sync current conversation','refresh',onRefresh));
  const compose=document.createElement('button');compose.type='button';
  compose.className='g-primary-control';compose.append(icon('message',15));
  compose.append(document.createTextNode(' Compose in ChatGPT'));
  compose.addEventListener('click',onCompose); tools.append(compose,control('Close canvas','close',onClose));
  header.append(branding,tools);wrapper.append(header);
  const canvas=createGraphCanvas({onSource,onMove,onStart});
  wrapper.append(canvas.element);
  const footer=document.createElement('footer');footer.className='g-footer';
  footer.innerHTML='<span>Move cards by dragging their header · Ctrl/⌘ + scroll to zoom</span><span>ChatGPT owns responses · Layout stored locally</span>';
  wrapper.append(footer);
  return {
    element:wrapper,
    show(){wrapper.hidden=false;},
    hide(){wrapper.hidden=true;},
    render(state, change){
      if(change?.type!=='patch' && change?.type!=='position')
        count.textContent=state.turns.length+' '+(state.turns.length===1?'turn':'turns');
      canvas.reconcile(state,change);
    }
  };
}

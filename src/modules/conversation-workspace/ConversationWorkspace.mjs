import { createGraphCanvas } from './components/GraphCanvas.mjs';
import { control, icon } from '../../components/ui/icons.mjs';

export function createConversationWorkspace({ onClose, onSource, onCompose, onRefresh, onMove, onStart, onSend }) {
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
  const historyLabel=document.createElement('span');historyLabel.className='g-history-status';
  historyLabel.setAttribute('role','status');historyLabel.setAttribute('aria-live','polite');
  tools.append(historyLabel,count,control('Load earlier messages / Sync','refresh',onRefresh));
  const compose=document.createElement('button');compose.type='button';
  compose.className='g-primary-control';compose.append(icon('message',15));
  compose.append(document.createTextNode(' Back to ChatGPT'));
  compose.addEventListener('click',onClose); tools.append(compose,control('Close canvas','close',onClose));
  header.append(branding,tools);wrapper.append(header);
  const canvas=createGraphCanvas({onSource,onMove,onStart,onCompose,onSend});
  wrapper.append(canvas.element);
  const footer=document.createElement('footer');footer.className='g-footer';
  footer.innerHTML='<span>Drag card headers to move · Ctrl/⌘ + wheel to zoom · Use Fit for overview</span><span>ChatGPT owns the conversation</span>';
  wrapper.append(footer);
  return {
    element:wrapper,
    show(){wrapper.hidden=false;},
    hide(){wrapper.hidden=true;},
    render(state, change){
      const status=state.history?.status || 'idle';
      const labels={
        loading:'Loading conversation history…',
        'reached-top':'Scanned available history',
        limited:'Some earlier messages may be unavailable',
        unavailable:'Only rendered messages available',
        idle:'',cancelled:''
      };
      historyLabel.textContent=labels[status] || '';
      if(status==='loading'&&state.history?.count>0)
        historyLabel.textContent='Scanning history · '+Math.floor(state.history.count/2)+' turns';
      historyLabel.hidden=!historyLabel.textContent;
      if(change?.type==='history')return;
      if(change?.type!=='patch' && change?.type!=='position')
        count.textContent=state.turns.length+' '+(state.turns.length===1?'turn':'turns');
      canvas.reconcile(state,change);
    }
  };
}

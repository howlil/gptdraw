import { createGraphCanvas } from './components/GraphCanvas.mjs';
import { control, icon } from '../../components/ui/icons.mjs';

export function createConversationWorkspace({ onClose, onSource, onCompose, onRefresh, onMove, onStart, onSend,
  onFork, onConfirmBranch, onDismissBranch, onOpenConversation }) {
  const wrapper=document.createElement('div'); wrapper.className='g-workspace'; wrapper.hidden=true;
  const header=document.createElement('header'); header.className='g-topbar';
  const branding=document.createElement('div'); branding.className='g-brand';
  branding.append(icon('graph',22));
  const brandingText=document.createElement('div');
  const title=document.createElement('strong');title.textContent='gptdraw';
  const subtitle=document.createElement('span');subtitle.textContent='Conversation graph';
  brandingText.append(title,subtitle);branding.append(brandingText);
  const tools=document.createElement('div');tools.className='g-toolbar';
  const search=document.createElement('input');search.className='g-find-input';
  search.type='search';search.placeholder='Find card';
  search.setAttribute('aria-label','Find conversation card');
  search.addEventListener('input',()=>canvas.search(search.value));
  const count=document.createElement('span');count.className='g-turn-count';
  const historyLabel=document.createElement('span');historyLabel.className='g-history-status';
  historyLabel.setAttribute('role','status');historyLabel.setAttribute('aria-live','polite');
  tools.append(search,control('Show conversation outline','list',()=>canvas.toggleOutline()),historyLabel,count,control('Load earlier messages / Sync','refresh',onRefresh));
  const compose=document.createElement('button');compose.type='button';
  compose.className='g-primary-control';compose.append(icon('message',15));
  compose.append(document.createTextNode(' Back to ChatGPT'));
  compose.addEventListener('click',onClose); tools.append(compose,control('Close canvas','close',onClose));
  header.append(branding,tools);wrapper.append(header);
  const branchNotice=document.createElement('div');branchNotice.className='g-branch-notice';branchNotice.hidden=true;
  branchNotice.setAttribute('role','status');
  const noticeText=document.createElement('span');noticeText.className='g-branch-message';
  const confirm=document.createElement('button');confirm.type='button';confirm.textContent='Link this branch';
  const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='Dismiss';
  const branchError=document.createElement('span');branchError.className='g-branch-error';
  branchNotice.append(noticeText,confirm,dismiss,branchError);wrapper.append(branchNotice);
  confirm.addEventListener('click',async()=>{confirm.disabled=true;try{await onConfirmBranch();}catch(error){branchError.textContent=error.message;}finally{confirm.disabled=false;}});
  dismiss.addEventListener('click',async()=>{try{await onDismissBranch();}catch(error){branchError.textContent=error.message;}});
  const canvas=createGraphCanvas({onSource,onMove,onStart,onCompose,onSend,onFork,onOpenConversation});
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
      const pending=state.pendingBranch;
      const current=state.route?.startsWith('conversation:')?state.route.slice(13):null;
      const canConfirm=!!pending&&!!current&&pending.parentConversationId!==current;
      branchNotice.hidden=!pending&&!state.branchError;
      noticeText.textContent=canConfirm
        ? 'Native branch detected? Confirm only if this chat was created from the selected message.'
        : pending?'Fork requested. Finish creating the new chat in ChatGPT.':'';
      confirm.hidden=!canConfirm;
      branchError.textContent=state.branchError || '';
      if(change?.type==='history')return;
      if(change?.type!=='patch' && change?.type!=='position')
        count.textContent=state.turns.length+' '+(state.turns.length===1?'turn':'turns');
      canvas.reconcile(state,change);
    }
  };
}

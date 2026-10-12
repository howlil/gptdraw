import { createGraphCanvas } from './components/GraphCanvas.mjs';
import { deriveWorkspaceMode } from './core/view-mode.mjs';
import { control, icon } from '../../components/ui/icons.mjs';
import { createDiagnosticsPanel } from './components/DiagnosticsPanel.mjs';

export function createConversationWorkspace({ onClose, onSource, onCompose, onRefresh, onMove, onStart, onSend,
  onFork, onAskQuote, onBookmark, onConfirmBranch, onDismissBranch, onOpenConversation, onDiagnostics, onActivity }) {
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
  search.addEventListener('input',()=>{onActivity?.();canvas.search(search.value);});
  const count=document.createElement('span');count.className='g-turn-count';
  const historyLabel=document.createElement('span');historyLabel.className='g-history-status';
  historyLabel.setAttribute('role','status');historyLabel.setAttribute('aria-live','polite');
  const diagnostics=createDiagnosticsPanel(()=>Promise.resolve({...onDiagnostics(),...canvas.stats()}));
  const outlineButton=control('Show conversation outline','list',()=>canvas.toggleOutline());
  const menu=document.createElement('div');
  menu.className='g-tools-menu';
  menu.hidden=true;
  const syncButton=document.createElement('button');
  syncButton.type='button';syncButton.append(icon('refresh',15),document.createTextNode(' Sync earlier messages'));
  syncButton.addEventListener('click',()=>{menu.hidden=true;onRefresh();});
  const diagnosticButton=document.createElement('button');
  diagnosticButton.type='button';
  diagnosticButton.append(icon('focus',15),document.createTextNode(' Compatibility diagnostics'));
  diagnosticButton.addEventListener('click',()=>{menu.hidden=true;diagnostics.open();});
  menu.append(syncButton,diagnosticButton);
  const moreButton=control('More workspace tools','more',()=>{
    menu.hidden=!menu.hidden;
    moreButton.setAttribute('aria-expanded',String(!menu.hidden));
  });
  moreButton.setAttribute('aria-expanded','false');
  const compose=document.createElement('button');compose.type='button';
  compose.className='g-primary-control';compose.textContent='Back to ChatGPT';
  compose.addEventListener('click',onClose);
  tools.append(search,outlineButton,historyLabel,count,moreButton,compose);
  header.append(branding,tools,menu);wrapper.append(header);
  const branchNotice=document.createElement('div');branchNotice.className='g-branch-notice';branchNotice.hidden=true;
  branchNotice.setAttribute('role','status');
  const noticeText=document.createElement('span');noticeText.className='g-branch-message';
  const confirm=document.createElement('button');confirm.type='button';confirm.textContent='Link this branch';
  const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='Dismiss';
  const branchError=document.createElement('span');branchError.className='g-branch-error';
  branchNotice.append(noticeText,confirm,dismiss,branchError);wrapper.append(branchNotice);
  confirm.addEventListener('click',async()=>{confirm.disabled=true;try{await onConfirmBranch();}catch(error){branchError.textContent=error.message;}finally{confirm.disabled=false;}});
  dismiss.addEventListener('click',async()=>{try{await onDismissBranch();}catch(error){branchError.textContent=error.message;}});
  const canvas=createGraphCanvas({onSource,onMove,onStart,onCompose,onSend,onFork,onAskQuote,onBookmark,onOpenConversation,onActivity,
    onSearchChange:value=>{search.value=value;}});
  wrapper.append(canvas.element);
  wrapper.append(diagnostics.element);
  const footer=document.createElement('footer');footer.className='g-footer';
  footer.innerHTML='<span>J / K navigate · R read · B branches · F fit · / find · Esc return</span><span>Native ChatGPT owns all AI responses</span>';
  wrapper.append(footer);
  wrapper.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey)return;
    if(event.key==='Escape'&&!menu.hidden){
      event.stopPropagation();event.preventDefault();
      menu.hidden=true;moreButton.setAttribute('aria-expanded','false');return;
    }
    if(event.key==='Escape'&&canvas.selectionOpen()){
      event.stopPropagation();event.preventDefault();canvas.hideSelection();return;
    }
    if(event.key==='Escape'&&canvas.inspectorOpen()){
      event.stopPropagation();event.preventDefault();canvas.closeInspector();return;
    }
    if(event.key==='Escape'&&canvas.outlineOpen){
      event.stopPropagation();event.preventDefault();canvas.closeOutline();
      if(wrapper.clientWidth<=570)outlineButton.focus();else search.focus();
      return;
    }
    const element=event.target;
    if(element?.matches?.('input,textarea,select,[contenteditable="true"]'))return;
    const key=event.key.toLowerCase();
    if(key==='/'&&!search.hidden){
      event.preventDefault();
      if(wrapper.clientWidth<=570)canvas.focusSearch();
      else {search.focus();search.select();}
      return;
    }
    if(key==='j'||key==='k'){event.preventDefault();canvas.nextTurn(key==='j'?1:-1);}
    if(key==='r'){event.preventDefault();canvas.readFocused();}
    if(key==='b'){event.preventDefault();canvas.focusBranches();}
    if(key==='f'){event.preventDefault();canvas.fit();}
  });
  return {
    element:wrapper,
    show(){wrapper.hidden=false;},
    hide(){canvas.hideSelection();menu.hidden=true;wrapper.hidden=true;},
    render(state, change){
      const status=state.history?.status || 'idle';
      const labels={
        loading:'Loading conversation history…',
        'reached-top':'Scanned available history',
        limited:'Some earlier messages may be unavailable',
        unavailable:'Only rendered messages available',
        idle:'',cancelled:'',paused:'History scan paused'
      };
      historyLabel.textContent=labels[status] || '';
      if(status==='loading'&&state.history?.count>0)
        historyLabel.textContent='Scanning history · '+Math.floor(state.history.count/2)+' turns';
      if(state.history?.unresolved>0)historyLabel.textContent+=' · '+state.history.unresolved+' unlinked history pages';
      historyLabel.hidden=!historyLabel.textContent;
      const mode=deriveWorkspaceMode(state);
      const populated=!['new','loading','unavailable'].includes(mode);
      search.hidden=state.turns.length<2;
      outlineButton.hidden=state.turns.length<2;
      count.hidden=!populated;
      if(!populated && search.value){search.value='';canvas.search('');}
      menu.hidden=true;moreButton.setAttribute('aria-expanded','false');
      const pending=state.pendingBranch;
      const current=state.route?.startsWith('conversation:')?state.route.slice(13):null;
      const canConfirm=!!pending&&!!current&&pending.parentConversationId!==current;
      branchNotice.hidden=!pending&&!state.branchError;
      noticeText.textContent=canConfirm
        ? 'Native branch detected? Confirm only if this chat was created from the selected message.'
        : pending?'Fork requested. Finish creating the new chat in ChatGPT.':'';
      confirm.hidden=!canConfirm;
      branchError.textContent=state.branchError || '';
      if(change?.type==='history' && populated)return;
      if(change?.type!=='patch' && change?.type!=='position')
        count.textContent=state.turns.length+' '+(state.turns.length===1?'turn':'turns')+' loaded';
      canvas.reconcile(state,change);
    }
  };
}

import { pairMessages, routeKey, safePoint } from '../core/graph.mjs';
import { mergeAnchoredHistory } from '../core/history.mjs';
import { conversationId, createPendingBranch, confirmBranch, branchRelations, stableMessageId } from '../core/branch.mjs';

// Single owner: native conversation is truth; this controller only projects
// visible DOM turns and persists extension-owned layout metadata.
export function createWorkspaceController({ observe, layoutStorage, branchStorage=null, prepareFork=null,
  onUpdate, pathname = () => location.pathname, idFactory = () => crypto.randomUUID(), resolveForkSource=null }) {
  let route = routeKey(pathname());
  let messages = [], turns = [], positions = {};
  let history = {status:'idle',steps:0};
  let branches=[],pendingBranch=null,branchError=null,bookmarks=[];
  const volatilePreviews=new Map(); // Up to eight loaded conversations, never Chrome Storage.
  let running = false, storeTimer = 0, generation = 0, lifecycle=0;
  let pendingLayout=null,writeTail=Promise.resolve(),unresolved=[];
  let structuralTimer=null;
  const contentSignatures=new Map();
  // A virtualized DOM may recycle conversation-turn-0..N on every viewport.
  // Session IDs prevent collisions; exact window/content re-identification is
  // volatile and never grants a durable ID for bookmarks or native branching.
  let observedOrdinal=0;
  let lastVisibleByNative=new Map();
  const observedWindows=new Map();
  const contentKey=row=>row.role+'\0'+row.text;
  function normalizeVisible(items){
    if(!items.length)return items;
    const fingerprint=items.map(contentKey).join('\u0002');
    const windowIds=observedWindows.get(fingerprint);
    const knownByText=new Map(),counts=new Map(),visibleCounts=new Map();
    for(const row of messages){
      const key=contentKey(row);
      counts.set(key,(counts.get(key)||0)+1);
      knownByText.set(key,row);
    }
    for(const row of items){
      const key=contentKey(row);visibleCounts.set(key,(visibleCounts.get(key)||0)+1);
    }
    const nextNative=new Map(),claimed=new Set();
    const rows=items.map((row,index)=>{
      if(row.identity!=='ephemeral'){
        nextNative.set(row.id,{...row});return row;
      }
      let id=windowIds?.[index];
      const recent=lastVisibleByNative.get(row.id);
      if(!id && recent?.role===row.role && recent.text===row.text)
        id=recent.id;
      if(!id && row.text.length>=28 &&
          counts.get(contentKey(row))===1 && visibleCounts.get(contentKey(row))===1)
        id=knownByText.get(contentKey(row))?.id;
      if(!id || claimed.has(id))id=row.role+':observed:'+ ++observedOrdinal;
      claimed.add(id);
      const normalized={...row,id,nativeId:row.id,identity:'ephemeral'};
      nextNative.set(row.id,normalized);
      return normalized;
    });
    lastVisibleByNative=nextNative;
    if(!observedWindows.has(fingerprint)){
      observedWindows.set(fingerprint,rows.map(row=>row.id));
      if(observedWindows.size>400)observedWindows.delete(observedWindows.keys().next().value);
    }
    return rows;
  }
  let observer = null;
  let unsubscribeBranches=()=>{};
  let messageIndex = new Map(), turnIndex = new Map();
  const notify = change => onUpdate({ route, turns, positions, history, bookmarks,
    previews:Object.fromEntries(volatilePreviews), branches, pendingBranch,
    branchError, relations:branchRelations(branches,conversationId(route)) }, change);
  const cacheLatest=()=>{
    const key=conversationId(route);
    const turn=turns[turns.length-1];
    if(!key || !turn || !turn.answer)return;
    // Keep a bounded display snapshot that originated from the actual DOM.
    if(volatilePreviews.has(key))volatilePreviews.delete(key);
    volatilePreviews.set(key,turn);
    while(volatilePreviews.size>8)volatilePreviews.delete(volatilePreviews.keys().next().value);
  };
  const refresh = () => {
    if(structuralTimer!==null){clearTimeout(structuralTimer);structuralTimer=null;}
    turns = pairMessages(messages);
    messageIndex = new Map(messages.map((m,i) => [m.id,i]));
    turnIndex = new Map();
    turns.forEach((turn,i) => {
      turnIndex.set(turn.userId,i);
      if (turn.assistantId) turnIndex.set(turn.assistantId,i);
    });
    cacheLatest();notify({ type:'snapshot' });
  };
  const scheduleRefresh=()=>{
    if(!turns.length || history.status!=='loading'){refresh();return;}
    if(structuralTimer!==null)return;
    structuralTimer=setTimeout(()=>{structuralTimer=null;if(running)refresh();},170);
  };
  async function loadRoute(path) {
    if(structuralTimer!==null){clearTimeout(structuralTimer);structuralTimer=null;}
    contentSignatures.clear();
    observedOrdinal=0;lastVisibleByNative.clear();observedWindows.clear();
    flushLayout();
    route = routeKey(path);
    const seq = ++generation;
    positions = {};bookmarks=[];unresolved=[];
    messages = [];
    turns = [];
    history={status:'idle',steps:0};branchError=null;
    branches=[];pendingBranch=null;
    messageIndex.clear();turnIndex.clear();
    notify({ type:'route' });
    try {
      const [restored,existing,pending,loadedBookmarks]=await Promise.all([
        layoutStorage.read(route),branchStorage?.list?.() ?? [],branchStorage?.pending?.() ?? null,
        layoutStorage.readBookmarks?.(route) ?? []
      ]);
      if (seq === generation && running) {
        positions=restored;branches=existing;pendingBranch=pending;
        bookmarks=loadedBookmarks;notify({type:'layout'});
      }
    } catch {
      // Native conversation reading remains usable if layout storage fails.
      if (seq === generation && running) notify({ type:'layout' });
    }
  }
  async function reloadBranchState(){
    if(!branchStorage)return;
    const seq=generation;
    try{
      const [records,pending]=await Promise.all([branchStorage.list(),branchStorage.pending()]);
      if(seq!==generation || !running)return;
      branches=records;pendingBranch=pending;notify({type:'branch'});
    }catch{/* Keep current canvas usable if extension storage is unavailable. */}
  }
  const callbacks = {
    onSnapshot(items,observation={}) {
      if(!running)return {count:messages.length,firstId:messages[0]?.id??null};
      items=normalizeVisible(items);
      // Compare only the currently scanned DOM window, not every old message
      // accumulated in RAM. Reuse prior records for unchanged windows.
      const previous=new Map(messages.map(row=>[row.id,row]));
      const normalized=items.map(row=>{
        const signature=row.role+'\0'+row.text+'\0'+JSON.stringify(row.blocks||[]);
        const old=previous.get(row.id);
        const matches=old && contentSignatures.get(row.id)===signature;
        contentSignatures.set(row.id,signature);
        return matches?old:row;
      });
      const merged=mergeAnchoredHistory(messages,normalized,unresolved,
        history.status==='loading'&&history.phase==='up',observation);
      unresolved=merged.unresolved;
      const changed=merged.messages.length!==messages.length ||
        merged.messages.some((row,i)=>row!==messages[i]);
      messages=merged.messages;
      if(changed)scheduleRefresh();
      return {count:messages.length,firstId:messages[0]?.id??null,unresolved:unresolved.length};
    },
    onHistory(status) {
      if(!running)return;
      if(status.status!=='loading' && structuralTimer!==null)refresh();
      history={...status,unresolved:unresolved.length};notify({type:'history'});
    },
    onPatch(item) {
      if(!running)return;
      if(item.identity==='ephemeral'){
        const alias=lastVisibleByNative.get(item.id);
        if(!alias)return;
        item={...item,id:alias.id,nativeId:alias.nativeId};
        lastVisibleByNative.set(alias.nativeId,item);
      }
      if(structuralTimer!==null)refresh();
      contentSignatures.set(item.id,item.role+'\0'+item.text+'\0'+JSON.stringify(item.blocks||[]));
      const i = messageIndex.get(item.id);
      if (i === undefined) { observer?.refresh(); return; }
      messages[i] = item;
      const index = turnIndex.get(item.id);
      if (index === undefined) { refresh(); return; }
      const original = turns[index];
      const updated = original.userId === item.id
        ? { ...original, prompt:item.text }
        : { ...original, answer:item.text, answerBlocks:item.blocks || [], pending:!item.text.trim() };
      const before=original.answerBlocks||[],after=updated.answerBlocks||[];
      if (original.prompt===updated.prompt && original.answer===updated.answer &&
          before.length===after.length && before.every((block,i)=>block===after[i]))return;
      turns[index] = updated;
      if(index===turns.length-1)cacheLatest();
      notify({ type:'patch', turnId:updated.id });
    },
    onRoute(path) { if(running)loadRoute(path); }
  };
  function flushLayout(){
    clearTimeout(storeTimer);
    if(!pendingLayout)return writeTail;
    const {key,snapshot}=pendingLayout;pendingLayout=null;
    writeTail=writeTail.catch(()=>{}).then(()=>layoutStorage.write(key,snapshot));
    writeTail.catch(()=>{});
    return writeTail;
  }
  const save=()=>{
    pendingLayout={key:route,snapshot:{...positions}};
    clearTimeout(storeTimer);
    storeTimer=setTimeout(flushLayout,250);
  };
  return {
    async start() {
      if(running)return;
      running=true;
      const token=++lifecycle;
      await loadRoute(pathname());
      if(!running || token!==lifecycle)return;
      const next=observe(callbacks);
      if(!running || token!==lifecycle)return;
      observer=next;observer.start();
      unsubscribeBranches=branchStorage?.subscribe?.(reloadBranchState)||(()=>{});
    },
    stop() {
      if(!running)return;
      running=false;++lifecycle;++generation;
      flushLayout();
      if(structuralTimer!==null){clearTimeout(structuralTimer);structuralTimer=null;}
      unsubscribeBranches();unsubscribeBranches=()=>{};
      observer?.stop();observer=null;
    },
    getSource(id) { return observer?.getElement(id) || null; },
    getDiagnostics(){
      const source=observer?.getDiagnostics?.() || {};
      return {adapter:'ChatGPT rendered DOM',observerActive:running&&!!observer,
        turns:turns.length,messages:messages.length,
        stableMessages:messages.filter(m=>m.identity==='stable' ||
          (m.identity===undefined&&stableMessageId(m.id))).length,
        unresolvedSegments:unresolved.length,
        historyStatus:history.status,historyPhase:history.phase||'none',
        branchCount:branches.length,bookmarks:bookmarks.length,...source};
    },
    refresh() { observer?.refresh();observer?.loadEarlier?.(); },
    pauseHistory() { observer?.pauseHistory?.(); },
    markInteraction() { observer?.markInteraction?.(); },
    async toggleBookmark(id) {
      if(!stableMessageId(id) || !turns.some(t=>t.id===id))
        throw new Error('This turn has no durable source ID for a persistent bookmark.');
      const previous=bookmarks;
      const next=previous.includes(id)?previous.filter(x=>x!==id):[...previous,id];
      if(next.length>500)throw new Error('Bookmark limit reached.');
      bookmarks=next;notify({type:'bookmark',turnId:id});
      try {await layoutStorage.writeBookmarks(route,next);}
      catch(error){bookmarks=previous;notify({type:'bookmark',turnId:id});throw error;}
      return next.includes(id);
    },
    async fork(turnId, anchor=null) {
      if(!branchStorage || !prepareFork)throw new Error('Native branching is unavailable.');
      const parentConversationId=conversationId(route);
      const turn=turns.find(t=>t.id===turnId);
      if(!parentConversationId || !turn?.assistantId)
        throw new Error('Open an existing ChatGPT conversation with a completed assistant answer.');
      if(!stableMessageId(turn.assistantId))
        throw new Error('This response lacks a durable message ID. Native Fork remains available in ChatGPT, but gptdraw cannot safely save its lineage.');
      // One user action at a time; reserve atomic intent only after the real
      // native menu is found. Identity/route are rechecked after scrolling.
      const existingIntent=await branchStorage.pending();
      if(existingIntent)throw new Error('Finish or dismiss the previous Fork before starting another.');
      observer?.pauseHistory?.();
      const forkRoute=route, token=lifecycle;
      let node=observer?.getElement(turn.assistantId);
      if(!node?.isConnected && resolveForkSource)
        node=await resolveForkSource(turn.assistantId);
      if(!node?.isConnected)
        throw new Error('The exact native source response could not be recovered.');
      if(!running||route!==forkRoute||lifecycle!==token)
        throw new Error('Conversation changed during Fork source recovery.');
      const native=await prepareFork(node);
      if(!running||route!==forkRoute||lifecycle!==token)
        throw new Error('Conversation changed while opening the native Fork menu.');
      const record=createPendingBranch({
        id:idFactory(),parentConversationId,sourceMessageId:turn.assistantId,
        rootConversationId:branchRelations(branches,parentConversationId).parent?.rootConversationId||parentConversationId,
        anchor
      });
      if(branchStorage.begin)await branchStorage.begin(record);
      else await branchStorage.setPending(record);
      if(!running||route!==forkRoute||lifecycle!==token){
        if(branchStorage.dismiss)await branchStorage.dismiss(record.id);
        else await branchStorage.clearPending();
        throw new Error('Conversation changed before native Fork activation.');
      }
      pendingBranch=record;branchError=null;notify({type:'branch'});
      try { native.activate(); }
      catch(error) {
        if(branchStorage.dismiss)await branchStorage.dismiss(record.id);
        else await branchStorage.clearPending();
        pendingBranch=null;
        branchError=error.message;notify({type:'branch'});throw error;
      }
      return record;
    },
    async confirmPending() {
      if(!branchStorage || !pendingBranch)throw new Error('No pending native branch.');
      const target=conversationId(route);
      if(!target || target===pendingBranch.parentConversationId)
        throw new Error('Open the new ChatGPT conversation before confirming its branch.');
      let confirmed;
      if(branchStorage.confirm){
        confirmed=await branchStorage.confirm(pendingBranch.id,target);
        branches=await branchStorage.list();
      }else{
        const [latest,currentIntent]=await Promise.all([branchStorage.list(),branchStorage.pending()]);
        if(!currentIntent||currentIntent.id!==pendingBranch.id)
          throw new Error('This pending branch was already dismissed or replaced.');
        confirmed=confirmBranch(latest,currentIntent,target);
        await branchStorage.save([...latest,confirmed]);
        await branchStorage.clearPending();
        branches=[...latest,confirmed];
      }
      pendingBranch=null;branchError=null;
      notify({type:'branch'});return confirmed;
    },
    async dismissPending() {
      if(branchStorage?.dismiss)await branchStorage.dismiss(pendingBranch?.id);
      else await branchStorage?.clearPending?.();
      pendingBranch=null;branchError=null;notify({type:'branch'});
    },
    move(id, candidate) {
      const point = safePoint(candidate);
      if (!point || !turns.some(turn => turn.id === id)) return;
      positions = { ...positions, [id]: point };
      notify({ type:'position',turnId:id }); save();
    },
    async persist() {
      return flushLayout();
    },
    snapshot() { return {route,turns,positions,history,bookmarks,
      previews:Object.fromEntries(volatilePreviews),branches,pendingBranch,branchError,
      relations:branchRelations(branches,conversationId(route))}; }
  };
}

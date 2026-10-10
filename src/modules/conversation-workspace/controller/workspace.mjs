import { pairMessages, routeKey, safePoint } from '../core/graph.mjs';
import { mergeAnchoredHistory } from '../core/history.mjs';
import { conversationId, createPendingBranch, confirmBranch, branchRelations, stableMessageId } from '../core/branch.mjs';

// Single owner: native conversation is truth; this controller only projects
// visible DOM turns and persists extension-owned layout metadata.
export function createWorkspaceController({ observe, layoutStorage, branchStorage=null, prepareFork=null,
  onUpdate, pathname = () => location.pathname, idFactory = () => crypto.randomUUID() }) {
  let route = routeKey(pathname());
  let messages = [], turns = [], positions = {};
  let history = {status:'idle',steps:0};
  let branches=[],pendingBranch=null,branchError=null,bookmarks=[];
  const volatilePreviews=new Map(); // Up to eight loaded conversations, never Chrome Storage.
  let running = false, storeTimer = 0, generation = 0, lifecycle=0;
  let pendingLayout=null,writeTail=Promise.resolve(),unresolved=[];
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
    turns = pairMessages(messages);
    messageIndex = new Map(messages.map((m,i) => [m.id,i]));
    turnIndex = new Map();
    turns.forEach((turn,i) => {
      turnIndex.set(turn.userId,i);
      if (turn.assistantId) turnIndex.set(turn.assistantId,i);
    });
    cacheLatest();notify({ type:'snapshot' });
  };
  async function loadRoute(path) {
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
    onSnapshot(items) {
      if(!running)return {count:messages.length,firstId:messages[0]?.id??null};
      const merged=mergeAnchoredHistory(messages,items,unresolved,
        history.status==='loading'&&history.phase==='up');
      unresolved=merged.unresolved;
      const changed=merged.messages.length!==messages.length || merged.messages.some((row,i)=>
        row.id!==messages[i]?.id || row.role!==messages[i]?.role ||
        row.text!==messages[i]?.text || JSON.stringify(row.blocks||[])!==JSON.stringify(messages[i]?.blocks||[]));
      messages=merged.messages;
      if (changed) refresh();
      return {count:messages.length,firstId:messages[0]?.id??null,unresolved:unresolved.length};
    },
    onHistory(status) {
      if(!running)return;
      history={...status,unresolved:unresolved.length};notify({type:'history'});
    },
    onPatch(item) {
      if(!running)return;
      const i = messageIndex.get(item.id);
      if (i === undefined) { observer?.refresh(); return; }
      messages[i] = item;
      const index = turnIndex.get(item.id);
      if (index === undefined) { refresh(); return; }
      const original = turns[index];
      const updated = original.userId === item.id
        ? { ...original, prompt:item.text }
        : { ...original, answer:item.text, answerBlocks:item.blocks || [], pending:!item.text.trim() };
      if (original.prompt === updated.prompt && original.answer === updated.answer &&
          JSON.stringify(original.answerBlocks||[])===JSON.stringify(updated.answerBlocks||[])) return;
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
      unsubscribeBranches();unsubscribeBranches=()=>{};
      observer?.stop();observer=null;
    },
    getSource(id) { return observer?.getElement(id) || null; },
    refresh() { observer?.refresh();observer?.loadEarlier?.(); },
    pauseHistory() { observer?.pauseHistory?.(); },
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
      const node=observer?.getElement(turn.assistantId);
      if(!node?.isConnected)
        throw new Error('The source response is not currently rendered. Return to the native source and retry.');
      // One unconfirmed native action at a time. Never replace a different
      // tab's pending lineage with a second click from this conversation.
      const existingIntent=await branchStorage.pending();
      if(existingIntent)throw new Error('Finish or dismiss the previous Fork before starting another.');
      // Do not persist a pending link unless native Branch has been discovered.
      observer?.pauseHistory?.();
      const native=await prepareFork(node);
      const record=createPendingBranch({
        id:idFactory(),parentConversationId,sourceMessageId:turn.assistantId,
        rootConversationId:branchRelations(branches,parentConversationId).parent?.rootConversationId||parentConversationId,
        anchor
      });
      await branchStorage.setPending(record);
      pendingBranch=record;branchError=null;notify({type:'branch'});
      try { native.activate(); }
      catch(error) {
        await branchStorage.clearPending();pendingBranch=null;
        branchError=error.message;notify({type:'branch'});throw error;
      }
      return record;
    },
    async confirmPending() {
      if(!branchStorage || !pendingBranch)throw new Error('No pending native branch.');
      const target=conversationId(route);
      if(!target || target===pendingBranch.parentConversationId)
        throw new Error('Open the new ChatGPT conversation before confirming its branch.');
      const [latest,currentIntent]=await Promise.all([branchStorage.list(),branchStorage.pending()]);
      if(!currentIntent || currentIntent.id!==pendingBranch.id)
        throw new Error('This pending branch was already dismissed or replaced.');
      const confirmed=confirmBranch(latest,currentIntent,target);
      await branchStorage.save([...latest,confirmed]);
      await branchStorage.clearPending();
      branches=[...latest,confirmed];pendingBranch=null;branchError=null;
      notify({type:'branch'});return confirmed;
    },
    async dismissPending() {
      await branchStorage?.clearPending?.();
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

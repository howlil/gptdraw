import { pairMessages, routeKey, safePoint } from '../core/graph.mjs';
import { mergeVisibleMessages } from '../core/history.mjs';
import { conversationId, createPendingBranch, confirmBranch, branchRelations } from '../core/branch.mjs';

// Single owner: native conversation is truth; this controller only projects
// visible DOM turns and persists extension-owned layout metadata.
export function createWorkspaceController({ observe, layoutStorage, branchStorage=null, prepareFork=null,
  onUpdate, pathname = () => location.pathname, idFactory = () => crypto.randomUUID() }) {
  let route = routeKey(pathname());
  let messages = [], turns = [], positions = {};
  let history = {status:'idle',steps:0};
  let branches=[],pendingBranch=null,branchError=null;
  let running = false, storeTimer = 0, generation = 0;
  let observer = null;
  let messageIndex = new Map(), turnIndex = new Map();
  const notify = change => onUpdate({ route, turns, positions, history, branches, pendingBranch,
    branchError, relations:branchRelations(branches,conversationId(route)) }, change);
  const refresh = () => {
    turns = pairMessages(messages);
    messageIndex = new Map(messages.map((m,i) => [m.id,i]));
    turnIndex = new Map();
    turns.forEach((turn,i) => {
      turnIndex.set(turn.userId,i);
      if (turn.assistantId) turnIndex.set(turn.assistantId,i);
    });
    notify({ type:'snapshot' });
  };
  async function loadRoute(path) {
    route = routeKey(path);
    const seq = ++generation;
    positions = {};
    messages = [];
    turns = [];
    history={status:'idle',steps:0};branchError=null;
    branches=[];pendingBranch=null;
    messageIndex.clear();turnIndex.clear();
    notify({ type:'route' });
    try {
      const [restored,existing,pending]=await Promise.all([
        layoutStorage.read(route),branchStorage?.list?.() ?? [],branchStorage?.pending?.() ?? null
      ]);
      if (seq === generation) {
        positions=restored;branches=existing;pendingBranch=pending;notify({type:'layout'});
      }
    } catch {
      // Native conversation reading remains usable if layout storage fails.
      if (seq === generation) notify({ type:'layout' });
    }
  }
  const callbacks = {
    onSnapshot(items) {
      const merged = mergeVisibleMessages(messages,items,history.status==='loading' && history.phase==='up');
      const changed = merged.length !== messages.length || merged.some((row,i) =>
        row.id !== messages[i]?.id || row.role !== messages[i]?.role || row.text !== messages[i]?.text);
      messages = merged;
      if (changed) refresh();
      return {count:messages.length,firstId:messages[0]?.id ?? null};
    },
    onHistory(status) {
      history={...status};notify({type:'history'});
    },
    onPatch(item) {
      const i = messageIndex.get(item.id);
      if (i === undefined) { observer?.refresh(); return; }
      messages[i] = item;
      const index = turnIndex.get(item.id);
      if (index === undefined) { refresh(); return; }
      const original = turns[index];
      const updated = original.userId === item.id
        ? { ...original, prompt:item.text }
        : { ...original, answer:item.text, answerBlocks:item.blocks || [], pending:!item.text.trim() };
      if (original.prompt === updated.prompt && original.answer === updated.answer) return;
      turns[index] = updated;
      notify({ type:'patch', turnId:updated.id });
    },
    onRoute(path) { loadRoute(path); }
  };
  const save = () => {
    clearTimeout(storeTimer);
    storeTimer = setTimeout(() => layoutStorage.write(route, positions).catch(() => {}), 250);
  };
  return {
    async start() {
      if (running) return;
      running = true;
      await loadRoute(pathname());
      observer = observe(callbacks);
      observer.start();
    },
    stop() { running = false; observer?.stop(); observer = null; clearTimeout(storeTimer); },
    getSource(id) { return observer?.getElement(id) || null; },
    refresh() { observer?.refresh();observer?.loadEarlier?.(); },
    async fork(turnId, anchor=null) {
      if(!branchStorage || !prepareFork)throw new Error('Native branching is unavailable.');
      const parentConversationId=conversationId(route);
      const turn=turns.find(t=>t.id===turnId);
      if(!parentConversationId || !turn?.assistantId)
        throw new Error('Open an existing ChatGPT conversation with a completed assistant answer.');
      const node=observer?.getElement(turn.assistantId);
      if(!node?.isConnected)
        throw new Error('The source response is not currently rendered. Return to the native source and retry.');
      // Do not persist a pending link unless native Branch has been discovered.
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
      const confirmed=confirmBranch(branches,pendingBranch,target);
      await branchStorage.save([...branches,confirmed]);
      await branchStorage.clearPending();
      branches=[...branches,confirmed];pendingBranch=null;branchError=null;
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
      clearTimeout(storeTimer);
      await layoutStorage.write(route, positions);
    },
    snapshot() { return {route,turns,positions,history,branches,pendingBranch,branchError,
      relations:branchRelations(branches,conversationId(route))}; }
  };
}

import { pairMessages, routeKey, safePoint } from '../core/graph.mjs';
import { mergeVisibleMessages } from '../core/history.mjs';

// Single owner: native conversation is truth; this controller only projects
// visible DOM turns and persists extension-owned layout metadata.
export function createWorkspaceController({ observe, layoutStorage, onUpdate, pathname = () => location.pathname }) {
  let route = routeKey(pathname());
  let messages = [], turns = [], positions = {};
  let history = {status:'idle',steps:0};
  let running = false, storeTimer = 0, generation = 0;
  let observer = null;
  let messageIndex = new Map(), turnIndex = new Map();
  const notify = change => onUpdate({ route, turns, positions, history }, change);
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
    history={status:'idle',steps:0};
    messageIndex.clear();turnIndex.clear();
    notify({ type:'route' });
    try {
      const restored = await layoutStorage.read(route);
      if (seq === generation) { positions = restored; notify({ type:'layout' }); }
    } catch {
      // Native conversation reading remains usable if layout storage fails.
      if (seq === generation) notify({ type:'layout' });
    }
  }
  const callbacks = {
    onSnapshot(items) {
      const merged = mergeVisibleMessages(messages,items,history.status==='loading');
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
    snapshot() { return { route, turns, positions, history }; }
  };
}

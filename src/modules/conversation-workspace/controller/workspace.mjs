import { pairMessages, routeKey, safePoint } from '../core/graph.mjs';

// Single owner: native conversation is truth; this controller only projects
// visible DOM turns and persists extension-owned layout metadata.
export function createWorkspaceController({ observe, layoutStorage, onUpdate, pathname = () => location.pathname }) {
  let route = routeKey(pathname());
  let messages = [], turns = [], positions = {};
  let running = false, storeTimer = 0, generation = 0;
  let observer = null;
  const notify = () => onUpdate({ route, turns, positions });
  const refresh = () => { turns = pairMessages(messages); notify(); };
  async function loadRoute(path) {
    route = routeKey(path);
    const seq = ++generation;
    positions = {};
    messages = [];
    turns = [];
    notify();
    try {
      const restored = await layoutStorage.read(route);
      if (seq === generation) { positions = restored; notify(); }
    } catch {
      // Native conversation reading remains usable if layout storage fails.
      if (seq === generation) notify();
    }
  }
  const callbacks = {
    onSnapshot(items) { messages = items; refresh(); },
    onPatch(item) {
      const i = messages.findIndex(entry => entry.id === item.id);
      if (i === -1) { observer?.refresh(); return; }
      messages[i] = item;
      refresh();
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
    refresh() { observer?.refresh(); },
    move(id, candidate) {
      const point = safePoint(candidate);
      if (!point || !turns.some(turn => turn.id === id)) return;
      positions = { ...positions, [id]: point };
      notify(); save();
    },
    async persist() {
      clearTimeout(storeTimer);
      await layoutStorage.write(route, positions);
    },
    snapshot() { return { route, turns, positions }; }
  };
}

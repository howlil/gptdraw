// Only public, rendered DOM. Never reads React state, fetch tokens, cookies,
// private endpoints, or ChatGPT's internal conversation object.
const TURN_SELECTOR = '[data-testid^="conversation-turn-"]';
const ROLE_SELECTOR = '[data-message-author-role]';
const RESPONSE_CONTENT = '.markdown, .prose, [data-testid="assistant-message"]';
const USER_CONTENT = '[data-testid="user-message"]';

export function collectMessages(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  const wrappers = [...root.querySelectorAll(TURN_SELECTOR)];
  const candidates = wrappers.length ? wrappers : [...root.querySelectorAll(ROLE_SELECTOR)]
    .filter(element => !element.parentElement?.closest(ROLE_SELECTOR));
  const result = [];
  const seen = new Set();
  for (const node of candidates) {
    const roleHolder = node.matches?.(ROLE_SELECTOR) ? node : node.querySelector?.(ROLE_SELECTOR);
    const role = roleHolder?.getAttribute('data-message-author-role');
    if (role !== 'user' && role !== 'assistant') continue;
    const id = node.getAttribute?.('data-message-id')
      || roleHolder?.getAttribute('data-message-id')
      || node.getAttribute?.('data-testid')
      || role + ':' + result.length;
    if (seen.has(id)) continue;
    seen.add(id);
    const content = role === 'user'
      ? node.querySelector?.(USER_CONTENT)
      : node.querySelector?.(RESPONSE_CONTENT);
    const source = content || roleHolder || node;
    const text = (source.textContent || '').trim();
    result.push({ id, role, text, element: node });
  }
  return result;
}

// Streaming updates usually mutate text inside an existing turn. Preserve its
// elements and only reread the changed turn (no full DOM scan per token).
export function createChatGPTObserver({ document, onSnapshot, onPatch, onRoute, schedule = callback => requestAnimationFrame(callback) }) {
  let root = null, observer = null, mounted = false, frame = null;
  let pathname = document.defaultView?.location.pathname || '/';
  let entries = [], nodes = new Map(), pendingIds = new Set(), needsRescan = false;
  const emitSnapshot = () => {
    entries = collectMessages(root);
    nodes = new Map(entries.map(item => [item.id, item]));
    onSnapshot(entries);
  };
  const flush = () => {
    frame = null;
    const nextPath = document.defaultView?.location.pathname || '/';
    if (nextPath !== pathname) {
      pathname = nextPath;
      onRoute(pathname);
      needsRescan = true;
    }
    if (needsRescan) {
      needsRescan = false;
      pendingIds.clear();
      emitSnapshot();
      return;
    }
    for (const id of pendingIds) {
      const old = nodes.get(id);
      if (!old) continue;
      const source = old.role === 'user'
        ? (old.element.querySelector?.(USER_CONTENT) || old.element.querySelector?.(ROLE_SELECTOR) || old.element)
        : (old.element.querySelector?.(RESPONSE_CONTENT) || old.element.querySelector?.(ROLE_SELECTOR) || old.element);
      const text = (source.textContent || '').trim();
      if (text !== old.text) {
        const next = { ...old, text };
        nodes.set(id, next);
        onPatch(next);
      }
    }
    pendingIds.clear();
  };
  const queue = () => { if (frame === null) frame = schedule(flush); };
  const findTurn = node => {
    const parent = node.nodeType === 1 ? node : node.parentElement;
    const turn = parent?.closest?.(TURN_SELECTOR) || parent?.closest?.(ROLE_SELECTOR);
    if (!turn) return null;
    for (const [id, item] of nodes) {
      if (item.element === turn || item.element.contains?.(turn)) return id;
    }
    return null;
  };
  const onMutation = changes => {
    for (const change of changes) {
      if (change.type === 'characterData') {
        const id = findTurn(change.target);
        if (id) pendingIds.add(id);
      } else if (change.type === 'childList') {
        const id = findTurn(change.target);
        const structural = [...change.addedNodes, ...change.removedNodes].some(node =>
          node.nodeType === 1 && (node.matches?.(TURN_SELECTOR) || node.matches?.(ROLE_SELECTOR)
            || node.querySelector?.(TURN_SELECTOR) || node.querySelector?.(ROLE_SELECTOR)));
        if (structural || !id) needsRescan = true;
        else pendingIds.add(id);
      }
    }
    queue();
  };
  const connect = () => {
    if (!mounted) return;
    const main = document.querySelector('main') || document.body;
    if (main !== root) {
      observer?.disconnect();
      root = main;
      observer = new MutationObserver(onMutation);
      observer.observe(root, { childList: true, characterData: true, subtree: true });
      needsRescan = true;
    }
    queue();
  };
  const routeListener = () => connect();
  return {
    start() {
      if (mounted) return;
      mounted = true;
      connect();
      document.defaultView?.addEventListener('popstate', routeListener);
      // Observe only direct body changes for SPA remounts; no page-wide polling.
      const bodyObserver = new MutationObserver(connect);
      bodyObserver.observe(document.body, { childList: true });
      this.bodyObserver = bodyObserver;
    },
    refresh: connect,
    getElement(id) { return nodes.get(id)?.element || null; },
    stop() {
      mounted = false;
      observer?.disconnect();
      this.bodyObserver?.disconnect();
      document.defaultView?.removeEventListener('popstate', routeListener);
      nodes.clear();
    }
  };
}

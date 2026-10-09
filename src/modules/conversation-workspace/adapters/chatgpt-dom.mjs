import { backfillHistory } from './history.mjs';
import { extractAssistantContent } from './response-content.mjs';

// Read only rendered ChatGPT message DOM. Never reach into React state,
// cookies, hidden endpoints or model context. Site markup varies by cohort.
const TURN_SELECTOR = '[data-testid^="conversation-turn-"],[data-turn-id][data-turn]';
const ROLE_SELECTOR = '[data-message-author-role],[data-conversation-role]';
const GROUP_SELECTOR = '[data-turn-key]';
const RESPONSE_CONTENT = '.markdown,.prose,[data-testid="assistant-message"]';
const USER_CONTENT = '[data-testid="user-message"],[data-user-message-bubble],.user-message-bubble-color,.whitespace-pre-wrap';

const normalizedRole = value => value === 'user' || value === 'assistant' ? value : null;
function roleOf(node) {
  return normalizedRole(node.getAttribute?.('data-turn'))
    || normalizedRole(node.getAttribute?.('data-message-author-role'))
    || normalizedRole(node.getAttribute?.('data-conversation-role'))
    || normalizedRole(node.querySelector?.(ROLE_SELECTOR)?.getAttribute?.('data-message-author-role'))
    || normalizedRole(node.querySelector?.(ROLE_SELECTOR)?.getAttribute?.('data-conversation-role'));
}
function readSource(node, role) {
  const selector = role === 'user' ? USER_CONTENT : RESPONSE_CONTENT;
  return node.querySelector?.(selector) || node.querySelector?.(ROLE_SELECTOR) || node;
}
function idOf(node, role, ordinal) {
  const inside = node.querySelector?.(ROLE_SELECTOR);
  const id = node.getAttribute?.('data-message-id')
    || inside?.getAttribute?.('data-message-id')
    || node.getAttribute?.('data-turn-id')
    || node.getAttribute?.('data-testid')
    || node.getAttribute?.('data-turn-key')
    || inside?.getAttribute?.('data-turn-key')
    || 'visible:' + ordinal;
  return role + ':' + id;
}

export function findChatMain(doc) {
  const mains = [...(doc.querySelectorAll?.('main,[role="main"]') || [])];
  if (!mains.length) return doc.querySelector?.('main') || doc.querySelector?.('[role="main"]') || doc.body;
  // Prefer the primary conversation surface, not sidebars or popovers.
  return mains.find(el => el.querySelector?.(TURN_SELECTOR) || el.querySelector?.(ROLE_SELECTOR) || el.querySelector?.(GROUP_SELECTOR))
    || mains.find(el => el.querySelector?.('#prompt-textarea,[data-testid="composer-text-input"]'))
    || mains[0];
}

export function collectMessages(root) {
  if (!root?.querySelectorAll) return [];
  const wrappers = [...root.querySelectorAll(TURN_SELECTOR)];
  const candidates = [];
  if (wrappers.length) {
    for (const wrapper of wrappers) {
      const own = normalizedRole(wrapper.getAttribute?.('data-turn'));
      if (own) candidates.push(wrapper);
      else {
        const children = [...(wrapper.querySelectorAll?.(ROLE_SELECTOR) || [])];
        const distinct = children.filter(node => normalizedRole(node.getAttribute?.('data-message-author-role'))
          || normalizedRole(node.getAttribute?.('data-conversation-role')));
        if (distinct.length) candidates.push(...distinct);
        else if (roleOf(wrapper)) candidates.push(wrapper);
      }
    }
    // Some A/B variants mix turn shells and bare role nodes.
    const extra = [...root.querySelectorAll(ROLE_SELECTOR)]
      .filter(el => !(el.closest?.(TURN_SELECTOR)));
    candidates.push(...extra);
    if (candidates.length > 1 && candidates.every(el => typeof el.compareDocumentPosition === 'function')) {
      candidates.sort((a,b) => a === b ? 0
        : a.compareDocumentPosition(b) & 4 ? -1 : 1);
    }
  } else {
    // Fallback when conversation-turn shells are absent or virtualized.
    candidates.push(...root.querySelectorAll(ROLE_SELECTOR));
  }
  const result = [], seen = new Set();
  for (const node of candidates) {
    const role = roleOf(node);
    if (!role) continue;
    const id = idOf(node,role,result.length);
    if (seen.has(id)) continue;
    seen.add(id);
    const extracted=role==='assistant'?extractAssistantContent(node):null;
    const source=extracted?.source || readSource(node,role);
    result.push({id,role,text:extracted?.text ?? (source.textContent || '').trim(),
      blocks:extracted?.blocks || [],element:node,source});
  }
  if (!result.some(row => row.role === 'user')) {
    // Some renderer variants put both roles under a stable user turn key,
    // without exposing a data-message-author-role on the user bubble.
    // Use this only when normal role-bearing user messages cannot be found.
    const grouped = [];
    for (const group of root.querySelectorAll(GROUP_SELECTOR)) {
      const key = group.getAttribute?.('data-turn-key');
      if (!key) continue;
      const user = group.querySelector?.('[data-user-message-bubble]');
      if (!user) continue;
      grouped.push({
        id:'user:turn-key:'+key,role:'user',
        text:(user.textContent||'').trim(),element:user,source:user
      });
      const marker = group.querySelector?.('[data-conversation-role="assistant"],[data-chatgpt-agent-turn-start]');
      if (marker) {
        let source = marker.closest?.('[data-conversation-role="assistant"]') || marker.parentElement || marker;
        // A container containing both roles cannot be treated as assistant
        // output: that would duplicate the user's prompt as a fake answer.
        if (source === group || source.contains?.(user)) source = marker;
        const answer=extractAssistantContent(source);
        grouped.push({
          id:'assistant:turn-key:'+key,role:'assistant',
          text:answer.text,blocks:answer.blocks,element:source,source:answer.source
        });
      }
    }
    if (grouped.length) return grouped;
  }
  return result;
}

// One MutationObserver per ChatGPT conversation surface. Keep a map from
// actual DOM nodes to turn IDs to avoid scanning every node for each token.
export function createChatGPTObserver({ document, onSnapshot, onPatch, onRoute, onHistory,
  schedule = callback => requestAnimationFrame(callback) }) {
  let root = null, observer = null, bodyObserver = null, mounted = false, queued = false;
  let pathname = document.defaultView?.location.pathname || '/';
  let nodes = new Map(), targetIds = new WeakMap(), pending = new Set(), rescan = true;
  let backfillAbort = null, historyStarted = false;
  const cancelBackfill = () => {backfillAbort?.abort();backfillAbort = null;};
  function startBackfill() {
    if (!mounted || historyStarted || backfillAbort || !onHistory ||
        !/(?:^|\/)c\/[a-zA-Z0-9_-]+/.test(pathname) || ![...nodes.values()].some(row => row.role === 'user')) return;
    historyStarted = true;
    const activeRoot = root;
    const controller = new AbortController();backfillAbort = controller;
    backfillHistory({document,root:activeRoot,signal:controller.signal,
      onStatus:status => {if(!controller.signal.aborted)onHistory(status);},
      onScan:() => {
        if(controller.signal.aborted || activeRoot!==root)return {count:0};
        const cumulative=snapshot();
        return cumulative || {count:nodes.size,firstId:nodes.keys().next().value ?? null};
      }
    }).catch(error => {
      if (!controller.signal.aborted)onHistory({status:'limited',message:error?.message || 'History load failed'});
    }).finally(() => {if(backfillAbort === controller)backfillAbort = null;});
  }
  const snapshot = () => {
    const rows = collectMessages(root);
    nodes = new Map(rows.map(row => [row.id,row]));
    targetIds = new WeakMap();
    for (const row of rows) {
      targetIds.set(row.element,row.id);
      if (row.source && typeof row.source === 'object') targetIds.set(row.source,row.id);
      const roleEl = row.element.querySelector?.(ROLE_SELECTOR);
      if (roleEl) targetIds.set(roleEl,row.id);
    }
    const cumulative=onSnapshot(rows);
    if (!historyStarted) queueMicrotask(startBackfill);
    return cumulative;
  };
  const turnFor = node => {
    let element = node?.nodeType === 1 ? node : node?.parentElement;
    while (element && element !== root) {
      const id = targetIds.get(element);
      if (id) return id;
      element = element.parentElement;
    }
    return null;
  };
  const flush = () => {
    queued = false;
    if (!mounted) return;
    const nextPath = document.defaultView?.location.pathname || '/';
    if (nextPath !== pathname) {
      cancelBackfill();historyStarted=false;
      pathname = nextPath; onRoute(pathname); rescan = true;
    }
    const newRoot = findChatMain(document);
    if (newRoot !== root) { cancelBackfill();historyStarted=false;attach(newRoot); rescan = true; }
    if (rescan) {
      rescan = false; pending.clear(); snapshot(); return;
    }
    for (const id of pending) {
      const previous = nodes.get(id);
      if (!previous) continue;
      const extracted=previous.role==='assistant'?extractAssistantContent(previous.element):null;
      const source=extracted?.source || readSource(previous.element,previous.role);
      const text = extracted?.text ?? (source.textContent || '').trim();
      if (text !== previous.text) {
        const updated = { ...previous,text,source,blocks:extracted?.blocks || [] };
        nodes.set(id,updated);
        targetIds.set(source,id);
        onPatch(updated);
      }
    }
    pending.clear();
  };
  const queue = () => { if (!queued) { queued = true; schedule(flush); } };
  const onMutations = mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        const id = turnFor(mutation.target);
        if (id) pending.add(id);
        else rescan = true;
      } else {
        const id = turnFor(mutation.target);
        const structural = [...mutation.addedNodes,...mutation.removedNodes].some(node =>
          node.nodeType === 1 && (
            node.matches?.(TURN_SELECTOR) || node.matches?.(ROLE_SELECTOR) || node.matches?.(GROUP_SELECTOR)
            || node.querySelector?.(TURN_SELECTOR) || node.querySelector?.(ROLE_SELECTOR) || node.querySelector?.(GROUP_SELECTOR)
          ));
        if (structural || !id) rescan = true;
        else pending.add(id);
      }
    }
    queue();
  };
  function attach(nextRoot) {
    observer?.disconnect();
    root = nextRoot;
    if (!root) return;
    observer = new MutationObserver(onMutations);
    observer.observe(root,{subtree:true,childList:true,characterData:true});
  }
  function connect() {
    if (!mounted) return;
    const next = findChatMain(document);
    if (next !== root) { cancelBackfill();historyStarted=false;attach(next); rescan = true; }
    queue();
  }
  const nav = () => { rescan = true; connect(); };
  return {
    start() {
      if (mounted) return;
      mounted = true;rescan = true;historyStarted=false;connect();
      document.defaultView?.addEventListener('popstate',nav);
      bodyObserver = new MutationObserver(connect);
      bodyObserver.observe(document.body,{childList:true});
    },
    refresh() { rescan = true; historyStarted=false; cancelBackfill(); connect(); },
    loadEarlier() { historyStarted=false;cancelBackfill();startBackfill(); },
    getElement(id) { return nodes.get(id)?.element || null; },
    stop() {
      mounted = false;cancelBackfill();historyStarted=false;observer?.disconnect();bodyObserver?.disconnect();
      document.defaultView?.removeEventListener('popstate',nav);
      root = null;observer = null;bodyObserver = null;queued = false;
      nodes.clear();pending.clear();targetIds = new WeakMap();rescan = true;
    }
  };
}

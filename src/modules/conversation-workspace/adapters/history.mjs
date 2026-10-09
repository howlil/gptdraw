// Progressive, cancellable DOM-only history loading for existing ChatGPT chats.
// Chrome owns no hidden history APIs. The native scroller is restored afterwards.
const TURN_MARKER = '[data-testid^="conversation-turn-"],[data-turn-id],[data-turn-key],[data-message-author-role]';
const SCROLL_SELECTORS = '[data-testid="conversation-scroll-container"],[data-testid="conversation-panel"],[class*="overflow-y-auto"],[class*="overflow-auto"],[role="log"]';

function scrollable(node, view) {
  if (!node || typeof node.scrollTop !== 'number') return false;
  if (!(node.scrollHeight > node.clientHeight + 48 && node.clientHeight > 100)) return false;
  const overflow = view?.getComputedStyle?.(node)?.overflowY || '';
  return /auto|scroll|overlay/.test(overflow) || node.scrollTop > 0;
}
export function findHistoryScroller(doc, main) {
  if (!main) return null;
  const view = doc.defaultView;
  const turn = main.querySelector?.(TURN_MARKER);
  // Prefer scroll ancestors of real messages, not sidebar/history navigation.
  let node = turn;
  while (node && node !== doc.body) {
    if (scrollable(node, view)) return node;
    node = node.parentElement;
  }
  const candidates = main.querySelectorAll?.(SCROLL_SELECTORS) || [];
  for (const candidate of candidates) {
    if (scrollable(candidate, view)) return candidate;
  }
  node = main;
  while (node && node !== doc.body) {
    if (scrollable(node, view)) return node;
    node = node.parentElement;
  }
  return null; // Never auto-scroll a sidebar, window, or unrelated page container.
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function backfillHistory({
  document, root, onScan, onStatus = () => {}, signal,
  findScroller = findHistoryScroller, wait = delay,
  maxSteps = 180, idleLimit = 9, waitMs = 170
}) {
  const scroller = findScroller(document, root);
  if (!scroller) {
    onStatus({ status:'unavailable', steps:0 });
    return 'unavailable';
  }
  const bottomGap = Math.max(0,scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop);
  let lastHead = null, lastHeight = -1, lastCount = -1, idle = 0, steps = 0;
  let outcome = 'limited';
  onStatus({ status:'loading', steps:0 });
  try {
    for (steps=0;steps<maxSteps;steps++) {
      if (signal?.aborted) { outcome='cancelled';break; }
      if (scroller.isConnected === false) { outcome='unavailable';break; }
      // Jump to the earliest currently loaded region; ChatGPT can prepend
      // another batch in response. Yield between attempts to avoid UI jank.
      scroller.scrollTop = 0;
      await wait(waitMs);
      if (signal?.aborted) { outcome='cancelled';break; }
      const info = await onScan();
      const height = scroller.scrollHeight;
      const head = info?.firstId ?? null;
      const count = info?.count ?? 0;
      const atTop = scroller.scrollTop <= 2;
      const stable = atTop && head === lastHead
        && height === lastHeight && count === lastCount;
      idle = stable ? idle + 1 : 0;
      lastHead=head;lastHeight=height;lastCount=count;
      if(steps % 4 === 0 || !stable)onStatus({status:'loading',steps:steps+1,count});
      if(idle >= idleLimit) {outcome='complete';break;}
    }
    if(signal?.aborted)outcome='cancelled';
    onStatus({status:outcome,steps:steps+1,count:Math.max(0,lastCount)});
    return outcome;
  } finally {
    // Preserve the user's previous distance from the end, even if older
    // messages were prepended. Never restore after cancellation/route change.
    if (!signal?.aborted && scroller.isConnected !== false)
      scroller.scrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight - bottomGap);
  }
}

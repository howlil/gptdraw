// User-triggered native UI adapter. Conservative by design: no ChatGPT API,
// hidden React state, broad page buttons, or simulated "branch succeeded" event.
const ACTION_TEXT=/^Branch(?:\s+in|\s+to)?\s+(?:a\s+)?new\s+chat$/i;
const MORE_HINT=/(more(?:\s+actions?|\s+options?)?|message\s+actions?)/i;
const MENU_SELECTOR='[role="menuitem"],[data-radix-collection-item],button,[role="option"]';
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
function visible(node) {
  if (!node || !node.isConnected || node.getAttribute?.('aria-disabled')==='true')return false;
  if (node.getClientRects && !node.getClientRects().length)return false;
  return true;
}
export function findNativeBranchAction(doc) {
  // Branch action can be rendered in a body portal (outside the message).
  const matches=[...(doc.querySelectorAll?.(MENU_SELECTOR)||[])].filter(node=>{
    const label=(node.textContent||node.getAttribute?.('aria-label')||'').trim();
    return ACTION_TEXT.test(label)&&visible(node);
  });
  // Require exact native menu label, never a generic "Branch" elsewhere.
  return matches.find(node=>node.closest?.('[role="menu"],[data-radix-menu-content]')) || null;
}
export function findNativeMoreButton(message) {
  const scope=message?.closest?.('[data-testid^="conversation-turn-"],[data-turn-id],[data-turn-key]') || message;
  if(!scope?.querySelectorAll)return null;
  return [...scope.querySelectorAll('button,[role="button"]')].find(node=>{
    const label=[node.getAttribute?.('aria-label'),node.getAttribute?.('title'),
      node.getAttribute?.('data-testid')].filter(Boolean).join(' ');
    return MORE_HINT.test(label)&&visible(node)&&!node.disabled;
  }) || null;
}
export async function prepareNativeBranch(doc,message,{wait=nextFrame}={}) {
  if (!message?.isConnected) throw new Error('Source message is not loaded in ChatGPT.');
  const more=findNativeMoreButton(message);
  if(!more) throw new Error('Native message actions unavailable. Open the original message in ChatGPT and use its Branch menu.');
  more.click();
  await wait();
  let action=findNativeBranchAction(doc);
  if(!action){ await wait(); action=findNativeBranchAction(doc); }
  if(!action) throw new Error('Native Branch in new chat was not found. ChatGPT may have changed its menu.');
  return {activate() {
    if(!visible(action))throw new Error('Native Branch menu closed before activation.');
    action.click(); return {status:'activated'};
  }};
}

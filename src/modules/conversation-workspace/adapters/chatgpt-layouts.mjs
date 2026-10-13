// Version-sensitive selectors for the rendered, public ChatGPT UI only.
// No React internals, private endpoints, cookies, or transcript persistence.
export const TURN_SELECTOR = '[data-testid^="conversation-turn-"],[data-turn-id][data-turn]';
export const ROLE_SELECTOR = '[data-message-author-role],[data-conversation-role],[data-message-role]';
export const GROUP_SELECTOR = '[data-turn-key]';
export const UNIT_SELECTOR = '[data-content-search-unit-key]';
export const TRANSCRIPT_SELECTOR = 'ol[data-conversation-transcript] > li[data-message-role]';
export const USER_BUBBLE_SELECTOR = '[data-user-message-bubble],[data-testid="user-message"]';
export const MESSAGE_MARKER = [
  TURN_SELECTOR, ROLE_SELECTOR, GROUP_SELECTOR, UNIT_SELECTOR, TRANSCRIPT_SELECTOR
].join(',');

const normalizedRole = value => value === 'user' || value === 'assistant' ? value : null;
export { normalizedRole };

export function roleOf(node) {
  if (!node) return null;
  for (const name of ['data-turn','data-message-author-role','data-conversation-role','data-message-role']) {
    const role = normalizedRole(node.getAttribute?.(name));
    if (role) return role;
  }
  // The suffix is a role marker, not a durable message ID.
  const key = node.getAttribute?.('data-content-search-unit-key');
  const unitRole = key?.match(/(?:^|:)(user|assistant)$/)?.[1];
  if (unitRole) return unitRole;
  const nested = node.querySelector?.(ROLE_SELECTOR);
  if (nested && nested !== node) {
    for (const name of ['data-message-author-role','data-conversation-role','data-message-role']) {
      const role = normalizedRole(nested.getAttribute?.(name));
      if (role) return role;
    }
  }
  return null;
}

export function detectLayout(root) {
  if (root?.querySelector?.(TRANSCRIPT_SELECTOR)) return 'transcript';
  if (root?.querySelector?.(UNIT_SELECTOR) || root?.querySelector?.(GROUP_SELECTOR)) return 'keyed';
  if (root?.querySelector?.(TURN_SELECTOR) || root?.querySelector?.(ROLE_SELECTOR)) return 'legacy';
  return 'unknown';
}

// Choose one canonical DOM family per snapshot. A/B layouts can expose
// overlapping markers; never emit the same prompt twice from two readers.
// If a higher-priority family lacks a user message, fall back safely.
export function canonicalCandidates(root) {
  const transcript = [...(root?.querySelectorAll?.(TRANSCRIPT_SELECTOR) || [])]
    .filter(node => roleOf(node));
  if (transcript.some(node => roleOf(node) === 'user')) {
    return { layout:'transcript', candidates:transcript };
  }
  const units = [...(root?.querySelectorAll?.(UNIT_SELECTOR) || [])]
    .filter(node => {
      const key = node.getAttribute?.('data-content-search-unit-key');
      return /(?:^|:)(?:user|assistant)$/.test(key || '');
    });
  if (units.some(node => roleOf(node) === 'user')) {
    // Nested search units can refer to the same text. Keep leaf role units.
    const leaves = units.filter(node => !units.some(other =>
      other !== node && node.contains?.(other) && roleOf(other) === roleOf(node)));
    return {layout:'keyed', candidates:leaves};
  }
  return {layout:detectLayout(root), candidates:null};
}

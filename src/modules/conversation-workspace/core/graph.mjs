// Pure conversation state; Chrome/DOM, provider and canvas are not domain dependencies.
export const WORKSPACE_VERSION = 1;

export function createRoot(prompt, id, createdAt = new Date().toISOString(), position = { x: 120, y: 130 }) {
  const text = String(prompt).trim();
  if (!text || text.length > 12000) throw new Error('Enter a prompt up to 12,000 characters.');
  if (typeof id !== 'string' || !id) throw new Error('A stable turn ID is required.');
  return {
    id, parentId: null, sourceAnchor: null, createdAt,
    userMessage: { id: id + ':user', text, attachmentIds: [] },
    assistant: { id: id + ':assistant', status: 'queued', text: '', revisionId: null, blocks: [], error: null },
    position
  };
}

export function updateTurn(turns, id, update) {
  if (!turns.some(turn => turn.id === id)) throw new Error('Unknown turn.');
  return turns.map(turn => turn.id === id ? { ...turn, assistant: { ...turn.assistant, ...update } } : turn);
}

export function completeTurn(turns, id) {
  const turn = turns.find(item => item.id === id);
  if (!turn || !turn.assistant.text.trim()) throw new Error('Cannot complete an empty response.');
  return updateTurn(turns, id, {
    status: 'complete',
    revisionId: id + ':revision:1',
    blocks: [{ id: id + ':block:1', kind: 'text', text: turn.assistant.text }],
    error: null
  });
}

export function restoreTurns(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(turn => turn && typeof turn.id === 'string'
    && turn.parentId === null && typeof turn.userMessage?.text === 'string'
    && typeof turn.assistant?.text === 'string'
    && typeof turn.position?.x === 'number' && typeof turn.position?.y === 'number')
    .map(turn => {
      const interrupted = ['streaming', 'queued'].includes(turn.assistant.status);
      return {
        ...turn,
        assistant: interrupted ? {
          ...turn.assistant, status: 'failed',
          error: 'Generation interrupted. Select Retry to start again.'
        } : turn.assistant
      };
    });
}

export function rootContext(turn) {
  if (turn.parentId !== null) throw new Error('This first-slice context builder handles root turns only.');
  return [{ role: 'user', content: turn.userMessage.text }];
}

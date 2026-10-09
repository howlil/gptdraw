import { createRoot, updateTurn, completeTurn, rootContext } from '../core/graph.mjs';

export function createWorkspaceController({ storage, assistant, onChange, idFactory = () => crypto.randomUUID() }) {
  let turns = [];
  let busy = false;
  let queue = Promise.resolve();
  const cancellationRequested = new Set();
  let persistTimer;
  const emit = () => onChange([...turns]);
  const persist = () => {
    queue = queue.catch(() => {}).then(() => storage.save(turns));
    return queue;
  };
  const persistSoon = () => {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => { persist().catch(console.error); }, 300);
  };
  async function run(id) {
    if (busy) throw new Error('Wait for the current generation to finish.');
    const turn = turns.find(t => t.id === id);
    if (!turn) throw new Error('Unknown conversation.');
    busy = true;
    turns = updateTurn(turns, id, { status: 'streaming', text: '', error: null, blocks: [], revisionId: null });
    emit();
    try {
      await persist();
      if (cancellationRequested.has(id)) throw new Error('Request cancelled.');
      await assistant.stream(id, rootContext(turn), text => {
        const current = turns.find(t => t.id === id);
        turns = updateTurn(turns, id, { text: current.assistant.text + text });
        emit();
        persistSoon();
      });
      turns = completeTurn(turns, id);
    } catch (error) {
      turns = updateTurn(turns, id, {
        status: error?.message === 'Request cancelled.' ? 'cancelled' : 'failed',
        error: error instanceof Error ? error.message : 'Unable to generate response.'
      });
    } finally {
      cancellationRequested.delete(id);
      busy = false;
      clearTimeout(persistTimer);
      await persist();
      emit();
    }
  }
  return {
    async init() { turns = await storage.load(); emit(); },
    snapshot() { return [...turns]; },
    async ask(prompt) {
      if (busy) throw new Error('Wait for the current generation to finish.');
      const id = idFactory();
      const index = turns.length;
      turns = [...turns, createRoot(prompt, id, new Date().toISOString(),
        { x: 120 + (index % 3) * 500, y: 110 + Math.floor(index / 3) * 440 })];
      emit();
      try {
        await persist();
      } catch {
        turns = turns.filter(turn => turn.id !== id);
        emit();
        throw new Error('Could not save the new conversation. Check extension storage and retry.');
      }
      await run(id);
      return id;
    },
    async retry(id) {
      const turn = turns.find(t => t.id === id);
      if (!turn || !['failed', 'cancelled'].includes(turn.assistant.status)) throw new Error('Only failed or cancelled turns can be retried.');
      await run(id);
    },
    cancel(id) {
      if (busy && turns.some(t => t.id === id && t.assistant.status === 'streaming')) {
        cancellationRequested.add(id);
        assistant.cancel(id);
      }
    },
    move(id, position) {
      turns = turns.map(turn => turn.id === id ? { ...turn, position } : turn);
      emit(); persistSoon();
    },
    async flush() { clearTimeout(persistTimer); await persist(); },
    dispose() { clearTimeout(persistTimer); }
  };
}

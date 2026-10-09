import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoot, updateTurn, completeTurn, restoreTurns, rootContext } from '../src/modules/conversation-workspace/core/graph.mjs';
import { createWorkspaceController } from '../src/modules/conversation-workspace/controller/workspace.mjs';

test('root turn identity and context are deterministic', () => {
  const root = createRoot('  Hello graph ', 'root-1', '2026-10-09T00:00:00.000Z');
  assert.equal(root.userMessage.text, 'Hello graph');
  assert.deepEqual(rootContext(root), [{ role: 'user', content: 'Hello graph' }]);
  assert.equal(root.parentId, null);
  assert.throws(() => createRoot(' ', 'id'));
});

test('completion binds stable response revision and block IDs', () => {
  const nodes = updateTurn([createRoot('hello', 'a')], 'a', { status: 'streaming', text: 'answer' });
  const result = completeTurn(nodes, 'a');
  assert.equal(result[0].assistant.status, 'complete');
  assert.equal(result[0].assistant.revisionId, 'a:revision:1');
  assert.equal(result[0].assistant.blocks[0].id, 'a:block:1');
});

test('restore marks interrupted streams as failed, preserving typed prompt', () => {
  const original = createRoot('Persist me', 'root');
  const recovered = restoreTurns([original]);
  assert.equal(recovered[0].assistant.status, 'failed');
  assert.equal(recovered[0].userMessage.text, 'Persist me');
});

test('complete vertical controller flow persists and recovers generated answer', async () => {
  let saved = [];
  const storage = { load: async () => saved, save: async nodes => { saved = structuredClone(nodes); } };
  const updates = [];
  const assistant = { stream: async (id, messages, delta) => {
    assert.deepEqual(messages, [{ role: 'user', content: 'Test integration' }]);
    delta('Hello'); delta(' world');
  } };
  const controller = createWorkspaceController({ storage, assistant, idFactory: () => 'id-1', onChange: nodes => updates.push(nodes) });
  await controller.init();
  await controller.ask('Test integration');
  assert.equal(saved[0].assistant.text, 'Hello world');
  assert.equal(saved[0].assistant.status, 'complete');
  const next = createWorkspaceController({ storage, assistant, onChange: () => {} });
  await next.init();
  assert.equal(next.snapshot()[0].assistant.text, 'Hello world');
  assert.ok(updates.length > 2);
});

test('failed generation is kept for retry without duplicate turn', async () => {
  let saved = [];
  let fails = true;
  const storage = { load: async () => saved, save: async turns => { saved = structuredClone(turns); } };
  const assistant = { stream: async (_id, _messages, delta) => {
    if (fails) throw new Error('Upstream unavailable');
    delta('Recovered');
  } };
  const controller = createWorkspaceController({ storage, assistant, idFactory: () => 'same-id', onChange: () => {} });
  await controller.init(); await controller.ask('Again');
  assert.equal(saved[0].assistant.status, 'failed');
  fails = false; await controller.retry('same-id');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].assistant.text, 'Recovered');
});

test('cancel stops a stream and keeps the original root for retry', async () => {
  let saved = [];
  let rejectStream;
  let cancelled = false;
  const storage = { load: async () => saved, save: async turns => { saved = structuredClone(turns); } };
  const assistant = {
    stream: () => new Promise((_resolve, reject) => { rejectStream = reject; }),
    cancel: () => { cancelled = true; rejectStream(new Error('Request cancelled.')); }
  };
  const controller = createWorkspaceController({ storage, assistant, idFactory: () => 'cancel-id', onChange: () => {} });
  await controller.init();
  const pending = controller.ask('Stop this');
  await new Promise(resolve => setTimeout(resolve, 10));
  controller.cancel('cancel-id');
  await pending;
  assert.equal(cancelled, true);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].assistant.status, 'cancelled');
});

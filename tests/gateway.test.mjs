import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from '../src/modules/conversation-workspace/adapters/gateway.mjs';
import { consumeSSE } from '../src/modules/conversation-workspace/core/sse.mjs';

const token = 'local-pair-token-0123456789';
const encoder = new TextEncoder();
function mockFetch(_url, options) {
  assert.equal(JSON.parse(options.body).store, false);
  assert.equal(JSON.parse(options.body).input[0].content, 'Hello');
  return Promise.resolve(new Response(new ReadableStream({
    start(c) {
      c.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"Hel'));
      c.enqueue(encoder.encode('lo"}\n\ndata: {"type":"response.completed"}\n\n'));
      c.close();
    }
  }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));
}
async function withGateway(fn) {
  const server = createGateway({ token, apiKey: 'fake-key', upstreamFetch: mockFetch });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await fn('http://127.0.0.1:' + server.address().port); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('health requires correct bearer token and rejects hostile browser origin', () => withGateway(async base => {
  assert.equal((await fetch(base + '/health')).status, 401);
  assert.equal((await fetch(base + '/health', { headers: { Origin: 'https://evil.example', Authorization: 'Bearer ' + token } })).status, 403);
  const health = await (await fetch(base + '/health', { headers: { Authorization: 'Bearer ' + token } })).json();
  assert.equal(health.ready, true);
}));
test('authorized request streams actual normalized upstream deltas', () => withGateway(async base => {
  const response = await fetch(base + '/responses', { method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] })
  });
  assert.equal(response.status, 200);
  const events = [];
  await consumeSSE(response.body, event => events.push(event));
  assert.deepEqual(events, [{ type: 'delta', text: 'Hello' }, { type: 'done' }]);
}));
test('invalid request content is rejected before upstream call', () => withGateway(async base => {
  const response = await fetch(base + '/responses', { method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'tool', content: 'bad' }] })
  });
  assert.equal(response.status, 400);
}));

test('SSE parser preserves CRLF framing split between chunks', async () => {
  const bytes = new TextEncoder();
  const stream = new ReadableStream({ start(controller) {
    controller.enqueue(bytes.encode('data: {"type":"delta","text":"Hi"}\\r'));
    controller.enqueue(bytes.encode('\\n\\r\\n'));
    controller.close();
  } });
  const events = [];
  await consumeSSE(stream, item => events.push(item));
  assert.deepEqual(events, [{ type: 'delta', text: 'Hi' }]);
});

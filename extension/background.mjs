import { consumeSSE } from '../src/modules/conversation-workspace/core/sse.mjs';

const GATEWAY = 'http://127.0.0.1:8787';
const TOKEN_KEY = 'gptdraw:gateway-pair-token';
chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: chrome.runtime.getURL('extension/workspace.html') }));
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'gptdraw-gateway' || port.sender?.id !== chrome.runtime.id) return;
  const pending = new Map();
  const reply = message => { try { port.postMessage(message); } catch { /* disconnected */ } };
  const auth = async () => (await chrome.storage.local.get(TOKEN_KEY))[TOKEN_KEY];
  const health = async token => {
    const response = await fetch(GATEWAY + '/health', { headers: { Authorization: 'Bearer ' + token } });
    if (!response.ok) throw new Error(response.status === 401 ? 'Invalid pairing token.' : 'Gateway unavailable.');
    return response.json();
  };
  port.onMessage.addListener(async message => {
    if (message?.type === 'status') {
      try {
        const token = await auth();
        if (!token) { reply({ type: 'status', paired: false }); return; }
        const result = await health(token);
        reply({ type: 'status', paired: true, model: result.model });
      } catch { reply({ type: 'status', paired: false, message: 'Start the local gateway and pair again.' }); }
    }
    if (message?.type === 'pair') {
      try {
        if (typeof message.token !== 'string' || message.token.trim().length < 16) throw new Error('Enter the pairing token printed by the gateway.');
        const token = message.token.trim();
        const result = await health(token);
        await chrome.storage.local.set({ [TOKEN_KEY]: token });
        reply({ type: 'paired', paired: true, model: result.model });
      } catch (error) { reply({ type: 'status', paired: false, message: error.message }); }
    }
    if (message?.type === 'ask') {
      const id = message.id;
      if (typeof id !== 'string' || id.length > 128 || pending.has(id)) return;
      const controller = new AbortController(); pending.set(id, controller);
      try {
        const token = await auth();
        if (!token) throw new Error('Start the local gateway and enter its pairing token.');
        const response = await fetch(GATEWAY + '/responses', {
          method: 'POST', signal: controller.signal,
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: message.messages })
        });
        if (!response.ok) throw new Error(response.status === 401 ? 'Pairing expired. Pair again.' : 'Gateway HTTP ' + response.status);
        let finished = false;
        await consumeSSE(response.body, event => {
          if (event.type === 'delta') reply({ type: 'delta', id, text: event.text });
          if (event.type === 'done' || event.type === 'error') {
            finished = true; reply({ ...event, id });
          }
        }, controller.signal);
        if (!finished) throw new Error('The gateway stream ended unexpectedly.');
      } catch (error) {
        if (!controller.signal.aborted) reply({ type: 'error', id, message: error.message || 'Request failed.' });
      } finally { pending.delete(id); }
    }
    if (message?.type === 'cancel' && pending.has(message.id)) {
      pending.get(message.id).abort(); pending.delete(message.id);
      reply({ type: 'error', id: message.id, message: 'Request cancelled.' });
    }
  });
  port.onDisconnect.addListener(() => {
    for (const controller of pending.values()) controller.abort();
    pending.clear();
  });
});

// Lives in the trusted extension workspace; the OpenAI key never enters Chrome.
export function createAssistantBridge() {
  const port = chrome.runtime.connect({ name: 'gptdraw-gateway' });
  const jobs = new Map();
  const listeners = new Set();
  let closed = false;
  port.onMessage.addListener(message => {
    if (message.type === 'status' || message.type === 'paired') {
      listeners.forEach(listener => listener(message));
      return;
    }
    const job = jobs.get(message.id);
    if (!job) return;
    if (message.type === 'delta') job.onDelta(message.text);
    if (message.type === 'done' || message.type === 'error') {
      jobs.delete(message.id);
      if (message.type === 'done') job.resolve();
      else job.reject(new Error(message.message || 'Gateway unavailable.'));
    }
  });
  port.onDisconnect.addListener(() => {
    closed = true;
    for (const job of jobs.values()) job.reject(new Error('Gateway connection closed.'));
    jobs.clear();
  });
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    status() { if (!closed) port.postMessage({ type: 'status' }); },
    pair(token) { if (!closed) port.postMessage({ type: 'pair', token }); },
    stream(id, messages, onDelta) {
      if (closed) return Promise.reject(new Error('Gateway connection closed.'));
      return new Promise((resolve, reject) => {
        jobs.set(id, { resolve, reject, onDelta });
        port.postMessage({ type: 'ask', id, messages });
      });
    },
    cancel(id) { if (!closed && jobs.has(id)) port.postMessage({ type: 'cancel', id }); },
    dispose() { if (!closed) port.disconnect(); }
  };
}

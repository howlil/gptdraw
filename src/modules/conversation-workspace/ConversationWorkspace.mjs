import { createGraphCanvas } from './components/GraphCanvas.mjs';
import { createWorkspaceController } from './controller/workspace.mjs';
import { workspaceStorage } from './adapters/storage.mjs';
import { createAssistantBridge } from './adapters/assistant.mjs';

export function mountConversationWorkspace(host) {
  host.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <div class="brand"><span class="brand-mark"><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 6v8a5 5 0 0 0 5 5h5M6 10a5 5 0 0 0 5-2h5"/></svg></span><div><strong>gptdraw</strong><span>Conversation canvas</span></div></div>
        <div class="header-tools"><span class="connection" id="connection">Connecting…</span><button id="new" type="button">+ New</button><button id="close" type="button" aria-label="Close canvas"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
      </header>
      <div id="workspace-error" class="workspace-error" role="alert" hidden></div>
      <div class="canvas-host"></div>
      <footer class="app-footer"><span>Drag card header · Drag background · Ctrl/⌘ + scroll to zoom</span><span>Stored in this extension</span></footer>
      <section id="pairing" class="pairing" hidden>
        <form id="pair-form" class="pair-card">
          <span class="pair-symbol"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 6v8a5 5 0 0 0 5 5h5M6 10a5 5 0 0 0 5-2h5"/></svg></span><h1>Connect AI gateway</h1>
          <p>Run the local gateway with your OpenAI API key, then enter the pairing token printed in its terminal. Your API key never enters this extension.</p>
          <label for="pair-token">Pairing token</label>
          <input id="pair-token" type="password" autocomplete="off" placeholder="Paste token" required minlength="16">
          <button type="submit">Connect</button><div id="pair-error" role="status"></div>
          <small>First slice · ChatGPT is the host page, not the AI provider. No ChatGPT conversation content is read.</small>
        </form>
      </section>
    </div>`;
  const bridge = createAssistantBridge();
  const connection = host.querySelector('#connection');
  const pairing = host.querySelector('#pairing');
  const submit = host.querySelector('#pair-form button');
  const errorBox = host.querySelector('#workspace-error');
  const showError = error => { errorBox.textContent = error instanceof Error ? error.message : String(error); errorBox.hidden = false; };
  const clearError = () => { errorBox.textContent = ''; errorBox.hidden = true; };
  let paired = false, busy = false, snapshot = [];
  let controller;
  const canvas = createGraphCanvas({
    onAsk: async text => {
      if (!paired || busy) throw new Error('Connect the gateway and wait for the current request.');
      busy = true; clearError(); canvas.render(snapshot, true);
      try { await controller.ask(text); }
      catch (error) { showError(error); throw error; }
      finally { busy = false; canvas.render(snapshot, false); }
    },
    onRetry: async id => {
      if (!paired || busy) return;
      busy = true; clearError(); canvas.render(snapshot, true);
      try { await controller.retry(id); }
      catch (error) { showError(error); }
      finally { busy = false; canvas.render(snapshot, false); }
    },
    onCancel: id => controller.cancel(id),
    onMove: (id, position) => controller.move(id, position)
  });
  host.querySelector('.canvas-host').append(canvas.element);
  controller = createWorkspaceController({
    storage: workspaceStorage, assistant: bridge,
    onChange: turns => { snapshot = turns; canvas.render(turns, busy); }
  });
  const setStatus = ({ paired: ready, model, message }) => {
    paired = !!ready;
    pairing.hidden = paired;
    connection.textContent = paired ? 'Connected · ' + (model || 'AI gateway') : 'Gateway offline';
    connection.classList.toggle('online', paired);
    host.querySelector('#pair-error').textContent = paired ? '' : (message || '');
    submit.disabled = false;
  };
  const unsubscribe = bridge.subscribe(setStatus);
  host.querySelector('#pair-form').addEventListener('submit', event => {
    event.preventDefault();
    submit.disabled = true;
    host.querySelector('#pair-error').textContent = 'Connecting…';
    bridge.pair(host.querySelector('#pair-token').value);
    host.querySelector('#pair-token').value = '';
  });
  host.querySelector('#new').addEventListener('click', () => canvas.focusComposer());
  host.querySelector('#close').addEventListener('click', () => {
    if (window.parent !== window) window.parent.postMessage({ type: 'GPTDRAW_CLOSE' }, '*');
    else window.close();
  });
  window.addEventListener('pagehide', () => { controller.flush().catch(() => {}); unsubscribe(); bridge.dispose(); });
  controller.init().then(() => { bridge.status(); canvas.fit(snapshot); })
    .catch(error => { connection.textContent = 'Storage error'; showError(error); console.error(error); });
}

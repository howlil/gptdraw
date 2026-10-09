// Host ChatGPT only; never read prompts, cookies or private ChatGPT DOM.
(() => {
  if (document.getElementById('gptdraw-launcher')) return;
  const frame = document.createElement('iframe');
  frame.id = 'gptdraw-workspace-frame';
  frame.title = 'gptdraw conversation canvas';
  const workspaceUrl = chrome.runtime.getURL('extension/workspace.html');
  frame.setAttribute('allow', 'clipboard-write');
  Object.assign(frame.style, {
    position: 'fixed', inset: '0', width: '100vw', height: '100vh',
    zIndex: '2147483646', border: '0', display: 'none', background: '#fcfcf8'
  });
  const button = document.createElement('button');
  button.id = 'gptdraw-launcher';
  button.type = 'button';
  button.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 6v8a5 5 0 0 0 5 5h5M6 10a5 5 0 0 0 5-2h5"/></svg><span>Graph</span>';
  button.setAttribute('aria-label', 'Open gptdraw canvas');
  Object.assign(button.style, {
    position: 'fixed', top: '84px', right: '20px', zIndex: '2147483645',
    border: '1px solid #e5e7eb', background: '#fff', color: '#252525',
    padding: '10px 15px', borderRadius: '999px', font: '500 13px system-ui',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', boxShadow: '0 5px 22px rgba(0,0,0,.09)'
  });
  button.addEventListener('click', () => {
    frame.style.display = 'block'; button.style.display = 'none';
    if (!frame.getAttribute('src')) frame.src = workspaceUrl;
  });
  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow || event.origin !== new URL(workspaceUrl).origin) return;
    if (event.data?.type === 'GPTDRAW_CLOSE') {
      frame.style.display = 'none'; button.style.display = 'block';
      button.focus();
    }
  });
  document.documentElement.append(frame, button);
})();

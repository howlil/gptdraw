// Host ChatGPT only; never read prompts, cookies or private ChatGPT DOM.
(() => {
  if (document.getElementById('gptdraw-launcher')) return;
  const frame = document.createElement('iframe');
  frame.id = 'gptdraw-workspace-frame';
  frame.title = 'gptdraw conversation canvas';
  frame.src = chrome.runtime.getURL('extension/workspace.html');
  frame.setAttribute('allow', 'clipboard-write');
  Object.assign(frame.style, {
    position: 'fixed', inset: '0', width: '100vw', height: '100vh',
    zIndex: '2147483646', border: '0', display: 'none', background: '#fcfcf8'
  });
  const button = document.createElement('button');
  button.id = 'gptdraw-launcher';
  button.type = 'button';
  button.textContent = '✣  Graph';
  button.setAttribute('aria-label', 'Open gptdraw canvas');
  Object.assign(button.style, {
    position: 'fixed', top: '84px', right: '20px', zIndex: '2147483645',
    border: '1px solid #e5e7eb', background: '#fff', color: '#252525',
    padding: '10px 15px', borderRadius: '999px', font: '500 13px system-ui',
    cursor: 'pointer', boxShadow: '0 5px 22px rgba(0,0,0,.09)'
  });
  button.addEventListener('click', () => {
    frame.style.display = 'block'; button.style.display = 'none';
  });
  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow || event.origin !== new URL(frame.src).origin) return;
    if (event.data?.type === 'GPTDRAW_CLOSE') {
      frame.style.display = 'none'; button.style.display = 'block';
      button.focus();
    }
  });
  document.documentElement.append(frame, button);
})();

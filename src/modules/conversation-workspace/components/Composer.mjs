export function createComposer(onSend) {
  const form = document.createElement('form');
  form.className = 'composer';
  form.innerHTML = '<textarea rows="1" aria-label="Prompt" placeholder="Ask a question…" maxlength="12000"></textarea><button class="send" aria-label="Send prompt" type="submit" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-7 7 7-7 7 7"/></svg></button>';
  const textarea = form.querySelector('textarea');
  const button = form.querySelector('button');
  const measure = () => {
    textarea.style.height = 'auto';
    const height = Math.min(140, Math.max(26, textarea.scrollHeight));
    textarea.style.height = height + 'px';
    form.classList.toggle('expanded', height > 36 || textarea.value.includes('\n'));
    button.disabled = !textarea.value.trim();
  };
  textarea.addEventListener('input', measure);
  textarea.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const value = textarea.value.trim();
    if (!value || textarea.disabled) return;
    button.disabled = true;
    try {
      await onSend(value);
      textarea.value = '';
    } catch {
      // Keep the draft so a failed save can be tried again.
    } finally {
      measure();
    }
  });
  return { element: form, focus: () => textarea.focus(), textarea };
}

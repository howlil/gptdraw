export function createChatCard(turn, { onRetry, onCancel }) {
  const card = document.createElement('article');
  card.className = 'chat-card';
  card.dataset.id = turn.id;
  card.style.left = turn.position.x + 'px';
  card.style.top = turn.position.y + 'px';
  card.innerHTML = `
    <div class="card-head" title="Drag to reposition">
      <span class="card-dot"></span><span class="card-title">Conversation</span>
      <span class="card-number"></span>
    </div>
    <div class="card-content">
      <div class="user-row"><div class="user-bubble"></div></div>
      <div class="assistant-answer" aria-live="polite"></div>
      <div class="card-status"></div>
      <div class="card-actions"><button class="stop" type="button" hidden>Stop</button><button class="retry" type="button" hidden>Retry</button></div>
    </div>`;
  card.querySelector('.user-bubble').textContent = turn.userMessage.text;
  card.querySelector('.retry').addEventListener('click', () => onRetry(turn.id));
  card.querySelector('.stop').addEventListener('click', () => onCancel(turn.id));
  updateChatCard(card, turn);
  return card;
}
export function updateChatCard(card, turn) {
  const answer = card.querySelector('.assistant-answer');
  if (answer.textContent !== turn.assistant.text) answer.textContent = turn.assistant.text;
  const status = card.querySelector('.card-status');
  status.textContent = {
    queued: 'Waiting to connect…', streaming: 'Generating…',
    complete: '', failed: turn.assistant.error || 'Request failed.',
    cancelled: 'Generation cancelled.'
  }[turn.assistant.status] || '';
  status.classList.toggle('error', turn.assistant.status === 'failed');
  card.querySelector('.retry').hidden = !['failed', 'cancelled'].includes(turn.assistant.status);
  card.querySelector('.stop').hidden = turn.assistant.status !== 'streaming';
  card.setAttribute('aria-busy', turn.assistant.status === 'streaming' ? 'true' : 'false');
}

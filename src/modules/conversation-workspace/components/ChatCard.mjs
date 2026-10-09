import { control, icon } from '../../../components/ui/icons.mjs';

export function createChatCard(turn, { index, onSource, onFocus }) {
  const card = document.createElement('article');
  card.className = 'g-card';
  card.dataset.turnId = turn.id;
  card.setAttribute('aria-label', 'Conversation turn ' + (index + 1));
  const head = document.createElement('header');
  head.className = 'g-card-head';
  head.append(icon('message',14));
  const label = document.createElement('span');
  label.className = 'g-card-label'; label.textContent = 'Turn ' + (index + 1);
  head.append(label);
  const actions = document.createElement('span'); actions.className = 'g-card-actions';
  actions.append(control('Read source in ChatGPT','arrow',() => onSource(turn.userId)),
    control('Focus card','focus',() => onFocus(turn.id)));
  head.append(actions);
  const body = document.createElement('div'); body.className = 'g-card-body';
  const row = document.createElement('div'); row.className = 'g-user-row';
  const question = document.createElement('div'); question.className = 'g-user-bubble';
  row.append(question);
  const answer = document.createElement('div'); answer.className = 'g-answer';
  answer.setAttribute('role','region'); answer.setAttribute('aria-label','Assistant response');
  const placeholder = document.createElement('p'); placeholder.className = 'g-placeholder';
  body.append(row, answer, placeholder);
  card.append(head,body);
  card._update = next => {
    if (question.textContent !== next.prompt) question.textContent = next.prompt;
    // No fake markdown/HTML and no re-creation of unchanged response nodes.
    if (answer.textContent !== next.answer) answer.textContent = next.answer;
    placeholder.textContent = next.pending ? 'Waiting for an assistant response in ChatGPT…' : '';
    placeholder.hidden = !next.pending;
  };
  card._update(turn);
  return card;
}

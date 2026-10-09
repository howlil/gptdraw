// A card represents ONE visible user prompt plus the following assistant reply.
// This is a DOM projection, not an AI/context engine. No ChatGPT internals are assumed.
export function pairMessages(messages) {
  const turns = [];
  let current = null;
  for (const message of messages) {
    if (message.role === 'user') {
      current = {
        id: message.id, userId: message.id, assistantId: null,
        prompt: message.text, answer: '', anchorId: message.id,
        pending: true
      };
      turns.push(current);
    } else if (message.role === 'assistant') {
      if (current && !current.assistantId) {
        current.assistantId = message.id;
        current.answer = message.text;
        current.pending = !message.text.trim();
      } else {
        // Orphan assistant output is not assigned a fabricated question.
        current = null;
      }
    }
  }
  return turns;
}

export function routeKey(pathname) {
  const match = String(pathname).match(/\/c\/([a-zA-Z0-9_-]+)/);
  return match ? 'conversation:' + match[1] : 'route:' + String(pathname).slice(0, 120);
}

export function safePoint(value) {
  const x = Number(value?.x), y = Number(value?.y);
  return Number.isFinite(x) && Number.isFinite(y)
    && Math.abs(x) < 1e6 && Math.abs(y) < 1e6 ? { x, y } : null;
}

export function layoutPoint(index) {
  // A horizontal reading spine. Positions can be customized by dragging cards.
  return { x: 130 + index * 476, y: 140 + (index % 2) * 34 };
}

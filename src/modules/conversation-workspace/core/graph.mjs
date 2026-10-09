// A card represents ONE visible user prompt plus the following assistant reply.
// This is a DOM projection, not an AI/context engine. No ChatGPT internals are assumed.
export function pairMessages(messages) {
  const turns = [];
  let current = null;
  for (const message of messages) {
    if (message.role === 'user') {
      current = {
        id: message.id, userId: message.id, assistantId: null,
        prompt: message.text, answer: '', answerBlocks:[], anchorId: message.id,
        pending: true
      };
      turns.push(current);
    } else if (message.role === 'assistant') {
      if (current && !current.assistantId) {
        current.assistantId = message.id;
        current.answer = message.text;
        current.answerBlocks = message.blocks || [];
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


// Keep canvas positions stable when lazy loading prepends older turns.
// Prior positions win for existing cards; explicit user-dragged positions
// override both. New cards are placed relative to their existing neighbors.
export function stabilizeLayout(turns, previous = new Map(), stored = {}) {
  const result = new Map(previous);
  for (const turn of turns) {
    const saved = safePoint(stored[turn.id]);
    if (saved) result.set(turn.id, saved);
  }
  for (let i=0;i<turns.length;i++) {
    const turn=turns[i];
    if (result.has(turn.id)) continue;
    let anchor=-1;
    for (let right=i+1;right<turns.length;right++) {
      if (result.has(turns[right].id)) {anchor=right;break;}
    }
    if (anchor<0) {
      for (let left=i-1;left>=0;left--) {
        if (result.has(turns[left].id)) {anchor=left;break;}
      }
    }
    if (anchor<0) result.set(turn.id,layoutPoint(i));
    else {
      const base=result.get(turns[anchor].id);
      result.set(turn.id,{x:base.x+(i-anchor)*476,y:layoutPoint(i).y});
    }
  }
  return result;
}

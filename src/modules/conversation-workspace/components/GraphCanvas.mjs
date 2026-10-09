import { createChatCard, updateChatCard } from './ChatCard.mjs';
import { createComposer } from './Composer.mjs';

export function createGraphCanvas({ onAsk, onRetry, onCancel, onMove }) {
  const container = document.createElement('div');
  container.className = 'canvas-viewport';
  container.innerHTML = '<div class="canvas-stage"></div><div class="canvas-controls"><button type="button" data-zoom="out" aria-label="Zoom out">−</button><span class="zoom-label">100%</span><button type="button" data-zoom="in" aria-label="Zoom in">+</button><button type="button" data-zoom="fit" aria-label="Fit canvas">⌗</button></div>';
  const stage = container.querySelector('.canvas-stage');
  const cards = new Map();
  let scale = 1, tx = 0, ty = 0, gesture = null, didInit = false;
  const draftCard = document.createElement('section');
  draftCard.className = 'draft-card';
  draftCard.innerHTML = '<div class="draft-header">New conversation</div><p class="draft-intro">Start a new path of thought.</p>';
  const composer = createComposer(onAsk);
  draftCard.append(composer.element);
  stage.append(draftCard);
  const apply = () => {
    stage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    container.querySelector('.zoom-label').textContent = Math.round(scale * 100) + '%';
  };
  function fit(turns = []) {
    const bounds = turns.length
      ? turns.map(turn => ({ x: turn.position.x, y: turn.position.y, w: 448, h: 340 }))
      : [{ x: 180, y: 150, w: 448, h: 230 }];
    const minX = Math.min(...bounds.map(p => p.x)), maxX = Math.max(...bounds.map(p => p.x + p.w));
    const minY = Math.min(...bounds.map(p => p.y)), maxY = Math.max(...bounds.map(p => p.y + p.h));
    scale = Math.max(.52, Math.min(1, (container.clientWidth - 60) / (maxX - minX),
      (container.clientHeight - 90) / (maxY - minY)));
    tx = (container.clientWidth - (minX + maxX) * scale) / 2;
    ty = (container.clientHeight - (minY + maxY) * scale) / 2;
    apply();
  }
  function zoom(next) {
    const centerX = container.clientWidth / 2, centerY = container.clientHeight / 2;
    const value = Math.max(.42, Math.min(1.4, next));
    tx = centerX - (centerX - tx) * value / scale;
    ty = centerY - (centerY - ty) * value / scale;
    scale = value; apply();
  }
  container.querySelector('.canvas-controls').addEventListener('click', event => {
    const action = event.target.closest('[data-zoom]')?.dataset.zoom;
    if (action === 'out') zoom(scale - .1);
    if (action === 'in') zoom(scale + .1);
    if (action === 'fit') fit([...cards.values()].map(card => ({
      position: { x: parseFloat(card.style.left), y: parseFloat(card.style.top) }
    })));
  });
  container.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button,textarea,input,.canvas-controls')) return;
    const head = event.target.closest('.card-head');
    const card = head?.closest('.chat-card');
    if (card) {
      gesture = { type: 'node', id: card.dataset.id, card, x: parseFloat(card.style.left),
        y: parseFloat(card.style.top), clientX: event.clientX, clientY: event.clientY,
        pointerId: event.pointerId };
    } else if (event.target === container || event.target === stage) {
      gesture = { type: 'pan', x: tx, y: ty, clientX: event.clientX, clientY: event.clientY,
        pointerId: event.pointerId };
    }
    if (gesture) container.setPointerCapture(event.pointerId);
  });
  container.addEventListener('pointermove', event => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.clientX, dy = event.clientY - gesture.clientY;
    if (gesture.type === 'pan') { tx = gesture.x + dx; ty = gesture.y + dy; apply(); }
    else {
      gesture.card.style.left = gesture.x + dx / scale + 'px';
      gesture.card.style.top = gesture.y + dy / scale + 'px';
    }
  });
  function endPointer(event) {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.type === 'node') onMove(gesture.id, {
      x: parseFloat(gesture.card.style.left), y: parseFloat(gesture.card.style.top)
    });
    gesture = null;
  }
  container.addEventListener('pointerup', endPointer);
  container.addEventListener('pointercancel', endPointer);
  container.addEventListener('wheel', event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoom(scale + (event.deltaY < 0 ? .08 : -.08));
  }, { passive: false });
  return {
    element: container,
    render(turns, busy) {
      const ids = new Set(turns.map(t => t.id));
      for (const [id, card] of cards) if (!ids.has(id)) { card.remove(); cards.delete(id); }
      for (const turn of turns) {
        if (!cards.has(turn.id)) {
          const card = createChatCard(turn, { onRetry, onCancel });
          cards.set(turn.id, card); stage.append(card);
        }
        const card = cards.get(turn.id);
        updateChatCard(card, turn);
        if (!gesture || gesture.id !== turn.id) {
          card.style.left = turn.position.x + 'px';
          card.style.top = turn.position.y + 'px';
        }
      }
      // The draft card is UI-only until Send creates a persisted domain turn.
      const count = turns.length;
      draftCard.style.left = 180 + (count % 3) * 500 + 'px';
      draftCard.style.top = 150 + Math.floor(count / 3) * 440 + 'px';
      composer.textarea.disabled = busy;
      draftCard.querySelector('.send').disabled = busy || !composer.textarea.value.trim();
      if (!didInit && container.clientWidth) { didInit = true; fit(turns); }
    },
    fit,
    focusComposer() {
      const x = parseFloat(draftCard.style.left) + 224;
      const y = parseFloat(draftCard.style.top) + 110;
      tx = container.clientWidth / 2 - x * scale;
      ty = container.clientHeight / 2 - y * scale;
      apply(); composer.focus();
    }
  };
}

import { safePoint } from '../core/graph.mjs';

// Store ONLY extension layout metadata, never user prompts or assistant text.
// Privacy: native ChatGPT remains the source of the conversation.
const PREFIX = 'gptdraw:layout:v2:';
export function createLayoutStorage(storage) {
  return {
    async read(route) {
      const key = PREFIX + route;
      const raw = (await storage.get(key))[key];
      const positions = {};
      if (raw?.version !== 2 || !raw.positions || typeof raw.positions !== 'object') return positions;
      for (const [id, value] of Object.entries(raw.positions)) {
        const point = safePoint(value);
        if (point) positions[id] = point;
      }
      return positions;
    },
    async write(route, positions) {
      await storage.set({ [PREFIX + route]: { version: 2, positions } });
    }
  };
}

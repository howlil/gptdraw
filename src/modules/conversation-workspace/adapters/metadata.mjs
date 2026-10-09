import { safePoint } from '../core/graph.mjs';

// Store ONLY extension layout metadata, never user prompts or assistant text.
// Privacy: native ChatGPT remains the source of the conversation.
const PREFIX = 'gptdraw:layout:v2:';
const BOOKMARK_PREFIX = 'gptdraw:bookmarks:v1:';
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
    },
    async readBookmarks(route) {
      const raw=(await storage.get(BOOKMARK_PREFIX+route))[BOOKMARK_PREFIX+route];
      return Array.isArray(raw?.ids) ? [...new Set(raw.ids.filter(id =>
        typeof id==='string' && id.length>0 && id.length<200))].slice(0,500):[];
    },
    async writeBookmarks(route,ids) {
      if(ids.length>500)throw new Error('Bookmark limit reached.');
      await storage.set({[BOOKMARK_PREFIX+route]:{version:1,ids}});
    }
  };
}

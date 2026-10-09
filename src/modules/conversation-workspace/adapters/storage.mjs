import { restoreTurns, WORKSPACE_VERSION } from '../core/graph.mjs';

const KEY = 'gptdraw:workspace:v1';
export const workspaceStorage = {
  async load() {
    const result = await chrome.storage.local.get(KEY);
    const data = result[KEY];
    return data?.version === WORKSPACE_VERSION ? restoreTurns(data.turns) : [];
  },
  async save(turns) {
    await chrome.storage.local.set({ [KEY]: { version: WORKSPACE_VERSION, turns } });
  }
};

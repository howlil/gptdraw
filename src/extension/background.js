// This extension stores only layout metadata. Allow its isolated content script
// to read positions even when upgrading from the old trusted-only token store.
chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })
  .catch(() => {});
// Toolbar action toggles the view in the current ChatGPT tab.
// No background conversation access, network requests, or API key.
chrome.action.onClicked.addListener(async tab => {
  if (!tab?.id) return;
  if (!/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(tab.url || '')) {
    await chrome.tabs.create({ url: 'https://chatgpt.com/' });
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'GPTDRAW_TOGGLE' });
  } catch {
    // The tab can predate extension installation; refreshing loads the content script.
  }
});

// One-time privacy cleanup from the superseded API/gateway implementation.
// Only remove exact legacy keys; preserve user-owned v2 layout positions.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove(['gptdraw:workspace:v1','gptdraw:gateway-pair-token'])
    .catch(() => {});
});

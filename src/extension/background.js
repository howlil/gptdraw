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

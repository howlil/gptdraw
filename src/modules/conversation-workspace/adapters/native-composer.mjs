// UI-only bridge. Uses the actual ChatGPT composer and its visible Send button.
// No internal APIs, React stores or fake response generation.
const EDITOR = '#prompt-textarea,[data-testid="composer-text-input"],form .ProseMirror[contenteditable="true"],[contenteditable="true"][data-placeholder]';
const SEND = 'button[data-testid="send-button"],#composer-submit-button,button[aria-label="Send prompt"],button[aria-label="Send message"],button[aria-label="Send"]';

export function findNativeComposer(doc) {
  return doc.querySelector(EDITOR);
}
export async function prepareNativePrompt(doc, prompt) {
  const text = String(prompt || '').trim();
  if (!text) throw new Error('Write a message first.');
  if (text.length > 12000) throw new Error('Message is too long.');
  const editor = findNativeComposer(doc);
  if (!editor) throw new Error('The ChatGPT composer is unavailable. Open a regular chat and try again.');
  const existing = (editor.value ?? editor.textContent ?? '').trim();
  if (existing && existing !== text)
    throw new Error('ChatGPT already has an unsent draft. Open its native composer to avoid overwriting it.');

  editor.focus();
  if (existing !== text) {
    if (editor.matches?.('textarea,input')) {
      const prototype = editor.tagName === 'TEXTAREA'
        ? doc.defaultView?.HTMLTextAreaElement?.prototype
        : doc.defaultView?.HTMLInputElement?.prototype;
      const setter = prototype && Object.getOwnPropertyDescriptor(prototype,'value')?.set;
      if (setter) setter.call(editor,text);
      else editor.value = text;
      editor.dispatchEvent(new Event('input',{bubbles:true}));
    } else {
      const selection=doc.getSelection?.(), range=doc.createRange?.();
      if (!selection || !range || typeof doc.execCommand !== 'function')
        throw new Error('Cannot safely edit the native ChatGPT composer.');
      range.selectNodeContents(editor);
      selection.removeAllRanges();selection.addRange(range);
      const succeeded=doc.execCommand('insertText',false,text);
      if (!succeeded) throw new Error('ChatGPT did not accept the prompt input.');
    }
  }

  return {status:'prepared'};
}
export async function submitNativePrompt(doc,prompt,nextFrame=callback=>requestAnimationFrame(callback)) {
  await prepareNativePrompt(doc,prompt);
  const editor=findNativeComposer(doc);
  // Let the site's actual composer react to its input event before clicking.
  await new Promise(resolve => nextFrame(resolve));
  const parent=editor.closest?.('form') || doc;
  const send=parent.querySelector?.(SEND) || doc.querySelector(SEND);
  if (send && !send.disabled && send.getAttribute?.('aria-disabled') !== 'true') {
    send.click();
    return { status:'activated' }; // Do not claim delivery until a native turn appears.
  }
  return { status:'prepared' }; // Draft remains in ChatGPT for manual send.
}

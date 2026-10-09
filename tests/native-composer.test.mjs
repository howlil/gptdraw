import test from 'node:test';
import assert from 'node:assert/strict';
import { findNativeComposer, submitNativePrompt } from '../src/modules/conversation-workspace/adapters/native-composer.mjs';

function fixture({ previous='', disabled=false, hasButton=true }={}) {
  const events=[];
  let clicks=0;
  const button={disabled, getAttribute:()=>null, click:()=>clicks++};
  const parent={querySelector:()=>hasButton?button:null};
  const editor={
    tagName:'TEXTAREA',value:previous,
    focus(){events.push('focus');},
    matches:selector=>selector.includes('textarea'),
    closest:()=>parent,
    dispatchEvent:event=>{events.push(event.type);return true;}
  };
  const doc={
    querySelector:selector=>selector.includes('#prompt-textarea')?editor:null,
    defaultView:{ HTMLTextAreaElement:{prototype:{
      set value(text){ this.value=text; }
    }}}
  };
  return {doc,editor,events,get clicks(){return clicks;}};
}
const frame=fn=>fn();

test('start card submits through real native composer, not another API',async()=>{
  const f=fixture();
  const result=await submitNativePrompt(f.doc,'Hello from gptdraw',frame);
  assert.equal(result.status,'activated');
  assert.equal(f.editor.value,'Hello from gptdraw');
  assert.equal(f.clicks,1);
  assert.deepEqual(f.events,['focus','input']);
});
test('an unavailable native send button keeps a prepared draft instead of faking success',async()=>{
  const f=fixture({hasButton:false});
  const result=await submitNativePrompt(f.doc,'Keep this text',frame);
  assert.equal(result.status,'prepared');
  assert.equal(f.editor.value,'Keep this text');
  assert.equal(f.clicks,0);
});
test('existing native draft is never overwritten by start card',async()=>{
  const f=fixture({previous:'Important native draft'});
  await assert.rejects(submitNativePrompt(f.doc,'New prompt',frame),/already has an unsent draft/);
  assert.equal(f.editor.value,'Important native draft');
  assert.equal(f.clicks,0);
});
test('bridge reports missing ChatGPT editor instead of silently sending',async()=>{
  const doc={querySelector:()=>null};
  assert.equal(findNativeComposer(doc),null);
  await assert.rejects(submitNativePrompt(doc,'Hello',frame),/unavailable/);
});

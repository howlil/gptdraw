import test from 'node:test';
import assert from 'node:assert/strict';
import {yieldForHistory} from '../src/modules/conversation-workspace/adapters/history.mjs';

test('background history waits while the user is interacting',async()=>{
  let active=true,waits=0;
  const ok=await yieldForHistory({},new AbortController().signal,{
    isInteracting:()=>active,
    wait:async()=>{waits++;active=false;}
  });
  assert.equal(ok,true);
  assert.equal(waits,1);
});
test('hidden tab yields until visible and honours cancellation',async()=>{
  const doc={visibilityState:'hidden'};let count=0;
  const abort=new AbortController();
  const result=await yieldForHistory(doc,abort.signal,{wait:async()=>{
    count++;abort.abort();doc.visibilityState='visible';
  }});
  assert.equal(result,false);
  assert.equal(count,1);
});
test('uses browser idle callback when available',async()=>{
  let called=0;
  const doc={defaultView:{requestIdleCallback:cb=>{called++;cb();return 1;}}};
  assert.equal(await yieldForHistory(doc,null),true);
  assert.equal(called,1);
});

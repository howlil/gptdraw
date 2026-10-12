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

test('pending idle callback abort resolves instead of hanging history shutdown',async()=>{
  const abort=new AbortController();
  let cancelled=0;
  const doc={defaultView:{
    requestIdleCallback:()=>7,
    cancelIdleCallback:id=>{assert.equal(id,7);cancelled++;}
  }};
  const waiting=yieldForHistory(doc,abort.signal);
  abort.abort();
  assert.equal(await waiting,false);
  assert.equal(cancelled,1);
});
test('input resuming between idle scheduling and scan yields again',async()=>{
  let active=false,calls=0,waits=0;
  const doc={defaultView:{requestIdleCallback:callback=>{
    calls++;active=calls===1;callback();return calls;
  }}};
  const result=await yieldForHistory(doc,new AbortController().signal,{
    isInteracting:()=>active,
    wait:async()=>{waits++;active=false;}
  });
  assert.equal(result,true);
  assert.equal(calls,2);
  assert.equal(waits,1);
});

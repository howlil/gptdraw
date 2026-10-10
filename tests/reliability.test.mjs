import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceController} from '../src/modules/conversation-workspace/controller/workspace.mjs';
import {mergeAnchoredHistory} from '../src/modules/conversation-workspace/core/history.mjs';

const messages=[
  {id:'user:uuid-u',role:'user',text:'Prompt'},
  {id:'assistant:uuid-a',role:'assistant',text:'Answer',blocks:[{kind:'paragraph',text:'Answer'}]}
];
const nextTick=()=>new Promise(resolve=>setTimeout(resolve,0));

test('closing while asynchronous layout restoration is running never resurrects an observer',async()=>{
 let complete;
 const slow=new Promise(resolve=>{complete=resolve;});
 let started=0;
 const controller=createWorkspaceController({
  pathname:()=>'/c/old',
  layoutStorage:{read:()=>slow,write:async()=>{}},
  observe:cb=>({start(){started++;cb.onSnapshot(messages);},stop(){}}),
  onUpdate:()=>{}
 });
 const starting=controller.start();
 controller.stop();
 complete({});
 await starting;
 assert.equal(started,0);
});
test('drag then navigate captures original route even when write is asynchronous',async()=>{
 const writes=[];let callbacks;
 const ctrl=createWorkspaceController({
  pathname:()=>'/c/routeA',
  layoutStorage:{
   read:async()=>({}),
   write:async(key,positions)=>{await nextTick();writes.push({key,positions});}
  },
  observe:cb=>{callbacks=cb;return{start(){cb.onSnapshot(messages);},stop(){}};},
  onUpdate:()=>{}
 });
 await ctrl.start();
 ctrl.move('user:uuid-u',{x:220,y:300});
 callbacks.onRoute('/c/routeB');
 await nextTick();await nextTick();
 assert.deepEqual(writes[0],{key:'conversation:routeA',
   positions:{'user:uuid-u':{x:220,y:300}}});
 assert.equal(ctrl.snapshot().route,'conversation:routeB');
 await ctrl.persist();
 ctrl.stop();
});
test('repeated quick open/close cannot leak observer',async()=>{
 let started=0,stopped=0;
 const ctrl=createWorkspaceController({
  pathname:()=>'/c/r',
  layoutStorage:{read:async()=>({}),write:async()=>{}},
  observe:cb=>({start(){started++;cb.onSnapshot(messages);},stop(){stopped++;}}),
  onUpdate:()=>{}
 });
 for(let i=0;i<8;i++){const startedPromise=ctrl.start();ctrl.stop();await startedPromise;}
 assert.equal(started,stopped);
 await ctrl.start();ctrl.stop();
 assert.equal(started,stopped);
});
test('unanchored older DOM windows remain unresolved, never create false sequence edges',()=>{
 const known=[{id:'u4',role:'user',text:'Old A'},{id:'a4',role:'assistant',text:'Answer A'}];
 const disjoint=[{id:'u1',role:'user',text:'Earlier question'}];
 const first=mergeAnchoredHistory(known,disjoint,[],true);
 assert.deepEqual(first.messages.map(x=>x.id),['u4','a4']);
 assert.equal(first.unresolved.length,1);
 const bridging=[{id:'u1',role:'user',text:'Earlier question'},
   {id:'u4',role:'user',text:'Old A'}];
 const resolved=mergeAnchoredHistory(first.messages,bridging,first.unresolved,true);
 assert.deepEqual(resolved.messages.map(x=>x.id),['u1','u4','a4']);
 assert.equal(resolved.unresolved.length,0);
});
test('format-only streaming mutation updates focused turn even if text matches',async()=>{
 let callbacks,latestChange;
 const ctrl=createWorkspaceController({
  pathname:()=>'/c/r',
  layoutStorage:{read:async()=>({}),write:async()=>{}},
  observe:cb=>{callbacks=cb;return{start(){cb.onSnapshot(messages);},stop(){}};},
  onUpdate:(_,change)=>{latestChange=change;}
 });
 await ctrl.start();
 callbacks.onPatch({...messages[1],blocks:[{kind:'paragraph',text:'Answer',
    inline:[{text:'Answer',href:'https://example.com'}]}]});
 assert.deepEqual(latestChange,{type:'patch',turnId:'user:uuid-u'});
 assert.equal(ctrl.snapshot().turns[0].answerBlocks[0].inline[0].href,'https://example.com');
 ctrl.stop();
});

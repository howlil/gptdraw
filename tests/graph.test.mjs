import test from 'node:test';
import assert from 'node:assert/strict';
import { pairMessages,routeKey,layoutPoint,safePoint } from '../src/modules/conversation-workspace/core/graph.mjs';
import { createWorkspaceController } from '../src/modules/conversation-workspace/controller/workspace.mjs';
import { createLayoutStorage } from '../src/modules/conversation-workspace/adapters/metadata.mjs';

test('each card pairs one user prompt with the following assistant output',()=>{
  const rows=pairMessages([
    {id:'u1',role:'user',text:'What is consistency?'},
    {id:'a1',role:'assistant',text:'Consistency means...'},
    {id:'u2',role:'user',text:'What about eventual consistency?'},
    {id:'a2',role:'assistant',text:'Eventual consistency is...'}
  ]);
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(x=>x.id),['u1','u2']);
  assert.equal(rows[0].answer,'Consistency means...');
  assert.equal(rows[1].answer,'Eventual consistency is...');
  assert.equal(rows[0].pending,false);
  assert.equal(rows[0].anchorId,'u1');
});

test('incomplete assistant reply remains visibly pending; orphan answer never invents a prompt',()=>{
  const rows=pairMessages([
    {id:'a0',role:'assistant',text:'Unpaired'},
    {id:'u1',role:'user',text:'Waiting'},
    {id:'a1',role:'assistant',text:''}
  ]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].pending,true);
  assert.equal(rows[0].prompt,'Waiting');
});

test('route-scoped layout keys and positions are validated',()=>{
  assert.equal(routeKey('/c/abc-42'),'conversation:abc-42');
  assert.equal(routeKey('/'),'route:/');
  assert.deepEqual(layoutPoint(2),{x:1082,y:140});
  assert.deepEqual(safePoint({x:'18',y:22}),{x:18,y:22});
  assert.equal(safePoint({x:Infinity,y:22}),null);
  assert.equal(safePoint({x:1e9,y:22}),null);
});

test('metadata adapter stores positions only, not ChatGPT message content',async()=>{
  const state={};
  const adapter=createLayoutStorage({
    async get(key){return {[key]:state[key]};},
    async set(entry){Object.assign(state,entry);}
  });
  await adapter.write('conversation:test',{u1:{x:100,y:200}});
  assert.deepEqual(await adapter.read('conversation:test'),{u1:{x:100,y:200}});
  assert.equal(JSON.stringify(state).includes('message'),false);
});

test('controller projects visible messages, updates only layout and restores positions',async()=>{
  let callbacks;let stopped=false, written=null, snapshot, lastChange;
  const controller=createWorkspaceController({
    pathname:()=>'/c/test',
    observe:cb=>{callbacks=cb;return {
      start(){cb.onSnapshot([{id:'u1',role:'user',text:'Question'}, {id:'a1',role:'assistant',text:'Answer'}]);},
      stop(){stopped=true;},
      getElement(id){return id==='u1'?{id:'native'}:null;},
      refresh(){cb.onSnapshot([{id:'u1',role:'user',text:'Question'}, {id:'a1',role:'assistant',text:'Updated'}]);}
    };},
    layoutStorage:{read:async()=>({u1:{x:100,y:200}}),write:async(route,points)=>{written={route,points};}},
    onUpdate:(state,change)=>{snapshot=state;lastChange=change;}
  });
  await controller.start();
  assert.equal(snapshot.turns[0].answer,'Answer');
  assert.deepEqual(snapshot.positions.u1,{x:100,y:200});
  callbacks.onPatch({id:'a1',role:'assistant',text:'Updated in place'});
  assert.equal(snapshot.turns[0].answer,'Updated in place');
  assert.deepEqual(lastChange,{type:'patch',turnId:'u1'});
  controller.move('u1',{x:240,y:340});
  assert.deepEqual(lastChange,{type:'position',turnId:'u1'});
  await controller.persist();
  assert.deepEqual(written,{route:'conversation:test',points:{u1:{x:240,y:340}}});
  assert.equal(controller.getSource('u1').id,'native');
  controller.refresh();
  assert.equal(snapshot.turns[0].answer,'Updated');
  controller.stop();
  assert.equal(stopped,true);
});

test('controller moves safely across ChatGPT route changes',async()=>{
  let cb, snapshot;
  const controller=createWorkspaceController({
    pathname:()=>'/c/first',
    observe:x=>{cb=x;return{start(){x.onSnapshot([{id:'u',role:'user',text:'one'}]);},stop(){},refresh(){},getElement(){return null;}};},
    layoutStorage:{read:async(route)=>route==='conversation:second'?{u2:{x:50,y:60}}:{},write:async()=>{}},
    onUpdate:state=>snapshot=state
  });
  await controller.start();
  cb.onRoute('/c/second');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(snapshot.route,'conversation:second');
  assert.deepEqual(snapshot.positions,{u2:{x:50,y:60}});
  controller.stop();
});

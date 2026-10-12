import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceController} from '../src/modules/conversation-workspace/controller/workspace.mjs';

const stable=(id,role,text)=>({id,role,text,identity:'stable',durableId:id});
const candidate=(id,role,text)=>({id,role,text,identity:'candidate',durableId:null});
function setup(rows){
  let callbacks,last;
  const controller=createWorkspaceController({
    pathname:()=>'/c/source',
    layoutStorage:{read:async()=>({}),write:async()=>{},readBookmarks:async()=>[],
      writeBookmarks:async()=>{}},
    branchStorage:{list:async()=>[],pending:async()=>null,subscribe:()=>()=>{}},
    prepareFork:async()=>({activate(){}}),
    observe:cb=>{callbacks=cb;return{start(){cb.onSnapshot(rows);},
      stop(){},getElement:()=>null};},
    onUpdate:s=>{last=s;}
  });
  return {controller,callbacks:()=>callbacks,state:()=>last};
}
test('candidate DOM identifiers never enable durable Bookmark or Fork UI',async()=>{
  const env=setup([
    candidate('user:opaque-id','user','Question'),
    candidate('assistant:opaque-answer','assistant','Answer')]);
  await env.controller.start();
  const turn=env.state().turns[0];
  assert.equal(turn.canBookmark,false);
  assert.equal(turn.canFork,false);
  await assert.rejects(env.controller.toggleBookmark(turn.id),/durable/);
  await assert.rejects(env.controller.fork(turn.id),/durable/);
  env.controller.stop();
});
test('durable IDs enable eligible actions only after an actual answer appears',async()=>{
  const env=setup([
    stable('user:msg-a','user','Question'),
    stable('assistant:msg-b','assistant','')]);
  await env.controller.start();
  assert.equal(env.state().turns[0].canBookmark,true);
  assert.equal(env.state().turns[0].canFork,false);
  env.callbacks().onPatch(stable('assistant:msg-b','assistant','Actual rendered response'));
  assert.equal(env.state().turns[0].canFork,true);
  env.controller.stop();
});
test('temporarily observed aliases remain read-only until durable identity exists',async()=>{
  const env=setup([
    {id:'user:conversation-turn-0',identity:'ephemeral',role:'user',text:'Question'},
    {id:'assistant:conversation-turn-1',identity:'ephemeral',role:'assistant',text:'Answer'}]);
  await env.controller.start();
  const turn=env.state().turns[0];
  assert.equal(turn.canBookmark,false);
  assert.equal(turn.canFork,false);
  env.controller.stop();
});

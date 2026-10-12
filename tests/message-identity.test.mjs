import test from 'node:test';
import assert from 'node:assert/strict';
import {stableMessageId,hasDurableSource,sourceDescriptor,matchesLiveSource}
  from '../src/modules/conversation-workspace/core/message-identity.mjs';
import {collectMessages} from '../src/modules/conversation-workspace/adapters/chatgpt-dom.mjs';
import {createWorkspaceController} from '../src/modules/conversation-workspace/controller/workspace.mjs';

function fakeMessage(attrs,text='A visible message') {
  const node={isConnected:true,textContent:text,
    getAttribute:key=>attrs[key]??null,
    querySelector:()=>null,querySelectorAll:()=>[],closest:()=>null};
  return node;
}
function scanOne(node){
  const root={querySelectorAll:selector=>
    selector.startsWith('[data-testid^=')?[node]:[]};
  return collectMessages(root);
}
test('identity provenance is taken from actual DOM attributes, never from opaque ID shape',()=>{
  const durable=scanOne(fakeMessage({'data-turn':'user','data-message-id':'msg-100'}))[0];
  assert.equal(durable.id,'user:msg-100');
  assert.equal(durable.identity,'stable');
  assert.equal(durable.durableId,'user:msg-100');
  assert.equal(hasDurableSource(durable),true);
  const candidate=scanOne(fakeMessage({'data-turn':'user','data-turn-id':'opaque-100'}))[0];
  assert.equal(candidate.identity,'candidate');
  assert.equal(hasDurableSource(candidate),false,'opaque turn-id is not confirmed durable');
  const positional=scanOne(fakeMessage({'data-turn':'user','data-testid':'conversation-turn-2'}))[0];
  assert.equal(positional.identity,'ephemeral');
  assert.equal(positional.durableId,null);
  assert.equal(hasDurableSource(positional),false);
});
test('observed aliases, role-position ids and turn keys are never durable',()=>{
  for(const id of ['assistant:observed:12','user:observed:xyz','assistant:visible:3',
    'user:conversation-turn-7','user:turn-key:abcd']){
    assert.equal(stableMessageId(id),false,id);
  }
  assert.equal(stableMessageId('assistant:msg-99'),true);
  assert.equal(hasDurableSource({id:'assistant:opaque',identity:'candidate'}),false);
  assert.equal(sourceDescriptor({id:'assistant:observed:1',nativeId:'assistant:conversation-turn-4',
    role:'assistant',identity:'ephemeral'}).durableId,null);
});
test('recycled native nodes cannot satisfy ephemeral or candidate source resolution',()=>{
  const node={isConnected:true};
  const row={id:'assistant:observed:4',nativeId:'assistant:conversation-turn-8',
    identity:'ephemeral',role:'assistant',element:node,text:'Original'};
  assert.equal(matchesLiveSource(row,node),true);
  assert.equal(matchesLiveSource(row,{isConnected:true}),false);
  row.source={isConnected:true,textContent:'Original'};
  assert.equal(matchesLiveSource(row,node),true);
  row.source.textContent='Recycled unrelated answer';
  assert.equal(matchesLiveSource(row,node),false);
  assert.equal(matchesLiveSource(row,{isConnected:false}),false);
});
test('Open Source maps RAM-only graph IDs to their exact currently connected native node',async()=>{
  const n1={isConnected:true},n2={isConnected:true};
  const source1={textContent:'Question',isConnected:true};
  const source2={textContent:'Answer',isConnected:true};
  const values=[
    {id:'user:conversation-turn-0',identity:'ephemeral',role:'user',
      text:'Question',element:n1,source:source1},
    {id:'assistant:conversation-turn-1',identity:'ephemeral',role:'assistant',
      text:'Answer',element:n2,source:source2}
  ];
  let callbacks,state,recovered=0,prepared=0;
  const controller=createWorkspaceController({
    pathname:()=>'/c/abc',
    layoutStorage:{read:async()=>({}),write:async()=>{},writeBookmarks:async()=>{}},
    branchStorage:{list:async()=>[],pending:async()=>null,subscribe:()=>()=>{}},
    prepareFork:async()=>{prepared++;return{activate(){}};},
    resolveForkSource:async()=>{recovered++;return null;},
    observe:cb=>{callbacks=cb;return{
      start(){cb.onSnapshot(values);},stop(){},
      getElement(id){return id===values[0].id?n1:id===values[1].id?n2:null;}
    };},
    onUpdate:s=>{state=s;}
  });
  await controller.start();
  const turn=state.turns[0];
  assert.match(turn.id,/observed:/);
  assert.equal(controller.getSource(turn.userId),n1);
  assert.equal(await controller.resolveSource(turn.assistantId),n2);
  await assert.rejects(controller.toggleBookmark(turn.id),/durable/);
  await assert.rejects(controller.fork(turn.id),/durable/);
  assert.equal(prepared,0,'native Fork never fires for ephemeral identity');
  n1.isConnected=false;
  assert.equal(await controller.resolveSource(turn.userId),null);
  assert.equal(recovered,0,'never scan old history for a recycled ID');
  n1.isConnected=true;
  source1.textContent='Different source';
  assert.equal(controller.getSource(turn.userId),null,'recycled element content cannot be used');
  callbacks.onRoute('/c/other');
  assert.equal(await controller.resolveSource(turn.userId),null);
  controller.stop();
});
test('candidate native rows are navigable live but never allowed into persistent bookmark',async()=>{
  const node={isConnected:true};
  let cb,snapshot;
  const ctrl=createWorkspaceController({
    pathname:()=>'/c/abc',
    layoutStorage:{read:async()=>({}),write:async()=>{},writeBookmarks:async()=>{}},
    observe:callback=>{cb=callback;return{start(){callback.onSnapshot([
      {id:'user:opaque-turn',identity:'candidate',durableId:null,role:'user',
        element:node,text:'Question'}]);},stop(){},getElement:()=>node};},
    onUpdate:value=>{snapshot=value;}
  });
  await ctrl.start();
  assert.equal(await ctrl.resolveSource(snapshot.turns[0].id),node);
  await assert.rejects(ctrl.toggleBookmark(snapshot.turns[0].id),/durable/);
  ctrl.stop();
});

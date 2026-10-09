import test from 'node:test';
import assert from 'node:assert/strict';
import {createPendingBranch,confirmBranch,branchRelations,quoteAnchor,stableMessageId}
  from '../src/modules/conversation-workspace/core/branch.mjs';
import {createBranchStorage} from '../src/modules/conversation-workspace/adapters/branches.mjs';
import {createWorkspaceController} from '../src/modules/conversation-workspace/controller/workspace.mjs';
import {findNativeMoreButton,findNativeBranchAction,prepareNativeBranch}
  from '../src/modules/conversation-workspace/adapters/chatgpt-branch.mjs';

const args={id:'fork-1',parentConversationId:'parent',sourceMessageId:'assistant:uuid-abc'};
test('stable source required; native positional IDs never become persistent lineage',()=>{
  assert.equal(stableMessageId('assistant:conversation-turn-4'),false);
  assert.equal(stableMessageId('assistant:visible:5'),false);
  assert.equal(stableMessageId('assistant:uuid-abc'),true);
  assert.throws(()=>createPendingBranch({...args,sourceMessageId:'assistant:conversation-turn-4'}),/stable/);
});
test('confirmed branch keeps parent/root and forbids duplicates or cycles',()=>{
  const pending=createPendingBranch(args);
  const confirmed=confirmBranch([],pending,'child');
  assert.equal(confirmed.status,'confirmed');
  assert.equal(branchRelations([confirmed],'child').parent.parentConversationId,'parent');
  assert.equal(branchRelations([confirmed],'parent').children.length,1);
  assert.throws(()=>confirmBranch([confirmed],createPendingBranch({...args,id:'fork-2'}),'child'),/already linked/);
  const reverse=createPendingBranch({id:'reverse',parentConversationId:'child',sourceMessageId:'assistant:stable'});
  assert.throws(()=>confirmBranch([confirmed],reverse,'parent'),/cycle/);
  assert.throws(()=>confirmBranch([],pending,'parent'),/different/);
});
test('quote metadata saves digest/offset but no quoted text',async()=>{
  const quote='Atomicity is all or nothing';
  const anchor=await quoteAnchor({text:quote,blockIndex:2,start:10,end:10+quote.length});
  assert.match(anchor.digest,/^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(anchor).includes('Atomicity'),false);
  const pending=createPendingBranch({...args,anchor});
  assert.equal(pending.source.anchor.blockIndex,2);
  assert.equal(JSON.stringify(pending).includes(quote),false);
  assert.throws(()=>createPendingBranch({...args,anchor:{blockIndex:0,start:5,end:2,digest:'x'}}),/anchor/);
});
test('branch storage persists only verified relations and a short-lived pending intent',async()=>{
  const state={};
  const storage=createBranchStorage({
    async get(key){return {[key]:state[key]};},
    async set(values){Object.assign(state,values);},
    async remove(key){delete state[key];}
  });
  const pending=createPendingBranch(args);
  await storage.setPending(pending);
  assert.equal((await storage.pending()).id,'fork-1');
  assert.deepEqual(await storage.list(),[]);
  const confirmed=confirmBranch([],pending,'child');
  await storage.save([confirmed]);
  assert.equal((await storage.list())[0].childConversationId,'child');
  await storage.clearPending();
  assert.equal(await storage.pending(),null);
});
test('native Branch is only clickable after the real message-specific menu item exists',async()=>{
  let nativeClicks=0,menuClicks=0,shown=false;
  const item={isConnected:true,getAttribute:()=>null,
    textContent:'Branch in new chat',
    closest:selector=>selector.includes('[role="menu"]')?{}:null,
    click(){nativeClicks++;}
  };
  const doc={querySelectorAll:()=>shown?[item]:[]};
  const more={isConnected:true,disabled:false,getAttribute:key=>key==='aria-label'?'More actions':null,
    click(){menuClicks++;shown=true;}};
  const root={isConnected:true,querySelectorAll:()=>[more],closest:()=>null};
  const prepared=await prepareNativeBranch(doc,root,{wait:async()=>{}});
  assert.equal(nativeClicks,0);
  assert.equal(menuClicks,1);
  prepared.activate();
  assert.equal(nativeClicks,1);
  assert.equal(findNativeMoreButton(root),more);
  assert.equal(findNativeBranchAction(doc),item);
  shown=false;
  await assert.rejects(prepareNativeBranch(doc,root,{wait:async()=>{shown=false;}}),/not found/);
});
test('workspace fork creates pending metadata, waits for explicit child confirmation, then navigable lineage',async()=>{
  let nativeClicks=0,callbacks,state;
  const memory={};
  const branchStorage=createBranchStorage({
    get:async key=>({[key]:memory[key]}),
    set:async item=>Object.assign(memory,item),
    remove:async key=>{delete memory[key];}
  });
  const node={isConnected:true};
  const controller=createWorkspaceController({
    pathname:()=>'/c/parent',idFactory:()=> 'fork-controller-1',
    layoutStorage:{read:async()=>({}),write:async()=>{}},
    branchStorage,
    prepareFork:async source=>{assert.equal(source,node);return{activate:()=>{nativeClicks++;}};},
    observe:x=>{callbacks=x;return{
      start(){x.onSnapshot([
        {id:'user:uuid-u',role:'user',text:'Why?'},
        {id:'assistant:uuid-a',role:'assistant',text:'Because.'}
      ]);},stop(){},getElement:id=>id==='assistant:uuid-a'?node:null,refresh(){}
    };},
    onUpdate:s=>{state=s;}
  });
  await controller.start();
  const pending=await controller.fork('user:uuid-u');
  assert.equal(pending.parentConversationId,'parent');
  assert.equal(nativeClicks,1);
  assert.deepEqual(state.branches,[]);
  callbacks.onRoute('/c/child');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(state.pendingBranch.id,pending.id);
  await controller.confirmPending();
  assert.equal(state.relations.parent.parentConversationId,'parent');
  assert.equal((await branchStorage.list())[0].childConversationId,'child');
  assert.equal(await branchStorage.pending(),null);
  controller.stop();
});

test('pending Fork blocks a second native action before opening another menu',async()=>{
 let prepared=0;
 const controller=createWorkspaceController({
   pathname:()=>'/c/parent',
   layoutStorage:{read:async()=>({}),write:async()=>{}},
   branchStorage:{list:async()=>[],pending:async()=>({id:'still-pending',status:'pending'}),
     subscribe:()=>()=>{}},
   prepareFork:async()=>{prepared++;return{activate(){}};},
   observe:cb=>({start(){cb.onSnapshot([
     {id:'user:uuid-u',role:'user',text:'Question'},
     {id:'assistant:uuid-a',role:'assistant',text:'Answer'}
   ]);},stop(){},getElement:()=>({isConnected:true})}),
   onUpdate:()=>{}
 });
 await controller.start();
 await assert.rejects(controller.fork('user:uuid-u'),/previous Fork/);
 assert.equal(prepared,0);
 controller.stop();
});

test('branch compare previews originate only from visited, actual DOM-derived turns',async()=>{
 let callback,last,storageWrites=0;
 const controller=createWorkspaceController({
   pathname:()=>'/c/root',
   layoutStorage:{read:async()=>({}),readBookmarks:async()=>[],write:async()=>{storageWrites++;}},
   observe:cb=>{callback=cb;return{
     start(){cb.onSnapshot([
       {id:'user:root-u',role:'user',text:'Root prompt'},
       {id:'assistant:root-a',role:'assistant',text:'Root genuine answer'}
     ]);},stop(){},getElement(){return null;}}},
   onUpdate:state=>{last=state;}
 });
 await controller.start();
 assert.equal(last.previews.root.answer,'Root genuine answer');
 callback.onRoute('/c/child');
 await new Promise(resolve=>setTimeout(resolve,0));
 callback.onSnapshot([
   {id:'user:child-u',role:'user',text:'Child prompt'},
   {id:'assistant:child-a',role:'assistant',text:'Child genuine answer'}
 ]);
 assert.equal(last.previews.root.answer,'Root genuine answer');
 assert.equal(last.previews.child.answer,'Child genuine answer');
 assert.equal(storageWrites,0,'volatile branch preview is not persisted');
 assert.equal(last.previews.unknown,undefined);
 controller.stop();
});

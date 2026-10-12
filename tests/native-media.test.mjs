import test from 'node:test';
import assert from 'node:assert/strict';
import {pairMessages} from '../src/modules/conversation-workspace/core/graph.mjs';
import {createWorkspaceController} from '../src/modules/conversation-workspace/controller/workspace.mjs';

test('media-only answers remain completed rather than claiming ChatGPT is still thinking',()=>{
  const turns=pairMessages([
    {id:'user:msg-u',role:'user',text:'Generate a diagram'},
    {id:'assistant:msg-a',role:'assistant',text:'',blocks:[],hasNativeMedia:true}
  ]);
  assert.equal(turns.length,1);
  assert.equal(turns[0].pending,false);
  assert.equal(turns[0].hasNativeMedia,true);
});
test('media presence changes during streaming produce a patch even with unchanged text',async()=>{
  let cb,snapshot,lastChange;
  const ctrl=createWorkspaceController({
    pathname:()=>'/c/media',
    layoutStorage:{read:async()=>({}),write:async()=>{}},
    observe:callback=>{cb=callback;return{start(){callback.onSnapshot([
      {id:'user:msg-u',role:'user',text:'Show image',identity:'stable',
        durableId:'user:msg-u'},
      {id:'assistant:msg-a',role:'assistant',text:'',blocks:[],
        hasNativeMedia:false,identity:'stable',durableId:'assistant:msg-a'}
    ]);},stop(){}};},
    onUpdate:(next,change)=>{snapshot=next;lastChange=change;}
  });
  await ctrl.start();
  assert.equal(snapshot.turns[0].pending,true);
  cb.onPatch({id:'assistant:msg-a',role:'assistant',text:'',blocks:[],
    hasNativeMedia:true,identity:'stable',durableId:'assistant:msg-a'});
  assert.equal(snapshot.turns[0].pending,false);
  assert.equal(snapshot.turns[0].hasNativeMedia,true);
  assert.equal(snapshot.turns[0].canFork,true);
  assert.deepEqual(lastChange,{type:'patch',turnId:'user:msg-u'});
  ctrl.stop();
});

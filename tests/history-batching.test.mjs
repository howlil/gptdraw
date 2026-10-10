import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceController} from '../src/modules/conversation-workspace/controller/workspace.mjs';
test('backfill coalesces structural commits while manual/suspended scan remains immediate',async()=>{
  let cb,snapshots=0,latest;
  const ctrl=createWorkspaceController({
    pathname:()=>'/c/long',layoutStorage:{read:async()=>({}),write:async()=>{}},
    observe:on=>{cb=on;return{start(){on.onSnapshot([
      {id:'u0',role:'user',text:'First'}]);},stop(){},refresh(){}}},
    onUpdate:(state,change)=>{
      latest=state;
      if(change?.type==='snapshot')snapshots++;
    }
  });
  await ctrl.start();
  assert.equal(snapshots,1);
  cb.onHistory({status:'loading',phase:'up',count:1});
  cb.onSnapshot([{id:'u0',role:'user',text:'First'},
    {id:'u1',role:'user',text:'Second'}]);
  cb.onSnapshot([{id:'u0',role:'user',text:'First'},
    {id:'u1',role:'user',text:'Second'},
    {id:'u2',role:'user',text:'Third'}]);
  assert.equal(snapshots,1);
  cb.onHistory({status:'reached-top',phase:'up',count:3});
  assert.equal(snapshots,2);
  assert.equal(latest.turns.length,3);
  cb.onSnapshot([{id:'u0',role:'user',text:'First'},
    {id:'u1',role:'user',text:'Second'},
    {id:'u2',role:'user',text:'Third'},
    {id:'u3',role:'user',text:'Fourth'}]);
  assert.equal(snapshots,3);
  ctrl.stop();
});

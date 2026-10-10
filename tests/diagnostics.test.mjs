import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceController} from '../src/modules/conversation-workspace/controller/workspace.mjs';
test('diagnostic report cannot expose native ChatGPT message text',async()=>{
 let last;
 const ctrl=createWorkspaceController({
  pathname:()=>'/c/private',
  layoutStorage:{read:async()=>({}),write:async()=>{}},
  observe:cb=>({
    start(){cb.onSnapshot([{id:'user:id-1',role:'user',text:'Sensitive prompt'},
      {id:'assistant:id-2',role:'assistant',text:'Private answer'}]);},
    stop(){},getElement(){return null;},
    getDiagnostics(){return {domScans:2,patches:0,rootPresent:true};}
  }),
  onUpdate:state=>{last=state;}
 });
 await ctrl.start();
 const report=ctrl.getDiagnostics();
 assert.equal(report.turns,1);
 assert.equal(report.domScans,2);
 assert.equal(report.stableMessages,2);
 assert.doesNotMatch(JSON.stringify(report),/Sensitive|Private|private|id-1|id-2/);
 ctrl.stop();
});

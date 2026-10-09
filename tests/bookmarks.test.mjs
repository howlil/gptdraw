import test from 'node:test';
import assert from 'node:assert/strict';
import {createLayoutStorage} from '../src/modules/conversation-workspace/adapters/metadata.mjs';
import {createWorkspaceController} from '../src/modules/conversation-workspace/controller/workspace.mjs';

function memoryStorage() {
 const data={};
 return {data,async get(key){return {[key]:data[key]};},
   async set(changes){Object.assign(data,changes);}};
}
test('bookmarks persist only native turn IDs per conversation, never message text',async()=>{
 const storage=memoryStorage();
 const adapter=createLayoutStorage(storage);
 const changes=[];
 const controller=createWorkspaceController({
   pathname:()=>'/c/one',layoutStorage:adapter,onUpdate:(state,change)=>changes.push({state,change}),
   observe:cb=>({start(){cb.onSnapshot([
     {id:'user:durable-123',role:'user',text:'Confidential text'},
     {id:'assistant:durable-124',role:'assistant',text:'Secret answer'}
   ]);},stop(){},getElement(){return null;}})
 });
 await controller.start();
 assert.equal(await controller.toggleBookmark('user:durable-123'),true);
 assert.deepEqual(await adapter.readBookmarks('conversation:one'),['user:durable-123']);
 assert.deepEqual(await adapter.readBookmarks('conversation:two'),[]);
 assert.equal(JSON.stringify(storage.data).includes('Confidential'),false);
 assert.equal(JSON.stringify(storage.data).includes('Secret'),false);
 assert.equal(await controller.toggleBookmark('user:durable-123'),false);
 assert.deepEqual(await adapter.readBookmarks('conversation:one'),[]);
 controller.stop();
});
test('refuse recycled IDs and rollback a failed Chrome storage write',async()=>{
 let writes=0,latest;
 const controller=createWorkspaceController({
   pathname:()=>'/c/one',
   layoutStorage:{read:async()=>({}),readBookmarks:async()=>[],
     write:async()=>{},writeBookmarks:async()=>{writes++;throw Error('quota');}},
   onUpdate:state=>{latest=state;},
   observe:cb=>({start(){cb.onSnapshot([
     {id:'user:conversation-turn-0',role:'user',text:'Bad identity'},
     {id:'user:durable',role:'user',text:'Known identity'}
   ]);},stop(){},getElement(){return null;}})
 });
 await controller.start();
 await assert.rejects(controller.toggleBookmark('user:conversation-turn-0'),/durable source ID/);
 await assert.rejects(controller.toggleBookmark('user:durable'),/quota/);
 assert.equal(writes,1);
 assert.deepEqual(latest.bookmarks,[]);
 controller.stop();
});

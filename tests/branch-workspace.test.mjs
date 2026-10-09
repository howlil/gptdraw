import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBranchWorkspace} from '../src/modules/conversation-workspace/core/branch-workspace.mjs';
const edge=(id,parentConversationId,childConversationId,createdAt)=>({
  id,parentConversationId,childConversationId,createdAt,status:'confirmed',
  source:{messageId:'assistant:id-'+id}
});
const branches=[
  edge('a','root','childA',1),edge('b','root','childB',2),
  edge('c','childA','grandchild',3),
  {...edge('pending','root','ghost',4),status:'pending'},
  edge('unrelated','else','unrelated',5)
];
test('a branch workspace includes ancestors, siblings and grandchildren, no unrelated graph',()=>{
 const m=buildBranchWorkspace(branches,'conversation:grandchild');
 assert.equal(m.root,'root');
 assert.deepEqual(new Set(m.nodes.map(n=>n.id)),new Set(['root','childA','childB','grandchild']));
 assert.equal(m.nodes.find(n=>n.id==='grandchild').isCurrent,true);
 assert.equal(m.edges.length,3);
 assert.ok(m.nodes.find(n=>n.id==='childB').x>m.nodes.find(n=>n.id==='root').x);
 assert.ok(m.nodes.every(n=>!('answer'in n)&&!('prompt'in n)));
});
test('standalone conversation is a single honest metadata node',()=>{
 const m=buildBranchWorkspace([], 'conversation:alone');
 assert.deepEqual(m.nodes.map(n=>n.id),['alone']);
 assert.equal(m.edges.length,0);
});
test('non-conversation pages have no manufactured branch graph',()=>{
 assert.deepEqual(buildBranchWorkspace(branches,'route:/').nodes,[]);
});
test('different current branch shares same deterministic tree positions',()=>{
 const x=buildBranchWorkspace(branches,'conversation:root');
 const y=buildBranchWorkspace(branches,'conversation:childB');
 assert.deepEqual(x.nodes.map(n=>({id:n.id,x:n.x,y:n.y})),
 y.nodes.map(n=>({id:n.id,x:n.x,y:n.y})));
});

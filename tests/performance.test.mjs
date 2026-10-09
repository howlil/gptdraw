import test from 'node:test';
import assert from 'node:assert/strict';
import {isCardNearViewport,stabilizeLayout} from '../src/modules/conversation-workspace/core/graph.mjs';
import {mergeVisibleMessages} from '../src/modules/conversation-workspace/core/history.mjs';

test('viewport overscan includes nearby nodes but culls distant cards',()=>{
  const camera={panX:0,panY:0,scale:1,width:1200,height:850};
  assert.equal(isCardNearViewport({x:200,y:200},camera),true);
  assert.equal(isCardNearViewport({x:2000,y:200},camera),false);
  assert.equal(isCardNearViewport({x:-1000,y:-1000},camera),false);
  assert.equal(isCardNearViewport({x:500,y:300},{...camera,panX:-500}),true);
});
test('2000 turns preserve coordinates across prepended history without quadratic layout',()=>{
  const recent=Array.from({length:1200},(_,i)=>({id:'u'+(i+800)}));
  const baseline=stabilizeLayout(recent);
  const old=Array.from({length:800},(_,i)=>({id:'u'+i}));
  const full=stabilizeLayout([...old,...recent],baseline);
  assert.equal(full.size,2000);
  assert.deepEqual(full.get('u800'),baseline.get('u800'));
  assert.equal(full.get('u799').x,baseline.get('u800').x-476);
  assert.equal(full.get('u1999').x,baseline.get('u1999').x);
});
test('2000 virtualized history messages merge without duplication or incorrect ordering',()=>{
  const known=Array.from({length:1000},(_,i)=>({id:'u'+(i+1000),text:'old'}));
  const incoming=Array.from({length:1200},(_,i)=>({id:'u'+i,text:'new'}));
  const merged=mergeVisibleMessages(known,incoming,true);
  assert.equal(merged.length,2000);
  assert.equal(new Set(merged.map(x=>x.id)).size,2000);
  assert.equal(merged[0].id,'u0');
  assert.equal(merged[1999].id,'u1999');
  assert.equal(merged[1000].text,'new');
});

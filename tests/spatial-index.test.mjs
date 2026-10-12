import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSpatialIndex} from '../src/modules/conversation-workspace/core/spatial-index.mjs';
test('grid search finds only nearby cards after pan, zoom and negative drag',()=>{
  const index=buildSpatialIndex([
    {id:'a',x:100,y:100,w:400,h:600},
    {id:'b',x:1600,y:100,w:400,h:600},
    {id:'c',x:-1800,y:-1400,w:400,h:600}]);
  const camera={panX:0,panY:0,scale:1,width:1000,height:850};
  assert.deepEqual(index.query(camera).sort(),['a']);
  assert.ok(index.query({...camera,panX:2000,panY:1400}).includes('c'));
  assert.ok(index.query({...camera,scale:.6}).includes('b'));
});
test('index query on 2000 turns preserves bounded visible result',()=>{
 const items=Array.from({length:2000},(_,i)=>({id:'u'+i,x:i*476,y:140,w:366,h:500}));
 const index=buildSpatialIndex(items);
 const result=index.query({panX:-40000,panY:0,scale:1,width:1200,height:900});
 assert.ok(result.length>0&&result.length<15);
 assert.equal(new Set(result).size,result.length);
});

test('incremental upsert moves one card between cells without stale hits',()=>{
  const index=buildSpatialIndex([
    {id:'a',x:0,y:100,w:366,h:300},
    {id:'b',x:1800,y:100,w:366,h:300}]);
  const camera={panX:0,panY:0,scale:1,width:900,height:600};
  assert.deepEqual(index.query(camera),['a']);
  assert.equal(index.upsert({id:'a',x:3200,y:100,w:366,h:300}),true);
  assert.deepEqual(index.query(camera),[]);
  assert.equal(index.upsert({id:'a',x:3200,y:100,w:366,h:300}),false);
  assert.equal(index.count,2);
  assert.equal(index.remove('a'),true);
  assert.equal(index.remove('a'),false);
  assert.equal(index.count,1);
  assert.equal(index.query({...camera,panX:-3200}).includes('a'),false);
});
test('upserting one resized card does not disturb other cells in a 2000-turn index',()=>{
  const nodes=Array.from({length:2000},(_,i)=>({
    id:'m'+i,x:i*476,y:140,w:366,h:270
  }));
  const index=buildSpatialIndex(nodes);
  const camera={panX:-476*500,panY:0,scale:1,width:1000,height:800};
  const before=new Set(index.query(camera));
  assert.ok(before.has('m500'));
  index.upsert({id:'m500',x:476*500,y:140,w:366,h:1200});
  const after=new Set(index.query(camera));
  assert.deepEqual(after,before);
  assert.equal(index.count,2000);
});

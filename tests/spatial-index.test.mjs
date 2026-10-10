import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSpatialIndex} from '../src/modules/conversation-workspace/core/spatial-index.mjs';
test('grid search finds only nearby cards after pan, zoom and negative drag',()=>{
  const index=buildSpatialIndex([
    {id:'a',x:100,y:100,w:400,h:600},
    {id:'b',x:1600,y:100,w:400,h:600},
    {id:'c',x:-1800,y:-1400,w:400,h:600}]);
  const camera={panX:0,panY:0,scale:1,width:1000,height:850};
  assert.deepEqual(index.query(camera).sort(),['a','b']);
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

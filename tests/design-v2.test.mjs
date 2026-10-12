import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveWorkspaceMode,centerEntryCamera,shouldShowMinimap,calculateGraphBounds} from '../src/modules/conversation-workspace/core/view-mode.mjs';
test('workspace modes distinguish new, loading, unavailable, populated and confirmed branch',()=>{
  assert.equal(deriveWorkspaceMode({route:'route:/',turns:[]}), 'new');
  assert.equal(deriveWorkspaceMode({route:'conversation:abc',turns:[]}), 'loading');
  assert.equal(deriveWorkspaceMode({route:'conversation:abc',turns:[],history:{status:'limited'}}),'unavailable');
  assert.equal(deriveWorkspaceMode({route:'conversation:abc',turns:[{id:'1'}]}),'single');
  assert.equal(deriveWorkspaceMode({route:'conversation:abc',turns:[{id:'1'},{id:'2'}]}),'multi');
  assert.equal(deriveWorkspaceMode({route:'conversation:abc',turns:[{id:'1'}],branches:[{status:'confirmed'}]}),'branched');
});
test('new entry centers at readable scale independent of fixed world offsets',()=>{
  assert.deepEqual(centerEntryCamera(1000,600,366,230),{scale:1,panX:317,panY:185});
  assert.deepEqual(centerEntryCamera(320,600,296,230),{scale:1,panX:12,panY:185});
});
test('minimap only appears for a graph that overflows the readable viewport',()=>{
  const one=[{x:0,y:0,w:366,h:230}];
  const two=[...one,{x:460,y:0,w:366,h:230}];
  const wide={panX:100,panY:50,scale:1,width:1000,height:600};
  assert.equal(shouldShowMinimap(one,wide),false);
  assert.equal(shouldShowMinimap(two,wide),false);
  assert.equal(shouldShowMinimap(two,{...wide,width:650}),true);
  assert.equal(shouldShowMinimap([],{...wide,width:650}),false);
});

test('cached graph envelope matches list-based minimap visibility under camera movement',()=>{
  const points=[{x:130,y:100,w:366,h:250},{x:1450,y:160,w:366,h:300}];
  const envelope=calculateGraphBounds(points);
  assert.deepEqual(envelope,{count:2,minX:130,minY:100,maxX:1816,maxY:460});
  for(const panX of [-130,-800,-1400]){
    const camera={panX,panY:0,scale:1,width:1000,height:700};
    assert.equal(shouldShowMinimap(envelope,camera),shouldShowMinimap(points,camera));
  }
  assert.equal(shouldShowMinimap(calculateGraphBounds([]),{
    panX:0,panY:0,scale:1,width:1000,height:700}),false);
});

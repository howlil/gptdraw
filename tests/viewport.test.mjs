import test from 'node:test';
import assert from 'node:assert/strict';
import {minimapProjection,cameraRect} from '../src/modules/conversation-workspace/core/viewport.mjs';
test('minimap navigation roundtrip stays in world coordinates',()=>{
 const points=[{x:130,y:140,w:366,h:180},{x:2200,y:600,w:230,h:100}];
 const p=minimapProjection(points);
 const to=p.project({x:1000,y:280});
 const back=p.unproject(to.x,to.y);
 assert.ok(Math.abs(back.x-1000)<.001);
 assert.ok(Math.abs(back.y-280)<.001);
 const visible=cameraRect({panX:-100,panY:-60,scale:1,width:900,height:600},p);
 assert.ok(visible.width>0&&visible.height>0);
});
test('minimap handles an empty graph without NaN',()=>{
 const p=minimapProjection([]);
 assert.deepEqual(p.project({x:2,y:3}),{x:2,y:3});
});

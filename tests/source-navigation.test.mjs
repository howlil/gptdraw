import test from 'node:test';
import assert from 'node:assert/strict';
import {revealNativeSource} from '../src/modules/conversation-workspace/adapters/source-navigation.mjs';

test('reaches earlier virtualized response using native scroller and preserves focus there',async()=>{
  const scroller={scrollTop:850,clientHeight:400,scrollHeight:1800,isConnected:true};
  const source={id:'target',isConnected:true,scrollIntoView(){this.scrolled=true;}};
  const doc={querySelectorAll:()=>[],querySelector:()=>null,body:{},
    defaultView:{location:{pathname:'/c/one'}}};
  const node=await revealNativeSource(doc,'assistant:uuid-100',{
    findScroller:()=>scroller,
    scan:()=>scroller.scrollTop<600?[{id:'assistant:uuid-100',element:source}]:[],
    wait:async()=>{},maxSteps:10
  });
  assert.equal(node,source);
  assert.equal(source.scrolled,true);
  assert.equal(scroller.scrollTop<600,true);
});
test('unavailable historical source restores original scroll and never guesses an element',async()=>{
  const scroller={scrollTop:800,clientHeight:300,scrollHeight:1600,isConnected:true};
  const doc={querySelectorAll:()=>[],querySelector:()=>null,body:{},
    defaultView:{location:{pathname:'/c/one'}}};
  const node=await revealNativeSource(doc,'assistant:uuid-missing',{
    findScroller:()=>scroller,scan:()=>[],wait:async()=>{},maxSteps:8
  });
  assert.equal(node,null);
  assert.equal(scroller.scrollTop,800);
});
test('recycled positional source is not searched across old virtualized pages',async()=>{
  let attempts=0;
  const doc={querySelectorAll:()=>[],querySelector:()=>null,body:{},
    defaultView:{location:{pathname:'/c/one'}}};
  const found=await revealNativeSource(doc,'assistant:conversation-turn-1',{
    findScroller:()=>{attempts++;return null;},
    scan:()=>[],wait:async()=>{}
  });
  assert.equal(found,null);
  assert.equal(attempts,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readAnswerSelection,selectionForAnswer} from '../src/modules/conversation-workspace/components/selection.mjs';

function fixture({multi=false,outside=false,collapsed=false}={}){
  const first={nodeType:1,closest:()=>first};
  const second={nodeType:1,closest:()=>second};
  const start={nodeType:3,parentElement:first};
  const end={nodeType:3,parentElement:outside?{}:multi?second:first};
  const range={startContainer:start,endContainer:end,startOffset:4,endOffset:9,
    toString:()=>multi?'the first. Second answer':'the first',
    cloneRange:()=>({
      selectNodeContents(){},
      setEnd(){},
      toString:()=> 'Some'
    }),
    getBoundingClientRect:()=>({left:120,top:180,right:190,bottom:203})
  };
  const answer={children:[first,second],contains:node=>[first,second].includes(node)};
  const selection={isCollapsed:collapsed,rangeCount:1,getRangeAt:()=>range};
  return {answer,selection};
}
test('a selection inside one response block produces an ephemeral anchor',()=>{
 const {answer,selection}=fixture();
 const result=readAnswerSelection(answer,selection);
 assert.equal(result.blockIndex,0);
 assert.equal(result.start,4);
 assert.equal(result.end,13);
 assert.equal(result.text,'the first');
 assert.equal(result.rect.left,120);
});
test('selection crossing two rendered answer blocks is accepted',()=>{
 const {answer,selection}=fixture({multi:true});
 const result=readAnswerSelection(answer,selection);
 assert.equal(result.endBlockIndex,1);
 assert.equal(result.text,'the first. Second answer');
});
test('selections outside answer, collapsed and missing ranges do not open toolbar',()=>{
 for(const options of [{outside:true},{collapsed:true}]){
  const {answer,selection}=fixture(options);
  assert.equal(readAnswerSelection(answer,selection),null);
 }
 const {answer}=fixture();
 assert.equal(readAnswerSelection(answer,{rangeCount:0}),null);
});

test('ShadowRoot selection is preferred to document selection',()=>{
 const selected={rangeCount:1,isCollapsed:false,getRangeAt:()=>({})};
 const answer={getRootNode:()=>({getSelection:()=>selected})};
 assert.equal(selectionForAnswer(answer),selected);
});
test('composed selection range resolves endpoints inside closed shadow root',()=>{
 const shadow={host:{}};
 const start={nodeType:3},end={nodeType:3};
 const range={startContainer:null,endContainer:null,
   setStart(node,offset){this.startContainer=node;this.startOffset=offset;},
   setEnd(node,offset){this.endContainer=node;this.endOffset=offset;},
   collapsed:false};
 const selection={getComposedRanges:options=>{
   assert.equal(options.shadowRoots[0],shadow);
   return [{startContainer:start,startOffset:2,endContainer:end,endOffset:5}];
 }};
 const doc={getSelection:()=>selection,createRange:()=>range};
 const answer={getRootNode:()=>shadow,ownerDocument:doc};
 const resolved=selectionForAnswer(answer);
 assert.equal(resolved.rangeCount,1);
 assert.equal(resolved.getRangeAt(0).startContainer,start);
 assert.equal(resolved.getRangeAt(0).endOffset,5);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {extractAssistantContent} from '../src/modules/conversation-workspace/adapters/response-content.mjs';

function fixture(){
  function paragraph(value){
    const text={nodeType:3,textContent:value};
    const el={tagName:'P',innerText:value,childNodes:[text],
      parentElement:{closest:()=>null},contains:node=>node===text};
    text.parentElement=el;
    return {el,text};
  }
  const a=paragraph('Paragraph A'),b=paragraph('Paragraph B');
  const blocks=[a.el,b.el];
  const markdown={parentElement:{closest:()=>null},
    querySelectorAll:()=>blocks,contains:()=>true};
  const root={querySelectorAll:selector=>selector==='.markdown'?[markdown]:[]};
  return {root,a,b,blocks};
}
test('a dirty paragraph reuses every untouched typed block identity',()=>{
  const {root,a,b}=fixture();
  const cache=new WeakMap();
  const initial=extractAssistantContent(root,{cache});
  b.el.innerText='B changes';b.text.textContent='B changes';
  const next=extractAssistantContent(root,{cache,dirtyNodes:new Set([b.text])});
  assert.equal(next.blocks[0],initial.blocks[0]);
  assert.notEqual(next.blocks[1],initial.blocks[1]);
  assert.equal(next.blocks[1].text,'B changes');
  assert.equal(next.text,'Paragraph A\n\nB changes');
});
test('a structural replace never reuses detached response block data',()=>{
  const {root,b,blocks}=fixture();
  const cache=new WeakMap(),before=extractAssistantContent(root,{cache});
  const replacement={...b.el,tagName:'H2',innerText:'New heading'};
  blocks[1]=replacement;
  const after=extractAssistantContent(root,{cache,dirtyNodes:new Set([replacement])});
  assert.equal(after.blocks[0],before.blocks[0]);
  assert.equal(after.blocks[1].kind,'heading');
  assert.notEqual(after.blocks[1],before.blocks[1]);
});

test('copy action reads the current code text after an in-place streaming update',async()=>{
  const {createResponseBlock}=await import('../src/modules/conversation-workspace/components/ResponseBlock.mjs');
  class Node {
    constructor(tag){this.tagName=tag;this.children=[];this.events={};this.textContent='';}
    append(...items){this.children.push(...items);}
    addEventListener(name,callback){this.events[name]=callback;}
  }
  const originalDocument=globalThis.document;
  const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  let copied='';
  globalThis.document={createElement:tag=>new Node(tag)};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{
    clipboard:{writeText:async value=>{copied=value;}}
  }});
  try {
    const root=createResponseBlock({kind:'code',text:'initial',language:'js'});
    const bar=root.children[0],pre=root.children[1];
    const button=bar.children[1],code=pre.children[0];
    code.textContent='streamed and updated';
    await button.events.click();
    assert.equal(copied,'streamed and updated');
  }finally{
    if(originalDocument===undefined)delete globalThis.document;
    else globalThis.document=originalDocument;
    if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);
    else delete globalThis.navigator;
  }
});

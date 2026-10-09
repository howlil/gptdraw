import test from 'node:test';
import assert from 'node:assert/strict';
import { collectMessages,createChatGPTObserver,findChatMain } from '../src/modules/conversation-workspace/adapters/chatgpt-dom.mjs';

function fixture(id,role,content){
  const roleNode={
    getAttribute:attr=>attr==='data-message-author-role'?role:null,
    textContent:content
  };
  const contentNode={textContent:content};
  const node={
    nodeType:1,
    parentElement:null,
    textContent:content,
    getAttribute:attr=>attr==='data-testid'?id:null,
    matches:()=>false,
    querySelector:selector=>{
      if(selector.includes('[data-message-author-role]'))return roleNode;
      if(role==='user' && selector.includes('[data-testid="user-message"]'))return contentNode;
      if(role==='assistant' && selector.includes('.markdown'))return contentNode;
      return null;
    },
    contains:other=>other===node,
    closest:()=>node
  };
  return node;
}
test('DOM selector normalizes visible ChatGPT user and assistant turns',()=>{
  const wrappers=[fixture('conversation-turn-0','user',' Hello '),
    fixture('conversation-turn-1','assistant',' Hello back ')];
  const root={querySelectorAll:()=>wrappers};
  const rows=collectMessages(root);
  assert.deepEqual(rows.map(({id,role,text})=>({id,role,text})),[
    {id:'user:conversation-turn-0',role:'user',text:'Hello'},
    {id:'assistant:conversation-turn-1',role:'assistant',text:'Hello back'}]);
});

test('DOM observer patches changed turn without full rescan per token',()=>{
  const user=fixture('conversation-turn-0','user','Question');
  const ai=fixture('conversation-turn-1','assistant','A');
  let scans=0, updates=[], frames=[], observers=[];
  const root={querySelectorAll:()=>{scans++;return[user,ai];}};
  const window={location:{pathname:'/c/t'},addEventListener(){},removeEventListener(){}};
  const document={
    querySelector:()=>root,body:{},
    defaultView:window
  };
  const saved=globalThis.MutationObserver;
  globalThis.MutationObserver=class {
    constructor(callback){this.callback=callback;observers.push(this);}
    observe(){}disconnect(){}
  };
  try {
    const app=createChatGPTObserver({
      document,
      onSnapshot:()=>{},
      onPatch:item=>updates.push(item.text),
      onRoute:()=>{},
      schedule:fn=>{frames.push(fn);}
    });
    app.start(); frames.shift()();
    const initial=scans;
    ai.querySelector=selector=>
      selector.includes('[data-message-author-role]')?{getAttribute:()=> 'assistant',textContent:'AB'}:
      selector.includes('.markdown')?{textContent:'AB'}:null;
    const target={nodeType:3,parentElement:ai};
    observers[0].callback([{type:'characterData',target}]);
    frames.shift()();
    assert.equal(scans,initial);
    assert.deepEqual(updates,['AB']);
    app.stop();
    app.start();frames.shift()();
    assert.ok(scans>initial,'re-open must rescan and reconnect');
    app.stop();
  } finally {globalThis.MutationObserver=saved;}
});


test('ChatGPT turn shells with data-turn are recognized without role descendants',()=>{
  const nodes=[
    { role:'user',text:'I am writing a test' },
    { role:'assistant',text:'Here is the result' }
  ].map((item,i)=>({
    nodeType:1,parentElement:null,
    getAttribute:key=>key==='data-turn'?item.role:key==='data-turn-id'?'message-'+i:
      key==='data-testid'?'conversation-turn-'+i:null,
    querySelector:selector=>{
      if(selector.includes('[data-message-author-role]'))return null;
      if(item.role==='user' && selector.includes('.user-message-bubble-color'))return{textContent:item.text};
      if(item.role==='assistant' && selector.includes('.markdown'))return{textContent:item.text};
      return null;
    },querySelectorAll:()=>[],closest:()=>null
  }));
  const root={querySelectorAll:selector=>selector.includes('conversation-turn')?nodes:[]};
  assert.deepEqual(collectMessages(root).map(item=>({role:item.role,text:item.text})),[
    {role:'user',text:'I am writing a test'},
    {role:'assistant',text:'Here is the result'}
  ]);
});

test('role-only ChatGPT layouts work without conversation-turn wrappers',()=>{
  const bare=['user','assistant'].map((role,i)=>({
    nodeType:1,parentElement:null,
    getAttribute:key=>key==='data-message-author-role'?role:
      key==='data-message-id'?'uuid-'+i:null,
    querySelector:selector=>selector.includes('.markdown') && role==='assistant'?
      {textContent:'Response'}:null,
    textContent:role==='user'?'Prompt':'Response'
  }));
  const root={querySelectorAll:selector=>selector.includes('conversation-turn')?[]:bare};
  assert.deepEqual(collectMessages(root).map(x=>x.id),['user:uuid-0','assistant:uuid-1']);
});

test('conversation main is selected over an unrelated navigation main',()=>{
  const navigation={querySelector:()=>null};
  const conversation={querySelector:selector=>selector.includes('conversation-turn')?{getAttribute:()=> 'user'}:null};
  const doc={querySelectorAll:()=>[navigation,conversation]};
  assert.equal(findChatMain(doc),conversation);
});

test('zero visible turns are distinguishable from missing native conversation',()=>{
  const main={querySelectorAll:()=>[]};
  assert.deepEqual(collectMessages(main),[]);
});

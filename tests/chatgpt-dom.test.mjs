import test from 'node:test';
import assert from 'node:assert/strict';
import { collectMessages,createChatGPTObserver } from '../src/modules/conversation-workspace/adapters/chatgpt-dom.mjs';

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
      if(selector==='[data-message-author-role]')return roleNode;
      if(role==='user' && selector==='[data-testid="user-message"]')return contentNode;
      if(role==='assistant' && selector.startsWith('.markdown'))return contentNode;
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
    {id:'conversation-turn-0',role:'user',text:'Hello'},
    {id:'conversation-turn-1',role:'assistant',text:'Hello back'}]);
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
      selector==='[data-message-author-role]'?{getAttribute:()=> 'assistant',textContent:'AB'}:
      selector.startsWith('.markdown')?{textContent:'AB'}:null;
    const target={nodeType:3,parentElement:{closest:()=>ai}};
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

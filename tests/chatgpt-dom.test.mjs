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

test('grouped ChatGPT turns recover a user prompt without a nested author role',()=>{
  const user={
    nodeType:1,textContent:'Ask about Rust',
    parentElement:null
  };
  const assistant={
    nodeType:1,textContent:'Rust is a systems programming language',
    parentElement:null,
    closest:()=>null
  };
  const group={
    getAttribute:key=>key==='data-turn-key'?'abc-123':null,
    querySelector:selector=>selector==='[data-user-message-bubble]'?user:
      selector.includes('[data-chatgpt-agent-turn-start]')?assistant:null
  };
  const unrelatedRole={nodeType:1,textContent:'thinking',
    getAttribute:key=>key==='data-conversation-role'?'assistant':
      key==='data-message-id'?'old':null,
    querySelector:()=>null};
  const root={
    querySelectorAll:selector=>{
      if(selector==='[data-turn-key]')return[group];
      if(selector.includes('conversation-turn'))return[];
      return [unrelatedRole];
    }
  };
  const found=collectMessages(root);
  assert.deepEqual(found.map(item=>({id:item.id,role:item.role,text:item.text})),[
    {id:'user:turn-key:abc-123',role:'user',text:'Ask about Rust'},
    {id:'assistant:turn-key:abc-123',role:'assistant',text:'Rust is a systems programming language'}
  ]);
});

test('native stable turn key takes precedence over recycled conversation-turn index',()=>{
  const wrapper={
    nodeType:1,textContent:'Keep turn stable',
    getAttribute:key=>key==='data-turn'?'user':
      key==='data-turn-key'?'stable-key-42':
      key==='data-testid'?'conversation-turn-0':null,
    querySelector:()=>null,querySelectorAll:()=>[]
  };
  const main={querySelectorAll:selector=>selector.includes('conversation-turn')?[wrapper]:[]};
  const result=collectMessages(main);
  assert.equal(result[0].id,'user:stable-key-42');
});

test('assistant role metadata nested under turn recovers the sibling rendered answer',()=>{
  const markdown={textContent:'Actual answer with multiple paragraphs',
    parentElement:{closest:()=>null},querySelectorAll:()=>[]};
  let wrapper;
  const role={
    getAttribute:key=>key==='data-message-author-role'?'assistant':null,
    querySelector:()=>null,querySelectorAll:()=>[],textContent:'Worked for 4m 2s',
    closest:()=>wrapper
  };
  wrapper={
    getAttribute:key=>key==='data-testid'?'conversation-turn-2':null,
    querySelectorAll:selector=>selector.includes('data-message-author-role')?[role]:
      selector==='.markdown'?[markdown]:[],
    querySelector:selector=>selector==='.markdown'?markdown:
      selector.includes('[data-message-author-role]')?role:null
  };
  const main={querySelectorAll:selector=>selector.includes('conversation-turn')?[wrapper]:[]};
  const rows=collectMessages(main);
  assert.equal(rows.length,1);
  assert.equal(rows[0].text,'Actual answer with multiple paragraphs');
});

test('nested SPA main replacement is observed without pressing Refresh',async()=>{
  let current=[fixture('conversation-turn-0','user','Old message')];
  let main={
    isConnected:true,
    querySelectorAll:()=>current,
    contains:()=>false
  };
  const events=[],callbacks=[],frames=[];
  const page={location:{pathname:'/c/first'},addEventListener(){},removeEventListener(){}};
  const body={};
  const doc={body,defaultView:page,querySelector:()=>main};
  const original=globalThis.MutationObserver;
  globalThis.MutationObserver=class {
    constructor(callback){callbacks.push(callback);}
    observe(){}disconnect(){}
  };
  try{
    const reader=createChatGPTObserver({
      document:doc,onSnapshot:rows=>events.push({type:'snapshot',text:rows[0]?.text}),
      onPatch:()=>{},onRoute:path=>events.push({type:'route',path}),
      schedule:fn=>frames.push(fn)
    });
    reader.start();
    frames.shift()();
    assert.equal(events.at(-1).text,'Old message');
    main.isConnected=false;
    current=[fixture('conversation-turn-0','user','Next message')];
    main={isConnected:true,querySelectorAll:()=>current,contains:()=>false};
    page.location.pathname='/c/second';
    callbacks[1]([{type:'childList',target:body,addedNodes:[],removedNodes:[]}]);
    await Promise.resolve();
    frames.shift()();
    assert.ok(events.some(e=>e.type==='route'&&e.path==='/c/second'));
    assert.equal(events.at(-1).text,'Next message');
    reader.stop();
  }finally{globalThis.MutationObserver=original;}
});

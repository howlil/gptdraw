import test from 'node:test';
import assert from 'node:assert/strict';
import { collectMessages,createChatGPTObserver,findChatMain } from '../src/modules/conversation-workspace/adapters/chatgpt-dom.mjs';
import { canonicalCandidates,detectLayout } from '../src/modules/conversation-workspace/adapters/chatgpt-layouts.mjs';
import { hasDurableSource } from '../src/modules/conversation-workspace/core/message-identity.mjs';
import { backfillHistory } from '../src/modules/conversation-workspace/adapters/history.mjs';

// Small DOM model with real parent/descendant relationships. Fixture text is
// synthetic: no ChatGPT transcript or authentication data enters the repo.
function el(tag='div',attrs={},children=[]) {
  const node={
    nodeType:1,tagName:tag.toUpperCase(),parentElement:null,isConnected:true,
    attrs,children:[],getAttribute(name){return this.attrs[name]??null;},
    matches(selector){return selector.split(',').some(part=>{
      const s=part.trim();
      if(s==='ol[data-conversation-transcript] > li[data-message-role]')
        return this.tagName==='LI' && this.parentElement?.tagName==='OL' &&
          this.parentElement?.getAttribute('data-conversation-transcript')!==null &&
          this.getAttribute('data-message-role')!==null;
      if(s==='main'||s==='[role="main"]')
        return s==='main'?this.tagName==='MAIN':this.getAttribute('role')==='main';
      if(s.startsWith('.'))return (this.getAttribute('class')||'').split(' ').includes(s.slice(1));
      if(s.startsWith('#'))return this.getAttribute('id')===s.slice(1);
      const attr=s.match(/^\[([\w-]+)(?:(\^?=)"([^"]*)")?\]$/);
      if(!attr)return false;
      const value=this.getAttribute(attr[1]);
      return value!==null && (!attr[2] || (attr[2]==='^='?
        value.startsWith(attr[3]):value===attr[3]));
    });},
    append(child){child.parentElement=this;this.children.push(child);return child;},
    contains(other){return this===other||this.children.some(c=>c.contains(other));},
    querySelectorAll(selector){
      const found=[];
      const visit=node=>{for(const child of node.children){
        if(child.matches(selector))found.push(child);
        visit(child);
      }};
      visit(this);return found;
    },
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;},
    closest(selector){for(let n=this;n;n=n.parentElement)if(n.matches(selector))return n;return null;},
    get textContent(){return this.children.map(c=>c.textContent).join('')||this.rawText||'';},
    set textContent(value){this.rawText=value;this.children=[];}
  };
  children.forEach(child=>node.append(child));return node;
}
const txt=(tag,text,attrs={})=>{const e=el(tag,attrs);e.textContent=text;return e;};

test('transcript list produces exact user/assistant pair without durable promotion',()=>{
  const root=el('main',{},[el('ol',{'data-conversation-transcript':''},[
    el('li',{'data-message-role':'user',id:'one'},[
      txt('button','Prompt A',{'data-user-message-bubble':''})]),
    el('li',{'data-message-role':'assistant',id:'two'},[
      el('div',{class:'markdown'},[txt('p','Reply A')])])
  ])]);
  const rows=collectMessages(root);
  assert.equal(detectLayout(root),'transcript');
  assert.deepEqual(rows.map(x=>[x.role,x.text]),[
    ['user','Prompt A'],['assistant','Reply A']]);
  assert.ok(rows.every(row=>row.identity!=='stable' && !hasDurableSource(row)));
  assert.deepEqual(canonicalCandidates(root).candidates.map(n=>n.tagName),['LI','LI']);
});

test('keyed search units recover both roles without duplicate keyed shells',()=>{
  const root=el('main',{},[el('section',{'data-turn-key':'exchange-1'},[
    el('div',{'data-content-search-unit-key':'exchange-1:0:user'},[
      txt('button','Ask B',{'data-user-message-bubble':''})]),
    el('div',{'data-content-search-unit-key':'exchange-1:2:assistant'},[
      el('div',{class:'markdown'},[txt('p','Answer B')])])
  ])]);
  const rows=collectMessages(root);
  assert.deepEqual(rows.map(x=>[x.role,x.text]),[
    ['user','Ask B'],['assistant','Answer B']]);
  assert.ok(rows.every(row=>row.identity==='candidate'));
});

test('keyed-only fallback does not leak prompt into assistant answer',()=>{
  const root=el('main',{},[el('section',{'data-turn-key':'k1'},[
    txt('button','Private prompt',{'data-user-message-bubble':''}),
    el('div',{'data-chatgpt-agent-turn-start':''},[
      el('div',{class:'markdown'},[txt('p','Independent answer')])])
  ])]);
  const rows=collectMessages(root);
  assert.deepEqual(rows.map(x=>x.text),['Private prompt','Independent answer']);
});

test('root discovery prefers transcript-bearing main to composer-only main',()=>{
  const home=el('main',{},[el('div',{'id':'prompt-textarea'})]);
  const transcript=el('main',{},[el('ol',{'data-conversation-transcript':''},[
    el('li',{'data-message-role':'user'},[txt('button','Prompt',{'data-user-message-bubble':''})])
  ])]);
  const doc={querySelectorAll:()=>[home,transcript]};
  assert.equal(findChatMain(doc),transcript);
});

test('new transcript insertion after hydration triggers structural rescan',()=>{
  const main=el('main');
  const frames=[],observers=[],snapshots=[];
  const page={location:{pathname:'/c/test'},addEventListener(){},removeEventListener(){}};
  const doc={querySelector:()=>main,body:el('body'),defaultView:page};
  const old=globalThis.MutationObserver;
  globalThis.MutationObserver=class{
    constructor(cb){this.callback=cb;observers.push(this);}
    observe(){}disconnect(){}
  };
  try {
    const watcher=createChatGPTObserver({document:doc,
      onSnapshot:rows=>snapshots.push(rows.length),onPatch:()=>{},onRoute:()=>{},
      schedule:callback=>frames.push(callback)
    });
    watcher.start();frames.shift()();
    assert.equal(snapshots.at(-1),0);
    const ol=main.append(el('ol',{'data-conversation-transcript':''},[
      el('li',{'data-message-role':'user'},[txt('button','Hello',{'data-user-message-bubble':''})]),
      el('li',{'data-message-role':'assistant'},[el('div',{class:'markdown'},[txt('p','Hi')])])
    ]));
    observers[0].callback([{type:'childList',target:main,addedNodes:[ol],removedNodes:[]}]);
    frames.shift()();
    assert.equal(snapshots.at(-1),2);
    assert.equal(watcher.getDiagnostics().discoveryStatus,'ready');
    assert.equal(watcher.getDiagnostics().layout,'transcript');
    watcher.stop();
  }finally{globalThis.MutationObserver=old;}
});

test('reversed native transcript backfill reaches negative oldest and restores offset',async()=>{
  const scroller={scrollTop:-200,scrollHeight:1200,clientHeight:400,
    isConnected:true,firstElementChild:null,querySelector:()=>null};
  const doc={defaultView:{getComputedStyle:()=>({flexDirection:'column-reverse'})}};
  let min=0;
  const outcome=await backfillHistory({document:doc,root:{},
    findScroller:()=>scroller,wait:async()=>{min=Math.min(min,scroller.scrollTop);},
    yieldForScan:async()=>true,onScan:()=>({count:2,firstId:'u1'}),
    maxSteps:30,idleLimit:2,waitMs:1
  });
  assert.equal(outcome,'reached-top');
  assert.equal(min,-800);
  assert.equal(scroller.scrollTop,-200);
});

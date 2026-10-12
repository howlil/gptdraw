import test from 'node:test';
import assert from 'node:assert/strict';
import {createStartCard} from '../src/modules/conversation-workspace/components/StartCard.mjs';
import {createChatCard} from '../src/modules/conversation-workspace/components/ChatCard.mjs';
import {createDialogueCard} from '../src/modules/conversation-workspace/components/DialogueCard.mjs';
import {createCardComposer} from '../src/modules/conversation-workspace/components/CardComposer.mjs';

function withDOM(fn) {
  const original=globalThis.document;
  class Element {
    constructor(tag) {
      this.tagName=tag.toUpperCase();this.children=[];this.events={};
      this.style={};this.attributes={};this.dataset={};this.hidden=false;
      this.value='';this.textContent='';this.scrollHeight=23;
      this.classes=new Set();this.className='';
    }
    append(...children){this.children.push(...children);}
    get lastChild(){return this.children.at(-1);}
    appendChild(child){this.append(child);}
    setAttribute(k,v){this.attributes[k]=v;}
    addEventListener(name,cb){this.events[name]=cb;}
    focus(){}
    requestSubmit(){this.submitted=(this.submitted||0)+1;}
    get classList(){return {
      add:k=>this.classes.add(k),
      toggle:(k,yes)=>yes===undefined?
        (this.classes.has(k)?this.classes.delete(k):this.classes.add(k)):
        (yes?this.classes.add(k):this.classes.delete(k)),
      contains:k=>this.classes.has(k)
    };}
  }
  globalThis.document={createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),
    createTextNode:text=>({textContent:text})};
  try{return fn();}
  finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
}
const has=(parent,className)=>parent.children.some(child=>child.className?.includes(className));
test('new, loading, real turn and branch use the same structural DialogueCard',()=>withDOM(()=>{
  const entry=createStartCard(async()=>({status:'prepared'}));
  const turn=createChatCard({id:'u1',userId:'u1',prompt:'Hello',answer:'',answerBlocks:[],pending:true},
    {index:0,onSource:async()=>{},onFocus:()=>{},onCompose:()=>{},
    onSend:async()=>({status:'activated'}),onFork:async()=>{},onRead:()=>{},
    onCompare:()=>{},onBookmark:async()=>{},onSelection:()=>{},isLatest:true});
  const branch=createDialogueCard({variant:'branch'});
  for(const card of [entry.element,turn,branch.element]) {
    assert.ok(card.className.includes('g-card'));
    assert.ok(has(card,'g-card-head'));
    assert.ok(has(card,'g-card-body'));
  }
  const startComposer=entry.element.children.find(c=>c.tagName==='FORM');
  const turnComposer=turn.children.find(c=>c.tagName==='FORM');
  assert.ok(startComposer.className.includes('g-node-composer'));
  assert.equal(turnComposer.className,startComposer.className.replace(' g-start-composer',''));
  assert.ok(has(startComposer,'g-node-send'));
  assert.ok(has(turnComposer,'g-node-send'));
  entry.setRoute('conversation:already-exists','loading');
  assert.equal(startComposer.hidden,true,'existing conversation cannot show a new-chat composer');
  entry.setRoute('route:/');
  assert.equal(startComposer.hidden,false);
}));
test('shared composer keeps native draft fallback, is IME safe, and exposes errors',async()=>{
  const original=globalThis.document;
  class El {
    constructor(tag){this.tagName=tag;this.events={};this.children=[];this.attributes={};
      this.style={};this.hidden=false;this.value='';this.scrollHeight=23;this.className='';
      this.classList={toggle(){}};}
    append(...xs){this.children.push(...xs);}
    setAttribute(k,v){this.attributes[k]=v;}
    addEventListener(k,v){this.events[k]=v;}
    requestSubmit(){this.submitRequests=(this.submitRequests||0)+1;}
    focus(){}
  }
  globalThis.document={createElement:tag=>new El(tag),createElementNS:(_,tag)=>new El(tag)};
  try{
    let submitted='';
    const c=createCardComposer({onSubmit:async text=>{submitted=text;}});
    assert.equal(c.send.disabled,true);
    c.input.value='Keep this draft';
    c.input.events.input();
    assert.equal(c.send.disabled,false);
    let prevented=false;
    c.input.events.keydown({key:'Enter',shiftKey:true,isComposing:false,preventDefault(){prevented=true;}});
    assert.equal(prevented,false);
    c.input.events.keydown({key:'Enter',shiftKey:false,isComposing:true,preventDefault(){prevented=true;}});
    assert.equal(prevented,false);
    c.input.events.keydown({key:'Enter',shiftKey:false,isComposing:false,preventDefault(){prevented=true;}});
    assert.equal(prevented,true);
    assert.equal(c.element.submitRequests,1);
    await c.element.events.submit({preventDefault(){}});
    assert.equal(submitted,'Keep this draft');
    assert.equal(c.input.value,'Keep this draft','draft is not silently discarded');
    c.setStatus('Draft prepared in ChatGPT');
    assert.equal(c.status.hidden,false);
    assert.match(c.status.textContent,/Draft prepared/);
  }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});

test('Open Source targets the currently paired assistant message, including after streaming',async()=>{
  let opened=null;
  const promise=withDOM(()=>{
    const original={id:'user:msg-u',userId:'user:msg-u',assistantId:null,
      prompt:'Draw a chart',answer:'',answerBlocks:[],pending:true};
    const card=createChatCard(original,{index:0,isLatest:true,
      onSource:async id=>{opened=id;},onFocus:()=>{},onCompose:()=>{},
      onSend:async()=>({status:'observed'}),onFork:async()=>{},
      onRead:()=>{},onCompare:()=>{},onBookmark:async()=>{},onSelection:()=>{}});
    card._update({...original,assistantId:'assistant:msg-a',
      hasNativeMedia:true,pending:false},0,true);
    const body=card.children.find(c=>c.className==='g-card-body');
    assert.equal(body.children.find(c=>c.className==='g-native-content-notice').hidden,false);
    const footer=card.children.find(c=>c.className==='g-node-footer');
    return footer.children[0].events.click();
  });
  await promise;
  assert.equal(opened,'assistant:msg-a');
});

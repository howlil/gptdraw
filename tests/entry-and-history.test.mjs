import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceController} from '../src/modules/conversation-workspace/controller/workspace.mjs';
import {createStartCard} from '../src/modules/conversation-workspace/components/StartCard.mjs';
import {mergeAnchoredHistory} from '../src/modules/conversation-workspace/core/history.mjs';

const page=(prefix)=>Array.from({length:5},(_,i)=>[
  {id:'user:conversation-turn-'+(i*2),identity:'ephemeral',role:'user',
    text:prefix+' unique question number '+i+' with meaningful additional context'},
  {id:'assistant:conversation-turn-'+(i*2+1),identity:'ephemeral',role:'assistant',
    text:prefix+' unique answer number '+i+' with meaningful supporting details'}
]).flat();

test('five positional ChatGPT turns grow into ten and fifteen honest history cards automatically',async()=>{
  let callbacks,current;
  const controller=createWorkspaceController({
    pathname:()=>'/c/history',
    layoutStorage:{read:async()=>({}),write:async()=>{}},
    observe:cb=>{callbacks=cb;return{
      start(){cb.onSnapshot(page('Recent'));},stop(){},getElement:()=>null
    };},
    onUpdate:state=>{current=state;}
  });
  await controller.start();
  assert.equal(current.turns.length,5);
  callbacks.onHistory({status:'loading',phase:'up'});
  callbacks.onSnapshot(page('Old'),{direction:'up',moved:true});
  callbacks.onHistory({status:'reached-top',phase:'up'});
  assert.equal(current.turns.length,10);
  assert.ok(current.turns[0].prompt.startsWith('Old'));
  assert.ok(current.turns[5].breakBefore,'uncertain window boundary is not a solid graph edge');

  callbacks.onHistory({status:'loading',phase:'down'});
  callbacks.onSnapshot(page('Later'),{direction:'down',moved:true});
  callbacks.onHistory({status:'reached-top',phase:'down'});
  assert.equal(current.turns.length,15);
  assert.equal(new Set(current.turns.map(turn=>turn.id)).size,15);

  callbacks.onSnapshot(page('Later'),{direction:'down',moved:false});
  assert.equal(current.turns.length,15,'repeated native window cannot duplicate turns');
  assert.equal(current.history.unresolved,0);
  controller.stop();
});

test('disjoint history without verified scroll movement remains unresolved',()=>{
  const existing=[{id:'user:observed:1',role:'user',identity:'ephemeral',text:'Hello'}];
  const next=[{id:'user:observed:2',role:'user',identity:'ephemeral',text:'Different'}];
  const uncertain=mergeAnchoredHistory(existing,next,[],true,{direction:'up',moved:false});
  assert.equal(uncertain.messages.length,1);
  assert.equal(uncertain.unresolved.length,1);
});

test('new chat Start Card uses the same Dialogue card/composer vocabulary, existing chat is loading',()=>{
  const original=globalThis.document;
  class E {
    constructor(tag){this.tagName=tag;this.children=[];this.events={};this.style={};
      this.hidden=false;this.attributes={};this.classes=new Set();}
    append(...children){this.children.push(...children);}
    setAttribute(key,value){this.attributes[key]=value;}
    addEventListener(type,listener){this.events[type]=listener;}
    focus(){}
    get classList(){return {toggle:(name,yes)=>yes?this.classes.add(name):this.classes.delete(name)};}
  }
  globalThis.document={
    createElement:tag=>new E(tag),createElementNS:(_,tag)=>new E(tag)
  };
  try{
    const card=createStartCard(async()=>({status:'prepared'}));
    assert.ok(card.element.className.includes('g-card'));
    const form=card.element.children.find(child=>child.tagName==='form');
    assert.ok(form.className.includes('g-node-composer'));
    assert.ok(form.children.some(child=>child.className==='g-node-send'));
    card.setRoute('conversation:existing');
    assert.equal(form.hidden,true);
    const body=card.element.children.find(child=>child.className==='g-card-body');
    assert.match(body.children[0].textContent,/Loading conversation/);
    card.setRoute('route:/');
    assert.equal(form.hidden,false);
  }finally{
    if(original===undefined)delete globalThis.document;
    else globalThis.document=original;
  }
});

test('positional streaming answer rerender updates existing card instead of duplicating it',async()=>{
  let cb,state;
  const messages=page('Current');
  const ctrl=createWorkspaceController({
    pathname:()=>'/c/stream',
    layoutStorage:{read:async()=>({}),write:async()=>{}},
    observe:x=>{cb=x;return{start(){x.onSnapshot(messages);},stop(){}}},
    onUpdate:next=>{state=next;}
  });
  await ctrl.start();
  const before=state.turns.map(x=>x.id);
  const changed=messages.map(row=>({...row}));
  changed[1].text+=' plus newly streamed tokens';
  cb.onSnapshot(changed);
  assert.equal(state.turns.length,5);
  assert.deepEqual(state.turns.map(x=>x.id),before);
  assert.equal(state.turns[0].answer,changed[1].text);
  ctrl.stop();
});

test('SPA conversation switch projects newly loaded conversation without manual refresh',async()=>{
  let cb,state;
  const ctrl=createWorkspaceController({
    pathname:()=>'/c/first',
    layoutStorage:{read:async()=>({}),write:async()=>{}},
    observe:x=>{cb=x;return{start(){x.onSnapshot(page('First'));},stop(){}}},
    onUpdate:next=>{state=next;}
  });
  await ctrl.start();
  assert.equal(state.turns.length,5);
  cb.onRoute('/c/second');
  cb.onSnapshot(page('Second'));
  assert.equal(state.route,'conversation:second');
  assert.equal(state.turns.length,5);
  assert.ok(state.turns[0].prompt.startsWith('Second'));
  ctrl.stop();
});

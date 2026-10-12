import test from 'node:test';
import assert from 'node:assert/strict';
import {createSubmissionTracker} from '../src/modules/conversation-workspace/core/submission-ack.mjs';
import {createWorkspaceController} from '../src/modules/conversation-workspace/controller/workspace.mjs';

function trackerWithClock(){
  const timers=new Map();let sequence=0;
  const tracker=createSubmissionTracker({
    schedule:cb=>{const id=++sequence;timers.set(id,cb);return id;},
    cancelSchedule:id=>timers.delete(id)
  });
  return {tracker,timeout:()=>{for(const cb of timers.values())cb();},timers};
}
const user=(id,text)=>({id,role:'user',text});
test('acknowledge only a newly observed native user turn after Send registration',async()=>{
  const {tracker}=trackerWithClock();
  const messages=[user('user:1','Explain channels')];
  const handle=tracker.begin({text:'Explain channels',messages,route:'conversation:c'});
  tracker.observe(messages,'conversation:c');
  assert.equal(tracker.pending,true,'existing equal text is not an ACK');
  tracker.observe([...messages,user('user:2','Other question')],'conversation:c');
  assert.equal(tracker.pending,true);
  tracker.observe([...messages,user('user:2','Explain channels')],'conversation:c');
  assert.deepEqual(await handle.promise,{status:'observed'});
  assert.equal(tracker.pending,false);
});
test('history scrolling, different route and timeout cannot fabricate a successful Send',async()=>{
  const clock=trackerWithClock();
  const handle=clock.tracker.begin({text:'Same text',messages:[user('user:1','Earlier')],
    route:'conversation:abc'});
  clock.tracker.observe([user('user:2','Same text')],'conversation:abc',{direction:'up',moved:true});
  assert.equal(clock.tracker.pending,true);
  clock.timeout();
  assert.deepEqual(await handle.promise,{status:'uncertain'});
  assert.equal(clock.timers.size,0);
  const second=clock.tracker.begin({text:'Next',messages:[],route:'conversation:abc'});
  clock.tracker.observe([], 'conversation:other');
  assert.deepEqual(await second.promise,{status:'uncertain'});
});
test('new-chat route may transition to actual conversation before its native Send ACK',async()=>{
  const {tracker}=trackerWithClock();
  const handle=tracker.begin({text:'Create a new chat',messages:[],route:'route:/'});
  tracker.observe([], 'conversation:new');
  assert.equal(tracker.pending,true);
  tracker.observe([user('user:msg-1','Create a new chat')],'conversation:new');
  assert.deepEqual(await handle.promise,{status:'observed'});
});
test('pending send is single-flight, cancel is safe and does not imply success',async()=>{
  const {tracker}=trackerWithClock();
  const a=tracker.begin({text:'A',messages:[],route:'route:/'});
  assert.throws(()=>tracker.begin({text:'B',messages:[],route:'route:/'}),/already awaiting/);
  a.cancel();
  assert.deepEqual(await a.promise,{status:'cancelled'});
  assert.equal(tracker.pending,false);
});
test('controller native observations acknowledge a matching newly appended user turn',async()=>{
  let callbacks,last;
  const ctrl=createWorkspaceController({
    pathname:()=>'/c/send',
    layoutStorage:{read:async()=>({}),write:async()=>{}},
    observe:cb=>{callbacks=cb;return{start(){cb.onSnapshot([
      {id:'user:one',role:'user',text:'Earlier'}]);},stop(){},getElement:()=>null};},
    onUpdate:state=>{last=state;}
  });
  await ctrl.start();
  const waiting=ctrl.beginSubmission('Send me this');
  callbacks.onSnapshot([
    {id:'user:one',role:'user',text:'Earlier'},
    {id:'user:two',role:'user',text:'Send me this'}
  ]);
  assert.deepEqual(await waiting.promise,{status:'observed'});
  assert.equal(last.turns.length,2);
  ctrl.stop();
});
test('stopping the controller resolves a pending Send as uncertain',async()=>{
  const ctrl=createWorkspaceController({
    pathname:()=>'/',
    layoutStorage:{read:async()=>({}),write:async()=>{}},
    observe:()=>({start(){},stop(){}}),onUpdate:()=>{}
  });
  await ctrl.start();
  const handle=ctrl.beginSubmission('Unsent question');
  ctrl.stop();
  assert.deepEqual(await handle.promise,{status:'uncertain'});
});

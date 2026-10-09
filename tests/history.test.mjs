import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeVisibleMessages } from '../src/modules/conversation-workspace/core/history.mjs';
import { backfillHistory,findHistoryScroller } from '../src/modules/conversation-workspace/adapters/history.mjs';

const row=id=>({id,role:id[0]==='u'?'user':'assistant',text:id});
test('older history pages prepend in order and preserve turns unmounted by ChatGPT',()=>{
  const existing=['u4','a4','u5','a5'].map(row);
  const loaded=['u2','a2','u3','a3','u4','a4'].map(row);
  const merged=mergeVisibleMessages(existing,loaded,true);
  assert.deepEqual(merged.map(x=>x.id),['u2','a2','u3','a3','u4','a4','u5','a5']);
  const older=mergeVisibleMessages(merged,['u0','a0'].map(row),true);
  assert.deepEqual(older.map(x=>x.id),['u0','a0','u2','a2','u3','a3','u4','a4','u5','a5']);
  const newer=mergeVisibleMessages(older,['u5','a5','u6','a6'].map(row),false);
  assert.deepEqual(newer.map(x=>x.id).slice(-4),['u5','a5','u6','a6']);
});

test('source text updates refresh a known history item without duplicating it',()=>{
  const current=[{id:'u1',text:'first'},{id:'a1',text:'old'}];
  const merged=mergeVisibleMessages(current,[{id:'a1',text:'updated'}]);
  assert.deepEqual(merged.map(x=>x.id),['u1','a1']);
  assert.equal(merged[1].text,'updated');
});

test('history scroller is selected from message ancestors, not another sidebar scroll area',()=>{
  const scroller={scrollTop:220,scrollHeight:1800,clientHeight:420,parentElement:null};
  const item={parentElement:scroller};
  const main={querySelector:()=>item,querySelectorAll:()=>[]};
  const doc={body:{},defaultView:{getComputedStyle:()=>({overflowY:'auto'})}};
  assert.equal(findHistoryScroller(doc,main),scroller);
});

test('progressive history loading repeatedly reaches top and restores scroll position',async()=>{
  const scroller={scrollTop:1700,scrollHeight:2400,clientHeight:400,isConnected:true};
  const states=[];
  let scans=0;
  const result=await backfillHistory({
    document:{},root:{},
    findScroller:()=>scroller,
    onStatus:status=>states.push(status.status),
    onScan:()=>{
      scans++;
      return {firstId:scans<2?'u3':'u1',count:scans<2?4:8};
    },
    wait:async()=>{if(scans===0)scroller.scrollHeight+=300;},
    idleLimit:2,maxSteps:20,waitMs:1
  });
  assert.equal(result,'reached-top');
  assert.ok(scans>=4);
  assert.equal(scroller.scrollTop,2000,'restore the prior bottom gap after prepend');
  assert.equal(states.at(-1),'reached-top');
});

test('cancelled backfill does not alter native scroll position on route change',async()=>{
  const controller=new AbortController();
  const scroller={scrollTop:1000,scrollHeight:1600,clientHeight:400,isConnected:true};
  const status=[];
  const result=await backfillHistory({
    document:{},root:{},signal:controller.signal,
    findScroller:()=>scroller,
    onStatus:info=>status.push(info.status),
    onScan:()=>({firstId:'u2',count:1}),
    wait:async()=>controller.abort(),maxSteps:50
  });
  assert.equal(result,'cancelled');
  assert.equal(scroller.scrollTop,0,'leave restoration to the new native route');
  assert.equal(status.at(-1),'cancelled');
});

test('unavailable native scroller is reported without scrolling the page',async()=>{
  const status=[];
  const result=await backfillHistory({
    document:{},root:{},findScroller:()=>null,
    onScan:()=>{throw Error('must not scan');},
    onStatus:s=>status.push(s.status)
  });
  assert.equal(result,'unavailable');
  assert.deepEqual(status,['unavailable']);
});

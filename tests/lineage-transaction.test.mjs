import test from 'node:test';
import assert from 'node:assert/strict';
import {applyLineageMutation} from '../src/modules/conversation-workspace/core/lineage-transaction.mjs';
const record={id:'pending-1',parentConversationId:'root',rootConversationId:'root',
  source:{messageId:'assistant:durable',role:'assistant',anchor:null},createdAt:100};
test('lineage transaction rejects replacing another tab pending branch',()=>{
  const first=applyLineageMutation(null,'begin',{record},200);
  assert.equal(first.result.id,'pending-1');
  assert.throws(()=>applyLineageMutation(first.state,'begin',{
    record:{...record,id:'pending-2'}
  },201),/previous Fork/);
  assert.equal(applyLineageMutation(first.state,'begin',{record},202).result.id,'pending-1');
});
test('serialized commands cannot double-parent a child or form cycles',()=>{
  let state=applyLineageMutation(null,'begin',{record},200).state;
  state=applyLineageMutation(state,'confirm',{pendingId:'pending-1',childConversationId:'child'},201).state;
  assert.equal(state.records.length,1);
  assert.throws(()=>applyLineageMutation(state,'confirm',{
    pendingId:'pending-1',childConversationId:'child'},202),/Pending Fork/);
  const second={...record,id:'pending-2',parentConversationId:'child',createdAt:205};
  state=applyLineageMutation(state,'begin',{record:second},206).state;
  assert.throws(()=>applyLineageMutation(state,'confirm',{
    pendingId:'pending-2',childConversationId:'root'},207),/cycle/);
});
test('dismiss requires matching pending ID',()=>{
 const initial=applyLineageMutation(null,'begin',{record},150).state;
 const unchanged=applyLineageMutation(initial,'dismiss',{pendingId:'other'},160).state;
 assert.equal(unchanged.pending.id,'pending-1');
 const cleared=applyLineageMutation(unchanged,'dismiss',{pendingId:'pending-1'},170).state;
 assert.equal(cleared.pending,null);
});

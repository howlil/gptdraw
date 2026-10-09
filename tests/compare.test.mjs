import test from 'node:test';
import assert from 'node:assert/strict';
import {selectCompareId,comparisonTurns} from '../src/modules/conversation-workspace/core/compare.mjs';
const items=[{id:'a',answer:'One'},{id:'b',answer:'Two'},{id:'c',answer:'Three'}];
test('two explicit loaded card selections produce an in-memory comparison',()=>{
 let s=selectCompareId([],'a',items.map(x=>x.id));
 s=selectCompareId(s,'b',items.map(x=>x.id));
 assert.deepEqual(s,['a','b']);
 assert.equal(comparisonTurns(items,s).right.answer,'Two');
});
test('unknown/unloaded branches never become comparison content',()=>{
 assert.deepEqual(selectCompareId(['a'],'external-branch',items.map(x=>x.id)),['a']);
 assert.equal(comparisonTurns(items,['a','external-branch']),null);
});
test('clicking a selected card deselects, third click starts new selection',()=>{
 assert.deepEqual(selectCompareId(['a','b'],'a',items.map(x=>x.id)),['b']);
 assert.deepEqual(selectCompareId(['a','b'],'c',items.map(x=>x.id)),['c']);
});

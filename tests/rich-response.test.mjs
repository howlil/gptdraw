import test from 'node:test';
import assert from 'node:assert/strict';
import {safeLink,extractAssistantContent}
  from '../src/modules/conversation-workspace/adapters/response-content.mjs';

const node=(tagName,innerText,extra={})=>({tagName,innerText,...extra});
test('only HTTP(S) links survive normalization',()=>{
  assert.equal(safeLink('javascript:alert(1)'),null);
  assert.equal(safeLink('data:text/html,hi'),null);
  assert.equal(safeLink(null),null);
  assert.match(safeLink('https://example.com/a'),/^https:\/\/example.com/);
});
test('rich block extractor retains list items, code language and table cells as typed data',()=>{
  const code=node('CODE','const answer = 42',{className:'language-typescript'});
  const pre=node('PRE','const answer = 42',{querySelector:()=>code});
  const list=node('UL','one\ntwo',{
    querySelectorAll:()=>[node('LI','one'),node('LI','two')]
  });
  const table=node('TABLE','Name\nAda',{
    querySelectorAll:()=>[{
      querySelectorAll:()=>[node('TH','Name'),node('TD','Ada')]
    }]
  });
  const content={parentElement:{closest:()=>null},
    querySelectorAll:()=>[list,pre,table],contains:()=>false};
  const wrapper={querySelectorAll:selector=>selector==='.markdown'?[content]:[],
    querySelector:()=>null};
  const {blocks}=extractAssistantContent(wrapper);
  assert.deepEqual(blocks[0].items,['one','two']);
  assert.equal(blocks[1].language,'typescript');
  assert.deepEqual(blocks[2].rows,[[{text:'Name',header:true},{text:'Ada',header:false}]]);
});

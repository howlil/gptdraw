import test from 'node:test';
import assert from 'node:assert/strict';
import {extractAssistantContent} from '../src/modules/conversation-workspace/adapters/response-content.mjs';

function element(tagName,text){
  return {tagName,innerText:text,parentElement:{closest:()=>null}};
}
test('prefers complete markdown over surrounding ChatGPT reasoning time summary',()=>{
  const blocks=[element('H2','Verification'),element('P','Here are the actual results.'),
    element('PRE','npm run test\nnpm run build'),element('P','All checks passed.')];
  const markdown={querySelectorAll:()=>blocks,contains:()=>false,parentElement:{closest:()=>null}};
  const wrapper={
    textContent:'Worked for 4m 2s',
    querySelectorAll:selector=>selector==='.markdown'?[markdown]:[],
    querySelector:selector=>selector==='.markdown'?markdown:null
  };
  const result=extractAssistantContent(wrapper);
  assert.equal(result.blocks.length,4);
  assert.equal(result.blocks[0].kind,'heading');
  assert.equal(result.blocks[2].kind,'code');
  assert.match(result.text,/All checks passed/);
  assert.doesNotMatch(result.text,/Worked for/);
});
test('response without answer must not render the reasoning duration as an answer',()=>{
  const node={textContent:'Worked for 40s',querySelectorAll:()=>[],querySelector:()=>null};
  assert.deepEqual(extractAssistantContent(node).blocks,[]);
});
test('multiple markdown bodies contribute to the same response',()=>{
  const first={querySelectorAll:()=>[element('P','First part')],parentElement:{closest:()=>null}};
  const second={querySelectorAll:()=>[element('P','Second part')],parentElement:{closest:()=>null}};
  const wrapper={querySelectorAll:selector=>selector==='.markdown'?[first,second]:[],querySelector:()=>null};
  assert.equal(extractAssistantContent(wrapper).text,'First part\n\nSecond part');
});

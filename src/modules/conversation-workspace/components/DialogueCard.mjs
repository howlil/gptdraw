// One DOM-owned Dialogue card shell for new, loading, real turns and branch metadata.
// Runtime/state logic belongs to the callers. Never copy native ChatGPT innerHTML.
export function createDialogueCard({number='01',origin='',variant='turn'}={}) {
  const element=document.createElement('article');
  element.className='g-card';
  const head=document.createElement('header');
  head.className='g-card-head';
  const label=document.createElement('span');
  label.className='g-card-label';
  const originLabel=document.createElement('span');
  originLabel.className='g-card-origin';
  const headActions=document.createElement('div');
  headActions.className='g-card-actions';
  head.append(label,originLabel,headActions);
  const body=document.createElement('div');
  body.className='g-card-body';
  element.append(head,body);
  function setHeader(nextNumber=number,nextOrigin=origin) {
    label.textContent=String(nextNumber);
    originLabel.textContent=String(nextOrigin);
  }
  function setVariant(next) {
    for(const value of ['start','loading','unavailable','turn','branch'])
      element.classList.toggle('g-card-'+value,value===next);
  }
  setHeader();
  setVariant(variant);
  return {element,head,body,label,originLabel,headActions,setHeader,setVariant};
}

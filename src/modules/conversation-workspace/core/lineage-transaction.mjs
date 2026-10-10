import { createPendingBranch, confirmBranch } from './branch.mjs';
export function applyLineageMutation(current,operation,payload={},now=Date.now()) {
  const records=Array.isArray(current?.records)?current.records:[];
  let pending=current?.pending?.status==='pending' &&
    now-current.pending.createdAt < 20*60*1000 ? current.pending:null;
  let next=records;
  let result=null;
  if(operation==='begin') {
    if(pending) {
      if(pending.id!==payload.record?.id)
        throw new Error('Finish or dismiss the previous Fork before starting another.');
      result=pending;
    } else {
      const input=payload.record;
      const record=createPendingBranch({...input,anchor:input?.source?.anchor ?? null,
        sourceMessageId:input?.source?.messageId,
        sourceRole:input?.source?.role || 'assistant'});
      pending=record;result=record;
    }
  } else if(operation==='confirm') {
    if(!pending || pending.id!==payload.pendingId)
      throw new Error('Pending Fork was dismissed, expired or replaced.');
    result=confirmBranch(records,pending,payload.childConversationId);
    next=[...records,result];pending=null;
  } else if(operation==='dismiss') {
    if(pending && payload.pendingId===pending.id)pending=null;
    result=null;
  } else throw new Error('Unsupported branch mutation.');
  if(next.length>2000)throw new Error('Too many branch relations.');
  return {state:{records:next,pending,revision:(current?.revision||0)+1},result};
}

// Native ChatGPT owns branching. These records represent explicitly verified
// relations, not a second model/context engine or a copy of message content.
export function conversationId(route) {
  return typeof route === 'string' && route.startsWith('conversation:') && route.length > 13
    ? route.slice(13) : null;
}
export function stableMessageId(id) {
  return typeof id === 'string' && id.length > 0 &&
    !/^(?:user|assistant):(?:visible:|conversation-turn-\d+$)/.test(id);
}
export function validateAnchor(anchor) {
  if (!anchor) return null;
  if (!Number.isInteger(anchor.blockIndex) || anchor.blockIndex < 0 ||
      !Number.isInteger(anchor.start) || !Number.isInteger(anchor.end) ||
      anchor.start < 0 || anchor.end <= anchor.start ||
      anchor.end - anchor.start > 12000 ||
      !/^[a-f0-9]{64}$/.test(anchor.digest || '')) {
    throw new Error('Invalid quote anchor.');
  }
  return { blockIndex:anchor.blockIndex, start:anchor.start,
    end:anchor.end, digest:anchor.digest };
}
export function createPendingBranch({id,parentConversationId,sourceMessageId,sourceRole='assistant',
  rootConversationId=parentConversationId,anchor=null,createdAt=Date.now()}) {
  if (!id || !parentConversationId || !rootConversationId ||
      !stableMessageId(sourceMessageId) ||
      !['user','assistant'].includes(sourceRole))
    throw new Error('A stable native message and conversation are required for Fork.');
  return {id,rootConversationId,parentConversationId,
    childConversationId:null,source:{messageId:sourceMessageId,role:sourceRole,
      anchor:validateAnchor(anchor)},status:'pending',createdAt};
}
export function confirmBranch(records,pending,childConversationId) {
  if (pending.status !== 'pending' || !childConversationId || childConversationId === pending.parentConversationId)
    throw new Error('Choose a different ChatGPT conversation to confirm a branch.');
  const existing = records.find(r=>r.childConversationId === childConversationId && r.status === 'confirmed');
  if (existing) throw new Error('This conversation is already linked to a parent.');
  if (records.some(r=>r.id===pending.id && r.status==='confirmed'))
    throw new Error('The branch was already confirmed.');
  const edges = [...records.filter(r=>r.status==='confirmed').map(r=>[r.parentConversationId,r.childConversationId]),
    [pending.parentConversationId,childConversationId]];
  // A child cannot indirectly become an ancestor of itself.
  const parents = new Map();
  for (const [parent,child] of edges) {
    if (parents.has(child)) throw new Error('A conversation cannot have two parents.');
    parents.set(child,parent);
  }
  for(const start of parents.keys()){
    const seen=new Set();let cursor=start;
    while(parents.has(cursor)){
      if(seen.has(cursor))throw new Error('A branch cannot create a cycle.');
      seen.add(cursor);cursor=parents.get(cursor);
    }
  }
  return {...pending,childConversationId,status:'confirmed'};
}
export function branchRelations(records,current) {
  const confirmed=records.filter(r=>r.status==='confirmed');
  return {
    parent:confirmed.find(r=>r.childConversationId===current)||null,
    children:confirmed.filter(r=>r.parentConversationId===current)
  };
}
export async function quoteAnchor({text,blockIndex,start,end},cryptoApi=globalThis.crypto) {
  if(typeof text!=='string'||text.length===0)throw new Error('No selected quote.');
  const digest=await cryptoApi.subtle.digest('SHA-256',new TextEncoder().encode(text));
  const hex=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  return validateAnchor({blockIndex,start,end,digest:hex});
}

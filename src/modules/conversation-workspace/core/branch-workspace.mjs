import { conversationId } from './branch.mjs';

// Connected, verified branch family. A disconnected conversation must never
// appear in the same workspace. Content is intentionally not part of this map.
export function buildBranchWorkspace(records,route) {
  const current=conversationId(route);
  if(!current)return {current:null,root:null,nodes:[],edges:[]};
  const byChild=new Map(),children=new Map();
  for(const record of records||[]) {
    if(record?.status!=='confirmed'||!record.parentConversationId||!record.childConversationId)continue;
    if(record.parentConversationId===record.childConversationId)continue;
    if(byChild.has(record.childConversationId))continue;
    byChild.set(record.childConversationId,record);
    if(!children.has(record.parentConversationId))children.set(record.parentConversationId,[]);
    children.get(record.parentConversationId).push(record);
  }
  let root=current;
  const seen=new Set();
  while(byChild.has(root)&&!seen.has(root)){
    seen.add(root);root=byChild.get(root).parentConversationId;
  }
  if(seen.has(root))return {current,root:current,nodes:[],edges:[]};
  const nodes=[],edges=[],visited=new Set();
  const visit=(id,depth,parentId=null)=>{
    if(visited.has(id))return;
    visited.add(id);
    const incoming=byChild.get(id);
    nodes.push({id,depth,parentId,isCurrent:id===current,
      sourceMessageId:incoming?.source?.messageId||null,
      createdAt:incoming?.createdAt||null});
    const descend=[...(children.get(id)||[])].sort((a,b)=>
      (a.createdAt||0)-(b.createdAt||0)||a.childConversationId.localeCompare(b.childConversationId));
    for(const record of descend){
      if(visited.has(record.childConversationId))continue;
      edges.push({id:record.id,from:id,to:record.childConversationId,
        sourceMessageId:record.source?.messageId||null});
      visit(record.childConversationId,depth+1,id);
    }
  };
  visit(root,0);
  // Sequential DFS leaf positions, with parent centered over children.
  const positions=new Map();let row=0;
  const place=id=>{
    const branch=(children.get(id)||[]).map(r=>r.childConversationId).filter(x=>visited.has(x));
    if(!branch.length){positions.set(id,row++);return positions.get(id);}
    const ys=branch.map(place);
    const y=(ys[0]+ys[ys.length-1])/2;
    positions.set(id,y);return y;
  };
  place(root);
  return {current,root,
    nodes:nodes.map(n=>({...n,x:n.depth*280,y:positions.get(n.id)*112})),
    edges
  };
}

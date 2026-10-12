// Graph identity and native provenance are different claims.
// Only an explicit native message identifier can authorize durable actions.
const TRANSIENT=/^(?:user|assistant):(?:observed:|visible:|conversation-turn-\d+|turn-key:|data-turn-key:)/;
export function stableMessageId(id) {
  return typeof id==='string' && id.length>0 && id.length<200 &&
    !TRANSIENT.test(id) && !/\s/.test(id);
}
export function hasDurableSource(row) {
  if(!row || !stableMessageId(row.id))return false;
  if(row.identity==='ephemeral'||row.identity==='candidate')return false;
  if(row.identity==='stable' && row.durableId===null)return false;
  // Legacy test fixtures/old stable records have no provenance property.
  // Real DOM rows always provide it; do not upgrade candidate DOM IDs.
  return row.identity===undefined || row.identity==='stable';
}
export function sourceDescriptor(row) {
  if(!row)return null;
  return {graphId:row.id,nativeId:row.nativeId||row.id,
    durableId:hasDurableSource(row)?(row.durableId||row.id):null,
    role:row.role,provenance:row.identity||'stable'};
}
export function matchesLiveSource(row,nativeNode) {
  if(!row || !nativeNode || nativeNode.isConnected===false)return false;
  if(row.identity!=='ephemeral' && row.identity!=='candidate')return true;
  // A position-based native id can be recycled. DOM element identity and
  // current text must corroborate the same visible message.
  if(row.element!==nativeNode || row.source?.isConnected===false)return false;
  const actual=row.source?.textContent;
  if(typeof actual==='string' && typeof row.text==='string'){
    const normalized=value=>value.replace(/\s+/g,' ').trim();
    if(normalized(actual)!==normalized(row.text))return false;
  }
  return true;
}

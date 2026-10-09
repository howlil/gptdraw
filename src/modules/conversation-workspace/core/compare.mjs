// Compare is read-only and limited to actual turns loaded into current memory.
// Unloaded branch metadata never supplies fabricated prompt/answer content.
export function selectCompareId(current,id,availableIds){
  if(!availableIds.includes(id))return current;
  if(current.includes(id))return current.filter(x=>x!==id);
  if(current.length>=2)return [id];
  return [...current,id];
}
export function comparisonTurns(turns,selected) {
  if(selected.length!==2||selected[0]===selected[1])return null;
  const byId=new Map(turns.map(t=>[t.id,t]));
  const left=byId.get(selected[0]),right=byId.get(selected[1]);
  return left&&right?{left,right}:null;
}

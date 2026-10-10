// A card represents ONE visible user prompt plus the following assistant reply.
// This is a DOM projection, not an AI/context engine. No ChatGPT internals are assumed.
export function pairMessages(messages) {
  const turns = [];
  let current = null;
  for (const message of messages) {
    if (message.role === 'user') {
      current = {
        id: message.id, userId: message.id, assistantId: null,
        prompt: message.text, answer: '', answerBlocks:[], anchorId: message.id,
        pending: true,breakBefore:!!message.breakBefore
      };
      turns.push(current);
    } else if (message.role === 'assistant') {
      if (current && !current.assistantId) {
        current.assistantId = message.id;
        current.answer = message.text;
        current.answerBlocks = message.blocks || [];
        current.pending = !message.text.trim();
      } else {
        // Orphan assistant output is not assigned a fabricated question.
        current = null;
      }
    }
  }
  return turns;
}

export function routeKey(pathname) {
  const match = String(pathname).match(/\/c\/([a-zA-Z0-9_-]+)/);
  return match ? 'conversation:' + match[1] : 'route:' + String(pathname).slice(0, 120);
}

export function safePoint(value) {
  const x = Number(value?.x), y = Number(value?.y);
  return Number.isFinite(x) && Number.isFinite(y)
    && Math.abs(x) < 1e6 && Math.abs(y) < 1e6 ? { x, y } : null;
}

export function layoutPoint(index) {
  // A horizontal reading spine. Positions can be customized by dragging cards.
  return { x: 130 + index * 476, y: 140 + (index % 2) * 34 };
}


// Keep canvas positions stable when lazy loading prepends older turns.
// Prior positions win for existing cards; explicit user-dragged positions
// override both. New cards are placed relative to their existing neighbors.
export function stabilizeLayout(turns, previous = new Map(), stored = {}) {
  const result=new Map(previous);
  for(const turn of turns){
    const saved=safePoint(stored[turn.id]);
    if(saved)result.set(turn.id,saved);
  }
  if(!result.size){
    turns.forEach((turn,i)=>result.set(turn.id,layoutPoint(i)));
    return result;
  }
  const nextAnchor=new Array(turns.length);
  let next=-1;
  for(let i=turns.length-1;i>=0;i--){
    if(result.has(turns[i].id))next=i;
    nextAnchor[i]=next;
  }
  let left=-1;
  for(let i=0;i<turns.length;i++){
    const turn=turns[i];
    if(result.has(turn.id)){left=i;continue;}
    const right=nextAnchor[i];
    const anchor=left>=0?left:right;
    if(anchor<0)result.set(turn.id,layoutPoint(i));
    else {
      const base=result.get(turns[anchor].id);
      result.set(turn.id,{x:base.x+(i-anchor)*476,y:layoutPoint(i).y});
    }
  }
  return result;
}

export function isCardNearViewport(position, camera, margin=520) {
  const {panX,panY,scale,width,height}=camera;
  if(!Number.isFinite(scale)||scale<=0||width<=0||height<=0)return true;
  const left=(-panX/scale)-margin,top=(-panY/scale)-margin;
  const right=(width-panX)/scale+margin,bottom=(height-panY)/scale+margin;
  return position.x+400>=left && position.x<=right &&
    position.y+600>=top && position.y<=bottom;
}

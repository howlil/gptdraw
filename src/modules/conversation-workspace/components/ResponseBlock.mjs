// Typed block renderer. Native DOM elements only; no trusted/unsafe HTML.
const el=(tag,className='')=>{
  const node=document.createElement(tag);if(className)node.className=className;return node;
};
function safeHref(raw) {
  try {
    if(!raw)return null;
    const uri=new URL(raw);
    return ['http:','https:'].includes(uri.protocol)?uri.href:null;
  }catch{return null;}
}
function renderInline(host,data) {
  const pieces=data.inline;
  if(!Array.isArray(pieces)||!pieces.length){
    host.textContent=data.text||'';return;
  }
  for(const piece of pieces) {
    const href=safeHref(piece.href);
    if(!href)host.append(document.createTextNode(piece.text||''));
    else {
      const link=el('a','g-inline-link');
      link.href=href;link.target='_blank';link.rel='noopener noreferrer';
      link.textContent=piece.text||href;host.append(link);
    }
  }
}
export function createResponseBlock(data) {
  const kind=data.kind||'paragraph';
  const tag=kind==='heading'?'h'+Math.min(4,Math.max(1,data.level||3)):
    kind==='code'?'div':kind==='quote'?'blockquote':kind==='list'?
    (data.ordered?'ol':'ul'):kind==='divider'?'hr':
    kind==='table'?'div':'p';
  const root=el(tag,'g-answer-block g-block-'+kind);
  if(kind==='heading'||kind==='paragraph')renderInline(root,data);
  else if(kind==='list'){
    const items=data.items?.length?data.items:[data.text];
    for(const item of items){
      const li=el('li');li.textContent=item;root.append(li);
    }
  }else if(kind==='code'){
    const bar=el('div','g-code-header');
    const label=el('span');label.textContent=data.language||'Code';
    const copy=el('button','g-text-action');copy.type='button';copy.textContent='Copy';
    copy.addEventListener('click',async()=>{
      // Streaming updates code.textContent in place. Read the live DOM value,
      // not the stale block data captured when this button was created.
      try{await navigator.clipboard.writeText(code.textContent||'');copy.textContent='Copied';}
      catch{copy.textContent='Copy unavailable';}
    });
    bar.append(label,copy);
    const pre=el('pre');const code=el('code');code.textContent=data.text||'';
    pre.append(code);root.append(bar,pre);
  }else if(kind==='table'&&data.rows?.length){
    const scroll=el('div','g-table-scroll'),table=el('table');
    data.rows.forEach(row=>{
      const tr=el('tr');
      row.forEach(cell=>{
        const td=el(cell.header?'th':'td');
        td.textContent=cell.text||'';
        tr.append(td);
      });table.append(tr);
    });
    scroll.append(table);root.append(scroll);
  }else root.textContent=data.text||'';
  return root;
}

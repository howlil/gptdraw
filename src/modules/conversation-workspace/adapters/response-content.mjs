// Rendered ChatGPT DOM -> typed, inert data. No copy of source innerHTML.
// Never trust URLs, markup events, scripts or ChatGPT's hidden model state.
const BLOCK_SELECTOR='h1,h2,h3,h4,p,pre,blockquote,ul,ol,table,hr';
const TEXT_KINDS={H1:'heading',H2:'heading',H3:'heading',H4:'heading',P:'paragraph',
  PRE:'code',UL:'list',OL:'list',BLOCKQUOTE:'quote',TABLE:'table',HR:'divider'};
const textOf=node=>String(node?.innerText ?? node?.textContent ?? '').trim().slice(0,120000);
const isStatusOnly=text=>/^(worked for|thought for|thinking for)\s+\d+/i.test(text);
export function safeLink(raw) {
  try {
    const value=new URL(raw,'https://chatgpt.com/');
    return ['https:','http:'].includes(value.protocol)?value.href:null;
  } catch{return null;}
}
function inlineFrom(element) {
  if(!element?.childNodes?.length)return null;
  const output=[];
  const add=(text,href=null)=>{
    if(!text)return;
    const previous=output.at(-1);
    if(previous&&previous.href===href)previous.text+=text;
    else output.push({text,href});
  };
  const walk=(node,depth)=>{
    if(depth>24||output.length>600)return;
    if(node.nodeType===3){add(node.textContent||'');return;}
    if(node.nodeType!==1)return;
    if(node.tagName==='BR'){add('\n');return;}
    if(node.tagName==='A'){
      const href=safeLink(node.getAttribute?.('href'));
      add(node.textContent||'',href);return;
    }
    for(const child of node.childNodes||[])walk(child,depth+1);
  };
  for(const node of element.childNodes)walk(node,0);
  return output.length?output:null;
}
function blockFrom(el) {
  const tag=el.tagName?.toUpperCase?.()||'P';
  const kind=TEXT_KINDS[tag]||'paragraph';
  const text=textOf(el);
  const block={kind,level:tag.startsWith('H')?Number(tag[1])||0:0,
    ordered:tag==='OL',text};
  if(kind==='paragraph'||kind==='heading')block.inline=inlineFrom(el);
  if(kind==='code'){
    const code=el.querySelector?.('code');
    block.text=textOf(code||el);
    const className=String(code?.className||'');
    const language=className.match(/(?:^|\s)language-([a-z0-9+#._-]+)/i);
    if(language)block.language=language[1];
  }
  if(kind==='list'){
    const lis=[...(el.querySelectorAll?.(':scope > li') || [])];
    const items=lis.length?lis:[...(el.querySelectorAll?.('li')||[])];
    if(items.length)block.items=items.map(textOf).filter(Boolean).slice(0,300);
  }
  if(kind==='table'){
    block.rows=[...(el.querySelectorAll?.('tr')||[])].slice(0,200).map(row=>
      [...(row.querySelectorAll?.('th,td')||[])].slice(0,30)
        .map(cell=>({text:textOf(cell),header:cell.tagName?.toUpperCase?.()==='TH'}))
    ).filter(row=>row.length);
  }
  return block;
}
function blocksFrom(container) {
  const all=[...(container?.querySelectorAll?.(BLOCK_SELECTOR)||[])];
  const filtered=all.filter(el=>{
    const parent=el.parentElement?.closest?.('pre,blockquote,ul,ol,table');
    return !parent||!container.contains?.(parent);
  });
  return filtered.map(blockFrom).filter(b=>b.kind==='divider'||b.text);
}
export function extractAssistantContent(node) {
  let markdown=[...(node?.querySelectorAll?.('.markdown')||[])]
    .filter(el=>!el.parentElement?.closest?.('.markdown'));
  if(!markdown.length){
    const found=node?.querySelector?.('.markdown');if(found)markdown=[found];
  }
  let sources=markdown;
  if(!sources.length){
    const prose=[...(node?.querySelectorAll?.('.prose')||[])]
      .filter(el=>!el.parentElement?.closest?.('.prose'));
    if(prose.length)sources=prose;
  }
  if(!sources.length){
    const direct=node?.querySelector?.('[data-testid="assistant-message"]');
    if(direct)sources=[direct];
  }
  if(!sources.length)sources=[node];
  const blocks=[];
  for(const source of sources) {
    const structured=blocksFrom(source);
    if(structured.length)blocks.push(...structured);
    else {
      const text=textOf(source);
      if(text&&!isStatusOnly(text))blocks.push({kind:'paragraph',level:0,ordered:false,text});
    }
  }
  const text=blocks.map(b=>b.text).filter(Boolean).join('\n\n');
  return {text,blocks,source:sources[0]||node};
}

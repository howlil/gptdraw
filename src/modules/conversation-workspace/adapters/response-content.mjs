// Extract a faithful *visible* assistant answer from ChatGPT markup.
// Prefer rendered markdown over generic assistant wrappers (which may include
// "Worked for 4m" and reasoning controls). Never copy unsafe source HTML.
const BLOCK_SELECTOR='h1,h2,h3,h4,p,pre,blockquote,ul,ol,table,hr';
const TEXT_KINDS={H1:'heading',H2:'heading',H3:'heading',H4:'heading',P:'paragraph',
  PRE:'code',UL:'list',OL:'list',BLOCKQUOTE:'quote',TABLE:'table',HR:'divider'};
const textOf = node => String(node?.innerText ?? node?.textContent ?? '').trim();
const isStatusOnly = text => /^(worked for|thought for|thinking for)\s+\d+/i.test(text);
function blocksFrom(container) {
  const all = [...(container?.querySelectorAll?.(BLOCK_SELECTOR) || [])];
  const filtered = all.filter(el=> {
    // A list/blockquote/pre already contains descendant paragraphs.
    const parent=el.parentElement?.closest?.('pre,blockquote,ul,ol,table');
    return !parent || !container.contains?.(parent);
  });
  return filtered.map(el=>{
    const tag=el.tagName?.toUpperCase?.() || '';
    return {kind:TEXT_KINDS[tag] || 'paragraph',level:/^H[1-4]$/.test(tag)?Number(tag[1]):0,
      ordered:tag==='OL',text:textOf(el)};
  }).filter(item=>item.kind==='divider' || item.text);
}
export function extractAssistantContent(node) {
  let markdown=[...(node?.querySelectorAll?.('.markdown') || [])]
    .filter(el=>!el.parentElement?.closest?.('.markdown'));
  if(!markdown.length) {
    const found=node?.querySelector?.('.markdown');
    if(found)markdown=[found];
  }
  let sources=markdown;
  if(!sources.length) {
    const prose=[...(node?.querySelectorAll?.('.prose') || [])]
      .filter(el=>!el.parentElement?.closest?.('.prose'));
    if(prose.length)sources=prose;
  }
  if(!sources.length) {
    const direct=node?.querySelector?.('[data-testid="assistant-message"]');
    if(direct)sources=[direct];
  }
  if(!sources.length) sources=[node];
  let blocks=[];
  for(const source of sources) {
    const structured=blocksFrom(source);
    if(structured.length)blocks.push(...structured);
    else {
      const text=textOf(source);
      if(text && !isStatusOnly(text))blocks.push({kind:'paragraph',level:0,ordered:false,text});
    }
  }
  const text=blocks.map(b=>b.text).filter(Boolean).join('\n\n');
  return {text,blocks,source:sources[0] || node};
}

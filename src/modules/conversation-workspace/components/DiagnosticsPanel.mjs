// Privacy-safe, on-demand diagnostics. No transcript, prompt, message IDs,
// URLs, cookies, tokens or DOM HTML are included in the export.
export function createDiagnosticsPanel(getData) {
  const panel=document.createElement('aside');panel.className='g-diagnostics';
  panel.hidden=true;panel.setAttribute('role','dialog');
  panel.setAttribute('aria-label','gptdraw compatibility diagnostics');
  const header=document.createElement('div');header.className='g-diagnostics-head';
  const title=document.createElement('strong');title.textContent='Compatibility diagnostics';
  const close=document.createElement('button');close.textContent='Close';close.type='button';
  close.addEventListener('click',()=>{panel.hidden=true;});
  header.append(title,close);
  const body=document.createElement('dl');body.className='g-diagnostics-rows';
  const actions=document.createElement('div');actions.className='g-diagnostics-actions';
  const copy=document.createElement('button');copy.type='button';copy.textContent='Copy diagnostics';
  const status=document.createElement('span');status.setAttribute('role','status');
  let snapshot={};
  async function refresh(){
    snapshot=await getData();
    body.replaceChildren();
    for(const [key,value] of Object.entries(snapshot)){
      const dt=document.createElement('dt');dt.textContent=key;
      const dd=document.createElement('dd');dd.textContent=String(value??'unknown');
      body.append(dt,dd);
    }
    return snapshot;
  }
  copy.addEventListener('click',async()=>{
    try{await refresh();await navigator.clipboard.writeText(JSON.stringify(snapshot,null,2));
      status.textContent='Copied';}
    catch{status.textContent='Clipboard unavailable';}
  });
  actions.append(copy,status);panel.append(header,body,actions);
  return {element:panel,open(){panel.hidden=false;refresh().catch(()=>{status.textContent='Diagnostics unavailable';});},
    close(){panel.hidden=true;}};
}

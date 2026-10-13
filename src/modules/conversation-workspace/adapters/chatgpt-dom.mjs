import { backfillHistory, yieldForHistory } from './history.mjs';
import { extractAssistantContent } from './response-content.mjs';
import { stableMessageId } from '../core/message-identity.mjs';
import { TURN_SELECTOR, ROLE_SELECTOR, GROUP_SELECTOR, UNIT_SELECTOR,
  TRANSCRIPT_SELECTOR, MESSAGE_MARKER, normalizedRole, roleOf,
  detectLayout, canonicalCandidates } from './chatgpt-layouts.mjs';

// Read only rendered ChatGPT message DOM. Never reach into React state,
// cookies, hidden endpoints or model context. Site markup varies by cohort.
const RESPONSE_CONTENT = '.markdown,.prose,[data-testid="assistant-message"]';
const USER_CONTENT = '[data-testid="user-message"],[data-user-message-bubble],.user-message-bubble-color,.whitespace-pre-wrap';

function readSource(node, role) {
  const selector = role === 'user' ? USER_CONTENT : RESPONSE_CONTENT;
  return node.querySelector?.(selector) || node.querySelector?.(ROLE_SELECTOR) || node;
}
function assistantFromTurn(node,options={}) {
  const own=extractAssistantContent(node,options);
  if(own.text||own.hasNativeMedia)return own;
  const wrapper=node.closest?.(TURN_SELECTOR) || node.closest?.(GROUP_SELECTOR);
  if(!wrapper || wrapper===node)return own;
  const surrounding=extractAssistantContent(wrapper,options);
  return surrounding.text||surrounding.hasNativeMedia?surrounding:own;
}
function idOf(node, role, ordinal) {
  const inside=node.querySelector?.(ROLE_SELECTOR);
  const messageId=node.getAttribute?.('data-message-id')||
    inside?.getAttribute?.('data-message-id');
  if(messageId){
    const id=role+':'+messageId;
    return {id,identity:stableMessageId(id)?'stable':'ephemeral',
      durableId:stableMessageId(id)?id:null};
  }
  // data-turn-id and data-turn-key can identify a rendered grouping but are
  // not proof of a durable native message identifier.
  const unitKey=node.getAttribute?.('data-content-search-unit-key');
  if(unitKey)return {id:role+':unit-key:'+unitKey,identity:'candidate',durableId:null};
  const transcriptId=node.matches?.(TRANSCRIPT_SELECTOR) && node.getAttribute?.('id');
  if(transcriptId)return {id:role+':transcript:'+transcriptId,identity:'candidate',durableId:null};
  const turnId=node.getAttribute?.('data-turn-id');
  if(turnId)return {id:role+':'+turnId,identity:'candidate',durableId:null};
  const turnKey=node.getAttribute?.('data-turn-key')||
    inside?.getAttribute?.('data-turn-key');
  if(turnKey)return {id:role+':'+turnKey,identity:'candidate',durableId:null};
  const testId=node.getAttribute?.('data-testid');
  return {id:role+':'+(testId||'visible:'+ordinal),
    identity:'ephemeral',durableId:null};
}

export function findChatMain(doc) {
  const mains = [...(doc.querySelectorAll?.('main,[role="main"]') || [])];
  if (!mains.length) return doc.querySelector?.('main') || doc.querySelector?.('[role="main"]') || doc.body;
  // The composer alone does not prove that a root owns the transcript.
  const score = el => {
    if(el.querySelector?.(TRANSCRIPT_SELECTOR)) return 8;
    if(el.querySelector?.(UNIT_SELECTOR)) return 7;
    if(el.querySelector?.(TURN_SELECTOR)) return 6;
    if(el.querySelector?.(ROLE_SELECTOR)) return 5;
    if(el.querySelector?.(GROUP_SELECTOR)) return 4;
    if(el.querySelector?.('#prompt-textarea,[data-testid="composer-text-input"]')) return 1;
    return 0;
  };
  const ranked=mains.map((el,index)=>({el,index,rank:score(el)}))
    .sort((a,b)=>b.rank-a.rank || a.index-b.index);
  return ranked[0]?.rank ? ranked[0].el : mains[0];
}

function collectCanonical(candidates,options={}) {
  const rows=[],seen=new Set();
  for (const node of candidates) {
    const role=roleOf(node);
    if(!role)continue;
    const provenance=idOf(node,role,rows.length);
    if(seen.has(provenance.id))continue;
    seen.add(provenance.id);
    // These canonical units already represent one role; never climb to a
    // shared group containing both the prompt and assistant response.
    const extracted=role==='assistant'?extractAssistantContent(node,options):null;
    const source=extracted?.source || readSource(node,role);
    rows.push({id:provenance.id,role,text:extracted?.text ?? (source.textContent||'').trim(),
      blocks:extracted?.blocks||[],hasNativeMedia:!!extracted?.hasNativeMedia,
      identity:provenance.identity,durableId:provenance.durableId,element:node,source});
  }
  return rows;
}

export function collectMessages(root,options={}) {
  if (!root?.querySelectorAll) return [];
  const canonical=canonicalCandidates(root);
  if(canonical.candidates) return collectCanonical(canonical.candidates,options);
  const wrappers = [...root.querySelectorAll(TURN_SELECTOR)];
  const candidates = [];
  if (wrappers.length) {
    for (const wrapper of wrappers) {
      const own = normalizedRole(wrapper.getAttribute?.('data-turn'));
      if (own) candidates.push(wrapper);
      else {
        const children = [...(wrapper.querySelectorAll?.(ROLE_SELECTOR) || [])];
        const distinct = children.filter(node => normalizedRole(node.getAttribute?.('data-message-author-role'))
          || normalizedRole(node.getAttribute?.('data-conversation-role')));
        if (distinct.length) candidates.push(...distinct);
        else if (roleOf(wrapper)) candidates.push(wrapper);
      }
    }
    // Some A/B variants mix turn shells and bare role nodes.
    const extra = [...root.querySelectorAll(ROLE_SELECTOR)]
      .filter(el => !(el.closest?.(TURN_SELECTOR)));
    candidates.push(...extra);
    if (candidates.length > 1 && candidates.every(el => typeof el.compareDocumentPosition === 'function')) {
      candidates.sort((a,b) => a === b ? 0
        : a.compareDocumentPosition(b) & 4 ? -1 : 1);
    }
  } else {
    // Fallback when conversation-turn shells are absent or virtualized.
    candidates.push(...root.querySelectorAll(ROLE_SELECTOR));
  }
  const result = [], seen = new Set();
  for (const node of candidates) {
    const role = roleOf(node);
    if (!role) continue;
    const identity=idOf(node,role,result.length);
    const id=identity.id;
    if (seen.has(id)) continue;
    seen.add(id);
    const extracted=role==='assistant'?assistantFromTurn(node,options):null;
    const source=extracted?.source || readSource(node,role);
    result.push({id,role,text:extracted?.text ?? (source.textContent || '').trim(),
      blocks:extracted?.blocks || [],hasNativeMedia:!!extracted?.hasNativeMedia,
      identity:identity.identity,durableId:identity.durableId,element:node,source});
  }
  if (!result.some(row => row.role === 'user')) {
    // Some renderer variants put both roles under a stable user turn key,
    // without exposing a data-message-author-role on the user bubble.
    // Use this only when normal role-bearing user messages cannot be found.
    const grouped = [];
    for (const group of root.querySelectorAll(GROUP_SELECTOR)) {
      const key = group.getAttribute?.('data-turn-key');
      if (!key) continue;
      const user = group.querySelector?.('[data-user-message-bubble]');
      if (!user) continue;
      grouped.push({
        id:'user:turn-key:'+key,role:'user',
        text:(user.textContent||'').trim(),identity:'candidate',durableId:null,element:user,source:user
      });
      const marker = group.querySelector?.('[data-conversation-role="assistant"],[data-chatgpt-agent-turn-start]');
      if (marker) {
        let source = marker.closest?.('[data-conversation-role="assistant"]') || marker.parentElement || marker;
        // A container containing both roles cannot be treated as assistant
        // output: that would duplicate the user's prompt as a fake answer.
        if (source === group || source.contains?.(user)) source = marker;
        // Group wrappers can keep rendered Markdown outside the role marker.
        // Do not serialize the whole keyed group: it includes the user prompt.
        const answerContent=[...(group.querySelectorAll?.(RESPONSE_CONTENT)||[])]
          .find(el => el!==user && !el.contains?.(user) && !user.contains?.(el));
        if(answerContent)source=answerContent;
        if(source===group || source.contains?.(user))continue;
        const answer=extractAssistantContent(source,options);
        grouped.push({
          id:'assistant:turn-key:'+key,role:'assistant',
          text:answer.text,blocks:answer.blocks,hasNativeMedia:!!answer.hasNativeMedia,
          identity:'candidate',durableId:null,element:source,source:answer.source
        });
      }
    }
    if (grouped.length) return grouped;
  }
  return result;
}

// One MutationObserver per ChatGPT conversation surface. Keep a map from
// actual DOM nodes to turn IDs to avoid scanning every node for each token.
export function createChatGPTObserver({ document, onSnapshot, onPatch, onRoute, onHistory,
  schedule = callback => requestAnimationFrame(callback) }) {
  let root = null, observer = null, bodyObserver = null, mounted = false, queued = false, connectQueued=false;
  let pathname = document.defaultView?.location.pathname || '/';
  let nodes = new Map(), targetIds = new WeakMap(), pending = new Map(), rescan = true;
  let blockCache=new WeakMap();
  let backfillAbort = null, historyStarted = false;
  let domScans=0,domPatches=0,userActivityUntil=0;
  let scanLastMs=0,scanMaxMs=0,patchLastMs=0,patchMaxMs=0;
  let discovery={layout:'unknown',rootValid:false,discoveredCandidates:0,
    acceptedMessages:0,rejectedCandidates:0,userMessages:0,assistantMessages:0,
    identityCounts:{stable:0,candidate:0,ephemeral:0},discoveryStatus:'awaiting-hydration'};
  const cancelBackfill = () => {backfillAbort?.abort();backfillAbort = null;};
  function startBackfill() {
    if (!mounted || historyStarted || backfillAbort || !onHistory ||
        !/(?:^|\/)c\/[a-zA-Z0-9_-]+/.test(pathname) || ![...nodes.values()].some(row => row.role === 'user')) return;
    historyStarted = true;
    const activeRoot = root;
    const controller = new AbortController();backfillAbort = controller;
    backfillHistory({document,root:activeRoot,signal:controller.signal,
      yieldForScan:()=>yieldForHistory(document,controller.signal,
        {isInteracting:()=>Date.now()<userActivityUntil}),
      onStatus:status => {if(!controller.signal.aborted)onHistory(status);},
      onScan:observation => {
        if(controller.signal.aborted || activeRoot!==root)return {count:0};
        const cumulative=snapshot(observation);
        return cumulative || {count:nodes.size,firstId:nodes.keys().next().value ?? null};
      }
    }).catch(error => {
      if (!controller.signal.aborted)onHistory({status:'limited',message:error?.message || 'History load failed'});
    }).finally(() => {if(backfillAbort === controller)backfillAbort = null;});
  }
  const snapshot = (observation={}) => {
    const started=performance.now();
    domScans++;
    blockCache=new WeakMap();
    const rows = collectMessages(root,{cache:blockCache});
    const markerCount=root?.querySelectorAll?.(MESSAGE_MARKER)?.length||0;
    const rootValid=markerCount>0 || rows.length>0;
    const mainMarkers=!!document.querySelector?.(MESSAGE_MARKER);
    const identityCounts={stable:0,candidate:0,ephemeral:0};
    for(const row of rows)identityCounts[row.identity]=(identityCounts[row.identity]||0)+1;
    discovery={
      layout:detectLayout(root),rootValid,discoveredCandidates:markerCount,
      acceptedMessages:rows.length,rejectedCandidates:Math.max(0,markerCount-rows.length),
      userMessages:rows.filter(row=>row.role==='user').length,
      assistantMessages:rows.filter(row=>row.role==='assistant').length,
      identityCounts,
      discoveryStatus:rows.length?'ready':rootValid?'unsupported-layout':
        mainMarkers?'root-mismatch':
        /(?:^|\\/)c\\/[a-zA-Z0-9_-]+/.test(pathname)?'awaiting-hydration':'empty-chat'
    };
    nodes = new Map(rows.map(row => [row.id,row]));
    targetIds = new WeakMap();
    for (const row of rows) {
      targetIds.set(row.element,row.id);
      if (row.source && typeof row.source === 'object') targetIds.set(row.source,row.id);
      const roleEl = row.element.querySelector?.(ROLE_SELECTOR);
      if (roleEl) targetIds.set(roleEl,row.id);
    }
    const cumulative=onSnapshot(rows,observation);
    scanLastMs=Math.round((performance.now()-started)*100)/100;
    scanMaxMs=Math.max(scanMaxMs,scanLastMs);
    if (!historyStarted) queueMicrotask(startBackfill);
    return cumulative;
  };
  const turnFor = node => {
    let element = node?.nodeType === 1 ? node : node?.parentElement;
    while (element && element !== root) {
      const id = targetIds.get(element);
      if (id) return id;
      element = element.parentElement;
    }
    return null;
  };
  const flush = () => {
    queued = false;
    if (!mounted) return;
    const nextPath = document.defaultView?.location.pathname || '/';
    if (nextPath !== pathname) {
      cancelBackfill();historyStarted=false;
      pathname = nextPath; onRoute(pathname); rescan = true;
    }
    const newRoot = findChatMain(document);
    if (newRoot !== root) { cancelBackfill();historyStarted=false;attach(newRoot); rescan = true; }
    if (rescan) {
      rescan = false; pending.clear(); snapshot(); return;
    }
    for (const [id,dirtyNodes] of pending) {
      const started=performance.now();
      const previous = nodes.get(id);
      if (!previous) continue;
      const extracted=previous.role==='assistant'?assistantFromTurn(previous.element,{cache:blockCache,dirtyNodes}):null;
      const source=extracted?.source || readSource(previous.element,previous.role);
      const text = extracted?.text ?? (source.textContent || '').trim();
      const blocks=extracted?.blocks||[];
      const previousBlocks=previous.blocks||[];
      const blocksChanged=blocks.length!==previousBlocks.length ||
        blocks.some((block,index)=>block!==previousBlocks[index]);
      const hasNativeMedia=!!extracted?.hasNativeMedia;
      if (text !== previous.text || blocksChanged ||
          hasNativeMedia!==!!previous.hasNativeMedia) {
        const updated = { ...previous,text,source,blocks,hasNativeMedia };
        nodes.set(id,updated);
        targetIds.set(source,id);
        domPatches++;onPatch(updated);
      }
      patchLastMs=Math.round((performance.now()-started)*100)/100;
      patchMaxMs=Math.max(patchMaxMs,patchLastMs);
    }
    pending.clear();
  };
  const queue = () => { if (!queued) { queued = true; schedule(flush); } };
  const structuralAttrs=new Set([
    'data-turn','data-turn-id','data-turn-key','data-message-id',
    'data-message-author-role','data-conversation-role','data-message-role',
    'data-content-search-unit-key','data-testid','id'
  ]);
  const onMutations = mutations => {
    for (const mutation of mutations) {
      const id=turnFor(mutation.target);
      if(mutation.type==='attributes' && structuralAttrs.has(mutation.attributeName)){
        rescan=true;
      } else if(mutation.type==='characterData' || mutation.type==='attributes'){
        if(id){
          if(!pending.has(id))pending.set(id,new Set());
          pending.get(id).add(mutation.target);
        } else rescan=true;
      } else if(mutation.type==='childList'){
        const structural=[...mutation.addedNodes,...mutation.removedNodes].some(node =>
          node.nodeType===1 && (node.matches?.(MESSAGE_MARKER) ||
            node.querySelector?.(MESSAGE_MARKER))
        );
        if(structural || !id)rescan=true;
        else {
          if(!pending.has(id))pending.set(id,new Set());
          pending.get(id).add(mutation.target);
        }
      }
    }
    queue();
  };
  function attach(nextRoot) {
    observer?.disconnect();
    root = nextRoot;
    if (!root) return;
    observer = new MutationObserver(onMutations);
    observer.observe(root,{subtree:true,childList:true,characterData:true,
      attributes:true,attributeFilter:['href',...structuralAttrs]});
  }
  function connect() {
    if(!mounted)return;
    const currentPath=document.defaultView?.location.pathname || '/';
    if(currentPath!==pathname){
      cancelBackfill();historyStarted=false;
      pathname=currentPath;onRoute(pathname);rescan=true;
    }
    const next=findChatMain(document);
    if(next!==root){cancelBackfill();historyStarted=false;attach(next);rescan=true;}
    queue();
  }
  // ChatGPT SPA transitions can replace a nested main, without popstate or
  // a direct BODY child insertion. Observe nested shell changes, but avoid
  // reacting to routine streamed content inside our separately watched root.
  const scheduleConnect=()=>{
    if(!mounted||connectQueued)return;
    connectQueued=true;
    queueMicrotask(()=>{connectQueued=false;connect();});
  };
  const onBodyMutations=mutations=>{
    if(!mounted)return;
    if((document.defaultView?.location.pathname||'/')!==pathname ||
       !root || root.isConnected===false){scheduleConnect();return;}
    for(const mutation of mutations){
      if(root.contains?.(mutation.target))continue;
      if([...mutation.addedNodes,...mutation.removedNodes].some(node=>
          node.nodeType===1 && (node.matches?.('main,[role="main"]') ||
            node.querySelector?.('main,[role="main"]')))){
        scheduleConnect();return;
      }
    }
  };
  const nav = () => { rescan = true; scheduleConnect(); };
  return {
    start() {
      if (mounted) return;
      mounted = true;rescan = true;historyStarted=false;connect();
      document.defaultView?.addEventListener('popstate',nav);
      bodyObserver = new MutationObserver(onBodyMutations);
      if(document.body)bodyObserver.observe(document.body,{childList:true,subtree:true});
    },
    refresh() { rescan = true; historyStarted=false; cancelBackfill(); connect(); },
    loadEarlier() { historyStarted=false;cancelBackfill();startBackfill(); },
    pauseHistory() {cancelBackfill();historyStarted=true;onHistory?.({status:'paused'});},
    markInteraction(){userActivityUntil=Date.now()+850;},
    getElement(id) { return nodes.get(id)?.element || null; },
    getDiagnostics(){
      return {domScans,domPatches,rootPresent:!!root,...discovery,
        liveDOMMessages:nodes.size,historyActive:!!backfillAbort,
        scanLastMs,scanMaxMs,patchLastMs,patchMaxMs,
        idSource:nodes.size && [...nodes.keys()].some(id=>id.includes('visible:'))?'mixed':'native-or-candidate'};
    },
    stop() {
      mounted = false;cancelBackfill();historyStarted=false;observer?.disconnect();bodyObserver?.disconnect();
      document.defaultView?.removeEventListener('popstate',nav);
      root = null;observer = null;bodyObserver = null;queued = false;connectQueued=false;
      nodes.clear();pending.clear();targetIds = new WeakMap();blockCache=new WeakMap();rescan = true;
      discovery={...discovery,acceptedMessages:0,userMessages:0,assistantMessages:0,
        rootValid:false,discoveryStatus:'awaiting-hydration'};
    }
  };
}

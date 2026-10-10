// Metadata only. Does not persist prompts, assistant content or selected quote.
// Pending records are deliberate user intent, never inferred from navigation.
const KEY='gptdraw:branch-relations:v1';
const PENDING='gptdraw:pending-branch:v1';
export function createBranchStorage(storage, changes=globalThis.chrome?.storage?.onChanged) {
  return {
    async list(){
      const value=(await storage.get(KEY))[KEY];
      return Array.isArray(value?.records) ? value.records.filter(r=>
        r && r.status==='confirmed' && typeof r.parentConversationId==='string'
        && typeof r.childConversationId==='string').slice(0,2000) : [];
    },
    async save(records) {
      if(records.length>2000)throw new Error('Too many stored branches.');
      await storage.set({[KEY]:{version:1,records}});
    },
    async pending() {
      const value=(await storage.get(PENDING))[PENDING];
      if(value?.status!=='pending'||!value.id)return null;
      // A pending relation is a transient hint, not an eternal auto-match.
      return Date.now()-value.createdAt<=20*60*1000 ? value:null;
    },
    async setPending(record) { await storage.set({[PENDING]:record}); },
    async clearPending() { await storage.remove(PENDING); },
    subscribe(listener) {
      if(!changes?.addListener)return ()=>{};
      const handler=(diff,area)=>{
        if(area==='local' && (Object.hasOwn(diff,KEY)||Object.hasOwn(diff,PENDING))) listener();
      };
      changes.addListener(handler);
      return ()=>changes.removeListener(handler);
    }
  };
}


// Production adapter delegates ALL lineage mutations to the extension-owned
// service worker IndexedDB transaction. chrome.storage pulse is notification
// only, not the source of truth.
export function createRpcBranchStorage(runtime,changes) {
  const PULSE='gptdraw:lineage-revision:v1';
  const request=(operation,payload={})=>new Promise((resolve,reject)=>{
    runtime.sendMessage({type:'GPTDRAW_LINEAGE',operation,payload},response=>{
      if(runtime.lastError)return reject(new Error(runtime.lastError.message));
      if(!response?.ok)return reject(new Error(response?.error||'Lineage service unavailable.'));
      resolve(response);
    });
  });
  return {
    async list(){return (await request('read')).state.records;},
    async pending(){
      const value=(await request('read')).state.pending;
      return value?.status==='pending' && Date.now()-value.createdAt<20*60*1000?value:null;
    },
    async begin(record){return (await request('begin',{record})).result;},
    async confirm(pendingId,childConversationId){
      return (await request('confirm',{pendingId,childConversationId})).result;
    },
    async dismiss(pendingId){return (await request('dismiss',{pendingId})).result;},
    subscribe(listener){
      if(!changes?.addListener)return ()=>{};
      const handler=(diff,area)=>{
        if(area==='local'&&Object.hasOwn(diff,PULSE))listener();
      };
      changes.addListener(handler);
      return ()=>changes.removeListener(handler);
    }
  };
}

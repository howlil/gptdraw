// Metadata only. Does not persist prompts, assistant content or selected quote.
// Pending records are deliberate user intent, never inferred from navigation.
const KEY='gptdraw:branch-relations:v1';
const PENDING='gptdraw:pending-branch:v1';
export function createBranchStorage(storage) {
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
    async clearPending() { await storage.remove(PENDING); }
  };
}

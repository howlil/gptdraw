import {applyLineageMutation} from '../modules/conversation-workspace/core/lineage-transaction.mjs';

const DB_NAME='gptdraw-metadata', STORE='lineage', ROW='main', PULSE='gptdraw:lineage-revision:v1';
const LEGACY_RELATIONS='gptdraw:branch-relations:v1', LEGACY_PENDING='gptdraw:pending-branch:v1';
let dbPromise;
function database(){
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'key'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Cannot open extension metadata database.'));
  });
  return dbPromise;
}
async function transact(operation,payload={}){
  // Read legacy metadata once as a migration seed. The IndexedDB transaction
  // is the sole authority after initialization. All writes serialize across tabs.
  const legacy=await chrome.storage.local.get([LEGACY_RELATIONS,LEGACY_PENDING]);
  const db=await database();
  const result=await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,operation==='read'?'readonly':'readwrite');
    const store=tx.objectStore(STORE);
    let output,committed=null;
    const get=store.get(ROW);
    get.onsuccess=()=>{
      try {
        const seeded={records:legacy[LEGACY_RELATIONS]?.records||[],
          pending:legacy[LEGACY_PENDING]||null,revision:0};
        const before=get.result?.state||seeded;
        if(operation==='read')output={state:before};
        else{
          const applied=applyLineageMutation(before,operation,payload);
          output={result:applied.result,state:applied.state};
          committed=applied.state;
          store.put({key:ROW,state:committed});
        }
      }catch(error){tx.abort();reject(error);}
    };
    tx.oncomplete=()=>resolve(output);
    tx.onerror=()=>reject(tx.error||new Error('Lineage transaction failed.'));
    tx.onabort=()=>reject(tx.error||new Error('Lineage transaction aborted.'));
  });
  if(operation!=='read'){
    // Notification only. It is never used for read-modify-write.
    chrome.storage.local.set({[PULSE]:result.state.revision}).catch(()=>{});
  }
  return result;
}
chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_AND_UNTRUSTED_CONTEXTS'}).catch(()=>{});
chrome.action.onClicked.addListener(async tab=>{
  if(!tab?.id)return;
  if(!/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(tab.url||'')){
    await chrome.tabs.create({url:'https://chatgpt.com/'});return;
  }
  try{await chrome.tabs.sendMessage(tab.id,{type:'GPTDRAW_TOGGLE'});}catch{}
});
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type!=='GPTDRAW_LINEAGE')return false;
  if(sender.id!==chrome.runtime.id){reply({ok:false,error:'Unauthorized context.'});return false;}
  transact(message.operation,message.payload).then(value=>reply({ok:true,...value}))
    .catch(error=>reply({ok:false,error:error?.message||'Lineage storage unavailable.'}));
  return true;
});
chrome.runtime.onInstalled.addListener(()=>{
  chrome.storage.local.remove(['gptdraw:workspace:v1','gptdraw:gateway-pair-token']).catch(()=>{});
});

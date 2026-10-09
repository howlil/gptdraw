import { createChatGPTObserver } from '../modules/conversation-workspace/adapters/chatgpt-dom.mjs';
import { createLayoutStorage } from '../modules/conversation-workspace/adapters/metadata.mjs';
import { createWorkspaceController } from '../modules/conversation-workspace/controller/workspace.mjs';
import { createConversationWorkspace } from '../modules/conversation-workspace/ConversationWorkspace.mjs';
import { icon } from '../components/ui/icons.mjs';

const HOST_ID='gptdraw-extension-root';
if(!document.getElementById(HOST_ID)){
  const host=document.createElement('div');host.id=HOST_ID;
  host.style.cssText='position:fixed;inset:0;z-index:2147483645;pointer-events:none';
  const shadow=host.attachShadow({mode:'closed'});
  const styles=document.createElement('link');
  styles.rel='stylesheet';styles.href=chrome.runtime.getURL('content.css');
  shadow.append(styles);
  const launch=document.createElement('button');
  launch.type='button';launch.className='g-launcher';
  launch.append(icon('graph',17),document.createTextNode('Graph'));
  launch.setAttribute('aria-label','Open gptdraw conversation canvas');
  shadow.append(launch);
  document.documentElement.append(host);

  const storage=createLayoutStorage(chrome.storage.local);
  let visible=false;
  const focusNative=element=>{
    hide();
    requestAnimationFrame(()=>{
      element?.scrollIntoView?.({behavior:'smooth',block:'center'});
    });
  };
  const controller=createWorkspaceController({
    pathname:()=>location.pathname,
    layoutStorage:storage,
    observe:callbacks=>createChatGPTObserver({document,...callbacks}),
    onUpdate:state=>workspace.render(state)
  });
  const workspace=createConversationWorkspace({
    onClose:hide,
    onSource:id=>focusNative(controller.getSource(id)),
    onCompose:()=>{
      hide();
      requestAnimationFrame(()=>{
        const native=document.querySelector('[data-testid="composer-text-input"],#prompt-textarea,[contenteditable="true"][data-placeholder]');
        native?.focus?.();
        native?.scrollIntoView?.({block:'nearest'});
      });
    },
    onRefresh:()=>controller.refresh(),
    onMove:(id,position)=>controller.move(id,position)
  });
  shadow.append(workspace.element);
  async function show(){
    if(visible)return;
    visible=true;launch.hidden=true;workspace.show();
    await controller.start();
  }
  function hide(){
    if(!visible)return;
    visible=false;workspace.hide();launch.hidden=false;
    controller.persist().catch(()=>{});
    controller.stop();
  }
  launch.addEventListener('click',show);
  chrome.runtime.onMessage.addListener(message=>{
    if(message?.type==='GPTDRAW_TOGGLE'){
      visible?hide():show();
    }
  });
  shadow.addEventListener('keydown',event=>{
    if(event.key==='Escape' && visible){event.preventDefault();hide();}
  });
  window.addEventListener('pagehide',()=>{controller.persist().catch(()=>{});controller.stop();});
}

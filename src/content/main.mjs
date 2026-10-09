import { createChatGPTObserver, findChatMain } from '../modules/conversation-workspace/adapters/chatgpt-dom.mjs';
import { submitNativePrompt, findNativeComposer } from '../modules/conversation-workspace/adapters/native-composer.mjs';
import { createLayoutStorage } from '../modules/conversation-workspace/adapters/metadata.mjs';
import { createWorkspaceController } from '../modules/conversation-workspace/controller/workspace.mjs';
import { createConversationWorkspace } from '../modules/conversation-workspace/ConversationWorkspace.mjs';
import { icon } from '../components/ui/icons.mjs';

const HOST_ID='gptdraw-extension-root';
if (!document.getElementById(HOST_ID)) {
  // Stay outside ChatGPT's React tree. The host covers the viewport only for
  // coordinate calculation; its children receive events only inside the main.
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
  let visible=false, measuredMain=null, resizeObserver=null, alignmentQueued=false;
  const focusNative=element=>{
    hide();
    requestAnimationFrame(()=>element?.scrollIntoView?.({behavior:'smooth',block:'center'}));
  };
  const controller=createWorkspaceController({
    pathname:()=>location.pathname,
    layoutStorage:storage,
    observe:callbacks=>createChatGPTObserver({document,...callbacks}),
    onUpdate:(state,change)=>workspace.render(state,change)
  });
  const workspace=createConversationWorkspace({
    onClose:hide,
    onSource:id=>focusNative(controller.getSource(id)),
    onCompose:()=>{
      hide();
      requestAnimationFrame(()=>{
        const native=findNativeComposer(document);
        native?.focus?.();native?.scrollIntoView?.({block:'nearest'});
      });
    },
    onStart:async text=>{
      // Native ChatGPT stays responsible for model execution, input and send.
      const result=await submitNativePrompt(document,text);
      if (result.status==='prepared') {
        hide();
        requestAnimationFrame(()=>findNativeComposer(document)?.focus?.());
      }
      return result;
    },
    onRefresh:()=>controller.refresh(),
    onMove:(id,position)=>controller.move(id,position)
  });
  shadow.append(workspace.element);

  function alignWorkspace() {
    alignmentQueued=false;
    if (!visible) return;
    const main=findChatMain(document);
    if (!main) return;
    if (main!==measuredMain) {
      resizeObserver?.disconnect();measuredMain=main;
      resizeObserver=new ResizeObserver(scheduleAlign);
      resizeObserver.observe(main);
    }
    const bounds=main.getBoundingClientRect();
    const left=Math.max(0,Math.min(window.innerWidth,bounds.left));
    const top=Math.max(0,Math.min(window.innerHeight,bounds.top));
    const width=Math.max(0,Math.min(window.innerWidth-left,bounds.width));
    const height=Math.max(0,Math.min(window.innerHeight-top,bounds.height));
    if (width < 240 || height < 180) return;
    Object.assign(workspace.element.style,{
      left:left+'px',top:top+'px',width:width+'px',height:height+'px'
    });
  }
  function scheduleAlign() {
    if (alignmentQueued || !visible) return;
    alignmentQueued=true;requestAnimationFrame(alignWorkspace);
  }
  async function show() {
    if (visible) return;
    visible=true;launch.hidden=true;
    alignWorkspace();
    workspace.show();
    await controller.start();
    scheduleAlign();
  }
  function hide() {
    if (!visible) return;
    visible=false;workspace.hide();launch.hidden=false;
    resizeObserver?.disconnect();resizeObserver=null;measuredMain=null;
    controller.persist().catch(()=>{});
    controller.stop();
  }
  launch.addEventListener('click',()=>show().catch(console.error));
  chrome.runtime.onMessage.addListener(message=>{
    if(message?.type==='GPTDRAW_TOGGLE'){
      visible?hide():show().catch(console.error);
    }
  });
  shadow.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&visible){event.preventDefault();hide();}
  });
  window.addEventListener('resize',scheduleAlign);
  // Sidebar may animate without a viewport resize. Re-measure after native
  // navigation/sidebar clicks, without moving or hiding any ChatGPT nodes.
  document.addEventListener('click',event=>{
    if (!visible || event.target===host || host.contains(event.target)) return;
    scheduleAlign();
    setTimeout(scheduleAlign,250);
  },true);
  window.addEventListener('pagehide',()=>{
    controller.persist().catch(()=>{});controller.stop();resizeObserver?.disconnect();
  });
}

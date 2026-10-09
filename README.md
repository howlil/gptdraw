# gptdraw

**Spatial conversation interface for the ChatGPT tab you already have open.**

gptdraw is a Chrome Manifest V3 extension that reads the **visible ChatGPT DOM**, projects user questions and assistant responses into connected canvas cards, and updates the affected card as ChatGPT streams new text. It changes the *interface*, not the AI model. **Only the chat main area is overlaid; ChatGPT's sidebar and app navigation remain intact.**

**No OpenAI API key. No local gateway. No second ChatGPT login. No conversation scraping to a remote service.**

## Install and run

Requirements: Node.js 22+ and Chrome/Chromium with MV3 support.

```bash
git clone https://github.com/howlil/gptdraw.git
cd gptdraw
npm install
npm run test
npm run build
```

1. Open `chrome://extensions`, switch on **Developer mode**.
2. Click **Load unpacked**, select the generated **`gptdraw/dist/` folder** (not the repo root).
3. Open or refresh `https://chatgpt.com/c/...`.
4. Click the **gptdraw icon in the Chrome extension toolbar**. If needed, pin gptdraw from Chrome's Extensions menu. There is **no floating Graph button** on the ChatGPT page.
5. Read the canvas while keeping ChatGPT's sidebar accessible; drag card headers, pan, zoom or return to the original ChatGPT message. **If no conversation exists, the canvas displays one Start Card** with a message input and Send. It delegates to ChatGPT's native composer; if automatic submission cannot be verified, your prepared draft remains in ChatGPT for manual sending.
6. Select **Compose in ChatGPT** to close the canvas and focus ChatGPT's actual native composer.
7. Return to the same chat and reopen Graph: the canvas restores your saved node positions from `chrome.storage.local`.

**No API key or gateway setup.** You must already be logged in to ChatGPT in the host tab. The extension does not create a ChatGPT subscription or access model APIs.

## Architecture and data ownership

```text
chatgpt.com (native model/composer/response)
   └── isolated Chrome content script
         ├── ChatGPT DOM observer
         │      └── normalized user+assistant turns
         ├── conversation-workspace controller
         │      ├── reusable Dialogue card components
         │      ├── SVG / DOM spatial canvas
         │      └── chrome.storage.local (positions ONLY)
         └── Shadow DOM styles (precompiled Tailwind CSS v4)

Build: esbuild JS bundle + Tailwind CLI compiled CSS → dist/
```

`AGENTS.md` + `DESIGN.md` live at root. `.agents/product-design.md` and `.agents/engineering-design.md` own product/engineering working documents. New code follows the locked `src/modules/conversation-workspace/` owner.

## Beautiful UI and the design system

The visual and reusable-component approach follows the approved Dialogue chat card and relevant [Beautiful UI](https://www.beautifului.dev/) interaction patterns. The actual extension is a **low-level native DOM implementation with reusable project-owned primitives**, not an install of the React-based Beautiful UI showcase; fake demo components, word-by-word animations and dependencies were deliberately excluded. Tailwind v4 is genuinely compiled into `dist/content.css`.

## What works now

- Reads visible user/assistant turns from ChatGPT markup, including wrapper `data-turn`, message-role fallback, and grouped `data-turn-key` exchanges; one user question + following assistant answer per card. Initial `0 turns` on a populated conversation was a role-parser bug addressed in this update.
- Mirrors current response text changes through MutationObserver + requestAnimationFrame batching without rereading the full DOM on every token.
- For **older/long conversations**, automatically walks the native conversation scroll container toward the earliest loadable messages, yielding between steps, then restores the previous scroll position. History turns collected during virtualization are held in memory only; loading can be cancelled when closing or changing chat. The workspace shows progress and a clear unavailable/limited status.
- Toolbar-icon-only activation and main-area-only overlay that preserves ChatGPT sidebar/navigation. Sequential connectors; pan/zoom, drag, focus, **First / Latest jump navigation**, Fit, native source navigation and a functioning single Start Card for empty chats. Existing cards retain their spatial positions when older messages are prepended.
- Local card-position persistence scoped to each ChatGPT conversation route. Chat text is not stored by the extension.
- Shadow DOM isolation; **black-and-white light/dark design**, following ChatGPT's explicit theme when detected and OS preference otherwise; subtle entry/hover transitions, no animation on streaming/pan/zoom; keyboard Escape close.

## Current limitations

- DOM selectors are version-sensitive. **Not live-tested on the latest authenticated ChatGPT web UI in this environment.** If ChatGPT changes markup, update `adapters/chatgpt-dom.mjs` after inspecting the real page.
- Sequential connectors are **not native branch edges**. The native Fork/Branch action, cross-conversation lineage and quote anchoring are future vertical slices.
- First slice projects **plain text** using `textContent`, not full rich HTML, code highlighting, ChatGPT citations or internal model reasoning.
- The Start Card uses a user-triggered native ChatGPT composer bridge; it does **not** call AI APIs. Native DOM-driven Send can fail after ChatGPT UI changes, in which case it retains the drafted message for manual sending.
- **History boundary:** the extension scrolls the *current open conversation*, not the list of separate chats in the sidebar. It can only collect messages that ChatGPT actually loads into the rendered DOM. Browser/network virtualization or removed messages may prevent reaching the true first turn; no private ChatGPT history API is called, and no messages are saved permanently by gptdraw.
- This extension has not yet been manually smoke-tested on a real logged-in ChatGPT page. Automated checks use deterministic fixtures and production build checks.

**After updating an unpacked extension:** run `npm run build`, then open `chrome://extensions` → click **Reload** on gptdraw, and refresh your ChatGPT tab. Otherwise Chrome may keep the previous content script.

## Developer commands

```bash
npm run test   # Node fixture/domain/controller tests
npm run build  # esbuild + Tailwind -> dist/
npm run check  # both
```

No API-related `.env` is needed. No remote JavaScript is loaded at runtime. When updating from the earlier API-client prototype, the extension automatically clears its **old saved conversation snapshot and gateway pairing token**; new per-conversation layout positions are preserved.

## Sources of truth

- [AGENTS.md](AGENTS.md) — routing and risk-based vertical-slice engineering.
- [DESIGN.md](DESIGN.md) — exact product/design contract.
- [.agents/product-design.md](.agents/product-design.md) — product evidence and open UX risks.
- [.agents/engineering-design.md](.agents/engineering-design.md) — implemented dependency boundaries, DOM compatibility and performance rules.

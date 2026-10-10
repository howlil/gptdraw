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
4. **gptdraw opens automatically** when you navigate to ChatGPT. The Chrome extension toolbar icon also toggles graph/native view; there is **no floating Graph button** on the ChatGPT page.
5. Read the canvas while keeping ChatGPT's sidebar accessible. The initial view **focuses the latest card at readable scale**, rather than fitting the entire graph into miniature 40% text. Use **Fit** only for overview, and Find Card / Outline to navigate large histories. Drag card headers, pan, zoom or return to native source. **If no conversation exists, the canvas displays one Start Card** with a message input and Send. It delegates to ChatGPT's native composer; if automatic submission cannot be verified, your prepared draft remains in ChatGPT for manual sending.
6. Select **Back to ChatGPT** or the close button to restore the native chat UI. This choice persists for the current tab session; click the extension toolbar icon to return to gptdraw. The latest card also provides a compact follow-up composer that delegates Send to the real ChatGPT composer.
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
         │      ├── chrome.storage.local (layout + bookmark IDs)
         │      └── service worker → transactional IndexedDB (branch lineage)
         └── Shadow DOM styles (precompiled Tailwind CSS v4)

Build: esbuild JS bundle + Tailwind CLI compiled CSS → dist/
```

`AGENTS.md` + `DESIGN.md` live at root. `.agents/product-design.md` and `.agents/engineering-design.md` own product/engineering working documents. New code follows the locked `src/modules/conversation-workspace/` owner.

## Beautiful UI and the design system

The visual and reusable-component approach follows the approved Dialogue chat card and relevant [Beautiful UI](https://www.beautifului.dev/) interaction patterns. The actual extension is a **low-level native DOM implementation with reusable project-owned primitives**, not an install of the React-based Beautiful UI showcase; fake demo components, word-by-word animations and dependencies were deliberately excluded. Tailwind v4 is genuinely compiled into `dist/content.css`.

## What works now

- Reads visible user/assistant turns from ChatGPT markup, including wrapper `data-turn`, message-role fallback, and grouped `data-turn-key` exchanges; one user question + following assistant answer per card. Initial `0 turns` on a populated conversation was a role-parser bug addressed in this update.
- Extracts actual assistant Markdown blocks (headings, paragraphs, lists, code, tables) instead of treating reasoning duration labels like `Worked for 40s` as the response. Mirrors response changes through MutationObserver and rAF batching without scanning the full conversation on every token.
- For **older/long conversations**, progressively traverses the native conversation scrollport **upward and then downward** to collect lazy-loaded or virtualized messages, yielding between steps, then restores the previous scroll position. Source navigation re-loads old native messages on demand without choosing a different message when IDs are unstable. History turns collected during virtualization are held in memory only; loading can be cancelled when closing or changing chat. The workspace shows progress and a clear unavailable/limited status.
- Automatic activation on ChatGPT with native-view restore and Chrome-toolbar toggle; main-area-only overlay preserves ChatGPT sidebar/navigation. Native Fork/confirmed lineage and sequential connectors; pan/zoom, drag, focus, **First / Latest jump navigation**, Fit, native source navigation and a functioning single Start Card for empty chats. Existing cards retain their spatial positions when older messages are prepended.
- Local card-position persistence scoped to each ChatGPT conversation route, bookmark IDs in local storage, and branch relations in extension IndexedDB. **No ChatGPT transcript is persisted**.
- Shadow DOM isolation; **black-and-white light/dark design**, following ChatGPT's explicit theme when detected and OS preference otherwise; subtle entry/hover transitions, no animation on streaming/pan/zoom; keyboard Escape close.

## Native branching workflow (requires real-site verification)

1. In an existing ChatGPT conversation, choose **Fork** on an assistant card (or select text in a single answer block and choose **Fork selected quote**).
2. If gptdraw detects that exact message's native **More actions → Branch in new chat**, it opens the native Branch action. If not, the UI shows why it cannot safely proceed; no phantom branch is created.
3. In the new ChatGPT child conversation, confirm **Link this branch** only when you know this chat was created from that source. Confirmation saves parent/child metadata (not conversation text), rejects duplicate parents/cycles, and displays parent/child navigation nodes.
4. **Continue** on the latest card sends through the native ChatGPT composer. **Continue as branch** on an earlier card invokes native Fork first. Quote selections are *focus references*: paste a copied quote into the child to guide its next prompt; it does not automatically strip ChatGPT's original context.

For 80+ loaded turns, a spatial grid index selects nearby cards (overscan); visible-only sequential edges keep pan/zoom work bounded. Canvas diagnostics include the most recent mount cost. Performance is covered by deterministic tests, not yet real-Chrome frame measurements.

## Branch workspace, minimap and reading tools

- **Branch family:** confirmed lineage now displays the whole connected parent → sibling → descendant tree. ChatGPT conversations other than the active one appear as navigable **metadata-only** nodes; they are never populated with invented AI text. Use the **Branches** control to locate the tree.
- **Minimap:** compact SVG overview with click-to-pan; viewport position follows real pan/zoom. No external graph dependency.
- **Focused Reading:** choose **Read** on a card to inspect its full available answer at a readable width; **Esc** returns to the graph.
- **Compare:** select **Compare** on two loaded turn cards for side-by-side reading. For two different native branches, visit both via ChatGPT's SPA navigation in the **same tab**; if both latest answers have been observed, the branch node offers **Compare loaded answers**. Only the last observed answer from up to eight visited conversations is cached **temporarily in tab memory**, never Chrome Storage or remote servers. A full page reload loses that preview.
- **Bookmarks:** each card's bookmark icon stores **only its stable turn ID** in `chrome.storage.local`, scoped to the conversation; unsupported positional IDs are rejected. Bookmarks appear in Outline, not in any transcript export.
- **Keyboard:** `J` / `K` previous/next card, `R` focused reading, `B` branch family, `F` Fit, `/` Find Card, `Esc` close reading or return to native ChatGPT. Shortcuts do not intercept typing in inputs.

## Reliability hardening and diagnostics

- **Route and lifecycle:** positions are captured for their owning route before debounce; pending writes flush on route swap and stop, using a serialized write queue. A generation guard prevents reopening the DOM observer after a rapid close.
- **History correctness:** pages without a verified overlapping message ID remain unresolved instead of being incorrectly prepended/appended. Positional or unverified IDs cannot prove chronology. The graph may show partial history, rather than fabricate sequential connections.
- **Native Fork:** source recovery can traverse virtualized ChatGPT DOM and revalidate the current route. Pending/confirmed lineage mutations are serialized by the MV3 service worker in **IndexedDB**; content scripts call the worker, and `chrome.storage.local` only distributes a revision notification. This avoids cross-tab lost updates from local-storage read/modify/write.
- **Streaming Reading:** inspector updates changed blocks in place; active text selection defers the update until released.
- **Compatibility diagnostics:** toolbar panel reports observed DOM counts, ID stability, history status, observer state and viewport reconciliation cost. **Copy diagnostics** includes no message text, URLs, account details, cookies or secrets.
- **Real Chrome acceptance:** follow [Chrome smoke-test runbook](docs/CHROME_SMOKE_TEST.md). CI tests/build do not prove the real ChatGPT DOM or native Branch menu is compatible.

## Current limitations

- DOM selectors are version-sensitive. **Not live-tested on the latest authenticated ChatGPT web UI in this environment.** If ChatGPT changes markup, update `adapters/chatgpt-dom.mjs` after inspecting the real page.
- **Native Fork is implemented with verification gates, not yet smoke-tested on a signed-in ChatGPT page.** The Fork button opens ChatGPT's **verified** message menu action when detectable; if unavailable it reports the problem. Branch relations become confirmed **only after the user confirms the actual child conversation**. Dashed graph connectors link those confirmed parent/child conversations; solid connectors within a chat remain a sequential reading path. Selected quotes store only fingerprint and offsets, not the quote itself. Quoted text can be copied to the clipboard for pasting into the new ChatGPT branch; this does not restrict hidden model context.
- Response cards use inert typed data for heading/paragraph/list/table/code and HTTP(S) links, with code Copy. They do **not** copy raw HTML or reproduce hidden reasoning, embedded tools, arbitrary attachments or proprietary native citation widgets.
- The Start Card uses a user-triggered native ChatGPT composer bridge; it does **not** call AI APIs. Native DOM-driven Send can fail after ChatGPT UI changes, in which case it retains the drafted message for manual sending.
- **History boundary:** the extension scrolls the *current open conversation* in both directions, not the list of separate chats in the sidebar. A stable DOM does not prove the entire account history was scanned. It can only collect messages that ChatGPT actually loads into the rendered DOM. Browser/network virtualization or removed messages may prevent reaching the true first turn; no private ChatGPT history API is called, and no messages are saved permanently by gptdraw.
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

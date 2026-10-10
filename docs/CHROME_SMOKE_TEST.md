# gptdraw — Real ChatGPT Acceptance Gate

This is a manual, **signed-in Chrome** runbook. Passing unit tests does not
verify selectors, ChatGPT's real Branch menu or authentication-specific DOM.
Never paste transcript data, cookies, tokens or page HTML into diagnostics.

## Before
1. `npm install && npm run build`
2. Visit `chrome://extensions` → Developer mode → Load unpacked `dist/`, then reload.
3. Open a signed-in ChatGPT tab; gptdraw should auto-open only over **main**.
4. Open **Compatibility diagnostics**. Copy only numeric/status diagnostics.

## Required sessions
- Empty/new chat: one Start Card, native Send or explicit draft handoff.
- Short chat (5 turns): exact message count; source navigation and formatting.
- Medium (50 turns): load older turns; position persists after drag/route swap.
- Long (200+ turns): earliest loadable DOM turn; no false order for disjoint pages,
  bounded mounted card count, no unusable zoom or unsolicited navigation.
- Streaming: update text and a link/code formatting change with Focus Reading
  open; preserve selection and scroll as much as possible.
- Native Fork: load the actual assistant source, open its real More menu,
  choose Branch in new chat, check new child, **manually confirm** lineage;
  verify parent/sibling navigation and page reload.
- Two tabs: attempt competing Fork requests; no double-parent/lost branch.
- Toggle/close: 10 rapid open/close attempts; no duplicate observer or browser lag.
- Dark/light, narrow viewport, sidebar expand/collapse: sidebar always native.

## Performance sampling (Chrome DevTools)
Record main thread long tasks, dropped frames, attached card count, graph open
latency and peak memory in 5 / 50 / 200+ turn runs. Target ~60 FPS during pan
on a representative desktop, not a claimed measured result. Profile before
changing the spatial grid or virtualized DOM boundaries.

## Expected limitations
- Native ChatGPT markup changes without notice.
- Historical DOM might not contain the entire server-side transcript.
- Native Branch menu may be absent; do not claim Fork succeeded then.
- Unloaded branches do not have copy of their chat text in gptdraw.
- Graph metadata is local; quotes and full transcripts are not persisted.

## Performance optimization regression checks

- Record **before/after** Chrome Performance traces against the same representative chats, device, browser build and viewport. Unit/CI cannot prove a faster frame time.
- Repeated camera-only pan/zoom with an unchanged visible card set must not increase **edgeDOMCreates/edgeDOMRemoves** after initial rendering. Verify connection geometry while dragging a card.
- Stream a long response with code, links, lists and tables. **patchLastMs**, **patchMaxMs** and unchanged block visual stability should be inspected. Change a link target in the native DOM and check it updates safely.
- During a long old-chat scan, pan/search and hide/restore the tab. History must yield, retain anchored order and eventually finish after tab becomes visible.
- Search a 2,000-turn fixture; outline initially mounts a bounded result set. Minimap must remain accurate after changing layout.
- Diagnostics may export numeric/status metrics only, not actual conversation text or native message IDs.

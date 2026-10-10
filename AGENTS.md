# AGENTS.md — gptdraw

Repository-wide agent instructions. **Root AGENTS.md and DESIGN.md are authoritative**, while `.agents/` contains working engineering/product documents, **not installable SKILL.md files**. No duplicated docs/ hierarchy.

## Source of truth

1. Current user request and accepted product decisions.
2. Observed ChatGPT DOM and current repository code/tests. A selector guess or design prototype is not observed production behavior.
3. [DESIGN.md](DESIGN.md) for UI/interaction rules.
4. [.agents/engineering-design.md](.agents/engineering-design.md) for module ownership, runtime and performance contracts.
5. [.agents/product-design.md](.agents/product-design.md) for approved UX decisions, open questions and acceptance criteria.

Read actual source before asserting supported features. Do not claim that DOM-rendered messages provide hidden model context.

## Product and platform — immutable until user changes direction

**gptdraw is a Chrome MV3 extension that projects the ChatGPT conversation already open in the browser into a branching/spatial canvas.** ChatGPT owns the conversation, model, user session, native composer, streaming and any native branching. gptdraw owns its overlay, DOM adapter, graph projection, navigation and local layout metadata.

- **No OpenAI API key, model gateway, ChatGPT undocumented API, session scraping or account login recreation.**
- **Automatically show gptdraw when ChatGPT loads**, replacing only chat main; Chrome's extension toolbar icon toggles graph/native modes. **Back to ChatGPT** restores native UI and persists that choice for the current tab session. Never add a floating Graph launcher.
- DOM access happens in an **isolated content script**, observing visible turns. **Keep native sidebar/navigation fully usable**: draw the canvas only inside the computed ChatGPT `main` bounding box. Never hide/move/delete ChatGPT's React-owned messages or sidebar. User-initiated Start Card submission may populate the visible native ChatGPT composer and click its real Send control; do not call hidden APIs.
- Model messages are not copied into extension storage. **Only** layout, bookmark IDs and explicitly confirmed branch metadata (conversation/message IDs, quote offsets + digest, no plaintext) are stored locally. Assistant Markdown is projected as safe structured text, never copied as raw executable HTML. Older turns may be held in *volatile memory* during progressive native scroll backfill; cancel backfill on route change/close and restore the native user's scroll.
- Native Fork must discover the source message's actual **More → Branch in new chat** menu before activation; unavailable integration must give a clear error. Never assume clicking a menu means the child exists. Explicit confirmation is required for persistent cross-conversation lineage; reject unstable positional IDs, cycles and duplicate child ownership. Empty/new chats show exactly one functional Start Card. No invented attachments, model selection, citations or reasoning.
- Canvas preserves the approved Dialogue prototype in monochrome: ~366px cards, compact numbered header, user bubble on right, structured assistant content on left, inline composer for latest card and source/continue actions with real native Fork gating. Initial camera focuses latest at readable zoom; Fit is optional. One graph card equals one user prompt and the following assistant response.

- **Branch family UI:** connected lineage is computed from confirmed metadata and renders *navigable* nodes only for inactive conversations; absent answer content must never be invented. A cross-branch comparison is enabled only when both actual final/last answers were observed in this tab. Cache at most eight last answers in volatile JS memory; do not write those previews to Chrome Storage or send them to a remote endpoint.
- **UI interactions:** selection inside a card or Focus Reading shows a contextual **Ask GPT / Fork** menu beside the highlighted text. Ask GPT only prepares a draft in the real native composer and must never auto-send or overwrite an unsent draft. Fork invokes the actual assistant's native Branch action; quote plaintext stays transient. Preserve a lightweight clickable minimap, focused reading, loaded-turn comparison, bookmark IDs, and keyboard navigation. Avoid introducing a new graph library, model gateway or component framework for these.
- **Native Fork hardening:** never overwrite an outstanding pending intent; bound polling for the real Branch menu. Confirm only on explicit user action and state that signed-in Chrome smoke testing is still required.

## Reliability boundary (strict)

- Route-specific layout writes capture immutable position snapshots before debounce; flush at route change/stop, serialize async writes, and protect `start()` against stale lifecycle completions.
- Unanchored virtualized-history windows must **not** be guessed into chronological order; positional/uncertain DOM IDs cannot prove overlap. Surface unresolved history in UI diagnostics.
- The background MV3 service worker is the **sole mutator of branch relations** through an IndexedDB readwrite transaction. Never restore unsafe `chrome.storage.local` read-modify-write in production; storage pulses are notifications only. Keep native menu activation user-initiated and child confirmation explicit.
- A historical Fork resolves the exact message via bounded native scrolling and checks the active route before committing pending metadata.
- Preserve unchanged typed DOM response block identities during streaming; invalidate on dirty text or link attributes, fall back to full parse on structure. Update Focus Reading in place without resetting active selection/scroll. Coalesce camera frames; **never redraw all SVG edges on camera-only updates**. Use keyed SVG paths with geometry invalidation and spatial grid culling. Cache search text and cap outline DOM results; background history yields to interaction and batches structural canvas commits. Diagnostics expose **numbers only**, never chat contents.
- Before claiming production-ready, run `docs/CHROME_SMOKE_TEST.md` in signed-in Chrome. Fixture/unit CI is not a substitute.

## Routing

| Work | Read |
| --- | --- |
| UI, card, interaction, reusable components, responsiveness | DESIGN.md → .agents/product-design.md |
| Selector compatibility, observation, graph semantics, performance, test architecture | .agents/engineering-design.md |
| Both behavior and UI | Both files, implement within one existing owner |
| Docs/copy or local low-risk correction | Direct change; no unnecessary skill/document creation |

## SWE workflow

**UNDERSTAND → OBSERVABLE OUTCOME → SMALLEST OWNER → TEST THE REAL RISK → IMPLEMENT → VERIFY → DIFF → STOP**

- Inspect the actual tree, browser contract and current Git state before changes.
- Map a user action to DOM → observer → projection/controller → component → persisted layout. Identify trust/performance boundaries and failure states.
- Develop **vertical slices**: one real ChatGPT task end-to-end, not domain/UI/gateway layers developed horizontally.
- **New code goes to its defined owner on day one**. Do not introduce temporary root files with a promised future refactor.
- Only add abstraction when a behavior boundary, dependency direction or real reuse requires it.
- Do not refactor, rename or relocate unrelated working modules unless user explicitly requests it.
- Test-first for actual business invariants or DOM regressions. Do not force tests for copy/docs/CSS-only edits.
- For DOM integration, include fixtures for currently observed selectors, mutation batching and SPA navigation/reopen.
- Verify `npm run test`, `npm run build` and Chrome Load unpacked manual smoke tests when relevant. Do not call a CI-only test a real Chrome smoke test.
- Before completion: inspect diff, report actual evidence and remaining gaps, then stop.

## Runtime and boundary rules

- Build-time: Tailwind CSS v4 + esbuild. **No Tailwind CDN, remote JS, runtime compiler, webpack-sized default scaffolding or unneeded animation libraries.**
- Runtime: Chrome MV3 content script + isolated **Shadow DOM** overlay. The React-owned ChatGPT DOM is read-only.
- Permanent owner: `src/modules/conversation-workspace/`:
  - `core/` pure projection/identity and deterministic rules;
  - `adapters/` ChatGPT DOM observation and Chrome metadata persistence;
  - `controller/` in-memory projection and state coordination;
  - `components/` spatial UI and chat cards.
- App entry: `src/content/main.mjs`. Generic reusable primitives: `src/components/ui/`. Extension toolbar entry: `src/extension/background.js`.
- **Do not recreate** `extension/gateway-server.mjs`, `adapters/gateway.mjs`, `adapters/assistant.mjs`, or provider API keys/transport.
- Use Beautiful UI **only for components that can be adapted to real ChatGPT-derived data without demo-only fake state**. Source reference: https://www.beautifului.dev/ . Reuse Tailwind patterns/primitive ownership, not its unrelated showcase runtime.

## Risk-based verification

| Change | Evidence |
| --- | --- |
| Product copy, tokens, docs | Inspect changed surface and token parity |
| Turn pairing, stable IDs, source navigation, lineage | Unit/fixture tests incl cycles, pending confirmation, virtualized recovery + real-site DOM smoke test |
| DOM selectors, streaming, historical chat backfill | Browser fixture + MutationObserver batching, progressive earliest-message loader, abort + scroll restoration, no full scan per token |
| Graph drag/pan/zoom, route layout | Interaction and persistence test + manual Chrome visual review |
| Chrome permissions, injection, security | Manifest/Shadow DOM/host boundary review |
| Build scripts/dependencies | Reproducible install, tests, production bundle and syntax checks |

**Git workflow:** default branch `master`; write only requested changes, preserve unrelated work, verify remote files and passing latest CI. Do not open PR or add planning artifacts as ceremony.

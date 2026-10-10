# Engineering design — gptdraw

**Active architecture contract for a Chrome Manifest V3 browser extension**. This file is working documentation in .agents, not a SKILL.md. Root [AGENTS.md](../AGENTS.md) owns SWE workflow; root [DESIGN.md](../DESIGN.md) owns appearance and interactions.

## System model

    chatgpt.com native React DOM (source of visible conversation truth)
                 │  isolated-world observation only
                 ▼
    content script: src/content/main.mjs
                 │
                 ├── adapters/chatgpt-dom.mjs     # MutationObserver + DOM parsing
                 ├── adapters/response-content.mjs # safe visible Markdown block extraction
                 ├── adapters/chatgpt-branch.mjs # gated native Branch action
                 ├── adapters/branches.mjs       # confirmed lineage metadata
                 ├── adapters/source-navigation.mjs # explicit old-source recovery
                 ├── adapters/history.mjs         # cancellable native scroll backfill
                 ├── core/graph.mjs               # prompt/reply pairing; pure identities
                 ├── core/history.mjs             # linear virtualized snapshot merge
                 ├── core/branch.mjs              # pending/confirmed lineage invariants
                 ├── controller/workspace.mjs     # per-overlay projection + metadata
                 ├── adapters/metadata.mjs        # chrome.storage.local: positions/bookmark IDs
                 └── components/                  # native incremental canvas/cards
                        └── src/components/ui/   # generic controls/icons

Build-time only: esbuild bundles content script; Tailwind CSS v4 compiles CSS. `dist/` is the loadable MV3 extension; `src/extension/background.mjs` only toggles the canvas toolbar action. No network provider, API key or backend.

**Trust boundary:** page DOM is observable but untrusted; ChatGPT's hidden React state/model context is inaccessible in isolated-world code. Never intercept secrets, cookies, private network traffic or app globals. Never move React-managed DOM into the canvas.

## Stable folder ownership (binding for all new code)

```text
gptdraw/
  AGENTS.md                      # root workflow
  DESIGN.md                      # root design contract
  .agents/
    product-design.md
    engineering-design.md
  manifest.json                  # source MV3 manifest
  src/
    content/main.mjs             # extension entrypoint, overlay/shadow setup
    extension/background.js      # toolbar toggle only
    app/workspace.css            # compiled Tailwind v4 source and theme tokens
    components/ui/icons.mjs      # genuinely reused primitive icons/controls
    modules/
      conversation-workspace/
        ConversationWorkspace.mjs # visual composition
        core/graph.mjs            # deterministic turn pairing, route, position
        core/history.mjs          # linear merge of virtualized DOM pages
        core/branch.mjs           # cycle/duplicate-safe lineage
        core/lineage-transaction.mjs # pure atomic mutation reducer
        core/spatial-index.mjs    # viewport cell query
        core/viewport.mjs         # minimap projection
        adapters/
          chatgpt-dom.mjs         # DOM selector/mutation compatibility
          history.mjs             # two-way native scroll + progress/cancellation
          response-content.mjs    # safe typed answer blocks and links
          chatgpt-branch.mjs      # native message More → Branch action
          branches.mjs            # service-worker RPC; legacy fixture adapter
          source-navigation.mjs   # native scroll source recovery
          native-composer.mjs     # user-initiated native editor/Send bridge
          metadata.mjs            # layout only, versioned chrome.storage keys
        controller/workspace.mjs  # conversation projection and view lifecycle
        components/
          GraphCanvas.mjs         # viewport gestures and sequential SVG edges
          ChatCard.mjs            # native DOM card (stable element per turn)
          ResponseBlock.mjs       # safe list/table/code/link renderer
          InspectionPanel.mjs     # streaming-aware read/compare panel
          DiagnosticsPanel.mjs    # metadata-only compatibility diagnostics
          StartCard.mjs           # real compose/send for zero-turn workspaces
  scripts/build.mjs               # compile/bundle & copy MV3 manifest
  tests/                          # deterministic unit/fixture checks
  dist/                           # generated, not committed
```

**No duplicate owners** (`features/chat`, `services/graph`, `integrations/ai`, `adapters/gateway`, `core/llm` are forbidden). The native page owns actual chat text. gptdraw owns only a view projection and layout metadata.

## Performance contract — low-level DOM, not zero-cost fiction

- **DOM observer** selects the active conversation `main` (or role-based fallback) and attaches to that subtree. Detection order: wrapper `data-turn`, nested/bare `data-message-author-role` or `data-conversation-role`, then a conservative `data-turn-key` grouped exchange fallback using a real user bubble. A missing user marker is never reconstructed from an assistant response. Its MutationObserver groups changes to one `requestAnimationFrame`. For character data changes, reread only the impacted turn; rescan message wrappers only on structural changes or route switches. Watch body direct children for host remounts.
- **Projection:** index native message IDs and their owning turn. The observer tracks changed native nodes per message and reuses typed block records from a WeakMap for unaffected rendered elements. Native link href mutations invalidate their owning block. Recompute prompt/reply pairs on structural changes; controller and renderer compare block identities, not full JSON per streamed token. Fall back to full message parsing whenever structure changes or DOM identity is lost.
- **Renderer:** one stable card element per mounted user-turn ID; update only changed typed answer blocks (heading, list, table, code with Copy, HTTP(S) links) using safe DOM APIs. Do not `innerHTML` or rebuild all cards every event.
- **History:** on an existing `/c/` route, discover the native scrollport inside the active conversation. Scan UP then DOWN through loadable virtualized windows, preserving verified ID anchors. Yield in idle slices, stop scanning while hidden or user interaction is recent, and cancel on route change/close. Reuse visible-window content signatures; batch structural canvas reconciliations only during active backfill. Manual Refresh and initial snapshot remain immediate. Restore native scroll offset only for the same route; a stable DOM is not proof of entire account history.
- **Stable canvas placement:** maintain position by turn ID in a canvas-local map. When older messages prepend during backfill, place new cards to the left of known nodes without shifting existing cards; provide First/Latest navigation. Layout metadata still stores only user-overridden coordinates.
- **Large canvas:** at 80+ turns, mount only nearby cards with a spatial grid index and viewport overscan. Mount/unmount diffs affect only nearby sequential edges; card geometry is cached from ResizeObserver. Retain focused/drafted card and use live drag coordinates to update connected paths. Search normalized content is cached per turn revision; outline initially shows 60 results.
- **Canvas:** CSS transform pan/zoom and keyed SVG paths. Camera-only changes are coalesced into one requestAnimationFrame without rebuilding edge paths; ResizeObserver or mount/drag/structural changes invalidate geometry. Keep bounds inside ChatGPT main and sidebar accessible. Do not reparse unaffected Markdown blocks per streamed token. Manual positions persist debounced.
- **Camera:** default to latest turn focused at readable 100% scale; Fit only by user request, Find Card + Outline for navigation, stable coordinates during prepend.
- **Activation:** content script starts overlay automatically unless user selected native mode in sessionStorage; toolbar toggles and Back to ChatGPT persists normal mode for this tab. No floating launcher.
- **CSS:** strictly black/white semantic tokens in light/dark mode, short open/hover transitions only; no motion on streaming, panning or zooming. Tailwind compiled/minified at build; inject into closed Shadow DOM via local stylesheet. No runtime Tailwind, React, model SDK, GL libraries, or remote code.
- **Beautiful UI:** component patterns and optional sourced primitives only, adapted to real data. Upstream demo/React components are **not** currently installed; do not pretend otherwise.

## Data/invariants

- A visible user turn has exactly one following assistant response slot (pending if no visible response). Orphan answers cannot manufacture fake prompts.
- Turn ID uses rendered DOM `data-message-id`/turn data-testid, else a weaker positional fallback. **IDs are not guaranteed durable across ChatGPT DOM versions**. Namespaced layout by `/c/:conversationId` route; reject invalid position values.
- Native ChatGPT response is the current truth; gptdraw does not store prompt/answer snapshots. On extension upgrade the background service worker deletes the two exact legacy keys, `gptdraw:workspace:v1` and `gptdraw:gateway-pair-token`, left by the deprecated API-client version.
- A response text mutation changes only the affected card. No synthetic AI answers or private reasoning states.
- Solid sequence links connect adjacent turns; dashed links connect only explicit user-confirmed parent/child conversation relations. Native Fork menu detection is conservative and **not** proven against real ChatGPT DOM yet. Branches are pending until child confirmation. Quote anchor has block index, offsets and SHA-256 digest, never stored plaintext. Child ancestry is metadata-only, not a new model context engine.
- When host DOM changes or the page is not a conversation, display an honest empty/fallback state; never silently switch to a fake model source.
- Closing overlay leaves native page intact; source action scrolls to corresponding native message; native Compose returns to the actual input. A single Start Card is rendered at zero turns; its submit uses the native composer input events and real Send button when possible, or hands over an unsent draft without pretending the request succeeded. Legacy `TRUSTED_CONTEXTS` access level is reset for the extension's isolated content script because only non-secret layout metadata remains.

## Boundary tests and validation

| Risk | Verification |
| --- | --- |
| Parser compatibility | Fixture tests for wrapper `data-turn`, nested roles, role-only variants, missing reply and IDs |
| Streaming mutations | Observer test proving text delta patch does **not** rescan the conversation |
| Old history | Bounded scroller/backfill tests for earliest loadable turn, virtualized pages, cancellation and scroll restore |
| Canvas placement | Unit regression for stable positions across prepend and first/latest navigation availability |
| Overlay lifecycle | Auto-activate on ChatGPT, native-mode session preference, Chrome toolbar toggle, back/close and observer re-subscription (no DOM launcher) |
| Layout | Chrome metadata storage roundtrip, invalid coordinates rejected, route separation |
| Build/CSP | Manifest artifact, esbuild, Tailwind output, no gateway strings |
| Manual browser | Install `dist`, open ChatGPT, stream answer, pan/zoom/drag, reopen, SPA route changes |

Test-first on real invariants. Use `npm run test` and `npm run build`; CI validates both. **CI tests do not prove actual ChatGPT DOM parity, browser injection success or performance budgets.** Those need manual/current-site Chrome checks.

## Implemented branch workspace and inspection ownership

- `core/branch-workspace.mjs`: deterministic connected-component tree layout of confirmed lineage (includes ancestors, siblings and descendants); tests forbid unrelated or pending nodes.
- `core/viewport.mjs` + `components/Minimap.mjs`: pure world-to-minimap math and a lightweight click-to-pan SVG.
- `components/InspectionPanel.mjs` + `core/compare.mjs`: focused long-form reading; side-by-side comparison only between loaded turn objects.
- `controller/workspace.mjs`: caches the **last real observed turn** from at most eight conversations in the current tab RAM for cross-branch comparison. Route changes that use native ChatGPT SPA navigation retain this cache; a hard reload discards it. None of these snapshots are persisted. Do not extend to a browser-wide conversation scraper without another privacy decision.
- `adapters/metadata.mjs`: per-conversation stable turn-ID bookmark list in Chrome Storage, capped at 500 IDs. No prompt/answer is saved.
- `components/GraphCanvas.mjs` + `ChatCard.mjs`: branch family nodes, meta-only placeholders, minimap, keyboard focus, Read/Compare/Bookmark buttons and virtualized turn-card ownership.
- `adapters/chatgpt-branch.mjs`: bounded, user-triggered native menu discovery; one pending Fork is allowed globally. The menu and new-tab behavior remain **unverified on live ChatGPT**.

## Vertical slice policy

**Slice 01 implemented:** capture current chat → normalize → update projected graph on streaming DOM mutation → navigate to source → layout persists. No model login/API key.

**Slice 02 implemented in source, live-gated:** native More → Branch action, pending intent, manual child confirmation, validated parent/child graph and persistent metadata. New-tab/route behavior still requires manual Chrome verification; never report a native branch as confirmed without user action.

**Slices 03–05 implemented in source with limits:** one-block selected quote digest/copy and native Continue-as-branch; typed safe code/table/list/link renderer; virtualized 80+ canvas, linear history/layout merges and old-source scroll recovery. Native citations, tools/attachments, automatic quote-context reduction, browser performance measurement and live ChatGPT compatibility remain unverified/unsupported.

All slices extend the same ownership tree; do not rebuild the app horizontally or schedule a blanket structural refactor.


## Reliability hardening (October 2026)

- **Layout:** controller captures route + position snapshot at each move, coalesces rapid drags and flushes route-specific work before navigation/close. Async writes are serialized; stop invalidates the lifecycle token so a late `loadRoute` cannot resurrect the observer.
- **History:** `mergeAnchoredHistory` allows structural ordering only with a verified stable overlap. Disjoint segments remain volatile and unresolved until anchored. Ephemeral and unverified IDs are not ordering evidence. Their omission is intentional, not loss of the underlying ChatGPT data.
- **Fork:** `source-navigation.mjs` recovers virtualized assistant DOM; controller verifies route/token again after recovery and after native menu discovery. One outstanding branch intent globally; the IndexedDB transaction runs in the bundled `background.mjs` service worker with the pure invariant reducer `core/lineage-transaction.mjs`. Chrome Storage is used only for branch revision change notifications and for existing layout/bookmark IDs. A signed-in-site native Fork smoke test remains mandatory.
- **Diagnostics:** `DiagnosticsPanel.mjs` reports counts, scan/patch totals, provisional identity quality, history phase and mounted cards plus measured viewport-update duration. The report **never** exports actual chat contents, message IDs, URLs or secrets.
- **Reading:** `InspectionPanel.mjs` patches displayed typed blocks without rerendering the pane; preserve the user's scroll and postpone mutations while a text selection is active.
- **Performance:** `core/spatial-index.mjs` builds a cell index after snapshot/layout changes; pan/zoom queries the grid, then mounts only nearby cards. Sequential edges are produced from mounted neighboring cards. Unit tests cover 2000 turns. Browser FPS is not claimed until measured.
- **Browser QA:** see `docs/CHROME_SMOKE_TEST.md`. Real authenticated ChatGPT behavior is not automatically verified by Node fixtures.

## Performance optimization — October 2026

- **Shapes:** `Map<NativeMessageId, Set<DirtyDomNode>>` belongs to the observer; typed blocks are immutable and cached by DOM element; mounted card/edge geometry belongs to the canvas. No prompt/reply persisted outside the current ChatGPT session.
- **A / happy paths:** input → one camera rAF → transform/minimap → diff nearby mounts; DOM mutation → dirty-message block extraction → identity delta → one card/Reading panel; history scroll step → browser idle yield → visible-window signature merge → batched structural commit.
- **E / recovery:** structural DOM changes force fresh extraction; unknown virtualized windows remain unresolved; cancelled/hidden history never commits stale native work; unmeasured card bounds use conservative estimates.
- **R / runtime:** native MutationObserver, requestAnimationFrame, ResizeObserver, requestIdleCallback with fallback and AbortSignal; no new runtime dependencies or graph library.
- **Scope:** observer weak maps and active scans terminate with workspace; history batch timer clears on stop/route change; mounted SVG edge path identities live only in the canvas.
- **Proof:** `tests/streaming-cache.test.mjs`, `tests/history-yield.test.mjs`, `tests/history-batching.test.mjs` alongside existing graph/performance tests; Chrome DevTools profiling still required for p95 frame and responsiveness claims.

## Chat readiness and recycled-history identities

- Controller launches `loadRoute()` (which resets synchronously) and **starts the DOM observer before awaiting async metadata**. Lifecycle/route generation guards still protect stop and navigation races.
- The observer watches its selected native `main` and watches BODY subtree *only for main replacement/SPA route changes*, filtering ordinary messages inside the active root so the duplicate observer does not reparse every streamed token.
- Native `conversation-turn-N` IDs may be reused by virtualization. The controller assigns **RAM-only `user:observed:N`/`assistant:observed:N` identities**, with bounded exact-window signatures and corroborated text matches. Those aliases are **not stable** and must never authorize bookmark/Fork persistence.
- History windows scanned after **measured scroll movement** can be included in the direction encountered even if no ID overlap exists. Mark the discontinuity `breakBefore`, and suppress its world-space SVG connector; do not treat physical scroll as proof of adjacent messages. Unknown windows observed without verified movement remain unresolved.
- Observer scan callbacks include `{direction,moved,scrollTop}`. Retain in-memory-only state; never store text fingerprints, observed aliases or expanded history in Chrome storage.

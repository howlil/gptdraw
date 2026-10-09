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
                 ├── adapters/history.mjs         # cancellable native scroll backfill
                 ├── core/graph.mjs               # prompt/reply pairing; pure identities
                 ├── core/history.mjs             # virtualized snapshot merge
                 ├── controller/workspace.mjs     # per-overlay projection + metadata
                 ├── adapters/metadata.mjs        # chrome.storage.local: positions only
                 └── components/                  # native incremental canvas/cards
                        └── src/components/ui/   # generic controls/icons

Build-time only: esbuild bundles content script; Tailwind CSS v4 compiles CSS. `dist/` is the loadable MV3 extension; `src/extension/background.js` only toggles the canvas toolbar action. No network provider, API key or backend.

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
        core/history.mjs          # merge historical DOM pages into RAM-only projection
        adapters/
          chatgpt-dom.mjs         # DOM selector/mutation compatibility
          history.mjs             # two-way native scroll + progress/cancellation
          response-content.mjs    # assistant heading/paragraph/list/code/table projection
          native-composer.mjs     # user-initiated native editor/Send bridge
          metadata.mjs            # layout only, versioned chrome.storage keys
        controller/workspace.mjs  # conversation projection and view lifecycle
        components/
          GraphCanvas.mjs         # viewport gestures and sequential SVG edges
          ChatCard.mjs            # native DOM card (stable element per turn)
          StartCard.mjs           # real compose/send for zero-turn workspaces
  scripts/build.mjs               # compile/bundle & copy MV3 manifest
  tests/                          # deterministic unit/fixture checks
  dist/                           # generated, not committed
```

**No duplicate owners** (`features/chat`, `services/graph`, `integrations/ai`, `adapters/gateway`, `core/llm` are forbidden). The native page owns actual chat text. gptdraw owns only a view projection and layout metadata.

## Performance contract — low-level DOM, not zero-cost fiction

- **DOM observer** selects the active conversation `main` (or role-based fallback) and attaches to that subtree. Detection order: wrapper `data-turn`, nested/bare `data-message-author-role` or `data-conversation-role`, then a conservative `data-turn-key` grouped exchange fallback using a real user bubble. A missing user marker is never reconstructed from an assistant response. Its MutationObserver groups changes to one `requestAnimationFrame`. For character data changes, reread only the impacted turn; rescan message wrappers only on structural changes or route switches. Watch body direct children for host remounts.
- **Projection:** index native message IDs and their owning turn. Recompute prompt/reply pairs only when message structure changes; streaming patches update the matching turn and card directly in constant lookup work. Never query the whole page on each token.
- **Renderer:** one stable card element per user-turn ID; update only changed typed answer blocks (Markdown heading, paragraph, list, code, table) with textContent. Do not `innerHTML` or rebuild all cards every event.
- **History:** on an existing `/c/` route, discover the native conversation scrollport using message ancestors (never the sidebar). Scan progressively UP to reach lazy-loaded older messages, and DOWN to collect later virtualized pages; cumulative RAM-only count is fed back to the adapter. Never claim a stable DOM proves complete account history. Stop at a stable top, cancellation, or a bounded attempt count. Merge historical visible snapshots into volatile RAM; do not persist chat content. Preserve the prior distance from the bottom after backfill, and never restore scroll after route cancellation. A failed/unavailable scrollport must remain visible as a limitation.
- **Stable canvas placement:** maintain position by turn ID in a canvas-local map. When older messages prepend during backfill, place new cards to the left of known nodes without shifting existing cards; provide First/Latest navigation. Layout metadata still stores only user-overridden coordinates.
- **Canvas:** CSS transform pan/zoom and lightweight SVG paths. The workspace is bounded to the real ChatGPT `main.getBoundingClientRect()`; measure again when sidebar/main dimensions change. Never cover native sidebar/navigation. Avoid giant rasterized planes and reparsing markdown for each streamed token. Manual positions persist at a debounced rate.
- **Camera:** default to latest turn focused at readable 100% scale; Fit only by user request, Find Card + Outline for navigation, stable coordinates during prepend.
- **Activation:** content script starts overlay automatically unless user selected native mode in sessionStorage; toolbar toggles and Back to ChatGPT persists normal mode for this tab. No floating launcher.
- **CSS:** strictly black/white semantic tokens in light/dark mode, short open/hover transitions only; no motion on streaming, panning or zooming. Tailwind compiled/minified at build; inject into closed Shadow DOM via local stylesheet. No runtime Tailwind, React, model SDK, GL libraries, or remote code.
- **Beautiful UI:** component patterns and optional sourced primitives only, adapted to real data. Upstream demo/React components are **not** currently installed; do not pretend otherwise.

## Data/invariants

- A visible user turn has exactly one following assistant response slot (pending if no visible response). Orphan answers cannot manufacture fake prompts.
- Turn ID uses rendered DOM `data-message-id`/turn data-testid, else a weaker positional fallback. **IDs are not guaranteed durable across ChatGPT DOM versions**. Namespaced layout by `/c/:conversationId` route; reject invalid position values.
- Native ChatGPT response is the current truth; gptdraw does not store prompt/answer snapshots. On extension upgrade the background service worker deletes the two exact legacy keys, `gptdraw:workspace:v1` and `gptdraw:gateway-pair-token`, left by the deprecated API-client version.
- A response text mutation changes only the affected card. No synthetic AI answers or private reasoning states.
- Sequence links connect adjacent visible turns. Real branch ancestry/selected quote offsets require a separate verified domain contract. Do not call a sequence edge a fork.
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

## Vertical slice policy

**Slice 01 implemented:** capture current chat → normalize → update projected graph on streaming DOM mutation → navigate to source → layout persists. No model login/API key.

**Slice 02 next:** use verified native Branch action and detect newly created conversation route, store parent-child conversation graph metadata, recover true anchors. Do not import provider integration.

**Slice 03:** responsive focus/overview, native composer bridge, advanced code/table/citation projection only with verified security and performance.

All slices extend the same ownership tree; do not rebuild the app horizontally or schedule a blanket structural refactor.

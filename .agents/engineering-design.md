# Engineering Design — gptdraw

**Working architecture documentation, not an installable skill.** Chrome Manifest V3 is the selected platform; the first root-chat vertical slice is implemented. Automated tests use a mock OpenAI upstream; real Chrome installation and live API calls are not yet smoke-tested.

## Status and authority

| Category | Status | Rule |
| --- | --- | --- |
| Approved product semantics: one turn/card, parent lineage, Fork/Continue, stable provenance | **Active contract for future code** | Implementation must preserve these invariants |
| Domain ownership: conversation is truth, canvas only a visual projection | **Engineering boundary decision** | Do not store business state only in graph/UI objects |
| Conversation workspace folder ownership | **Binding contract for all new application code** | Use prescribed owners from the first implementation; do not create empty scaffolds |
| MV3 runtime and local storage | **Implemented for Slice 01** | Native ESM, isolated iframe, chrome.storage.local, background Port and Node localhost gateway |
| AI streaming | **Implemented, credential-dependent** | Official Responses SSE via local gateway; requires a separate API key and live smoke test |
| React Flow | **Not installed** | Native canvas is current implementation; revisit only with justified graph complexity |
| Old HTML prototype | **Design reference** | Mock AI, local filename handling and in-memory graph are not production behavior |

Follow root [AGENTS.md](../AGENTS.md) for workflow, risk-based tests, scope and Git rules. Follow root [DESIGN.md](../DESIGN.md) for UI. Do not create an additional `architecture.md` or planning document unless a genuinely independent contract becomes necessary.

## Core dependency graph

    User event (Ask / Fork / Continue)
      → Chat composer (draft)
      → Conversation domain command (invariants)
      → Create pending child turn + provenance
      → Context builder (root → parent + source focus)
      → AI transport (when integrated)
      → Stream / cancel / error
      → Persist
      → Render chat and canvas projection

    Canvas UI: spatial nodes, edges, handles, zoom, selection
    Conversation domain: one authority for turns, ancestry, context, response blocks
    Chat UI: prompt, assistant renderer and adaptive composer
    Integration boundaries: provider/transport and storage

**Canvas data is not the canonical conversation store.** Prefer one conversations domain owner rather than two duplicate conversation-graph/chat model owners.

## Domain invariants (test first)

- Each node is one user message plus one assistant response **slot** with queued/streaming/complete/failed/cancelled states.
- Parent must exist except root; no cycle, self-parent or unintended orphan.
- Continue/Fork always create a child, never rewrite parent or sibling.
- Continue inherits **ordered root → parent messages**. Fork inherits the same path by default and adds an explicit source focus (response/block/selected quote). Selection-only context, if supported, must be opt-in and visible.
- Branch context must **exclude siblings**. Visual edges are not context assembly.
- Anchor identity includes **response revision + stable block ID**, exact quote and optional offsets/version. Regeneration never silently retargets old forks.
- Draft/caret state persists on card selection, collapse, re-render, pan/zoom and retry.
- Provider retries/idempotency prevent duplicate child turns. Errors preserve prompts.
- Token budget overflow must have a transparent truncation/summarization policy; unavailable ancestors must not be silently fabricated.

## Vertical-slice architecture contract — binding for new implementation

**Delivery strategy is vertical-slice development, not a staged MVP or horizontal domain→UI→canvas→AI rollout.** Every slice completes one user-observable path across the layers it genuinely needs. Quality/invariants are enforced from the first slice; unavailable integrations must be declared rather than faked.

**Implemented owners (Slice 01), extend in-place for future vertical slices:**

```text
manifest.json
extension/
  launcher.js                 # ChatGPT-page launcher only
  workspace.html              # isolated extension UI
  background.mjs              # trusted service worker / Port / token
  gateway-server.mjs          # local Node gateway entry
src/
  app/
    main.mjs                  # bootstrap
    workspace.css             # UI design contract implementation
  modules/
    conversation-workspace/
      ConversationWorkspace.mjs  # composition + pairing
      core/
        graph.mjs             # root turn model + stable IDs
        sse.mjs               # pure streaming parser
      adapters/
        storage.mjs           # chrome.storage.local
        assistant.mjs         # Chrome Port messages
        gateway.mjs           # OpenAI Responses API relay
      controller/
        workspace.mjs         # per-workspace lifecycle + persistence
      components/
        ChatCard.mjs          # prompt and assistant
        Composer.mjs          # adaptive input
        GraphCanvas.mjs       # native graph viewport
tests/
  graph.test.mjs
  gateway.test.mjs
```

**One feature owner:** conversation, chat turn, branch lineage, source anchoring, composer and canvas all belong to `conversation-workspace` in the initial product. Canvas is a *visual projection*, not a second domain. Do **not** also create `features/conversations`, `features/canvas`, `shared/graph`, `services/conversation` or `hooks/graph` without an explicit boundary decision.

**Responsibility rules:**

| Owner | Owns | Must not own |
| --- | --- | --- |
| `app/` | Bootstrapping, app-wide providers/routes | Conversation rules or provider secrets |
| Workspace root | Feature composition and wiring | Domain commands or storage |
| `core/` | Pure data types, graph transitions, context assembly, invariants | UI, network, storage, React/React Flow |
| `adapters/` | Feature-local persistence and provider transport implementation | Graph business rules or UI state |
| `controller/` | Per-workspace state, draft ownership, coordinating commands and async lifecycle | Duplicate core policy or raw HTML content |
| `components/` | Chat, prompt, assistant response, spatial graph interaction | Canonical conversation truth or provider credentials |
| `components/ui/` | Actually reused generic presentation primitives | Domain-specific behavior |

- On a React stack, a controller may be a hook/store, but only controller owns orchestration; **do not introduce a second global store for the same state**.
- Add only real files and folders required by the current slice. Once a responsibility appears, place it in its prescribed owner **from the first commit**, rather than implementing loosely and scheduling a structural cleanup.
- Never put loose helper/business files next to `ConversationWorkspace.mjs`. No arbitrary extra buckets `hooks/`, `services/`, `utils/`, `lib/` or per-folder barrel exports.
- These rules define **responsibility and dependency direction**, not a requirement to use every directory for every future tiny module. A genuinely new domain module needs an explicit ownership decision, not copy-pasted four empty folders.
- **Current runtime:** dependency-free Chrome MV3 ESM, loaded directly from the repository with no build step. React/TypeScript/React Flow are not installed. Do not silently add a duplicate frontend or move owners.

### End-to-end slices, not horizontal phases

Each slice must have: user job → UI → domain command/context → integration boundary/persistence → observable result → regression verification. Implement only required owners; no speculative scaffolding.

| Order | Vertical user journey | Completion/evidence |
| --- | --- | --- |
| Slice 01 — Ask and receive | Create root card → send prompt → **real authorized AI response streaming** → persist turn → reload → read answer in graph | Context/testable transport, loading/error/retry, persistence roundtrip, minimal canvas and actual UI; needs approved provider/platform |
| Slice 02 — Fork from source | Select answer quote/block → Fork → child created with stable parent/revision/block → assembled ancestor+focus context → AI answer → persist/reload → navigate to original quote | Unit tests for anchors, lineage/sibling isolation; E2E selection→fork→return |
| Slice 03 — Continue and navigation | Continue a chosen path → distinct child answer → switch sibling paths, focus/overview, pan/zoom/collapse/search → drafts preserved | Context builder excludes sibling, gestures isolated, stable persisted viewport/draft state |
| Slice 04 — Rich conversation | Attach supported file/content → show actual source/code/table/tool blocks → stream/cancel/retry → responsive composer expansion | Validated attachment bytes/permissions, no simulated tools/reasoning, errors recover, keyboard/mobile UI |

**No artificial "foundation-only", "UI-only", or "canvas-only" release.** The first slice can be small in feature breadth but **complete in the selected user journey**, with correctness/security/loading/error/test handling from day one. Future slices extend the same folder owners without structural refactors.

**Implementation gate before Slice 01:** resolve platform (standalone web vs extension), provider/auth mechanism, and persistence deployment. The choices affect actual transport and secret boundaries. Do not guess secrets or falsely label mock output as connected AI.

## Canvas / UI implementation

`components/GraphCanvas.mjs` currently provides native root-card positioning, pan and zoom. No branch edges exist yet. Keep selection/textarea scroll isolated from canvas drag. Future branch handles must reference stable block and response revision IDs, not section indices. Distinguish focus reading from zoomed-out overview as topology grows. A future React Flow dependency would require an explicit decision, not a parallel feature owner.

## Persistence, providers, security

- **Platform chosen:** Chrome MV3. `chatgpt.com` is only the launcher host; no ChatGPT DOM extraction, cookies, private API calls, or implicit conversation context.
- **Storage chosen:** `chrome.storage.local` v1 root-turn snapshot, with trusted-context pairing token. No cross-device sync.
- **Transport:** background Port → authenticated localhost Node gateway (`127.0.0.1:8787`) → official OpenAI Responses SSE. Pairing token is not a provider API key and must not be treated as remote multi-user auth.
- Never embed provider secrets in client/extension bundle. Use authorized transport/backend.
- Attachments require actual content validation/upload and bounded access; filenames alone are not context.
- Treat user text, AI Markdown, links, tool results and files as untrusted. Prevent XSS, unsafe links and leaked sensitive logs.
- Real streaming needs cancellation, retries, error visibility, rate/cost controls and duplicate-send protection.
- Never present mocked results, sources, search, reasoning or model routing as real.

## Risk-based verification (execution flow lives in root AGENTS.md)

Select tests based on the changed boundary, rather than running an invented or irrelevant suite:

- **Pure domain / context:** unit tests for lineage, parent/cycle validation, immutable anchor/revision, sibling exclusion and context budgeting.
- **Storage / AI transport:** faithful integration tests for persistence/migration, idempotent send, streaming/cancel/retry and attachment validation.
- **Canvas / composer:** interactive component/E2E checks for compact→expanded composer, per-card draft preservation, selection→fork, keyboard/mouse gesture isolation and source navigation.
- **System quality:** relevant build/typecheck/lint when scripts exist; inspect responsive, light/dark, long output and large graphs if UI changed; check untrusted Markdown/XSS where external content flows through.

**Verification rules:** first inspect which scripts and test boundaries exist. Use a failing regression test for meaningful behavior changes when feasible; do not force tests for docs, copy or CSS-only adjustments. Evidence must be from actual commands, not assumptions. Stop once the user-visible outcome and affected invariants are verified.

## Execution order

**Done in source:** Slice 01 MV3 root chat, streaming bridge, local persistence and error/retry with mocked integration tests. **Next:** manual Chrome + actual provider key smoke test, then Slice 02 stable source-anchored Fork. **Later:** path continuation, richer content and attachments.

No claim of implemented functionality or passed tests without verification output.

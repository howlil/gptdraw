# Engineering Design — gptdraw

**Working documentation, not an installable skill.** Architecture is proposed; the repository does not yet contain a runtime or passing application tests.

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

## Proposed boundaries (do not scaffold unused folders)

~~~text
src/
  app/                     # composition, app shell / routing
  features/
    conversations/
      model/               # turn, branching, lineage, context
      ui/                  # ChatCard, Composer, ResponseRenderer
    canvas/                # React Flow UI / spatial interaction
  integrations/
    ai/                    # provider transport, streaming
    storage/               # migrations, persistence
  shared/
    ui/                    # genuinely reused primitives only
~~~

- Domain imports no React, React Flow, DOM, storage driver or provider SDK.
- App wires composition; feature UIs call domain commands; integrations speak in domain DTOs.
- Feature-first and shallow; add directories only for real files/ownership.
- Avoid blanket core/controllers/adapters/services/utils layers, speculative abstractions and refactors without measurable benefits.
- Test next to its owner or follow repository convention.

## Canvas / UI integration

React + TypeScript with @xyflow/react custom nodes is a **recommendation**, not an installed dependency. Source/target handles should use stable block IDs, updated when dynamic node size or blocks change. Use nodrag/nopan/nowheel or equivalent to isolate response selection, textarea, internal scroll and menus. Preserve React component identity during canvas updates. Zoomed-out overview and focused readable chat are distinct. ELK auto-layout remains optional until needed.

## Persistence, providers, security

- Choose web vs extension **before** choosing auth, storage, model transport or deployment. IndexedDB/backend DB is an unresolved decision.
- Never embed provider secrets in client/extension bundle. Use authorized transport/backend.
- Attachments require actual content validation/upload and bounded access; filenames alone are not context.
- Treat user text, AI Markdown, links, tool results and files as untrusted. Prevent XSS, unsafe links and leaked sensitive logs.
- Real streaming needs cancellation, retries, error visibility, rate/cost controls and duplicate-send protection.
- Never present mocked results, sources, search, reasoning or model routing as real.

## SWE workflow

**Inspect → Understand/map → Plan → Test first → Implement → Verify → Review/iterate**

1. Inspect repo/lockfiles and reproduce behavior, not remembered architecture.
2. Map critical path, ownership, call/data graph, invariants and failure paths.
3. Plan Now → Next → Later with the smallest full vertical slice and exact touched files.
4. Write a failing invariant/unit/UI/integration test or executable acceptance scenario before code.
5. Implement minimally. No architecture-only layers, oversized commits or unrequested refactor.
6. Run existing targeted tests, typecheck, lint/build; inspect real UI desktop/mobile/light/dark and long-form response.
7. Review diff/security/concurrency/state and report actual evidence + remaining risks.

Tests: unit (lineage, anchors, sibling isolation, budgets); integration (storage/migration, stream/cancel/retry, attachment validation); E2E (root→fork→continue→reload→return-to-source, pan vs selection, composer states, keyboard/touch); nonfunctional (30–50+ cards, rendering, XSS/performance).

## Critical path

**Now:** platform + context semantics + stable data model → **Next:** mocked root/fork/child with persistence and regression tests → **Later:** real provider streaming, rich content, advanced layout and graph comparison/merge.

No claim of implemented functionality or passed tests without verification output.

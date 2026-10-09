# Engineering Design — gptdraw

**Working architecture documentation, not an installable skill.** This repository currently has no implemented app, installed framework, active module tree or passing application test suite.

## Status and authority

| Category | Status | Rule |
| --- | --- | --- |
| Approved product semantics: one turn/card, parent lineage, Fork/Continue, stable provenance | **Active contract for future code** | Implementation must preserve these invariants |
| Domain ownership: conversation is truth, canvas only a visual projection | **Engineering boundary decision** | Do not store business state only in graph/UI objects |
| Proposed `src/` layout, React Flow, storage/provider choices | **Proposal, NOT active code or mandatory folder structure** | Inspect stack and real call sites first; create owners only when needed |
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

## Proposed boundaries — reference only (not a scaffolding mandate)

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
- **No unsolicited refactoring:** adding a feature does not permit moving, renaming, splitting or cleaning up unrelated code. Fix boundary violations in **new code** from the start; change legacy structure only with explicit user authorization or a narrowly demonstrated blocker.
- **Folder creation test:** create a directory only when it owns an invariant, a real external boundary, or multiple files with strong change locality. Do not automatically impose `core/`, `adapters/`, `controller/`, `features/`, `application/`, `ports/`, `repositories/`, or per-feature barrels. Borrow no mandatory module structure from `modu-app` or `cs-101` without verifying this repo's needs.
- Explicitly distinguish **current implemented ownership** from **planned target ownership** in future architecture updates. Future paths do not authorize moving existing code.

## Canvas / UI integration

React + TypeScript with @xyflow/react custom nodes is a **recommendation**, not an installed dependency. Source/target handles should use stable block IDs, updated when dynamic node size or blocks change. Use nodrag/nopan/nowheel or equivalent to isolate response selection, textarea, internal scroll and menus. Preserve React component identity during canvas updates. Zoomed-out overview and focused readable chat are distinct. ELK auto-layout remains optional until needed.

## Persistence, providers, security

- Choose web vs extension **before** choosing auth, storage, model transport or deployment. IndexedDB/backend DB is an unresolved decision.
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

## Critical path

**Now:** platform + context semantics + stable data model → **Next:** mocked root/fork/child with persistence and regression tests → **Later:** real provider streaming, rich content, advanced layout and graph comparison/merge.

No claim of implemented functionality or passed tests without verification output.

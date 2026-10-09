---
name: engineering-design
description: Design and audit gptdraw conversation graph, data flow, storage, AI integration, canvas boundaries, repository structure, and test strategy. Trigger for implementation plans, architecture, refactors, backend/model integrations, performance, security, and code reviews.
---

# Engineering Design Agent — gptdraw

## Mission

Deliver the **smallest maintainable implementation** that preserves real conversation context and graph invariants. Use graph-first reasoning and test-first engineering. Choose **clear boundaries without folder proliferation, blanket layering, premature ports/adapters, or speculative abstractions**.

Read **AGENTS.md → DESIGN.md → docs/PRODUCT_RESEARCH.md**; inspect actual repository and lockfiles before choosing framework/library. No source tree currently existed at repository initialization: the proposed layout below is **not** a claim that code already exists.

## Engineering process

```text
Inspect repository + reproduce request
  → map user action / event
  → trace UI state → domain data → persistence → AI transport
  → list invariants, failure paths, trust boundaries
  → minimal implementation plan + changed files
  → failing test / executable acceptance criterion
  → implement smallest vertical slice
  → run targeted tests and type/lint/build
  → inspect UI at 320/360/768/desktop and light/dark
  → review security, reliability and performance
  → report evidence + remaining risks
```

Do not assume a preferred framework is installed. Recommend React + TypeScript + `@xyflow/react` for production canvas if starting from zero, with a real model transport and local-first persistence if appropriate. ELK.js is **optional for auto-layout** once graph scale justifies it. Beautiful UI / AI Elements are component patterns only; they are not substitutes for graph domain design.

## Critical dependency graph

```text
app composition / routes
  ├── canvas UI (React Flow adapter, viewport/layout)
  │     └── conversation-graph core
  ├── chat UI (card, adaptive composer, response renderer)
  │     ├── conversation-graph core (commands/queries)
  │     └── chat content types
  ├── persistence adapter
  │     └── conversation-graph core types
  └── AI transport / orchestration
        ├── context builder → conversation-graph core
        └── provider SDK or approved integration
```

**Allowed dependencies**: composition imports features and adapters; canvas imports graph core; chat UI imports domain commands/queries and shared primitives; provider adapters import domain DTOs. **Forbidden**: graph core importing React Flow, DOM, browser extension APIs, persistence driver or model SDK; chat UI constructing provider prompts ad hoc; canvas UI becoming canonical conversation storage; persistence mutating response anchors silently.

## Domain model (design target, not production code)

```ts
type NodeId = string;
type BlockId = string;
type TurnStatus = 'draft' | 'queued' | 'streaming' | 'complete' | 'failed' | 'cancelled';

type SourceAnchor =
  | { kind: 'response'; parentNodeId: NodeId }
  | { kind: 'block'; parentNodeId: NodeId; blockId: BlockId }
  | {
      kind: 'selection';
      parentNodeId: NodeId;
      blockId: BlockId;
      exactQuote: string;
      startOffset?: number;
      endOffset?: number;
      contentVersion?: string;
    };

type ConversationNode = {
  id: NodeId;
  parentId: NodeId | null;
  userMessage: { id: string; text: string; attachmentIds: string[] };
  assistant: {
    id: string | null;
    status: TurnStatus;
    blocks: Array<{ id: BlockId; kind: string; content: unknown }>;
    error?: { code: string; message: string; retryable: boolean };
  };
  sourceAnchor: SourceAnchor | null;
  createdAt: string;
};

// The conversation entity is NOT a React Flow Node.
// Viewport position, zoom, collapsed/focused state, drafts and selection
// belong to presentation/workspace state, not to the canonical AI message.
```

Use stable IDs (including response blocks), not numeric section indices. Persist context lineage and source provenance separately from positions. Consider schema migrations from day one if persistence is enabled; avoid speculative event sourcing.

## Graph invariants (test first)

1. Each node contains exactly one user message and one assistant response **slot**, including queued/failed/streaming states.
2. Root parentId=null and anchor=null. Every non-root parentId refers to an existing node.
3. Graph is acyclic; no self-parent, ancestor-parent reversal or orphan created by mutations.
4. Existing completed node content and anchor identity remain stable when a child is created; editing/deleting a source demands explicit orphan/re-anchor policy.
5. Continue and Fork create **separate child nodes**; never overwrite parent.
6. Continue carries ordered root→parent conversation context; Fork also carries ordered ancestry by default **plus source anchor**. A selection-only context policy requires an explicit mode and visible disclosure.
7. Context builder never uses visual graph coordinates, collapsed state or unsent drafts as hidden model messages.
8. Branching from selected text is anchored to immutable block ID + quote and optional offsets/version; invalid ranges fail safely and prompt for user confirmation.
9. User drafts survive switching active node, collapse/expand, zoom/pan, transport retries and non-destructive re-renders.
10. Provider streaming never corrupts domain tree; failed/cancelled turn retains clear status and retryable input.

For v1, allow one parent per node (tree). Merge/multi-parent DAG belongs to a separate product design and data migration decision.

## Explicit context-builder semantics

- Build the ordered path of completed conversation turns from root to the **chosen parent**, then append the new child user's message.
- Include only messages whose content is available; define policy for failed/pending ancestor turns rather than silently injecting synthetic answers.
- SourceAnchor is **additional grounding/provenance**. It does **not** implicitly mean that earlier turns are discarded.
- Bound model context by actual token budget and transparent truncation/summarization policy; show truncation or summary provenance rather than claiming full context if truncated.
- Keep user-uploaded files out of prompt assembly until validated and successfully stored/authorized.
- Define cancellation, retries, deduplication and idempotency for send; protect against double-send and duplicate child creation.

## Boundary proposal (only after framework selection)

```text
src/
  app/                             # routes, providers, dependency wiring
  features/
    conversation-graph/
      model/                       # node types, ancestry, commands, invariants
      ui/                          # graph canvas, custom nodes/edges, viewport
    chat/
      model/                       # response block/message/attachment types
      ui/                          # ChatCard, Composer, ResponseRenderer
  integrations/
    ai/                            # model transport/provider, streaming
    storage/                       # chosen persistent store
  shared/
    ui/                            # only genuinely reused primitives
```

Conventions:
- **Feature-first, low-depth**. Add folders only if at least two cohesive files justify them.
- No empty `core/`, `controller/`, `adapters/`, `services/`, `utils/` folders mandated across all features. Split by ownership, not patterns for pattern's sake.
- Name files after responsibilities, not vague `helper.ts`, `manager.ts`, `common.ts`.
- A module boundary exists to protect an invariant or dependency direction; **do not abstract a one-off call**.
- All graph mutations funnel through tested domain commands; React Flow edge/node arrays are projections.
- An API/model integration is a genuine external boundary. Avoid exposing provider SDK objects across features.
- Keep styles/tokens aligned with DESIGN.md and do not duplicate CSS tokens across card variants.

## Canvas integration details

- React Flow: custom chat node; stable source/target handle IDs (prefer `block:<id>`); call `useUpdateNodeInternals` whenever rendered handles/positions change.
- Use `nodrag`, `nopan`, `nowheel` to isolate text selection, textarea, popovers and internal scrolling from viewport gestures.
- Preserve per-node composer state outside transient React Flow node render lifetimes. Never rebuild all message DOM on every pan/search/input keypress.
- Rendering at low zoom should show readable **overview representation**; do not pretend scaled-down full answers are legible.
- For layout, honor manual user positions. Auto layout, if adopted, should be explicit and testable; large layouts off main thread when required.
- Ensure changes in card height, collapse state and streamed blocks recompute edge handles without flicker.

## Persistence, security, reliability

- Choose browser storage (e.g. IndexedDB) or backend DB only after clarifying deployment and cross-device sync; name migration/version strategy.
- Do not place API keys in browser or extension frontend, repo, client bundle, or local storage. Use server-side gateway / approved auth scheme.
- Do not assume an unofficial ChatGPT website DOM integration can supply a complete model context. If browser extension is selected, assess platform permissions, site policy, origin/CSP and a supported provider integration.
- Sanitize/escape untrusted model/user content; secure Markdown/HTML renderer and external links; treat attached files as untrusted. Enforce file type/size and auth/access checks.
- Handle response streaming cancellation, reconnect/rate limits/timeouts, duplicate submission, persistence failure and provider unavailability.
- Never invent reasoning steps, sources, “search completed”, usage metrics or model names.
- Trace issues with redacted structured error logs; no sensitive prompt/attachment leakage by default.

## Testing matrix

| Level | Mandatory cases |
| --- | --- |
| Unit | lineage ordering; cycle rejection; invalid/missing parent; stable anchor; fork vs continue; context budget policy |
| Integration | storage roundtrip/migration; provider stream/cancel/retry; dedup send; attachment validation; node persistence |
| UI/component | composer compact→expanded→compact; per-node draft; selection-to-fork; thinking/sources conditional; pending/error |
| E2E | create root→two branches→continue one; refresh persistence; source navigation; text selection while pan disabled; drag/zoom, keyboard, dark/mobile |
| Nonfunctional | long output; code/table; 50+ nodes; edge recalculation; no catastrophic rerenders; security and a11y audit |

A test “passed” claim requires actual commands/results, not an invented status. Use the repo's current package manager and scripts, not guessed commands.

## Change review output

Deliver:
1. **Graph of affected boundaries/data flow** and root cause.
2. **Minimal plan** with exact files and invariants.
3. **Implemented diff** and tests with evidence.
4. **Regressions/risks**, especially context corruption, node duplication, UX selection and auth/storage exposure.
5. A **Now → Next → Later** path, not unbounded architecture work.

### Stop signs

Stop and reconsider when:
- The proposal introduces layers unrelated to a real boundary.
- Graph view objects become persisted conversation truth.
- Branch context semantics are undocumented or silently vary.
- A demo stub is labeled as production.
- A broad refactor is suggested without failing tests or measured maintainability gain.
- A UI change loses behavior from DESIGN.md.

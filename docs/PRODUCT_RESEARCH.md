# Product research & decisions — gptdraw

Last reviewed: **2026-10-09**.

## Scope and evidence

This document consolidates **the current chat discussion and the user-supplied `branch-ai-native-graph(1).html` prototype**. It is an analysis/specification, not a record of a production implementation.

Evidence labels:
- **DECIDED** — explicitly selected or confirmed in the chat.
- **OBSERVED** — directly present in the attached prototype.
- **INFERRED** — product/engineering inference; validate with users/tests.
- **PROPOSED** — new recommendation, not yet accepted.
- **NOT IMPLEMENTED** — requires new code/provider/infra.

## Decision trail

| Stage | Evidence | Decision |
| --- | --- | --- |
| Spatial chat graph | DECIDED | Canvas cards represent branching conversation turns rather than a conventional one-thread chat or sidebar graph. |
| Card granularity | DECIDED | Exactly **one user question + one AI response per card**. Follow-ups create connected cards. |
| Component research | DECIDED | AI-native content states (Markdown, code, sources, thinking/tool output **when available**), not generic decorative descriptions. Beautiful UI inspired the component vocabulary, not the graph implementation. |
| Four card explorations | DECIDED | “Dialogue” preferred over Reader, Sectioned and Graph Compact as the main **focused** card design. |
| Role presentation | DECIDED | **No user/bot icons or avatars**. User prompt right-aligned with different, soft tint; AI response left, like conventional AI chat. |
| Composer screenshot review | DECIDED | Compact one-line pill by default; if text wraps/grows or attachments appear, **expand upward** with toolbar at the bottom, similar to reference screenshots. |
| Full canvas iteration | DECIDED | Keep card content primary, with Fork/Continue, connectable graph, parent navigation, drag/pan/zoom, collapse, outline and search. |
| Design tone | DECIDED | Clean, calm, compact, minimalist, subtle glass only when appropriate, smooth but restrained interactions; system UI/SF Pro + SF Mono fallback, 4px spacing scale. |

## Product mental model

```text
USER INTENT
Ask about a topic
  → receive answer
  → spot a claim worth exploring
  → select passage / choose Fork
  → child inherits known ancestor conversation path
  → compare branches in spatial overview
  → focus any node for a readable AI chat
  → source click returns to originating passage
```

The **chat turn is the domain object**. The canvas node is only its spatial representation. The graph does not justify reducing the readability, context or reliability of the conversation.

## Prototype audit — actual behavior vs desired production behavior

Observed from the uploaded HTML source (the source is a standalone vanilla JS prototype with inline CSS):

| Dimension | OBSERVED in supplied prototype | Gap / risk | Target |
| --- | --- | --- | --- |
| Domain state | In-memory `nodes`, `drafts`, active/composer IDs | Refresh loses graph and prompts | Persist model + drafts, explicit schema |
| AI output | New child has `simulated: true` and placeholder answer | Not connected to AI; cannot claim full inherited model context | Provider transport + streaming/error/retry |
| Branch provenance | Parent + numeric section `anchor` and optional selected quote | Section index changes if answer edited/streamed | Immutable response-block ID + quote/offset/version |
| Context | UI shows “Context inherited”; no context builder or provider call | Visual link ≠ actual context inheritance | Tested root→parent message reconstruction |
| Files | File picker stores **name only** | Not upload/content, can't ground AI answer | Secure storage/validation + content attachment |
| Model chooser | UI toggles between Instant/Thinking in local state | No runtime model switch | Real provider routing or disabled control |
| Thinking/sources | Pre-seeded display text | Acceptable demo, not evidence of actual model/tool reasoning | Display only provider-supplied values |
| Editing | Cards re-created via `innerHTML` during render | Can lose text selection/focus/scroll, scale poorly | Stable component identity & external draft state |
| Dynamic edges | SVG computed from DOM element height and section offset | Fragile during resize/collapse/streaming | Stable measured handles and resize updates |
| Canvas | Fixed stage (2600x2000), CSS translate+scale | Not truly unbounded | Tested pan/zoom bounds, optional virtualized view |
| Reading | Narrow 366px card scaled for multi-card fit | Text becomes tiny at overview | Explicit overview vs focused reading |
| Interactions | Pointer drag/pan and card controls exist | Must isolate text selection, internal scroll, keyboard/touch | Canvas event isolation + accessible equivalents |
| Search | Re-renders all cards each input update | Draft selection and performance risk | Memoized/projection-level filtering |
| Layout | Manually positions new child by scanning existing heights | Large/deep graph overlap and inefficient placement | Deterministic placement + explicit auto-layout option |
| Safety | User text mostly escaped before insertion | Real Markdown, external URLs and tool results increase XSS surface | Safe renderer, URL validation, threat review |

These are **observed implementation characteristics**, not proof that a specific bug was reproduced in browser automation. A UI test suite must verify each predicted failure before calling it a regression.

## Design evaluation — keep / change / avoid

### Keep (high alignment)
- Right user bubble / left plain assistant answer.
- No avatars, minimal card header with source navigation.
- One active composer; compact pill that grows.
- Conditional thinking and citations.
- Edge connections from parent/section, with active lineage highlighted.
- Focus/collapse/search/outline controls.

### Change first
- Replace permanent per-paragraph Fork buttons with contextual selection actions + visible card-level Fork fallback.
- Separate **Overview** (compact summary) from **Focus** (readable full answer/large composer).
- Preserve selection and drafts across card state changes. Use a stable data model rather than `innerHTML` reinitialization.
- Track **what the model actually receives**; preserve source anchor and ancestor chain.
- Correct accessibility and content-specific scroll: typing, selection, attachment menu and code scrolling must not trigger canvas motion.
- Distinguish simulated content from actual AI results.

### Avoid
- A second sidebar that duplicates full chat (outline/navigation is fine).
- One card per message bubble; the approved unit is one **turn**.
- Avatar badges, explanatory chrome, “AI response ready”, decorative status pills, generic source boxes.
- Importing every Beautiful UI component just because it exists.
- Source/Thinking/model UI that implies unsupported provider behavior.
- Over-layered `core/controller/adapters/services` scaffolding before code exists.

## Information architecture / state graph

```text
Workspace
  ├── graph (conversation domain: nodes + parent + stable anchors)
  │      ├── root turn
  │      ├── fork turn (block / selection anchor)
  │      └── continue turn (parent lineage)
  ├── viewport (positions, zoom, selected node, overview/focus)
  ├── chat (structured response blocks, sources, tool results)
  ├── composer (draft per node, files, mode, pending state)
  └── model connector (optional streaming, failure, cancellation)
```

Events: **select card → compose → continue/fork → create pending child → context assembly → submit → stream → complete/error**. UI layout state must not silently determine what the provider sees.

## Known trade-offs / outstanding decisions

| Open question | Suggested default | Evidence status |
| --- | --- | --- |
| Product form | Validate web-first vs browser extension before defining integration | INFERRED (extension was considered, not confirmed as a shipping contract) |
| Data persistence | Local-first at first, add sync when a real use case requires it | PROPOSED |
| Canvas technology | React Flow (`@xyflow/react`) custom nodes + dynamic handles | PROPOSED |
| Automatic layout | Manual graph placement first, ELK only when scale/complexity justifies | PROPOSED |
| Rich chat components | Beautiful UI visual patterns; AI Elements for message/composer patterns if React chosen | PROPOSED |
| Card size | Overview ~280px, default ~360–420px, focused ~520–560px, long content up to ~720px | INFERRED/UNTESTED |
| Selection anchors | Stable response block IDs + exact quote; re-anchor policy on regenerated answer | PROPOSED |
| Context budget | Inherit full ordered lineage up to capacity; disclose summaries/truncation | PROPOSED |
| Branch merge | Defer; v1 remains single-parent tree | PROPOSED |
| Data security/auth | Decide with hosting, provider and attachment workflow | NOT IMPLEMENTED |

## Reference implementation research

External docs used to validate **component/library capabilities**, not user-preference decisions:

- React Flow custom handles: https://reactflow.dev/learn/customization/handles — source/target handles and dynamic handle considerations.
- React Flow update internals: https://reactflow.dev/api-reference/hooks/use-update-node-internals — recompute dynamic handles when their number/position changes.
- AI Elements Prompt Input: https://elements.ai-sdk.dev/components/prompt-input — composition with attachments and model options.
- AI Elements Sources: https://elements.ai-sdk.dev/components/sources — conditional expandable source/citation display.
- AI Elements Reasoning: https://elements.ai-sdk.dev/components/reasoning — stream-aware reasoning UI only when supported.
- AI Elements Chatbot: https://elements.ai-sdk.dev/examples/chatbot — block-based message rendering.

These references are **not proof** that gptdraw already uses React Flow, AI Elements or any AI provider.

## Acceptance test map

**P0 — correctness:**
1. Fork from a selected sentence in a specific response block; create child; refresh; return-to-source highlights same block/quote. Invalidated quote shows recoverable state.
2. Continue from branch B preserves exact root→B ordered prompts/responses; sibling C's messages are not leaked into context.
3. Failure and cancellation do not append a fabricated success answer; retry preserves the original prompt and does not duplicate children.
4. Attachment is not sent as a fake filename-only source; unsupported actions are disabled.

**P1 — core product:**
5. Short composer is pill-sized; wrapping or file attachment expands to textarea + bottom toolbar; deleting content collapses again without losing focus/draft.
6. Drag card header vs select response text vs internal scroll vs canvas pan never conflict.
7. Focus a card while 30+ cards exist: response remains readable; return to overview preserves scroll and positions.
8. Close/reopen card, zoom/pan, or switch active node: drafts, streaming state and caret remain intact.

**P2 — resilience/polish:**
9. Mobile 320/360px: read, compose, fork, navigate sources, collapse via keyboard/touch.
10. Theme, reduced-motion, content density, large graph and code/table rendering remain accessible/performance-budgeted.

## Delivery sequencing

- **Now**: establish docs, domain invariants, user journey tests, concrete stack/provider decision. Keep the uploaded HTML as **reference prototype** only.
- **Next**: isolated ChatCard + adaptive Composer, then graph view + persistence and stable provenance; test context builder before calling AI.
- **Later**: robust streaming/provider integration, richer response blocks, search/outline scale, optional auto-layout, branch comparison and eventual merge specification.

### Final review rule

A change is acceptable only if it preserves **chat-first readability**, **stable branch provenance**, **honest model capability**, **per-node draft persistence**, **clear module ownership**, and **verifiable tests**. Review the underlying interaction and domain graph before polishing visuals.

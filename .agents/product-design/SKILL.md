---
name: product-design
description: Research, model and audit gptdraw user journeys and AI-native chat/branching interaction. Trigger for UX, UI, component design, preview requests, usability, design audits, graph navigation or design system changes.
---

# Product Design Agent — gptdraw

## Purpose and authority

Create a calm, readable, compact **chat-first spatial conversation experience**. The product agent owns user problems, interaction semantics, information hierarchy and acceptance criteria. It **does not** authorize technical architecture decisions on its own.

Read **AGENTS.md → DESIGN.md → docs/PRODUCT_RESEARCH.md** before proposing/implementing UI. Inspect working code and existing patterns first. Do not invent UI features, model capabilities, research evidence or success metrics.

## Working method — graph first

```text
User job
  → task/context
  → current user journey
  → friction and failure modes
  → information hierarchy
  → interaction states
  → design variants (only if meaningful)
  → interactive preview
  → usability tests / accessibility
  → implementation handoff
```

When a user explicitly asks for design: **build an interactive preview rather than only prose, mockup imagery or static HTML code**. Prefer a compact 1–4 variant comparison when choices are genuinely open, then focus the selected direction. Reuse the project's colors, typography and components; use real SVG icons.

## User jobs to optimize

1. Ask a question; read a clear AI response without interface noise.
2. Explore an answer at a specific paragraph or selected quote without losing the originating question.
3. Continue an existing conversation path while retaining exactly the intended context.
4. Compare two related explanations in the canvas without confusing their lineage.
5. Recover from a failed request, long answer, unsupported feature or lost network connection.
6. Navigate a large graph without reading unreadably scaled-down card text.

## Stable product decisions (not open to casual re-interpretation)

- One card = exactly one **user turn + assistant response**.
- User chat bubble right, softly tinted. AI content left, unboxed. **No user or bot avatars**.
- The chosen card style is **Dialogue**, not reader-like labels or dense per-section dashboards.
- Composer initially compact ChatGPT-like pill: + / text / real mode choice if available / send. Expands for wrapped/multiline text and attachment, controls reposition below text.
- Fork/Continue create new connected cards, not messages appended to their parent.
- Fork can originate at an answer, a stable response block or text selection. A visual edge from its provenance, with parent navigation.
- Overview is for scanning; Focus is for reading/typing. Only the selected card needs a prominent composer.
- Sources, thinking, code, tables, tool results are **conditional**, not always-on decoration.
- Light/dark, keyboard, mobile and error states are part of the design, not polish backlog.

## Mandatory audit lenses

| Lens | Question | Expected result |
| --- | --- | --- |
| Job | Can user get from prompt to useful answer? | Critical path unobstructed |
| Hierarchy | Does reading beat metadata/actions? | Neutral first, visible reading order |
| Density | What can be removed? | No duplicate labels/status/source explanation |
| Provenance | Which answer/block/quote led to the fork? | Parent link, stable anchor, clear edge |
| Context | What will the model actually inherit? | Context scope visible and testable |
| State | Empty/loading/streaming/success/error/retry? | Honest status, no fake output |
| Accessibility | Keyboard/touch/selection/reduced motion? | Equivalent functional paths |
| Performance | How many cards fit before readability breaks? | Overview/Focus boundary |
| Responsiveness | 320/360/768/desktop with code and attachment? | No clipped controls or lost drafts |

## Design execution protocol

### Discover
- Review current implementation and prototype, plus relevant DESIGN.md sections.
- Express the user task in one sentence and map the flow **Now → Next → Later**.
- Classify findings: **Observed (source-backed), Inferred (hypothesis), Unverified (requires test)**.
- Identify root cause and affected interaction states, not cosmetic symptoms.

### Explore
- Prefer a coherent single solution when requirements are settled; show variants only when requested or trade-offs matter.
- Explore changes using structure + typography + interaction behavior before decoration.
- Respect system font sizes (12/14/16/18/20/28/36), spacing (4/8/12/16/20/24/32) and --accent reserved for active/focus/connection.
- Treat card width proposals as hypotheses. Avoid a generic fixed 360px for all reading modes.
- Avoid UI kits copied verbatim; component libraries are **implementation references**, not product architecture.

### Prototype
- Functional preview should demonstrate: prompt bubble, AI answer, adaptive composer, relevant conditional response blocks, fork/continue, node creation, branch line, return-to-source and collapse/focus.
- Include light/dark and narrow-width checks when design changes affect layout.
- Preview must mark generated AI response as simulated and attachment as local demo when applicable.
- Do not hide controls behind hover-only mechanics: keyboard/touch fallback required.

### Validate
- Reproduce a task and run behavior checks rather than judge only screenshots.
- Verify focus and selection are preserved; typing/selecting text must not pan/drag graph.
- Audit long prompt, long answer, code/table, slow streaming and error states.
- Give findings with **Severity → Evidence → User impact → Proposed correction → Acceptance test**.

### Handoff
Provide the minimum useful artifact:
- User job and exact interaction flow.
- Visual rules / token decisions and components impacted.
- States and event transitions, including failure paths.
- Acceptance criteria phrased as observable behavior.
- Evidence level; links to prototype/tests when they exist.
- Out-of-scope items and open questions.

Never present an untested interaction as implemented or production-safe.

## Escalate / pair with

- **engineering-design** for domain graph, parent/anchor persistence, React Flow behavior, providers, context inheritance, state ownership, security, performance and folders.
- **AGENTS.md workflow** for test-first implementation and evidence.

## Acceptance criteria examples

- Given a single-line draft, the composer stays in one compact row; when wrapping/attachment occurs, it expands without erasing text.
- Given a selection in a streamed response, Fork opens a child attached to the original immutable block/quote; the original selection's provenance survives rerender.
- Given 30 cards at overview zoom, response text is not presented as if readable; focusing a card returns readable type and a working composer.
- Given no sources returned by a provider, the sources component is absent.
- Given a card is collapsed and then expanded, its unsent draft remains unchanged.

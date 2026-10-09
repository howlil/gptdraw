# AGENTS.md — gptdraw

Router and SWE workflow for project agents. **.agents/ contains documentation, not auto-discovered skills.** Keep decisions at their owning document; do not create a second docs/ repository tree.

## Read and route

| Work | Read first | Output |
| --- | --- | --- |
| UI design, composer, chat card, design graph, product research, UX audit | [DESIGN.md](DESIGN.md) → [.agents/product-design.md](.agents/product-design.md) | User job, interaction states, interactive preview, acceptance tests |
| Domain graph, context, AI integration, data/storage, structure, security, refactor | [.agents/engineering-design.md](.agents/engineering-design.md) | Dependency graph, invariants, minimal changes, tests |
| Implement a UI feature affecting model behavior | Product design → Engineering design → DESIGN.md | Product acceptance + tested vertical slice |
| Trivial localized typo | Relevant file | Direct focused fix |

## SWE lifecycle

**Inspect → Understand/map → Plan → Test-first → Implement → Verify → Review/iterate**

1. **Inspect reality.** Read repo/source/tests and reproduce actual behavior. Never assume the prototype is a real AI product.
2. **Map the graph.** User action → state → owning domain → I/O → result; identify ownership, critical path, invariants, failures and affected boundaries.
3. **Plan small.** Now → Next → Later; exact files and observable acceptance tests. Challenge assumptions and avoid speculative refactoring.
4. **Test-first for behavior.** Define a failing unit/integration/E2E test or executable acceptance criterion before changing behavior.
5. **Implement minimally.** Small working vertical slice, feature-first low-depth organization, no duplicated owners or premature adapter/controller/service layers.
6. **Verify.** Run actual tests, typecheck/lint/build when present; inspect live desktop/mobile/light/dark interaction when UI changes. Check concurrency, security and state persistence.
7. **Review & iterate.** Compare with DESIGN.md, check diff/regression risks; report actual evidence and unresolved items. Never claim tests passed, deployment completed or provider connected without proof.

## Hard constraints

- One graph node = one user turn with one AI response slot.
- User bubble right, AI response left, no avatars. One active adaptive composer.
- Continue/Fork creates a new child node. Fork provenance and **actual model context** must be correct; SVG edges alone are insufficient.
- Conversation domain is the canonical source; canvas nodes/positions are projections.
- Stable response revision/block ID and selected quote anchor, not numeric section index.
- Persist drafts; never create fake sources, thinking, attachment upload or AI output without a clear demo label.
- Use user-approved tokens/interaction in DESIGN.md; no UI drift.
- Do not move/create folders or add frameworks just for pattern consistency.

**Doc ownership:** DESIGN.md = UI rules; product-design.md = research and UX method; engineering-design.md = architecture and engineering evidence; AGENTS.md = routing/process. Update only the owner and necessary references.

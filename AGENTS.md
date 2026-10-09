# AGENTS.md — gptdraw Agent Router & SWE Workflow

This document is the **entry point** for any coding/research/design agent operating in this repository. It is a project contract, not a generic persona.

## Source-of-truth order

1. **Explicit current user request**, where it does not contradict safety/security or conceal unverified behavior.
2. **DESIGN.md** for product UI/interaction and visual tokens.
3. **.agents/product-design/SKILL.md** for product discovery, UX audits and interactive design handoff.
4. **.agents/engineering-design/SKILL.md** for architecture, domain invariants, data flow, tests, security and performance.
5. **docs/PRODUCT_RESEARCH.md** for evidence, decided/open questions, prototype limitations and rationale.
6. Current repository source, lockfiles and actual test/build output (always inspect them; never imagine files that do not exist).

If a requirement conflicts with a previous product decision, explain the trade-off and update DESIGN.md and PRODUCT_RESEARCH.md **in the same change** rather than quietly drifting.

## Routing — select only the useful skills

| Request signal | Route | Mandatory output |
| --- | --- | --- |
| New UI/card/composer/canvas design, research, accessibility, visual consistency | **product-design** | User job → states → interactive preview → acceptance criteria |
| Folder structure, boundary, dependency graph, refactor, system design, model/DB/API | **engineering-design** | Data/control flow → invariants → minimal architecture → test plan |
| Implement UI flow / branching / composer | **both**: product-design first, then engineering-design | Approved behavior + minimal implementation + tested screenshots |
| Bugs, context corruption, missing lineage, duplicate sends, persistence | **engineering-design** (+ product-design if UX behavior changes) | Reproduction → root cause → regression test → fix |
| Design-system change | **product-design** and update DESIGN.md | Tokens + exact component impacts + interactive regression |
| Release/production hardening | **engineering-design** | Security/reliability/performance gates and actual results |
| Small copy-only/doc typo | Direct change | No unnecessary skill invocation or refactor |

Read the referenced SKILL.md files when routed to them. Re-evaluate routing if scope changes. Do not invoke multiple agents mechanically for trivial changes.

## Core product invariants (read DESIGN.md for full rules)

- **One chat card = one user message + one assistant response slot**.
- User bubble **right**, subtly tinted. Assistant content **left**, no avatars.
- AI-native responsive content blocks; show sources/tool output/thinking only when actually present.
- Adaptive compact pill composer, automatic multiline/attachment expansion. Preserve per-node draft.
- Continue = child on same conversation lineage; Fork = anchored child with provenance. **Do not confuse visual edges with actual model context**.
- Canvas = navigation/exploration; reading comfort is primary. Overview/Focus are distinct views.
- No fake supported controls: a demo must declare simulated model output, local-only attachment and unavailable mic/provider.

## SWE execution contract

Follow this sequence for **any nontrivial code change**. Keep it lean: do not write a separate document for each step unless useful.

### 0. Inspect and establish reality
- Check repository structure, language/framework, package manager, AGENTS.md, DESIGN.md, relevant feature code and test scripts.
- Verify the actual task, input/output, reproducible bug and affected path. Use current source, not memory of another repository.
- If starting from an empty repository, say so; **do not imply** libraries, tests, deployments or model APIs exist.

### 1. Model before implementation
- Map the **critical user journey** and **data/control graph**: event → UI state → domain command → context builder → provider/transport → persistence → render.
- List invariants, trust boundaries, failures and concurrency risks (double send, stale response, streaming cancel, orphan node).
- Decide ownership and dependencies. Prefer feature boundaries, avoid broad `utils`/service/controller stacks.
- State **Now → Next → Later**; keep Now a small verifiable vertical slice.

### 2. Plan changes
- Write a compact change plan: files affected, behavior differences, schema migrations, tests and rollback.
- Prefer existing patterns and files; avoid sweeping refactors without supporting evidence.
- Research library/docs only when they improve the decision, not to import abstractions wholesale.
- Architecture decisions that change invariants/context semantics require updating docs.

### 3. Test first where behavior matters
- Start from a **failing unit/integration/E2E test** or a precise executable acceptance criterion.
- Prefer unit tests for graph/tree/context invariants, integration tests for storage and AI provider, E2E for real composition and canvas interaction.
- For visual changes build **interactive preview**, then compare desktop/mobile, short/long answers, dark/light, keyboard/touch.
- Preserve existing test coverage. Avoid asserting that tests passed without actual tool output.

### 4. Implement minimally
- Implement the smallest complete vertical slice, not a sprawling skeleton of unused modules.
- Keep pure graph/context logic separate from React Flow display state and provider SDK.
- Preserve node/user drafts through re-renders and node movements.
- Avoid rendering fake AI responses as real: mark mocked, do not show fabricated reasoning/sources.
- Use design tokens from DESIGN.md; no duplicate style islands or ornamental UI.

### 5. Verify and review
Run the commands that actually exist in the repository:
- Unit + integration + E2E targeted to changed behavior.
- Typecheck, lint, formatting and build.
- Functional preview and visual inspection at 320/360, ~768 and desktop; light/dark; keyboard/selection/drag.
- Security: auth, input/attachment validation, XSS-safe Markdown, secrets, origin/CSP, rate limit/cost controls.
- Reliability: retry/error/cancel, idempotency, persistence, streaming reconnection/cleanup.
- Performance: large graph, dynamic edges/handles, input latency, no unnecessary rerender loops.
- Compare final behavior with acceptance criteria and state exactly which checks were not run.

### 6. Report with evidence
Use concise format:
- **Changed**: behavior + affected files.
- **Verified**: commands/screenshots/test results (not general assurances).
- **Risks**: incomplete integrations and remaining edge cases.
- **Next**: only the nearest useful follow-up.

Never say “implemented”, “tested”, “production-ready”, “merged”, or “deployed” unless evidence supports it.

## Structural discipline (strict; prevents future drift)

- Prefer **feature-first** organization and named domain ownership. Do not impose folders as decoration.
- Direction: **app → feature UI → domain**, with external integrations behind explicit boundaries.
- Domain logic cannot depend on React/React Flow, DOM, provider SDK or storage driver.
- Reuse components only when an actual second use exists; no premature global `components` dumping ground.
- Test adjacent to the owning module or in a coherent tests folder that matches existing convention. No arbitrary duplicate ownership.
- A feature should have one authoritative source of state. React Flow nodes/edges are **projections**, not the canonical conversation graph.
- Before creating/moving folders, explain ownership and list which imports can cross the boundary.
- Do not routinely propose refactors just to fit a pattern. Refactor only when a real boundary/invariant/testability issue is evidenced.
- Changes to these rules must be explicit so future agents do not revert design via unrelated refactors.

## Git safety and delivery

- Inspect current branch/state and file history before edits.
- Preserve unrelated user changes. Avoid force pushes and destructive rewrite.
- Use scoped changes/commits; verify file contents after remote writes.
- If a PR is used, include design contract, test evidence and outstanding uncertainties.
- Empty repository initialization is **documentation first**. Runtime/framework choice and live AI integration require an explicit implementation task/decision.

## Decision record template (only for consequential changes)

**Decision / Why / Alternatives rejected / Invariants preserved / Risks / Verification / Status (decided vs hypothesis)**.

## Definition of Done

A change is complete when behavior matches the stated user job, domain invariants hold, the design system remains consistent, appropriate tests and UI states are verified, and the exact evidence/limitations are reported. Passing a screenshot review alone is never sufficient.

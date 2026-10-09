# AGENTS.md — gptdraw

Repository-wide SWE workflow and routing. **.agents/ contains working documentation, not installable skills.** Keep decisions with their single owner; do not create a parallel docs/ tree or per-task planning files.

**Source of truth:** current user request → existing code/config/tests and observed runtime (for actual behavior) → this workflow → [DESIGN.md](DESIGN.md) for UI contract → [.agents/engineering-design.md](.agents/engineering-design.md) for architecture guidance → [.agents/product-design.md](.agents/product-design.md) for UX evidence. Architecture file paths are **proposals until implemented**, not evidence of a working stack. Never override observable code behavior with an aspirational document.

## Read and route

| Work | Read first | Output |
| --- | --- | --- |
| UI design, composer, chat card, design graph, product research, UX audit | [DESIGN.md](DESIGN.md) → [.agents/product-design.md](.agents/product-design.md) | User job, interaction states, interactive preview, acceptance tests |
| Domain graph, context, AI integration, data/storage, structure, security, refactor | [.agents/engineering-design.md](.agents/engineering-design.md) | Dependency graph, invariants, minimal changes, tests |
| Implement a UI feature affecting model behavior | Product design → Engineering design → DESIGN.md | Product acceptance + tested vertical slice |
| Trivial localized typo | Relevant file | Direct focused fix |

## Workflow — smallest correct change, least ceremony

**UNDERSTAND → IDENTIFY OBSERVABLE OUTCOME → MAP OWNER/RISK → CHANGE MINIMALLY → VERIFY ACTUAL RISK → INSPECT DIFF → STOP.**

For nontrivial engineering, use **inspect → map → plan → test-first → implement → verify → review**, but depth is proportional to risk. Think and plan before coding, without creating planning documents by default.

1. **Inspect reality.** Read the actual source, configuration, tests and current Git state. Reproduce a bug or define the user-visible outcome. Prototype behavior is not production evidence.
2. **Map the critical path.** Trace user action → owning component → state/domain decision → persistence/provider → UI. Name the **smallest owning boundary**, invariants, trust boundaries and failure modes. State Now → Next → Later only when it clarifies a substantial change.
3. **Plan only what matters.** Specify concrete affected files, observable acceptance and risk. Do not scaffold modules, add dependencies or introduce a new layer until the requested outcome needs them.
4. **Test-first where behavior is at risk.** Prefer the smallest faithful failing regression/domain test before implementation. Do not force unit tests for copy, CSS-only changes, docs or trivial wiring.
5. **Implement one coherent change.** Preserve unrelated behavior, contracts and user edits. Do not turn feature work into repo-wide cleanup.
6. **Verify the relevant boundary.** Run available targeted tests and then typecheck/lint/build where applicable; inspect interactive UI on desktop/mobile/light/dark when visual behavior changes. For domain/state/persistence, cover invalid input, concurrency, retry and state recovery where relevant.
7. **Review diff and stop.** Confirm no unrelated modifications, report exact evidence and skipped checks. Never imply tests, deployment or AI integration worked without actual results.

### Verification depth by risk

| Change | Expected verification |
| --- | --- |
| Text, docs, CSS-only, trivial wiring | Focused inspection, visual check when relevant; no obligatory new test |
| Deterministic domain behavior / local regression | Faithful unit or component regression test + targeted check |
| Graph lineage, context, streaming, state, storage, API | Explicit invariants + integration tests at the correct owner |
| Migrations, auth, concurrency, external provider | Failure/retry/idempotency/security checks and infrastructure-faithful evidence |

### Vertical-slice delivery (mandatory for application development)

**Do not organize work as horizontal milestones** (finish all domain, then all chat UI, then canvas, then storage, then AI). Deliver **one user-observable end-to-end path at a time**, covering the actual UI → pure domain → adapter/provider → persistence → verification boundaries it needs.

The permanent `conversation-workspace` responsibility/folder contract lives in [.agents/engineering-design.md](.agents/engineering-design.md). **Read it before adding any application files.** New code goes into its correct owner from the **first commit**. Do not build in temporary root-level files with a promise to refactor later. Create only directories with needed files; do not fill every bucket with placeholders.

Slice 01 is **ask → streamed AI response → persist → reload → see card in graph**, with real or explicitly approved provider integration, failure handling and tests. Later slices extend the same owners for Fork, Continue, graph navigation and rich content. This is **vertical-slice delivery**, not a reduced-quality MVP: each completed slice must be production-correct for its supported path.

Before application bootstrap, resolve web vs extension, provider/auth and storage. Never put a model secret in client code or claim mock output is a real response.

**No unsolicited refactoring:** a feature request authorizes work in its existing owner, not renaming, splitting, relocating or redesigning unrelated modules. New code must respect ownership from its first commit. If a legacy boundary blocks the requested change, explain the smallest necessary adjustment; do not start a sweeping refactor. A separate refactoring request is required for general cleanup.

**Git:** the current default branch is `master`; work directly there for explicit implementation requests unless the user asks for a branch/PR. Always inspect the current head/file before writing, preserve concurrent changes, verify remote content and inspect the diff. No PR or release ceremony by default.

## Hard constraints

- One graph node = one user turn with one AI response slot.
- User bubble right, AI response left, no avatars. One active adaptive composer.
- Continue/Fork creates a new child node. Fork provenance and **actual model context** must be correct; SVG edges alone are insufficient.
- Conversation domain is the canonical source; canvas nodes/positions are projections.
- Stable response revision/block ID and selected quote anchor, not numeric section index.
- Persist drafts; never create fake sources, thinking, attachment upload or AI output without a clear demo label.
- Use user-approved tokens/interaction in DESIGN.md; no UI drift.
- Do not move existing modules or add frameworks for pattern consistency. **For new application code, the conversation-workspace ownership contract is mandatory**, but not a license to scaffold unused directories. Do not copy the Svelte runtime or imports from another repo without selecting that stack.

**Doc ownership:** DESIGN.md = UI rules; product-design.md = research and UX method; engineering-design.md = architecture and engineering evidence; AGENTS.md = routing/process. Update only the owner and necessary references.

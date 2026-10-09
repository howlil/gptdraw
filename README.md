# gptdraw

**AI-native branching conversations.** One graph card = one user question and one assistant response. Chat is primary; graph organizes exploration, lineage and forks.

**Status:** Docs/decisions only. The uploaded HTML is a prototype, not a production app. Model integration, persistence and runtime tests do not yet exist.

## Single source of truth per concern

- [AGENTS.md](AGENTS.md) — lightweight routing and the developer's SWE workflow.
- [DESIGN.md](DESIGN.md) — canonical visual system, card, adaptive composer and canvas behavior.
- [.agents/product-design.md](.agents/product-design.md) — product research, approved decisions, interaction analysis and UX verification.
- [.agents/engineering-design.md](.agents/engineering-design.md) — engineering decisions, boundaries, graph/context invariants and test strategy.

**.agents contains project working documentation, not skill files.** Do not create SKILL.md or duplicate research under docs/.

## Approved product direction

Dialogue chat card, user bubble aligned right with a soft tint, AI answer left without avatars. Composer is a compact pill expanding for multiline/attachment. Continue and Fork create separate connected cards with provenance. Canvas is for overview/navigation; focus mode preserves reading comfort. Neutral calm minimal UI, real SVG icons, system fonts and 4px spacing rhythm.

## Workflow

Inspect → map critical path and dependencies → plan small → test-first → implement → verify → review/iterate.

Before bootstrapping a runtime, decide web app vs extension, AI transport and persistence. Do not scaffold a hierarchy of empty folders.

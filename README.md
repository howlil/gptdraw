# gptdraw

**AI-native, spatial branching conversations.** One conversation turn (one user prompt + one assistant response) is one graph card. The chat is the primary experience; the graph preserves provenance and organizes exploration.

> Status: **product/design specification only**. This repository was empty when these documents were initialized. The supplied HTML prototype is a reference, not a connected AI product or production implementation.

## Read before changing anything

1. [AGENTS.md](AGENTS.md) — agent routing, engineering workflow and quality gates.
2. [DESIGN.md](DESIGN.md) — binding UI/interaction design contract.
3. [.agents/product-design/SKILL.md](.agents/product-design/SKILL.md) — product research, interaction audits and usability acceptance criteria.
4. [.agents/engineering-design/SKILL.md](.agents/engineering-design/SKILL.md) — architecture, boundaries, data flow and test design.
5. [docs/PRODUCT_RESEARCH.md](docs/PRODUCT_RESEARCH.md) — decisions, evidence, prototype audit, risks and open questions.

## Product contract

- User message: right-aligned, softly tinted bubble, **no avatar**.
- Assistant: left-aligned readable response, **no avatar or compulsory bubble**.
- One card is **one question and its answer**. Branches are other cards, not extra turns inside the same card.
- Continue creates a child with the full ancestor path. Fork creates a child anchored to a response block or selected text, while preserving explicit ancestry.
- Composer defaults to a compact single-line pill; expands on wrapping/multiline/attachments. No fake functional controls.
- Viewport supports pan, zoom, move, selection, collapsed overview, focused reading, search, and context lineage.

## Recommended delivery order

1. Choose runtime and persistence target, validate browser-extension constraints if applicable.
2. Define graph/conversation schema and context assembly; test invariants.
3. Build chat card / adaptive composer in isolation, with interactive preview and automated UI tests.
4. Integrate canvas custom nodes and persisted graph; handle zoom vs readability.
5. Connect a legitimate model/provider transport with streaming, error/retry, and attachment security.

The rules are prescriptive; the folder structure and libraries in the engineering skill are proposals until the framework and integration strategy are actually chosen.

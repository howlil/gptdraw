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

## Workflow — vertical slices with stable ownership

**Understand → map owner/risk → plan a complete journey → test first → implement → verify → inspect diff → stop.**

New application code follows the fixed `src/modules/conversation-workspace/` ownership buckets in [.agents/engineering-design.md](.agents/engineering-design.md): `core/` (conversation invariants/context), `adapters/` (external transport/storage), `controller/` (per-workspace orchestration), `components/` (Dialogue card, composer, graph). `ConversationWorkspace.tsx` is composition only. Create each folder/file only when the current end-to-end slice needs it.

**Not a horizontal MVP plan.** Slices add complete user paths while maintaining the same ownership structure:

1. Ask in root chat → real streaming AI response → persistent card → reload.
2. Select a response passage → Fork → source-anchored child with correct inherited AI context → persistence/navigation.
3. Continue selected path → compare siblings, focus/overview and graph gestures → drafts/navigation persist.
4. Rich content/attachments → valid model context → streaming/error/retry and adaptive input.

Use no dummy “production” integrations or fake completion badges. Before Slice 01, choose **standalone web vs extension**, provider/auth, and storage. Never scaffold unused architecture or move unrelated code later for aesthetics.

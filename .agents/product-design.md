# Product Design — gptdraw

**Working documentation, not an installable skill.** Evidence from this chat's iterative designs and the uploaded interactive HTML prototype, October 2026. No real user study or connected model has been verified.

## Product goal / design graph

Chat is the primary job; graph is an exploration surface:

    Ask → Read AI response → Select claim/paragraph → Fork
      → New child card → Compare paths → Return to source
    Continue → New child inheriting ancestor conversation
    Canvas overview ↔ Focused readable chat card

**One card is one user turn (user prompt + AI response slot)**, never one node per message bubble.

## Decisions from the conversation (approved)

- The preferred card alternative is **Dialogue**, not Reader, Sectioned or Graph Compact.
- User input appears as a **right-aligned softly tinted bubble**; AI answer as **left-aligned plain content**. **No avatars or bot/user icons.**
- Composer initially **compact pill**; when text wraps/multiline or an attachment is present, input expands and controls move to the lower row, matching the user-supplied ChatGPT composer screenshots.
- Fork from whole answer or a selected response passage; Continue starts a new connected child. A source link must lead back to the exact parent block/quote.
- Canvas offers pan/zoom, card drag, collapse, selected path, search/outline; focus mode must make long-form reading comfortable.
- Compact, calm, minimal, neutral-first, system UI, real Lucide-style SVG icons, restrained accent and smooth motion. Remove redundant headings, “response ready”, fake statuses and decorative information.

**DESIGN.md owns actual typography/color/spacing/component rules. Do not duplicate its full token table here.**

## Prototype audit — evidence and limitations

**Observed in supplied HTML:**
- Standalone vanilla-JS node array, local drafts, SVG edges and pointer canvas.
- Child cards are created with simulated assistant output; AI provider is not connected.
- Anchor uses a numerical response-section index; selection provenance can become stale when source response changes.
- Model/mode selection only changes local UI. File picker stores file name, not uploaded/processed content.
- Rebuilding card HTML through innerHTML and a fixed canvas size may disturb selection, focus, scroll and scaling.

**Not implemented/verified:** real context inheritance, provider streaming, storage across refresh, actual attachment upload, real citations/thinking, responsive large-graph behavior or user usability results. These are risks to test, not already reproduced bug claims.

## Information/interaction hierarchy

1. Prompt and answer must be legible before controls/graph metadata.
2. Thinking, sources, code, tables and tool results are conditional on real response content.
3. Exactly one card has prominent composer; inactive/collapsed cards are compact.
4. Selection actions are contextual; a persistent Fork per paragraph on every card creates visual noise.
5. Overview scans structure, Focus reads/types. Do not present deeply zoomed-out text as legible.
6. Explicitly show whether a fork uses inherited ancestor context, a selected source quote or an alternative restricted-context mode.

## Product design working method

1. **Inspect:** user job, current files, UI and failures.
2. **Map:** journey + navigation / state graph, information hierarchy and friction.
3. **Distinguish:** Decided / Observed / Inferred / Unverified; challenge assumptions.
4. **Explore:** variants only when requested or a real trade-off is open.
5. **Preview interactively:** working actions, real SVG icons, honest simulated states.
6. **Validate:** small/large screen, light/dark, keyboard/touch, long answer, attachment/error, 3 vs 30+ cards.
7. **Handoff:** exact behavior, affected states, user impact and observable acceptance tests, then coordinate engineering boundaries.

## Initial acceptance scenarios

- Select response text → Fork child → go back to the same original quote, even after refresh.
- Continue branch B → only ancestor path to B is carried; unrelated sibling branch C excluded.
- Compact input → multiline/attachment expanded → remove content → compact; draft survives switching cards.
- Pan/drag never steals text selection, textarea typing or code scrolling.
- Unknown provider/tool capability is disabled or omitted, never faked.
- A 320–360px viewport can focus, read, compose and branch without clipped actions.

## Open product choices

**Platform decided: Chrome MV3 extension**, launched from the ChatGPT page. The extension does **not** import existing ChatGPT conversations or reuse ChatGPT login as API authentication. Current first slice implements only root chat → real gateway stream → local restore with explicit pairing; browser+live-key smoke test remains outstanding. Fork/Continue, real attachments, rich Markdown, long-form focus and responsive widths are still next-slice work.

**Now → Next → Later:** finalize context/fork semantics and focus behavior → build/test card+composer and first branch → richer content, search/layout scaling, comparison.

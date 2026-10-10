# Product design — gptdraw

Working project research/UX specification, not a skill installation. Canonical tokens and card rules live in root [DESIGN.md](../DESIGN.md).

## Corrected product definition (decided 2026-10-09)

gptdraw enhances the **currently open ChatGPT website** with a graph-based conversation view. It does **not** own inference, API keys, user sessions or model execution.

    ChatGPT page (existing prompts, assistant replies, native streaming)
        → read-only DOM adapter (visible turn extraction)
        → normalized prompt/answer pairs
        → spatial canvas projection
        → local layout state + jump back to native message

**One card = one user prompt + the following AI response.** The approved Dialogue card places the user bubble on the right and AI text on the left, without avatars.

## Observed source and product caveats

- The earlier HTML prototype created fictional assistant answers, stored conversations in an in-memory JS graph and used section indexes as fork anchors. **It is a visual reference, not the runtime data source**.
- The initial `0 turns` bug was caused by recognizing conversation wrappers while **requiring a nested `data-message-author-role`**. Current adapter checks wrapper `data-turn=user|assistant` first, then nested `data-message-author-role` and `data-conversation-role`, and falls back to role-only messages or `data-turn-key` grouped exchanges when the user bubble is present. Text extraction uses known user-bubble and assistant-markdown selectors. All remain **version-sensitive** and require live ChatGPT verification.
- DOM snapshots do not necessarily include hidden messages, model context, tools, attachments or historical branches.
- Solid connectors remain sequential. **Native Fork is implemented behind message-specific DOM discovery**, but not yet verified on a real logged-in ChatGPT instance. A pending action is never an edge; user-confirmed parent/child metadata is rendered as dashed lineage. Quote anchors contain offsets/digest, not source text.
- Native ChatGPT composer remains the actual send mechanism in first slice; extension can return focus to it but does not fake sending.

## User-job graph

**Now / corrected first slice:** open ChatGPT → automatically show graph (no page floating trigger) → replace only conversation main (sidebar stays visible) → read source-derived turns and live text changes → pan/zoom/focus → return to native message. **If no turns are detected, render one Start Card in the graph** with textarea and a native ChatGPT Send bridge; if native submission is unavailable, preserve the draft and hand off to ChatGPT. For old chats, walk toward the earliest DOM-loadable user turn without covering sidebar, preserve the original scroll position, and retain virtualized messages in memory while canvas is open. Back to ChatGPT restores native chat and keeps that preference for the tab; the Chrome toolbar icon toggles. Reopen retains card positions.

**Implemented in code, browser verification still pending:** native message menu detection → pending Fork → explicit child confirmation → persisted parent/child metadata → navigable dashed lineage. A known native UI action is required; automated tests use DOM fixtures only.

**Implemented with limitations:** single-block selected quote hashing/copy, true list/table/code/link rendering from safe typed DOM, search/outline, focused latest card and viewport culling for 80+ turns. **Still unsupported:** automatic focused-quote context reduction, provider-native citations/widgets, attachments, real-site Chrome smoke and measured FPS.

## UX research & design process

1. Inspect current ChatGPT DOM and extension behavior. Label findings **Observed / Decided / Inferred / Unverified**.
2. Map user task, current path and friction: entry → read → branch/explore → return.
3. Review information hierarchy and interaction states, not only component aesthetics.
4. Build interactive preview with **real** controls; no imaginary model/status. Favor selected Dialogue direction rather than gratuitous variants.
5. Validate streaming, route navigation, selection conflicts, keyboard, touch, focus, light/dark, 320/360/768/desktop.
6. Hand off exact behavior, affected owner, acceptance checks, evidence and limitations.

## Theme and performance decisions

- Black/white light and dark themes (no lavender/cobalt), follow ChatGPT theme if explicit; otherwise OS.
- UI entry/hover ~150ms only. Per-token response changes and pan/zoom are synchronous/incremental.
- Historical scanning traverses native conversation up and down, merges virtualized messages into RAM and remains cancellable; success means *DOM-loadable* messages, not guaranteed account-level first message.
- Default focus latest card at readable scale; Fit is explicit, with Find Card and searchable Outline. Rich cards follow the supplied Dialogue HTML prototype, but no fake model/fork/attachments. Do not cross to unrelated chat histories from the sidebar.

## Latest implemented workspace interaction decisions

- **Multi-branch family** includes verified parents/siblings/descendants without claiming the entire transcript of unloaded chats.
- **Minimap and focus navigation** reduce traversal cost in very wide conversations.
- **Reading** uses a full-height panel on real response blocks; **Compare** uses two real loaded cards, or two previously visited branch latest responses in the same tab. A page reload discards cross-route comparisons because previews are deliberately RAM-only.
- **Bookmarks** are per-conversation stable turn IDs (no transcript storage); **keyboard shortcuts** cover navigation, read, branch, Fit and search.
- Still **unverified:** native Fork on a real signed-in ChatGPT page, end-to-end SPA lifecycle, actual 60FPS under long chats, responsive live UI and exact current DOM selector parity. True automatic quote-context isolation, citations and attachments remain unsupported.

## Questions still open

- Exact native ChatGPT DOM and accessibility selectors across account plans/site versions (manual inspection required).
- Whether a native Branch action can be safely triggered via DOM without dependence on a brittle internal event contract.
- Stable IDs when ChatGPT virtualizes/recreates message DOM or regenerates responses.
- High-fidelity native citations and embedded tool widgets without copying untrusted HTML.
- Beautiful UI's React demo primitives vs lightweight project-owned low-level components: only integrate source when it adds concrete value without faking functionality.

## Reliability acceptance gate

Before introducing another user-visible feature, complete the Chrome signed-in smoke runbook under `docs/CHROME_SMOKE_TEST.md`. The implementation contains generation-safe lifecycle, route-bound layout saves, unanchored history detection, historical Fork source recovery, IndexedDB atomic branch ownership, transcript-free diagnostics, live Reading updates, and indexed spatial culling. These are **implemented in source with passing Node/CI tests**, not yet proof of stable behavior against a real account's ChatGPT DOM. Prioritize failures shown by diagnostics and performance traces over speculative components.

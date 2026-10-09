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
- A sequential connector between visible turns is not a confirmed ChatGPT-native fork. Fork automation should not be displayed until the real branching path and source anchoring have been verified.
- Native ChatGPT composer remains the actual send mechanism in first slice; extension can return focus to it but does not fake sending.

## User-job graph

**Now / corrected first slice:** open conversation → click the Chrome extension toolbar icon (no page floating trigger) → replace only conversation main (sidebar stays visible) → read source-derived turns and live text changes → pan/zoom/focus → return to native message. **If no turns are detected, render one Start Card in the graph** with textarea and a native ChatGPT Send bridge; if native submission is unavailable, preserve the draft and hand off to ChatGPT. For old chats, walk toward the earliest DOM-loadable user turn without covering sidebar, preserve the original scroll position, and retain virtualized messages in memory while canvas is open. Reopen retains card positions.

**Next:** verify native branch action and route changes → store parent/child conversation **metadata**, and show genuine fork edges with source provenance. Confirm behavior using live ChatGPT manual tests before claiming automatic branching.

**Later:** selected quote fork, richer native response rendering, adaptive composer bridge, search/outline, large-graph optimization and optional comparison modes, without ever recreating the AI provider.

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
- Historical scanning is progressive and cancellable; success means *earliest DOM-loadable* messages, not guaranteed account-level first message. Do not cross to unrelated chat histories from the sidebar.

## Questions still open

- Exact native ChatGPT DOM and accessibility selectors across account plans/site versions (manual inspection required).
- Whether a native Branch action can be safely triggered via DOM without dependence on a brittle internal event contract.
- Stable IDs when ChatGPT virtualizes/recreates message DOM or regenerates responses.
- Rich response/citations extraction without copying untrusted HTML.
- Beautiful UI's React demo primitives vs lightweight project-owned low-level components: only integrate source when it adds concrete value without faking functionality.

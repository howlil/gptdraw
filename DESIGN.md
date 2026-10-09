# DESIGN.md — gptdraw design contract

## Product identity

**ChatGPT remains the AI runtime. gptdraw is its spatial interface.** The extension canvas replaces the **visible conversation main area only** while active; the ChatGPT **sidebar, navigation and surrounding app shell remain visible and usable**. No invented provider status or hidden conversation context.

User journey: **navigate to ChatGPT → gptdraw opens automatically over the main chat area → read a focused prompt+answer card → search/outline/explore earlier turns → Back to ChatGPT restores native main → toolbar icon toggles modes**. The native-view preference persists for the tab session.

One graph card = one user turn + its following assistant response (which may still be empty/streaming). The initial implementation shows a **sequential conversation spine**, not true fork lineage. Fork is future work requiring a verified native action.

## Visual system

- **Tone:** clean, calm, compact, neutral-first, technically credible. Avoid glass saturation, badges for static metadata, decorative dashboard chrome and animation-per-token.
- **Fonts:** system UI (Apple SF Pro / Windows Segoe UI), mono SF Mono / Consolas / Liberation Mono / Menlo. No bundled fonts.
- **Text sizes/line height:** 12/16 meta, 14/20 UI, 16/24 body, 18/24 title, 20/28 large title, 28/34 page title, 36/40 display. Weights 400/500/600.
- **Spacing scale:** 4/8/12/16/20/24/32px. No arbitrary page rhythm values.
- **Colors — black/white only:** light background `#FAFAFA`, white card `#FFFFFF`, ink/accent `#171717`, muted `#737373`, border `#E5E5E5`, user bubble `#F0F0F0`. Dark background `#0A0A0A`, surface `#151515`, ink/accent `#FAFAFA`, border `#303030`, user bubble `#252525`. No cobalt/lavender/purple/blue styling. Follow ChatGPT's explicit light/dark class if available, else OS preference.
- **Controls:** compact rounded pills and SVG icons; **auto-open on ChatGPT navigation**, with Chrome toolbar as explicit toggle and **Back to ChatGPT** as a real reversible exit. No floating launcher/button inside ChatGPT. Canvas zoom controls remain visible *inside* the main area.

The implemented token owner is `src/app/workspace.css`. It imports **Tailwind CSS v4 at build time**, using reusable component CSS and a Shadow DOM-specific variable scope. Tailwind does not ship as a runtime compiler. The host ChatGPT CSS must not style extension UI, and extension CSS must not style host content.

## Chat Card (approved Dialogue direction)

- **User prompt on right**, softly tinted rounded bubble.
- **Assistant answer on left**, not an extra bubble, no user/AI avatars.
- Header carries short turn identity and native source/focus actions, not duplicate explanatory status.
- Content stays text-first; no fake sources, thinking steps, model actions or attachment indicators.
- Pending assistant turns show an honest waiting state.
- Stable DOM node identity: never replace the entire card on every streaming token.
- Content formatting: safely project the *rendered* assistant Markdown structure as typed headings, paragraphs, lists, tables and code blocks using DOM `textContent` / `innerText`; prioritize real answer content over reasoning-time labels. Never inject copied ChatGPT `innerHTML`. Full interactive citations/source previews remain unsupported.

## Conversation canvas

- Nodes represent consecutive visible turn pairs in one ChatGPT conversation. The overlay is measured against the native `main` bounding rectangle and updates when the sidebar opens/closes. Do not position the workspace across the full viewport or cover ChatGPT navigation.
- Edges in the first slice are a **sequential reading path**, not confirmed native branch relationships.
- Pan the empty canvas; move nodes by dragging the **header only**. Text selection, links, buttons and internal scroll do not initiate canvas dragging.
- Ctrl/Cmd+wheel or explicit zoom controls adjust viewport; **default to focused latest card at 100%** (rather than an unreadable 40% graph). Fit is an explicit overview command; Focus centers a card for reading. Find Card and searchable Outline provide shortcuts. **First / Latest** actions navigate directly to the oldest available or newest turn without traversing the full horizontal graph.
- Return-to-source closes the overlay and scrolls the native ChatGPT message into view.
- Overview zoom is for topology. At unreadable zoom, Focus is the preferred reading surface.
- Persist user-moved card positions by ChatGPT conversation route. Do not persist answer/prompt text or call layout data a conversation backup.
- **Historic chat backfill:** after opening an existing conversation, progressively scan the *native conversation scrollport* upward to the earliest loadable turn, then downward through virtualized rows, merging all observed turn IDs without network/private APIs. Previously positioned cards retain their coordinates when an older prefix appears; older nodes extend to the left without displacing current focus. Preserve old turns in temporary in-memory graph state even if ChatGPT virtualizes them away. Yield between scroll steps, cancel on route change/close, and restore the user's previous scroll offset. Never scroll the native sidebar or claim a complete archive if ChatGPT does not expose it.

## Composer behavior

**When no turns are visible, show one Start Card in the canvas**, not a separate modal or `0 turns` error page. It contains a real textarea and Send action, visually consistent with Dialogue cards. The Send action uses the **native ChatGPT composer and visible Send button** through a user-initiated DOM bridge. If no Send button is usable, hand off the prepared draft to the native composer; never fabricate a model response or silently discard the text. Existing native drafts must never be overwritten.

For existing turns, the **Compose in ChatGPT** action returns focus to the native editor. A fully featured adaptive gptdraw composer inside each active graph card is **future work**, not silently enabled; native model picker, microphone and attachments remain owned by ChatGPT.

## Reusable components / Beautiful UI

Use **Beautiful UI** (https://www.beautifului.dev/) for interaction references and selective source reuse when a real component is required, especially Chat, Prompt Bar, Streaming Text and Selection Actions. Source examples are React/Next.js/Tailwind and may include demo data and animations; **do not transplant those into the low-level content script as fake components**. Current reusable primitives are the project-owned SVG icon/control API under `src/components/ui/` and the Dialogue card/canvas compositions.

Any adoption of upstream Beautiful UI source must preserve license, document dependencies, remove demo content and animation timing, and be explicitly validated for extension performance. Do not claim the original upstream React components are installed unless they actually are.

## Interaction/accessibility/performance acceptance

- A current ChatGPT conversation opens as connected prompt+answer cards without another login or API key. `data-turn` on conversation wrappers must be checked before fallback role descendants; unsupported variants must be reported as undetected rather than inventing text.
- Streaming updates update only the affected response node; no page-wide DOM scan for every token and no synthetic word-by-word animation. The full graph is not reconciled when a backfill scan finds no new text.
- **Motion:** subtle ~140–150ms entrance, hover and focus transitions. No animated CSS transforms while dragging, zooming, or streaming. Respect `prefers-reduced-motion`.
- Close/reopen restores a live native ChatGPT session and saved card positions; no message capture to extension storage.
- Unsupported UI states are omitted, not represented as working controls.
- Keyboard Escape closes; source/compose buttons have real native actions; explicit Zoom/Fit controls support non-pointer navigation.
- Test browser widths 320/360/768/desktop, light/dark, long prompt and response, 3/50+ turns, selection vs drag, reduced motion and SPA route transitions.
- Prefer `textContent` over injecting raw ChatGPT HTML. Never move native React-owned messages or modify hidden app state.

If a design change alters product behavior, update this contract intentionally before shipping.

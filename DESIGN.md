# DESIGN.md — gptdraw design contract

## Product identity

**ChatGPT remains the AI runtime. gptdraw is its spatial interface.** The design must remain an extension overlay over the native website, with no invented provider status or hidden conversation context.

User journey: **open existing ChatGPT conversation → toggle Graph → read one prompt+answer card → explore connected turns → return to the exact native source → continue composing in ChatGPT**.

One graph card = one user turn + its following assistant response (which may still be empty/streaming). The initial implementation shows a **sequential conversation spine**, not true fork lineage. Fork is future work requiring a verified native action.

## Visual system

- **Tone:** clean, calm, compact, neutral-first, technically credible. Avoid glass saturation, badges for static metadata, decorative dashboard chrome and animation-per-token.
- **Fonts:** system UI (Apple SF Pro / Windows Segoe UI), mono SF Mono / Consolas / Liberation Mono / Menlo. No bundled fonts.
- **Text sizes/line height:** 12/16 meta, 14/20 UI, 16/24 body, 18/24 title, 20/28 large title, 28/34 page title, 36/40 display. Weights 400/500/600.
- **Spacing scale:** 4/8/12/16/20/24/32px. No arbitrary page rhythm values.
- **Colors:** background `#FCFCF8`; white card; ink `#252525`; gray `#737984`; neutral border `#E5E7EB`; accent `#9BB1FF`; user bubble `#EEF2FF`. Dark semantic equivalents, no flashing theme switch.
- **Controls:** compact rounded pills, real SVG/Lucide-style icons with accessible names; floating canvas controls use restrained shadow.

The implemented token owner is `src/app/workspace.css`. It imports **Tailwind CSS v4 at build time**, using reusable component CSS and a Shadow DOM-specific variable scope. Tailwind does not ship as a runtime compiler. The host ChatGPT CSS must not style extension UI, and extension CSS must not style host content.

## Chat Card (approved Dialogue direction)

- **User prompt on right**, softly tinted rounded bubble.
- **Assistant answer on left**, not an extra bubble, no user/AI avatars.
- Header carries short turn identity and native source/focus actions, not duplicate explanatory status.
- Content stays text-first; no fake sources, thinking steps, model actions or attachment indicators.
- Pending assistant turns show an honest waiting state.
- Stable DOM node identity: never replace the entire card on every streaming token.
- Content formatting: first slice projects **plain text only** from safe `textContent`. Rich code/Markdown/citations require audited native DOM extraction and separate supported rendering, not unsafe `innerHTML`.

## Conversation canvas

- Nodes represent consecutive visible turn pairs in one ChatGPT conversation.
- Edges in the first slice are a **sequential reading path**, not confirmed native branch relationships.
- Pan the empty canvas; move nodes by dragging the **header only**. Text selection, links, buttons and internal scroll do not initiate canvas dragging.
- Ctrl/Cmd+wheel or explicit zoom controls adjust viewport; Fit shows detected cards; Focus centers a card for reading.
- Return-to-source closes the overlay and scrolls the native ChatGPT message into view.
- Overview zoom is for topology. At unreadable zoom, Focus is the preferred reading surface.
- Persist user-moved card positions by ChatGPT conversation route. Do not persist answer/prompt text or call layout data a conversation backup.

## Composer behavior

The **native ChatGPT composer is the currently implemented input**. The extension has a real **Compose in ChatGPT** action that closes its overlay and focuses the website's native composer when discoverable.

The approved future **adaptive gptdraw composer** (compact one-line pill → textarea+bottom toolbar when multiline/attachment) is a design direction, **not part of slice 01**. Only introduce it once a supported/verified bridge to the native ChatGPT composer exists; otherwise it would fake submission. No native model picker, fake microphone or mock attachments.

## Reusable components / Beautiful UI

Use **Beautiful UI** (https://www.beautifului.dev/) for interaction references and selective source reuse when a real component is required, especially Chat, Prompt Bar, Streaming Text and Selection Actions. Source examples are React/Next.js/Tailwind and may include demo data and animations; **do not transplant those into the low-level content script as fake components**. Current reusable primitives are the project-owned SVG icon/control API under `src/components/ui/` and the Dialogue card/canvas compositions.

Any adoption of upstream Beautiful UI source must preserve license, document dependencies, remove demo content and animation timing, and be explicitly validated for extension performance. Do not claim the original upstream React components are installed unless they actually are.

## Interaction/accessibility/performance acceptance

- A current ChatGPT conversation opens as connected prompt+answer cards without another login or API key.
- Streaming updates update only the affected response node; no page-wide DOM scan for every token and no synthetic word-by-word animation.
- Close/reopen restores a live native ChatGPT session and saved card positions; no message capture to extension storage.
- Unsupported UI states are omitted, not represented as working controls.
- Keyboard Escape closes; source/compose buttons have real native actions; explicit Zoom/Fit controls support non-pointer navigation.
- Test browser widths 320/360/768/desktop, light/dark, long prompt and response, 3/50+ turns, selection vs drag, reduced motion and SPA route transitions.
- Prefer `textContent` over injecting raw ChatGPT HTML. Never move native React-owned messages or modify hidden app state.

If a design change alters product behavior, update this contract intentionally before shipping.

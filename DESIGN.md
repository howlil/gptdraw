# DESIGN.md — gptdraw Design Contract

Status: **canonical UI/design-system contract**. Read with [.agents/product-design.md](.agents/product-design.md) for research and interaction decisions. Approved UI rules are binding; measurements and untested behavior remain hypotheses.

## 1. Product north star

**Chat first. Graph second.** gptdraw is a spatial conversation workspace, not a flowchart populated with chat widgets. People must be able to: ask → read → select an answer passage → fork → compare paths → return to source.

**One card = one user turn and one assistant response**. A follow-up is a **new connected card**, never a second message appended inside its parent card.

Principles:
- Content density over decorative metadata; remove redundant headings, explanatory badges, “response ready”, “original prompt”, generic info panels and unnecessary card chrome.
- Calm, compact, minimal, tactile only where it improves interaction. White/off-white neutral surfaces, subtle boundaries and optional subtle glass **for floating overlays**, not body content.
- Use **real icons** (consistent Lucide or equivalent SVG set), not emoji, fake glyphs or ornamental avatars.
- Interaction hierarchy: reading is primary; card actions are secondary; spatial topology is tertiary.
- Progressive disclosure: show only controls with a reason to exist for this state.
- All new designs: **interactive preview first**, inspect at desktop and narrow widths; screenshots alone do not validate interaction.

## 2. Typography and spacing tokens

Fonts:
- Sans: system UI; macOS/iOS SF Pro, Windows Segoe UI, fallback system sans-serif.
- Mono: SF Mono when available; Consolas / Liberation Mono / Menlo fallback.
- No font files committed solely to enforce a platform font.

| Role | Font size / line-height (px) | Weight |
| --- | --- | --- |
| Metadata | 12 / 16 | 400–500 |
| Control / UI | 14 / 20 | 400–500 |
| Body | 16 / 24 | 400 |
| Small title | 18 / 24 | 600 |
| Large title | 20 / 28 | 600 |
| Page title | 28 / 34 | 600 |
| Display | 36 / 40 | 600 |

Spacing scale: **4, 8, 12, 16, 20, 24, 32px**. Favor a 4px rhythm and avoid arbitrary gaps. Prototype cards may use 13–14px for dense samples; production reading text at focused scale should normally be 14–16px **before zoom**, and must remain comfortably readable after zoom.

## 3. Color and material contract

Visual intent is howlil-style **neutral-first / lavender-blue interaction accent**, not saturated full-card blue.

Suggested initial **design tokens** (starting palette, verify actual contrast in light/dark modes):

| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| `--bg` | `#FCFCF8` | `#0C0D10` | Workspace/page |
| `--surface` | `#FFFFFF` | `#17191D` | Chat card |
| `--surface-subtle` | `#F7F8FA` | `#22252A` | Input/hover/context |
| `--text` | `#252525` | `#F4F5F7` | Primary text |
| `--text-muted` | `#6B7079` | `#AAB0BA` | Secondary |
| `--border` | `#E5E7EB` | `#343840` | Subtle separators |
| `--accent` | `#9BB1FF` | `#9BB1FF` | Focus, selection, branch path |
| `--accent-soft` | `#EEF2FF` | `#242D45` | User prompt bubble |

Rules:
- Accent is **meaningful**, not background decoration. A primary action may use it, but check button text contrast; **do not use white text on light lavender without verifying contrast**. Prefer dark label on lavender or a stronger accessible action color.
- User message: **right-aligned softly tinted bubble**; AI response: **left-aligned unboxed text**.
- No user/assistant avatar or status emoji. If an icon is necessary for a real affordance, keep its stroke/size consistent.
- Light/dark use the same semantic tokens. Avoid theme flicker and implicit OS-theme overrides after a user preference is chosen.
- Shadows extremely restrained (prefer border); backdrop blur/glass reserved for hovering popovers/floating canvas controls.

## 4. Chat card anatomy

```text
┌─────────  02  ·  Source link  ────────── [collapse] ┐
│                                     User prompt     │
│                         [soft tinted right bubble]  │
│                                                      │
│ AI response (left, no avatar, no forced bubble)      │
│ [Optional thinking summary during/after streaming]  │
│ Paragraphs · headings · lists · code · tables        │
│ [Optional citations, tool results, attachments]      │
│                                                      │
│ [Copy]   [Retry if valid]   [Fork]   [Continue]      │
│                                                      │
│ (+)  Ask a follow-up ...      [mode]  [Send]          │
└──────────────────────────────────────────────────────┘
```

Card header: keep minimal sequence number, parent/source navigation when present, collapse/focus. No redundant “root”, “AI response ready”, “source preserved” explanations.

**States**:
- Overview/collapsed: question and short answer excerpt with connected edges. **No composer**.
- Default: readable question + AI answer; minimal footer, composer only on active card.
- Focused: increased width, typography and reading comfort.
- Expanded: long-form code/table/attachments with horizontal overflow handled within content, not the whole page.
- Pending/streaming/error/retry: visible, accurate system state; avoid fabricated thinking summaries.

Width hypotheses to validate, not immutable constants:
- Collapsed ~280px.
- Canvas default ~360–420px.
- Focused ~520–560px.
- Long-form up to ~720px or side reading panel.

**If zoom makes card text too small, switch to overview display**, don't force users to read a shrunk 12px body font. Canvas is for scanning; focused state is for reading.

## 5. AI-native content renderer

Render content by structured response blocks, not by assuming one concatenated string:

- Text/Markdown (headings, links, ordered/unordered lists, inline code).
- Code with syntax coloring, wrap or isolated horizontal scroll, and real Copy.
- Tables, images/files, citations with actionable URLs, relevant tool results.
- Thinking **only if the integration provides a displayable summary/status**. Never invent private reasoning or fabricate tool output.
- Sources only when there are actual sources. Retry only on valid retriable errors; show errors clearly.
- Rich output can be isolated from the conversation graph UI without changing the parent-child model.

Do not show decorative components merely because Beautiful UI / AI Elements offers them.

## 6. Adaptive composer: explicit behavior

Default = **compact one-line pill** modeled on the approved screenshot:
- Left: **+** attachment/context menu (only functioning options).
- Middle: text input.
- Right: actual model/mode picker if connected, microphone only if supported, Send arrow.
- Use a real textarea for composition; Enter to submit only if chosen by UX, Shift+Enter newline, Ctrl/Cmd+Enter shortcut. Avoid intercepting IME composition.

Expand **when content wraps, contains explicit newline, or includes an attachment**; do not rely only on a hardcoded character threshold. Expanded state stacks attachment previews and textarea above a pinned bottom toolbar.
- Attachment thumbnails with remove control; accessible file names, size/type validation.
- Empty Send is disabled; failures keep the draft and show actionable error; sending must not silently drop files.
- Preserve per-node drafts during pan, zoom, card selection, collapse and re-render.
- A collapsed node has no active composer, and only one composer is prominent at a time.
- If a control is a stub (voice, file upload, model choice), remove/disable it with an explicit reason rather than faking success.

## 7. Branching UX and provenance

**Continue**: new child card connected to current card, inheriting the ordered ancestor conversation path through the parent.

**Fork response**: new child card, parent pointer, optional stable source block anchor.

**Fork selected text**: selection toolbar with Fork (and optional Explain/Copy) after text selection. Store a **stable block ID**, exact selected quote and validated offsets/range if available, not merely an array index. Always display the source link so people can navigate to the parent and highlight the source.

- A selection action must preserve the selection until the user performs it; re-rendering cannot lose its provenance.
- The default fork **preserves complete ancestor lineage** while highlighting the selected source. Restricting context to the selection is an explicit different mode, not an accidental truncation.
- Active lineage edges highlighted by accent. Other edges remain neutral.
- Follow-up cards position near the source and do not overlap. Manual position overrides auto-layout.
- Parent-child graph remains a **tree** in the first version. Multi-parent merge is deferred and requires a separate specification.

## 8. Canvas interaction contract

- Pan blank canvas, drag **card header only**; scroll/drag/select inside response, input and menus must never move the canvas.
- Zoom centered on cursor/viewport; fit content, center selected card, search/outline with accurate navigation.
- Keyboard and touch equivalents for actions that would otherwise require drag. Visible focus and escape/close affordances.
- Overview vs focus must be intentional, not an accidental CSS zoom.
- Zoom and node dragging cannot reset drafts, selection, response scroll, or stream state.
- Dynamic source handles and paths update when nodes resize/collapse or sections stream in.
- No arbitrary finite-canvas clipping: large workspaces should remain navigable and performant.
- Avoid persistent per-paragraph Fork controls on every non-active card; show contextual affordance or selection toolbar to limit noise.

## 9. Responsiveness and accessibility

- Desktop graph can pan and spatially explore multiple card branches.
- Narrow/mobile: prioritize **focused single-card reading and outline/list navigation**; graph remains optional or zoomed overview.
- Support keyboard focus, logical tab order, aria-expanded, accessible labels, Escape close, touch targets ~40–44px and prefers-reduced-motion.
- Selection/fork must work without mouse; allow a card-level Fork fallback.
- Test: 320/360px, 768px, desktop; light/dark; short/long response; code and table; very long prompt, attachments, streaming/error; 3 vs 50+ nodes.

## 10. Design review checklist

1. Does each visible component help reading, branching, composing, or navigating?
2. One node still equals one user prompt + assistant response?
3. Correct right-user / left-assistant layout without decorative avatars?
4. Composer compact until content truly requires expansion?
5. Are branch anchor, parent context and source navigation unambiguous?
6. Does selecting text / typing inside a card avoid canvas dragging?
7. Readable at actual viewport scale? Keyboard + mobile + dark mode?
8. Is model/tool/source state real rather than demo-fabricated?
9. Were alternate layouts previewed **interactively** and inspected before implementation?
10. Were screenshot comparisons and behavior tests performed against this contract?

If a feature conflicts with this document, update the design decision explicitly before implementation; don't silently drift.

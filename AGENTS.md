# AGENTS.md — gptdraw

Repository-wide agent instructions. **Root AGENTS.md and DESIGN.md are authoritative**, while `.agents/` contains working engineering/product documents, **not installable SKILL.md files**. No duplicated docs/ hierarchy.

## Source of truth

1. Current user request and accepted product decisions.
2. Observed ChatGPT DOM and current repository code/tests. A selector guess or design prototype is not observed production behavior.
3. [DESIGN.md](DESIGN.md) for UI/interaction rules.
4. [.agents/engineering-design.md](.agents/engineering-design.md) for module ownership, runtime and performance contracts.
5. [.agents/product-design.md](.agents/product-design.md) for approved UX decisions, open questions and acceptance criteria.

Read actual source before asserting supported features. Do not claim that DOM-rendered messages provide hidden model context.

## Product and platform — immutable until user changes direction

**gptdraw is a Chrome MV3 extension that projects the ChatGPT conversation already open in the browser into a branching/spatial canvas.** ChatGPT owns the conversation, model, user session, native composer, streaming and any native branching. gptdraw owns its overlay, DOM adapter, graph projection, navigation and local layout metadata.

- **No OpenAI API key, model gateway, ChatGPT undocumented API, session scraping or account login recreation.**
- DOM access happens in an **isolated content script**, observing the real visible conversation. Never move, remove or monkey-patch React-owned ChatGPT message nodes.
- Model messages are not copied into extension storage. Layout only (route-specific positions) is stored locally.
- An action is enabled only if its native ChatGPT DOM target actually exists and has been verified. No fake Fork, attachment, model selection, sources or thinking.
- Canvas preserves the approved Dialogue design: right user bubble / left assistant content / no avatars. One graph card equals one user prompt and the following assistant response.

## Routing

| Work | Read |
| --- | --- |
| UI, card, interaction, reusable components, responsiveness | DESIGN.md → .agents/product-design.md |
| Selector compatibility, observation, graph semantics, performance, test architecture | .agents/engineering-design.md |
| Both behavior and UI | Both files, implement within one existing owner |
| Docs/copy or local low-risk correction | Direct change; no unnecessary skill/document creation |

## SWE workflow

**UNDERSTAND → OBSERVABLE OUTCOME → SMALLEST OWNER → TEST THE REAL RISK → IMPLEMENT → VERIFY → DIFF → STOP**

- Inspect the actual tree, browser contract and current Git state before changes.
- Map a user action to DOM → observer → projection/controller → component → persisted layout. Identify trust/performance boundaries and failure states.
- Develop **vertical slices**: one real ChatGPT task end-to-end, not domain/UI/gateway layers developed horizontally.
- **New code goes to its defined owner on day one**. Do not introduce temporary root files with a promised future refactor.
- Only add abstraction when a behavior boundary, dependency direction or real reuse requires it.
- Do not refactor, rename or relocate unrelated working modules unless user explicitly requests it.
- Test-first for actual business invariants or DOM regressions. Do not force tests for copy/docs/CSS-only edits.
- For DOM integration, include fixtures for currently observed selectors, mutation batching and SPA navigation/reopen.
- Verify `npm run test`, `npm run build` and Chrome Load unpacked manual smoke tests when relevant. Do not call a CI-only test a real Chrome smoke test.
- Before completion: inspect diff, report actual evidence and remaining gaps, then stop.

## Runtime and boundary rules

- Build-time: Tailwind CSS v4 + esbuild. **No Tailwind CDN, remote JS, runtime compiler, webpack-sized default scaffolding or unneeded animation libraries.**
- Runtime: Chrome MV3 content script + isolated **Shadow DOM** overlay. The React-owned ChatGPT DOM is read-only.
- Permanent owner: `src/modules/conversation-workspace/`:
  - `core/` pure projection/identity and deterministic rules;
  - `adapters/` ChatGPT DOM observation and Chrome metadata persistence;
  - `controller/` in-memory projection and state coordination;
  - `components/` spatial UI and chat cards.
- App entry: `src/content/main.mjs`. Generic reusable primitives: `src/components/ui/`. Extension toolbar entry: `src/extension/background.js`.
- **Do not recreate** `extension/gateway-server.mjs`, `adapters/gateway.mjs`, `adapters/assistant.mjs`, or provider API keys/transport.
- Use Beautiful UI **only for components that can be adapted to real ChatGPT-derived data without demo-only fake state**. Source reference: https://www.beautifului.dev/ . Reuse Tailwind patterns/primitive ownership, not its unrelated showcase runtime.

## Risk-based verification

| Change | Evidence |
| --- | --- |
| Product copy, tokens, docs | Inspect changed surface and token parity |
| Turn pairing, stable IDs, source navigation | Unit/fixture tests + DOM smoke test |
| DOM selectors, streaming | Browser fixture + MutationObserver batching, no full scan per token |
| Graph drag/pan/zoom, route layout | Interaction and persistence test + manual Chrome visual review |
| Chrome permissions, injection, security | Manifest/Shadow DOM/host boundary review |
| Build scripts/dependencies | Reproducible install, tests, production bundle and syntax checks |

**Git workflow:** default branch `master`; write only requested changes, preserve unrelated work, verify remote files and passing latest CI. Do not open PR or add planning artifacts as ceremony.

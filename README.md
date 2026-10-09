# gptdraw

**Chrome Manifest V3 extension for AI-native branching conversation cards.**

gptdraw launches a full-screen conversation canvas **from ChatGPT**. It does not scrape ChatGPT, read current-page messages, reuse the ChatGPT account session, or access undocumented ChatGPT endpoints. Actual model responses are streamed from the **official OpenAI Responses API**, through a separate loopback gateway that keeps the OpenAI API key server-side.

## Implementation status

**Vertical slice 01 is implemented in source:** launch from ChatGPT → create a root prompt → stream an AI response → persist the card in Chrome extension storage → reload → recover the conversation. Gateway pairing, interruption recovery, retry and basic native canvas pan/zoom/drag are included.

**Not yet implemented:** Fork/Continue, graph edges between branches, anchored selections, arbitrary attachments, rich Markdown/code/table rendering, cloud sync or an installed end-user service. A live OpenAI call requires a real API key and a running gateway; automated integration tests use a fake upstream and do **not** prove a real model response occurred.

## Quick start

Requirements: Chrome/Chromium with Manifest V3 support and Node.js 22+ installed locally. No npm dependencies, bundler, or build step required for the extension.

1. Clone the repository: `git clone https://github.com/howlil/gptdraw.git`.
2. Start the AI gateway **with a real API key set only in the local server process**:
   - macOS/Linux: `OPENAI_API_KEY=your_key npm run gateway`
   - Windows PowerShell: `$env:OPENAI_API_KEY="your_key"; npm run gateway`
   - Optional model override: `OPENAI_MODEL` (default `gpt-4.1-mini`).
3. The gateway binds to **127.0.0.1:8787** and prints a fresh **pairing token**. This is *not* your OpenAI key.
4. Open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the **repository root** (the folder containing `manifest.json`).
5. Visit [chatgpt.com](https://chatgpt.com), click **Graph** at top-right (or click the extension toolbar icon to open the canvas in a new tab).
6. Enter the printed pairing token. Write a question and press Enter/Send. Streaming content is persisted in `chrome.storage.local`. Refresh the page or reopen the workspace to recover the card.

If gateway is stopped, start it again and enter the new pairing token (unless `GPTDRAW_PAIR_TOKEN` was configured explicitly). A disconnected/incomplete generation is shown as **failed** with Retry, not as a fabricated complete response.

**Important:** OpenAI API usage and billing are separate from ChatGPT subscriptions. The browser extension never receives `OPENAI_API_KEY`. The gateway pairing token is stored only in trusted extension storage and cannot be used as an OpenAI API key. It is a local development pairing mechanism, **not** production multi-user authentication. Deploying a remote gateway needs dedicated authentication, per-user authorization, rate limits and abuse protection.

## Runtime/data flow

```text
ChatGPT page
  └── extension/launcher.js (button only, no ChatGPT DOM extraction)
       └── extension/workspace.html (isolated extension-origin iframe)
            └── src/app/main.mjs
                 └── src/modules/conversation-workspace/
                      ├── ConversationWorkspace.mjs (composition)
                      ├── core/ (turn invariants + SSE parser)
                      ├── controller/ (workspace state, streaming lifecycle)
                      ├── components/ (Dialogue card, adaptive composer, native canvas)
                      └── adapters/ (chrome.storage.local, port transport, local gateway)
                           ⇅ chrome.runtime Port
                 extension/background.mjs (trusted fetch/pairing token)
                           ⇅ localhost bearer-auth gateway
                 extension/gateway-server.mjs (process env OPENAI_API_KEY)
                           ⇅ official OpenAI Responses API
```

Canonical conversation data lives in the conversation workspace domain/controller, not the canvas. Positions are presentation projections in the stored node snapshot. The currently supported domain shape is **root turns only**; future Fork must add validated parent lineage, immutable response revisions and source-block anchors without moving these owners.

## Tests and verification

Run `npm test` or `node --test tests/*.test.mjs`. Tests cover root lifecycle, stable IDs, persistence/reload, interrupted request recovery, retry, provider-normalized SSE stream with mock upstream, and rejecting unauthorized/invalid gateway requests. GitHub Actions performs Node 22 tests and syntax checks on push.

Current automated test scope **does not cover real Chrome extension installation, visual layout, full extension↔gateway streaming, or a live OpenAI request**. Those require a manual Chromium/real-key smoke test.

## Agent instructions

- [AGENTS.md](AGENTS.md) — repo-wide routing, smallest correct change, vertical slices.
- [DESIGN.md](DESIGN.md) — canonical user/AI chat card, adaptive composer and visual system.
- [.agents/product-design.md](.agents/product-design.md) — product decisions and UX acceptance.
- [.agents/engineering-design.md](.agents/engineering-design.md) — implemented extension boundaries, invariants and ownership.

**One conversation workspace owner.** No speculative feature folders, skill scaffolds or duplicate docs.

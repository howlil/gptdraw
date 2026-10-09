import { createServer } from 'node:http';
import { consumeSSE } from '../core/sse.mjs';

export function createGateway({ token, apiKey, model = 'gpt-4.1-mini', upstreamFetch = fetch }) {
  if (!token || token.length < 16) throw new Error('A random 16+ character pairing token is required.');
  if (!apiKey) throw new Error('OPENAI_API_KEY must be configured on the local gateway.');
  return createServer(async (req, res) => {
    const origin = req.headers.origin;
    // Browser pages are not authorized callers; service worker fetches can omit Origin.
    if (origin && !/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) {
      res.writeHead(403).end('Forbidden origin'); return;
    }
    if (req.headers.authorization !== 'Bearer ' + token) {
      res.writeHead(401, { 'Content-Type': 'application/json' }).end('{"error":"Pairing required"}'); return;
    }
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        .end(JSON.stringify({ ready: true, model }));
      return;
    }
    if (req.url !== '/responses' || req.method !== 'POST') {
      res.writeHead(404).end(); return;
    }
    const controller = new AbortController();
    res.on('close', () => controller.abort());
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString('utf8');
        if (Buffer.byteLength(body) > 65536) {
          res.writeHead(413).end('Request too large'); return;
        }
      }
      const payload = JSON.parse(body);
      const input = payload.messages;
      if (!Array.isArray(input) || input.length < 1 || input.length > 40 ||
        !input.every(m => ['user', 'assistant'].includes(m?.role)
          && typeof m.content === 'string' && m.content.length > 0 && m.content.length <= 12000) ||
        input.reduce((n, m) => n + m.content.length, 0) > 48000) {
        res.writeHead(400).end('Invalid messages'); return;
      }
      const upstream = await upstreamFetch('https://api.openai.com/v1/responses', {
        method: 'POST', signal: controller.signal,
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input, stream: true, store: false })
      });
      if (!upstream.ok) {
        res.writeHead(502, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ error: 'AI provider returned HTTP ' + upstream.status }));
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      const write = event => { if (!res.destroyed) res.write('data: ' + JSON.stringify(event) + '\n\n'); };
      let completed = false;
      await consumeSSE(upstream.body, event => {
        if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
          write({ type: 'delta', text: event.delta });
        } else if (event.type === 'response.completed') {
          completed = true; write({ type: 'done' });
        } else if (event.type === 'response.failed' || event.type === 'error') {
          write({ type: 'error', message: 'AI generation failed.' });
        }
      }, controller.signal);
      if (!completed) write({ type: 'error', message: 'AI stream ended before completion.' });
      res.end();
    } catch (error) {
      if (controller.signal.aborted) return;
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
      const message = error instanceof SyntaxError ? 'Invalid JSON request.' : 'Gateway request failed.';
      if (res.headersSent && res.getHeader('Content-Type')?.startsWith('text/event-stream'))
        res.end('data: ' + JSON.stringify({ type: 'error', message }) + '\n\n');
      else res.end(JSON.stringify({ error: message }));
    }
  });
}

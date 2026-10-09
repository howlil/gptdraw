// Local development gateway. Never copy OPENAI_API_KEY into extension storage.
import { randomBytes } from 'node:crypto';
import { createGateway } from '../src/modules/conversation-workspace/adapters/gateway.mjs';

const token = process.env.GPTDRAW_PAIR_TOKEN || randomBytes(24).toString('hex');
const server = createGateway({
  token, apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL || 'gpt-4.1-mini'
});
server.listen(8787, '127.0.0.1', () => {
  console.log('gptdraw gateway listening on http://127.0.0.1:8787');
  console.log('Pairing token (enter once in extension): ' + token);
  console.log('OpenAI API key remains in this local server process.');
});

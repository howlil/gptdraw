// Stream-safe SSE parsing shared by the gateway and extension background.
export async function consumeSSE(stream, onEvent, signal) {
  if (!stream) throw new Error('Missing response stream.');
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  try {
    while (true) {
      if (signal?.aborted) throw new Error('Request cancelled.');
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = pending.indexOf('\n\n')) >= 0) {
        const frame = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        const data = frame.split('\n').filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trimStart()).join('\n');
        if (data && data !== '[DONE]') onEvent(JSON.parse(data));
      }
      if (pending.length > 256000) throw new Error('Oversized SSE frame.');
    }
    pending += decoder.decode();
    const remainder = pending.trim();
    if (remainder) {
      const data = remainder.split('\n').filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart()).join('\n');
      if (data && data !== '[DONE]') onEvent(JSON.parse(data));
    }
  } finally {
    reader.releaseLock();
  }
}

// Smoke-test for /api/chat. Streams the response and prints chunks.
// Usage: node scripts/smoke-chat.mjs "Your French question here"

const prompt =
  process.argv[2] ??
  'Bonjour Diabo, en une phrase, qui es-tu et comment peux-tu m\'aider ?';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';

const body = JSON.stringify({
  messages: [
    {
      id: 'm1',
      role: 'user',
      parts: [{ type: 'text', text: prompt }],
    },
  ],
});

console.log(`POST ${baseUrl}/api/chat ...`);
console.log('Prompt:', prompt);
const start = Date.now();
const res = await fetch(`${baseUrl}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body,
});
console.log('Status:', res.status);
console.log('Cookie:', res.headers.get('set-cookie'));
console.log('Content-Type:', res.headers.get('content-type'));

if (!res.body) {
  console.log('NO BODY');
  process.exit(1);
}
const reader = res.body.getReader();
const dec = new TextDecoder();
let full = '';
let chunks = 0;
let textOnly = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const text = dec.decode(value, { stream: true });
  full += text;
  chunks++;
  if (chunks <= 3) {
    console.log(`chunk ${chunks}:`, text.slice(0, 200).replace(/\n/g, '\\n'));
  }
  // Crude text extraction from the UI message stream protocol.
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        const evt = JSON.parse(line.slice(6));
        if (evt.type === 'text-delta' && typeof evt.delta === 'string') {
          textOnly += evt.delta;
        }
        if (evt.type === 'text' && typeof evt.text === 'string') {
          textOnly += evt.text;
        }
      } catch {
        /* ignore */
      }
    }
  }
}

const elapsed = Date.now() - start;
console.log('---');
console.log(
  `Total chunks: ${chunks}, bytes: ${full.length}, elapsed: ${elapsed} ms`,
);
console.log('Extracted text:', textOnly || '(none extracted, raw body below)');
if (!textOnly) {
  console.log('Raw last 600 chars:', full.slice(-600));
}

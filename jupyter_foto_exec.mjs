/**
 * Executes Python code on the FOTO pod JupyterLab kernel via WebSocket.
 * Usage: node jupyter_foto_exec.mjs <kernel_id> <xsrf_token> <code_b64>
 */
import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

const [,, kernelId, xsrf, codeB64] = process.argv;
const code = Buffer.from(codeB64, 'base64').toString('utf8');

const wsUrl = `wss://mct7zo9ymeysy7-8888.proxy.runpod.net/api/kernels/${kernelId}/channels`;

let cookies = [];
try {
  const lines = readFileSync('c:\\tmp\\jupyter_foto_cookies.txt', 'utf8').split('\n');
  for (const line of lines) {
    if (line.startsWith('#') || !line.trim()) continue;
    const parts = line.split('\t');
    if (parts.length >= 7) cookies.push(`${parts[5]}=${parts[6].trim()}`);
  }
} catch {}

const ws = new WebSocket(wsUrl, {
  headers: {
    'Cookie': cookies.join('; '),
    'X-XSRFToken': xsrf,
  },
  rejectUnauthorized: false,
});

const msgId = randomUUID();
let done = false;

const timeout = setTimeout(() => {
  console.error('TIMEOUT after 180s');
  ws.close();
  process.exit(1);
}, 180000);

ws.on('open', () => {
  const msg = {
    header: {
      msg_id: msgId,
      msg_type: 'execute_request',
      username: '',
      session: randomUUID(),
      date: new Date().toISOString(),
      version: '5.3',
    },
    parent_header: {},
    metadata: {},
    content: {
      code,
      silent: false,
      store_history: false,
      user_expressions: {},
      allow_stdin: false,
    },
    channel: 'shell',
  };
  ws.send(JSON.stringify(msg));
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    const mt = msg.msg_type;
    if (mt === 'stream') {
      process.stdout.write(msg.content?.text ?? '');
    } else if (mt === 'execute_result' || mt === 'display_data') {
      const txt = msg.content?.data?.['text/plain'] ?? '';
      process.stdout.write(txt + '\n');
    } else if (mt === 'error') {
      console.error('KERNEL ERROR:', msg.content?.ename, msg.content?.evalue);
      console.error(msg.content?.traceback?.join('\n'));
    } else if (mt === 'execute_reply') {
      done = true;
      clearTimeout(timeout);
      const status = msg.content?.status;
      console.error(`\n[execute_reply] status=${status}`);
      ws.close();
      process.exit(status === 'ok' ? 0 : 1);
    }
  } catch {}
});

ws.on('error', (err) => {
  console.error('WS error:', err.message);
  process.exit(1);
});

ws.on('close', () => {
  if (!done) process.exit(1);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadClient(fetch, env = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../lib/comfyui/runpod-client.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, process: { env: { RUNPOD_API_KEY: 'test-key', ...env } }, fetch, Buffer, AbortSignal, console });
  return exports;
}

test('removed photo endpoint configuration resolves to the existing endpoint', () => {
  assert.equal(loadClient(null, { RUNPOD_FOTO_ENDPOINT_ID: 'eeqi251ru6qxf9' }).RUNPOD_FOTO_ENDPOINT, '6igeofbzrfl3vv');
  assert.equal(loadClient(null, { RUNPOD_FOTO_ENDPOINT_ID: 'custom-endpoint' }).RUNPOD_FOTO_ENDPOINT, 'custom-endpoint');
});

for (const status of [400, 401, 403, 404, 409, 422]) {
  test(`HTTP ${status} does not leave a photo processing forever`, async () => {
    const client = loadClient(async () => new Response('', { status }));
    const result = await client.checkRunpodJob('endpoint', 'job');
    assert.equal(result.status, 'failed');
    assert.match(result.error, new RegExp(String(status)));
  });
}

for (const status of [429, 500, 503]) {
  test(`temporary HTTP ${status} keeps the existing job without resubmitting`, async () => {
    const client = loadClient(async () => new Response('', { status }));
    assert.equal((await client.checkRunpodJob('endpoint', 'job')).status, 'pending');
  });
}

test('completed jobs require an image rather than remaining pending', async () => {
  const client = loadClient(async () => Response.json({ status: 'COMPLETED', output: { images: [] } }));
  const result = await client.checkRunpodJob('endpoint', 'job');
  assert.equal(result.status, 'failed');
  assert.match(result.error, /imagem/);
});

test('successful and legacy image outputs remain supported', async () => {
  for (const output of [{ images: [{ data: 'aW1hZ2U=' }] }, { status: 'success', message: 'aW1hZ2U=' }]) {
    const client = loadClient(async () => Response.json({ status: 'COMPLETED', output }));
    const result = await client.checkRunpodJob('endpoint', 'job');
    assert.equal(result.status, 'done');
    assert.equal(result.outputs[0], 'aW1hZ2U=');
  }
});

test('queued and running provider states are retained separately', async () => {
  for (const status of ['IN_QUEUE', 'IN_PROGRESS']) {
    const client = loadClient(async () => Response.json({ status }));
    const result = await client.checkRunpodJob('endpoint', 'job');
    assert.equal(result.status, 'pending');
    assert.equal(result.providerStatus, status);
  }
});

test('missing API key fails before downloading or submitting an image', async () => {
  let calls = 0;
  const client = loadClient(async () => { calls++; }, { RUNPOD_API_KEY: '' });
  await assert.rejects(client.submitRunpodJob('endpoint', {}, 'https://example.com/photo.png'), /chave/);
  assert.equal(calls, 0);
});

test('a submit response without a job ID cannot strand a database job', async () => {
  const client = loadClient(async url => url.endsWith('/run') ? Response.json({}) : new Response('image'));
  await assert.rejects(client.submitRunpodJob('endpoint', {}, 'https://example.com/photo.png'), /identificador/);
});

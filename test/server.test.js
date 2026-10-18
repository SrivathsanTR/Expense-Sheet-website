import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { createServer } from '../server.js';

test('static server serves the app and protects non-asset files', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'together-expenses-test-'));
  await mkdir(join(root, 'src'));
  await Promise.all([
    writeFile(join(root, 'index.html'), '<!doctype html><title>Test app</title>'),
    writeFile(join(root, 'src', 'app.js'), 'export const example = true;'),
    writeFile(join(root, 'src', 'styles.css'), 'body { color: black; }'),
    writeFile(join(root, 'README.md'), 'Private project notes'),
    writeFile(join(root, 'package.json'), '{"private":true}'),
  ]);
  const server = createServer({ root });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  });
  const port = server.address().port;
  const get = (path, method = 'GET') => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (part) => { body += part; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });

  await t.test('serves the home page with development and content-type headers', async () => {
    const result = await get('/');
    assert.equal(result.status, 200);
    assert.match(result.body, /Test app/);
    assert.equal(result.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.headers['x-content-type-options'], 'nosniff');
  });
  await t.test('serves JavaScript and CSS including cache-busting query strings', async () => {
    const script = await get('/src/app.js?v=1');
    const style = await get('/src/styles.css');
    assert.equal(script.status, 200);
    assert.equal(script.headers['content-type'], 'text/javascript; charset=utf-8');
    assert.equal(style.status, 200);
    assert.equal(style.headers['content-type'], 'text/css; charset=utf-8');
  });
  await t.test('HEAD returns headers without a response body', async () => {
    const result = await get('/index.html', 'HEAD');
    assert.equal(result.status, 200);
    assert.ok(Number(result.headers['content-length']) > 0);
    assert.equal(result.body, '');
  });
  await t.test('rejects writes and does not accept expense data', async () => {
    const result = await get('/src/app.js', 'POST');
    assert.equal(result.status, 405);
    assert.equal(result.headers.allow, 'GET, HEAD');
  });
  await t.test('rejects project files, missing assets, and traversal paths', async () => {
    for (const path of ['/README.md', '/package.json', '/server.js', '/src/missing.js',
      '/src/%2e%2e%2fREADME.md', '/src/..%5cserver.js', '/src/%00app.js']) {
      const result = await get(path);
      assert.equal(result.status, 404, path);
      assert.doesNotMatch(result.body, /Private project notes/);
    }
  });
  await t.test('rejects malformed encoding without crashing', async () => {
    assert.equal((await get('/src/%E0%A4%A')).status, 400);
    assert.equal((await get('/')).status, 200);
  });
});

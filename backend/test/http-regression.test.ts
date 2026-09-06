import assert from 'node:assert/strict';
import { test, after, before } from 'node:test';

process.env.NODE_ENV = 'test';

const { server } = await import('../src/server.js');

let baseUrl = '';

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server did not bind to a TCP port');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('unknown route returns 404 with request id and security headers', async () => {
  const response = await fetch(`${baseUrl}/does-not-exist`);
  assert.equal(response.status, 404);
  const body = await response.json() as { error: string; request_id: string };
  assert.equal(body.error, 'NOT_FOUND');
  assert.match(body.request_id, /^[0-9a-f-]{36}$/);
  assert.equal(response.headers.get('x-request-id'), body.request_id);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
});

test('malformed JSON returns 400 without touching the database', async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not-json',
  });
  assert.equal(response.status, 400);
  const body = await response.json() as { error: string; request_id: string };
  assert.equal(body.error, 'INVALID_JSON_BODY');
  assert.ok(body.request_id);
});

test('non-JSON body returns 415', async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'hello',
  });
  assert.equal(response.status, 415);
  const body = await response.json() as { error: string };
  assert.equal(body.error, 'UNSUPPORTED_MEDIA_TYPE');
});

test('oversized request returns 413', async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': '1000001',
    },
    body: '{}',
  });
  assert.equal(response.status, 413);
  const body = await response.json() as { error: string };
  assert.equal(body.error, 'BODY_TOO_LARGE');
});

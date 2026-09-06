import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NORMAL_SESSION_DAYS,
  REMEMBERED_SESSION_DAYS,
  createSessionToken,
  hashSessionToken,
  sessionCookieOptions,
  sessionExpiry,
} from '../src/auth/session.js';

test('session tokens are random 256-bit values', () => {
  const first = createSessionToken();
  const second = createSessionToken();
  assert.notEqual(first, second);
  assert.equal(Buffer.from(first, 'base64url').length, 32);
});

test('session token hashes are one-way SHA-256 hex values', () => {
  const token = createSessionToken();
  const hash = hashSessionToken(token);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, token);
});

test('normal and remembered session expiry use the approved durations', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(
    sessionExpiry(false, now).toISOString(),
    '2026-01-08T00:00:00.000Z',
  );
  assert.equal(
    sessionExpiry(true, now).toISOString(),
    '2026-01-31T00:00:00.000Z',
  );
  assert.equal(NORMAL_SESSION_DAYS, 7);
  assert.equal(REMEMBERED_SESSION_DAYS, 30);
});

test('production session cookie supports credentialed cross-origin frontend', () => {
  const expires = new Date('2026-01-08T00:00:00.000Z');
  const options = sessionCookieOptions(true, expires);
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, 'none');
  assert.equal(options.path, '/');
  assert.equal(options.expires, expires);
});

test('development session cookie remains SameSite=Lax', () => {
  const options = sessionCookieOptions(false, new Date('2026-01-08T00:00:00.000Z'));
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, false);
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.path, '/');
});

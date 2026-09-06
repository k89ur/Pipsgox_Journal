import test from 'node:test';
import assert from 'node:assert/strict';
import { isJsonContentType } from '../src/http/security.js';

test('accepts application/json with parameters', () => {
  assert.equal(isJsonContentType('application/json; charset=utf-8'), true);
});

test('rejects missing or non-JSON content types', () => {
  assert.equal(isJsonContentType(undefined), false);
  assert.equal(isJsonContentType('text/plain'), false);
});

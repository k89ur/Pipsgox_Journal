import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeEmail,
  validateDisplayName,
  validateEmail,
  validatePassword,
} from '../src/auth/validation.js';

test('normalizeEmail trims and lowercases email', () => {
  assert.equal(normalizeEmail('  Trader@Example.COM '), 'trader@example.com');
});

test('validateEmail accepts a basic valid email', () => {
  assert.equal(validateEmail('trader@example.com'), true);
  assert.equal(validateEmail('not-an-email'), false);
});

test('validatePassword enforces minimum length', () => {
  assert.equal(validatePassword('1234567'), false);
  assert.equal(validatePassword('12345678'), true);
});

test('validateDisplayName enforces 1-100 characters after trimming', () => {
  assert.equal(validateDisplayName(' Trader '), true);
  assert.equal(validateDisplayName('   '), false);
  assert.equal(validateDisplayName('a'.repeat(101)), false);
});

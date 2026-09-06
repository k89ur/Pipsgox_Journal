import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEntry,
  getEntry,
  updateEntry,
  deleteEntry,
} from '../src/journal/service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TRADE_ID = '33333333-3333-4333-8333-333333333333';

async function expectError(fn: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(fn, (error: unknown) => error instanceof Error && error.message === code);
}

test('journal creation validates required content', async () => {
  await expectError(
    () => createEntry(USER_ID, { content: '', entry_at: '2026-09-06T10:00:00Z' }),
    'INVALID_CONTENT',
  );
});

test('journal creation validates title and entry timestamp', async () => {
  await expectError(
    () => createEntry(USER_ID, { title: 42, content: 'Note', entry_at: '2026-09-06T10:00:00Z' }),
    'INVALID_TITLE',
  );
  await expectError(
    () => createEntry(USER_ID, { content: 'Note', entry_at: 'not-a-date' }),
    'INVALID_ENTRY_AT',
  );
});

test('journal creation validates linked trade id before database access', async () => {
  await expectError(
    () => createEntry(USER_ID, { trade_id: 'not-a-trade-id', content: 'Note', entry_at: '2026-09-06T10:00:00Z' }),
    'INVALID_TRADE_ID',
  );
});

test('journal reads and deletes reject malformed entry ids without database access', async () => {
  assert.equal(await getEntry(USER_ID, 'not-an-entry-id'), null);
  assert.equal(await deleteEntry(USER_ID, 'not-an-entry-id'), false);
});

test('journal updates require at least one supported field', async () => {
  await expectError(
    () => updateEntry(USER_ID, '44444444-4444-4444-8444-444444444444', {}),
    'NO_FIELDS',
  );
});

test('journal update validates fields before database access', async () => {
  await expectError(
    () => updateEntry(USER_ID, '44444444-4444-4444-8444-444444444444', { trade_id: TRADE_ID, content: '' }),
    'INVALID_CONTENT',
  );
  await expectError(
    () => updateEntry(USER_ID, '44444444-4444-4444-8444-444444444444', { entry_at: 'bad' }),
    'INVALID_ENTRY_AT',
  );
});

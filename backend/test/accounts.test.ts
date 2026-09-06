import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTradingAccount,
  getTradingAccount,
  updateTradingAccount,
  deleteTradingAccount,
} from '../src/accounts/service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';

async function expectError(fn: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(fn, (error: unknown) => error instanceof Error && error.message === code);
}

test('account creation rejects an invalid user id before database access', async () => {
  await expectError(
    () => createTradingAccount('not-a-user-id', { name: 'Trading', baseCurrency: 'INR' }),
    'UNAUTHENTICATED',
  );
});

test('account creation validates required fields', async () => {
  await expectError(
    () => createTradingAccount(USER_ID, { name: '', baseCurrency: 'INR' }),
    'INVALID_NAME',
  );
  await expectError(
    () => createTradingAccount(USER_ID, { name: 'Trading', baseCurrency: 'US' }),
    'INVALID_CURRENCY',
  );
});

test('account creation rejects malformed currency before database access', async () => {
  await expectError(
    () => createTradingAccount(USER_ID, { name: 'Trading', baseCurrency: 'US1' }),
    'INVALID_CURRENCY',
  );
});

test('account reads reject malformed ids without database access', async () => {
  assert.equal(await getTradingAccount(USER_ID, 'not-an-account-id'), null);
  assert.equal(await getTradingAccount(OTHER_USER_ID, 'not-an-account-id'), null);
});

test('account updates require at least one supported field', async () => {
  await expectError(
    () => updateTradingAccount(USER_ID, '33333333-3333-4333-8333-333333333333', {}),
    'NO_FIELDS',
  );
});

test('account updates validate active flag and currency', async () => {
  const accountId = '33333333-3333-4333-8333-333333333333';
  await expectError(
    () => updateTradingAccount(USER_ID, accountId, { is_active: 'false' }),
    'INVALID_ACTIVE_FLAG',
  );
  await expectError(
    () => updateTradingAccount(USER_ID, accountId, { base_currency: 'INVALID' }),
    'INVALID_CURRENCY',
  );
});

test('account deletion rejects malformed ids without database access', async () => {
  assert.equal(await deleteTradingAccount(USER_ID, 'not-an-account-id'), false);
});

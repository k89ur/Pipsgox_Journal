import test from 'node:test';
import assert from 'node:assert/strict';
import { createTradingTrade, getTradingTrade, getTradingTrades } from '../src/trades/service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_ID = '33333333-3333-4333-8333-333333333333';

async function expectError(fn: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(fn, (error: unknown) => error instanceof Error && error.message === code);
}

test('trade creation rejects invalid user id', async () => {
  await expectError(
    () => createTradingTrade('bad', { trading_account_id: ACCOUNT_ID, symbol: 'RELIANCE', direction: 'long' }),
    'UNAUTHENTICATED',
  );
});

test('trade creation validates account, symbol and direction before database access', async () => {
  await expectError(
    () => createTradingTrade(USER_ID, { trading_account_id: 'bad', symbol: 'RELIANCE', direction: 'long' }),
    'INVALID_ACCOUNT_ID',
  );
  await expectError(
    () => createTradingTrade(USER_ID, { trading_account_id: ACCOUNT_ID, symbol: 'bad symbol', direction: 'long' }),
    'INVALID_SYMBOL',
  );
  await expectError(
    () => createTradingTrade(USER_ID, { trading_account_id: ACCOUNT_ID, symbol: 'RELIANCE', direction: 'sideways' }),
    'INVALID_DIRECTION',
  );
});

test('trade lookup rejects malformed ids without database access', async () => {
  assert.equal(await getTradingTrade(USER_ID, 'bad'), null);
});

test('trade list rejects malformed account filters', async () => {
  await expectError(() => getTradingTrades(USER_ID, 'bad'), 'INVALID_ACCOUNT_ID');
});

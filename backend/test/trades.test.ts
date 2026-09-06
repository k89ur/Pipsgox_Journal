import test from 'node:test';
import assert from 'node:assert/strict';
import { createTradingExecution, createTradingTrade, getTradingTrade, getTradingTrades } from '../src/trades/service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_ID = '33333333-3333-4333-8333-333333333333';
const TRADE_ID = '44444444-4444-4444-8444-444444444444';

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
  await expectError(() => createTradingTrade(USER_ID, { trading_account_id: 'bad', symbol: 'RELIANCE', direction: 'long' }), 'INVALID_ACCOUNT_ID');
  await expectError(() => createTradingTrade(USER_ID, { trading_account_id: ACCOUNT_ID, symbol: 'bad symbol', direction: 'long' }), 'INVALID_SYMBOL');
  await expectError(() => createTradingTrade(USER_ID, { trading_account_id: ACCOUNT_ID, symbol: 'RELIANCE', direction: 'sideways' }), 'INVALID_DIRECTION');
});

test('trade lookup rejects malformed ids without database access', async () => {
  assert.equal(await getTradingTrade(USER_ID, 'bad'), null);
});

test('trade list rejects malformed account filters', async () => {
  await expectError(() => getTradingTrades(USER_ID, 'bad'), 'INVALID_ACCOUNT_ID');
});

test('execution creation validates all fields before database access', async () => {
  await expectError(() => createTradingExecution('bad', TRADE_ID, {}), 'UNAUTHENTICATED');
  await expectError(() => createTradingExecution(USER_ID, 'bad', {}), 'INVALID_TRADE_ID');
  await expectError(() => createTradingExecution(USER_ID, TRADE_ID, { side: 'hold', quantity: 1, price: 100, executed_at: '2026-01-01T10:00:00Z' }), 'INVALID_SIDE');
  await expectError(() => createTradingExecution(USER_ID, TRADE_ID, { side: 'buy', quantity: 0, price: 100, executed_at: '2026-01-01T10:00:00Z' }), 'INVALID_QUANTITY');
  await expectError(() => createTradingExecution(USER_ID, TRADE_ID, { side: 'buy', quantity: 1, price: 0, executed_at: '2026-01-01T10:00:00Z' }), 'INVALID_PRICE');
  await expectError(() => createTradingExecution(USER_ID, TRADE_ID, { side: 'buy', quantity: 1, price: 100, executed_at: 'bad' }), 'INVALID_EXECUTED_AT');
  await expectError(() => createTradingExecution(USER_ID, TRADE_ID, { side: 'buy', quantity: 1, price: 100, executed_at: '2026-01-01T10:00:00Z', total_charges: -1 }), 'INVALID_TOTAL_CHARGES');
});

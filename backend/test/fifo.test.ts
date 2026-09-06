import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFifo } from '../src/trades/fifo.js';

test('long FIFO matches earliest entries first', () => {
  const result = calculateFifo('long', [
    { side: 'buy', quantity: 10, price: 100 },
    { side: 'buy', quantity: 10, price: 110 },
    { side: 'sell', quantity: 15, price: 120, totalCharges: 5 },
  ]);

  assert.equal(result.remainingQuantity, 5);
  assert.equal(result.averageEntryPrice, 110);
  assert.equal(result.grossRealizedPnl, 250);
  assert.equal(result.totalCharges, 5);
  assert.equal(result.netRealizedPnl, 245);
});

test('short FIFO calculates profit when buying back lower', () => {
  const result = calculateFifo('short', [
    { side: 'sell', quantity: 10, price: 200 },
    { side: 'sell', quantity: 5, price: 190 },
    { side: 'buy', quantity: 12, price: 180, totalCharges: 3 },
  ]);

  assert.equal(result.remainingQuantity, 3);
  assert.equal(result.averageEntryPrice, 190);
  assert.equal(result.grossRealizedPnl, 220);
  assert.equal(result.totalCharges, 3);
  assert.equal(result.netRealizedPnl, 217);
});

test('partial close keeps the remaining FIFO lot quantity', () => {
  const result = calculateFifo('long', [
    { side: 'buy', quantity: 10, price: 100 },
    { side: 'sell', quantity: 4, price: 105 },
  ]);

  assert.equal(result.remainingQuantity, 6);
  assert.equal(result.averageEntryPrice, 100);
  assert.equal(result.grossRealizedPnl, 20);
});

test('over-closing a position is rejected', () => {
  assert.throws(
    () => calculateFifo('long', [
      { side: 'buy', quantity: 5, price: 100 },
      { side: 'sell', quantity: 6, price: 110 },
    ]),
    /OVER_CLOSING_POSITION/,
  );
});

test('invalid charges are rejected', () => {
  assert.throws(
    () => calculateFifo('long', [{ side: 'buy', quantity: 1, price: 100, totalCharges: -1 }]),
    /INVALID_TOTAL_CHARGES/,
  );
});

export type TradeDirection = 'long' | 'short';
export type ExecutionSide = 'buy' | 'sell';

export type FifoExecution = {
  side: ExecutionSide;
  quantity: number;
  price: number;
  totalCharges?: number;
};

export type FifoLot = {
  quantity: number;
  price: number;
};

export type FifoResult = {
  remainingQuantity: number;
  averageEntryPrice: number | null;
  grossRealizedPnl: number;
  totalCharges: number;
  netRealizedPnl: number;
  lots: FifoLot[];
};

const EPSILON = 1e-9;

function isOpeningSide(direction: TradeDirection, side: ExecutionSide): boolean {
  return direction === 'long' ? side === 'buy' : side === 'sell';
}

function assertPositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`INVALID_${field.toUpperCase()}`);
}

export function calculateFifo(
  direction: TradeDirection,
  executions: FifoExecution[],
): FifoResult {
  const lots: FifoLot[] = [];
  let grossRealizedPnl = 0;
  let totalCharges = 0;

  for (const execution of executions) {
    assertPositive(execution.quantity, 'quantity');
    assertPositive(execution.price, 'price');
    const charges = execution.totalCharges ?? 0;
    if (!Number.isFinite(charges) || charges < 0) throw new Error('INVALID_TOTAL_CHARGES');
    totalCharges += charges;

    if (isOpeningSide(direction, execution.side)) {
      lots.push({ quantity: execution.quantity, price: execution.price });
      continue;
    }

    let remainingToClose = execution.quantity;
    while (remainingToClose > EPSILON) {
      const lot = lots[0];
      if (!lot) throw new Error('OVER_CLOSING_POSITION');

      const matched = Math.min(remainingToClose, lot.quantity);
      if (direction === 'long') {
        grossRealizedPnl += (execution.price - lot.price) * matched;
      } else {
        grossRealizedPnl += (lot.price - execution.price) * matched;
      }

      lot.quantity -= matched;
      remainingToClose -= matched;
      if (lot.quantity <= EPSILON) lots.shift();
    }
  }

  const remainingQuantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const remainingValue = lots.reduce((sum, lot) => sum + lot.quantity * lot.price, 0);
  const averageEntryPrice = remainingQuantity > EPSILON ? remainingValue / remainingQuantity : null;

  return {
    remainingQuantity,
    averageEntryPrice,
    grossRealizedPnl,
    totalCharges,
    netRealizedPnl: grossRealizedPnl - totalCharges,
    lots: lots.map((lot) => ({ ...lot })),
  };
}

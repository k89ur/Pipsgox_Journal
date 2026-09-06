import { calculateFifo, type FifoExecution } from './fifo.js';
import {
  createExecution,
  createTrade,
  findTradeById,
  listExecutions,
  listTrades,
  type TradeRecord,
} from './repository.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SYMBOL_RE = /^[A-Za-z0-9._-]{1,50}$/;

function requireUserId(userId: string): void {
  if (!UUID_RE.test(userId)) throw new Error('UNAUTHENTICATED');
}

function validateSymbol(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_SYMBOL');
  const symbol = value.trim().toUpperCase();
  if (!SYMBOL_RE.test(symbol)) throw new Error('INVALID_SYMBOL');
  return symbol;
}

function validateDirection(value: unknown): 'long' | 'short' {
  if (value !== 'long' && value !== 'short') throw new Error('INVALID_DIRECTION');
  return value;
}

function optionalText(value: unknown, max: number, code: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error(code);
  const text = value.trim();
  if (text.length > max) throw new Error(code);
  return text || null;
}

function positiveNumber(value: unknown, code: string): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(code);
  return number;
}

function nonNegativeNumber(value: unknown, code: string): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(code);
  return number;
}

function validateExecutedAt(value: unknown): Date {
  const date = new Date(String(value ?? ''));
  if (!value || Number.isNaN(date.getTime())) throw new Error('INVALID_EXECUTED_AT');
  return date;
}

function publicTrade(trade: TradeRecord) {
  return {
    id: trade.id,
    trading_account_id: trade.trading_account_id,
    symbol: trade.symbol,
    direction: trade.direction,
    setup: trade.setup,
    strategy: trade.strategy,
    notes: trade.notes,
    created_at: trade.created_at,
    updated_at: trade.updated_at,
  };
}

export async function createTradingTrade(userId: string, input: Record<string, unknown>) {
  requireUserId(userId);
  if (!UUID_RE.test(String(input.trading_account_id ?? ''))) throw new Error('INVALID_ACCOUNT_ID');
  const symbol = validateSymbol(input.symbol);
  const direction = validateDirection(input.direction);
  const setup = optionalText(input.setup, 100, 'INVALID_SETUP');
  const strategy = optionalText(input.strategy, 100, 'INVALID_STRATEGY');
  const notes = optionalText(input.notes, 10_000, 'INVALID_NOTES');

  const trade = await createTrade(userId, {
    tradingAccountId: String(input.trading_account_id), symbol, direction, setup, strategy, notes,
  });
  if (!trade) throw new Error('ACCOUNT_NOT_FOUND');
  return publicTrade(trade);
}

export async function getTradingTrade(userId: string, tradeId: string) {
  requireUserId(userId);
  if (!UUID_RE.test(tradeId)) return null;
  const trade = await findTradeById(userId, tradeId);
  return trade ? publicTrade(trade) : null;
}

export async function getTradingTrades(userId: string, accountId?: string) {
  requireUserId(userId);
  if (accountId !== undefined && !UUID_RE.test(accountId)) throw new Error('INVALID_ACCOUNT_ID');
  return (await listTrades(userId, accountId)).map(publicTrade);
}

export async function createTradingExecution(userId: string, tradeId: string, input: Record<string, unknown>) {
  requireUserId(userId);
  if (!UUID_RE.test(tradeId)) throw new Error('INVALID_TRADE_ID');
  if (input.side !== 'buy' && input.side !== 'sell') throw new Error('INVALID_SIDE');
  const quantity = positiveNumber(input.quantity, 'INVALID_QUANTITY');
  const price = positiveNumber(input.price, 'INVALID_PRICE');
  const executedAt = validateExecutedAt(input.executed_at);
  const totalCharges = nonNegativeNumber(input.total_charges ?? 0, 'INVALID_TOTAL_CHARGES');
  const brokerExecutionId = optionalText(input.broker_execution_id, 150, 'INVALID_BROKER_EXECUTION_ID');
  const notes = optionalText(input.notes, 10_000, 'INVALID_NOTES');

  const execution = await createExecution(userId, tradeId, {
    side: input.side,
    quantity,
    price,
    executedAt,
    totalCharges,
    brokerExecutionId,
    notes,
  });
  if (!execution) throw new Error('TRADE_NOT_FOUND');
  return execution;
}

export async function getTradeSummary(userId: string, tradeId: string) {
  requireUserId(userId);
  if (!UUID_RE.test(tradeId)) return null;
  const trade = await findTradeById(userId, tradeId);
  if (!trade) return null;

  const executions = await listExecutions(userId, tradeId);
  const fifoExecutions: FifoExecution[] = executions.map((execution) => ({
    side: execution.side, quantity: Number(execution.quantity), price: Number(execution.price), totalCharges: Number(execution.total_charges),
  }));
  const result = calculateFifo(trade.direction, fifoExecutions);
  const firstExecution = executions[0]?.executed_at ?? null;
  const lastExecution = executions[executions.length - 1]?.executed_at ?? null;
  const closed = result.remainingQuantity <= 1e-9;

  return {
    trade: publicTrade(trade),
    status: closed ? 'CLOSED' : 'OPEN',
    opened_at: firstExecution,
    closed_at: closed ? lastExecution : null,
    remaining_quantity: result.remainingQuantity,
    average_entry_price: result.averageEntryPrice,
    gross_realized_pnl: result.grossRealizedPnl,
    total_charges: result.totalCharges,
    net_realized_pnl: result.netRealizedPnl,
    execution_count: executions.length,
  };
}

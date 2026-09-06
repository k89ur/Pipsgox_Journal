import { query } from '../db/client.js';

export type TradeRecord = {
  id: string;
  trading_account_id: string;
  symbol: string;
  direction: 'long' | 'short';
  setup: string | null;
  strategy: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ExecutionRecord = {
  id: string;
  trade_id: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  executed_at: Date;
  total_charges: number;
  broker_execution_id: string | null;
  notes: string | null;
  created_at: Date;
};

export async function createTrade(
  userId: string,
  input: { tradingAccountId: string; symbol: string; direction: 'long' | 'short'; setup: string | null; strategy: string | null; notes: string | null },
): Promise<TradeRecord | null> {
  const result = await query<TradeRecord>(
    `INSERT INTO trades (trading_account_id, symbol, direction, setup, strategy, notes)
     SELECT id, $3, $4, $5, $6, $7
       FROM trading_accounts
      WHERE id = $1 AND user_id = $2
      RETURNING id, trading_account_id, symbol, direction, setup, strategy, notes, created_at, updated_at`,
    [input.tradingAccountId, userId, input.symbol, input.direction, input.setup, input.strategy, input.notes],
  );
  return result.rows[0] ?? null;
}

export async function findTradeById(userId: string, tradeId: string): Promise<TradeRecord | null> {
  const result = await query<TradeRecord>(
    `SELECT t.id, t.trading_account_id, t.symbol, t.direction, t.setup, t.strategy, t.notes, t.created_at, t.updated_at
       FROM trades t
       JOIN trading_accounts a ON a.id = t.trading_account_id
      WHERE t.id = $1 AND a.user_id = $2
      LIMIT 1`,
    [tradeId, userId],
  );
  return result.rows[0] ?? null;
}

export async function listTrades(userId: string, tradingAccountId?: string): Promise<TradeRecord[]> {
  const result = await query<TradeRecord>(
    `SELECT t.id, t.trading_account_id, t.symbol, t.direction, t.setup, t.strategy, t.notes, t.created_at, t.updated_at
       FROM trades t
       JOIN trading_accounts a ON a.id = t.trading_account_id
      WHERE a.user_id = $1
        AND ($2::uuid IS NULL OR t.trading_account_id = $2)
      ORDER BY t.created_at DESC`,
    [userId, tradingAccountId ?? null],
  );
  return result.rows;
}

export async function listExecutions(userId: string, tradeId: string): Promise<ExecutionRecord[]> {
  const result = await query<ExecutionRecord>(
    `SELECT e.id, e.trade_id, e.side, e.quantity, e.price, e.executed_at, e.total_charges, e.broker_execution_id, e.notes, e.created_at
       FROM executions e
       JOIN trades t ON t.id = e.trade_id
       JOIN trading_accounts a ON a.id = t.trading_account_id
      WHERE e.trade_id = $1 AND a.user_id = $2
      ORDER BY e.executed_at ASC, e.created_at ASC`,
    [tradeId, userId],
  );
  return result.rows;
}

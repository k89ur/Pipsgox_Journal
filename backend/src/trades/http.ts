import { authenticateSession, type PublicUser } from '../auth/service.js';
import {
  createTradingExecution,
  createTradingTrade,
  getTradeSummary,
  getTradingTrade,
  getTradingTrades,
} from './service.js';

export type TradeRequest = {
  user: PublicUser;
  body?: Record<string, unknown>;
  tradeId?: string;
  accountId?: string;
};

export type TradeResponse = { status: number; body: Record<string, unknown> };

export async function authenticateTradeRequest(token: string | undefined): Promise<PublicUser | null> {
  const user = await authenticateSession(token);
  if (!user) return null;
  return { id: user.id, email: user.email, display_name: user.display_name, status: user.status };
}

export async function createTradeHandler(req: TradeRequest): Promise<TradeResponse> {
  try {
    return { status: 201, body: { trade: await createTradingTrade(req.user.id, req.body ?? {}) } };
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INVALID_TRADE';
    return { status: code === 'ACCOUNT_NOT_FOUND' ? 404 : 400, body: { error: code } };
  }
}

export async function listTradesHandler(req: TradeRequest): Promise<TradeResponse> {
  try {
    return { status: 200, body: { trades: await getTradingTrades(req.user.id, req.accountId) } };
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INVALID_ACCOUNT_ID';
    return { status: 400, body: { error: code } };
  }
}

export async function getTradeHandler(req: TradeRequest): Promise<TradeResponse> {
  const trade = await getTradingTrade(req.user.id, req.tradeId ?? '');
  return trade ? { status: 200, body: { trade } } : { status: 404, body: { error: 'TRADE_NOT_FOUND' } };
}

export async function createExecutionHandler(req: TradeRequest): Promise<TradeResponse> {
  try {
    return { status: 201, body: { execution: await createTradingExecution(req.user.id, req.tradeId ?? '', req.body ?? {}) } };
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INVALID_EXECUTION';
    const status = code === 'TRADE_NOT_FOUND' ? 404 : code === 'OVER_CLOSING_POSITION' ? 409 : 400;
    return { status, body: { error: code } };
  }
}

export async function getTradeSummaryHandler(req: TradeRequest): Promise<TradeResponse> {
  const summary = await getTradeSummary(req.user.id, req.tradeId ?? '');
  return summary ? { status: 200, body: { summary } } : { status: 404, body: { error: 'TRADE_NOT_FOUND' } };
}

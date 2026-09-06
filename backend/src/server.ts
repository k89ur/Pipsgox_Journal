import 'dotenv/config';
import http from 'node:http';
import { URL } from 'node:url';
import { checkDatabaseConnection, closeDatabasePool } from './db/pool.js';
import { loginHandler, logoutHandler, meHandler, signupHandler, type AuthRequest, type AuthResponse } from './auth/http.js';
import { SESSION_COOKIE } from './auth/session.js';
import {
  authenticateAccountRequest,
  createAccountHandler,
  deleteAccountHandler,
  getAccountHandler,
  listAccountsHandler,
  updateAccountHandler,
} from './accounts/http.js';
import {
  authenticateTradeRequest,
  createExecutionHandler,
  createTradeHandler,
  getTradeHandler,
  getTradeSummaryHandler,
  listTradesHandler,
} from './trades/http.js';
import {
  authenticateJournalRequest,
  createJournalEntryHandler,
  deleteJournalEntryHandler,
  getJournalEntryHandler,
  listJournalEntriesHandler,
  updateJournalEntryHandler,
} from './journal/http.js';
import { applyCors, applySecurityHeaders, isJsonContentType } from './http/security.js';

const port = Number(process.env.PORT ?? 3000);
const isProduction = process.env.NODE_ENV === 'production';
const MAX_BODY_BYTES = 1_000_000;

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name) continue;
    try { cookies[name] = decodeURIComponent(value); } catch { /* ignore malformed cookie */ }
  }
  return cookies;
}

async function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const declaredLength = Number(req.headers['content-length'] ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('INVALID_JSON_BODY');
  return parsed as Record<string, unknown>;
}

function serializeCookie(name: string, value: string, options: Record<string, unknown>): string {
  let cookie = `${name}=${encodeURIComponent(value)}`;
  if (options.expires instanceof Date) cookie += `; Expires=${options.expires.toUTCString()}`;
  if (options.httpOnly) cookie += '; HttpOnly';
  if (options.secure) cookie += '; Secure';
  if (options.sameSite) cookie += `; SameSite=${String(options.sameSite)}`;
  if (options.path) cookie += `; Path=${String(options.path)}`;
  return cookie;
}

async function route(req: http.IncomingMessage): Promise<AuthResponse> {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (method === 'OPTIONS') return { status: 204, body: {} };

  const isBodyMethod = method === 'POST' || method === 'PATCH';
  const hasBody = Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding'] !== undefined;
  if (isBodyMethod && hasBody && !isJsonContentType(req.headers['content-type'])) {
    throw new Error('UNSUPPORTED_MEDIA_TYPE');
  }

  const authRequest: AuthRequest = {
    body: isBodyMethod ? await readJsonBody(req) : {},
    cookies: parseCookies(req.headers.cookie),
  };

  if (method === 'POST' && url.pathname === '/auth/signup') return signupHandler(authRequest);
  if (method === 'POST' && url.pathname === '/auth/login') return loginHandler(authRequest);
  if (method === 'GET' && url.pathname === '/auth/me') return meHandler(authRequest);
  if (method === 'POST' && url.pathname === '/auth/logout') return logoutHandler(authRequest);
  if (method === 'GET' && url.pathname === '/health') {
    await checkDatabaseConnection();
    return { status: 200, body: { status: 'ok', database: 'ok' } };
  }

  if (url.pathname === '/accounts' || url.pathname.startsWith('/accounts/')) {
    const user = await authenticateAccountRequest(authRequest.cookies?.[SESSION_COOKIE]);
    if (!user) return { status: 401, body: { error: 'UNAUTHENTICATED' } };
    const accountId = url.pathname.startsWith('/accounts/') ? url.pathname.slice('/accounts/'.length) : undefined;
    const accountRequest = { ...authRequest, user, accountId };
    if (method === 'POST' && url.pathname === '/accounts') return createAccountHandler(accountRequest);
    if (method === 'GET' && url.pathname === '/accounts') return listAccountsHandler(accountRequest);
    if (method === 'GET' && accountId) return getAccountHandler(accountRequest);
    if (method === 'PATCH' && accountId) return updateAccountHandler(accountRequest);
    if (method === 'DELETE' && accountId) return deleteAccountHandler(accountRequest);
  }

  if (url.pathname === '/trades' || url.pathname.startsWith('/trades/')) {
    const user = await authenticateTradeRequest(authRequest.cookies?.[SESSION_COOKIE]);
    if (!user) return { status: 401, body: { error: 'UNAUTHENTICATED' } };
    const segments = url.pathname.split('/').filter(Boolean);
    const tradeId = segments[1];
    const accountId = url.searchParams.get('account_id') ?? undefined;
    const tradeRequest = { ...authRequest, user, tradeId, accountId };

    if (method === 'POST' && segments.length === 1) return createTradeHandler(tradeRequest);
    if (method === 'GET' && segments.length === 1) return listTradesHandler(tradeRequest);
    if (method === 'GET' && segments.length === 2) return getTradeHandler(tradeRequest);
    if (method === 'POST' && segments.length === 3 && segments[2] === 'executions') return createExecutionHandler(tradeRequest);
    if (method === 'GET' && segments.length === 3 && segments[2] === 'summary') return getTradeSummaryHandler(tradeRequest);
  }

  if (url.pathname === '/journal' || url.pathname.startsWith('/journal/')) {
    const user = await authenticateJournalRequest(authRequest.cookies?.[SESSION_COOKIE]);
    if (!user) return { status: 401, body: { error: 'UNAUTHENTICATED' } };
    const entryId = url.pathname.startsWith('/journal/') ? url.pathname.slice('/journal/'.length) : undefined;
    const journalRequest = { ...authRequest, userId: user.id, entryId };
    if (method === 'POST' && url.pathname === '/journal') return createJournalEntryHandler(journalRequest);
    if (method === 'GET' && url.pathname === '/journal') return listJournalEntriesHandler(journalRequest);
    if (method === 'GET' && entryId) return getJournalEntryHandler(journalRequest);
    if (method === 'PATCH' && entryId) return updateJournalEntryHandler(journalRequest);
    if (method === 'DELETE' && entryId) return deleteJournalEntryHandler(journalRequest);
  }

  return { status: 404, body: { error: 'NOT_FOUND' } };
}

function sendResponse(res: http.ServerResponse, result: AuthResponse): void {
  res.statusCode = result.status;
  if (result.status !== 204) res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (result.setCookie) res.setHeader('Set-Cookie', serializeCookie(result.setCookie.name, result.setCookie.value, result.setCookie.options));
  else if (result.clearCookie) res.setHeader('Set-Cookie', serializeCookie(result.clearCookie.name, '', { ...result.clearCookie.options, expires: new Date(0) }));
  if (result.status === 204) { res.end(); return; }
  res.end(JSON.stringify(result.body));
}

export const server = http.createServer(async (req, res) => {
  applySecurityHeaders(res);
  if (!applyCors(req, res)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'CORS_FORBIDDEN' }));
    return;
  }

  try {
    sendResponse(res, await route(req));
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
    const status = code === 'BODY_TOO_LARGE' ? 413
      : code === 'INVALID_JSON_BODY' ? 400
      : code === 'UNSUPPORTED_MEDIA_TYPE' ? 415
      : 500;
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: status === 500 ? 'INTERNAL_ERROR' : code }));
  }
});

server.headersTimeout = 10_000;
server.requestTimeout = 30_000;
server.keepAliveTimeout = 5_000;

async function start(): Promise<void> {
  await checkDatabaseConnection();
  server.listen(port, () => console.log(`Backend ready on port ${port}.`));
}

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}; closing server and database pool.`);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeDatabasePool();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

if (!isProduction || process.env.NODE_ENV !== 'test') {
  start().catch(async (error) => {
    console.error('Backend startup failed:', error);
    await closeDatabasePool();
    process.exitCode = 1;
  });
}

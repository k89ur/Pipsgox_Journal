import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import pg from 'pg';

const { Pool } = pg;
const baseUrl = 'http://127.0.0.1:3000';
const email = `pipsgox-smoke-${randomUUID()}@example.invalid`;
const password = 'SmokeTest-2026!';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: true } });
let child;
let testUserId = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const text = await response.text();
  let body = {};
  if (text) {
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
  }
  return { response, body };
}

function cookieFrom(response) {
  const value = response.headers.get('set-cookie') ?? '';
  const match = value.match(/pipsgox_session=([^;]+)/);
  return match ? `pipsgox_session=${decodeURIComponent(match[1])}` : null;
}

async function waitForHealth() {
  for (let i = 0; i < 30; i += 1) {
    try {
      const { response, body } = await request('/health', { headers: { 'content-type': 'application/json' } });
      if (response.status === 200 && body.database === 'ok') return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Backend did not become healthy');
}

async function main() {
  console.log('Production smoke test starting.');
  child = spawn(process.execPath, ['dist/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'production', PORT: '3000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (data) => process.stdout.write(`[server] ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`[server] ${data}`));

  await waitForHealth();
  console.log('PASS health');

  let result = await request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, display_name: 'Pipsgox Smoke' }),
  });
  assert(result.response.status === 201, `signup failed: ${result.response.status}`);
  testUserId = result.body.user?.id;
  assert(typeof testUserId === 'string', 'signup did not return user id');
  let cookie = cookieFrom(result.response);
  assert(cookie, 'signup did not return session cookie');
  console.log('PASS signup + session creation');

  result = await request('/auth/me', { headers: { Cookie: cookie } });
  assert(result.response.status === 200 && result.body.user?.id === testUserId, 'auth/me failed');
  console.log('PASS authenticated session');

  result = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, remember_device: false }),
  });
  assert(result.response.status === 200 && result.body.user?.id === testUserId, 'login failed');
  cookie = cookieFrom(result.response);
  assert(cookie, 'login did not return session cookie');
  console.log('PASS login');

  result = await request('/accounts', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ name: 'Smoke Account', broker: 'Smoke Broker', base_currency: 'INR' }),
  });
  assert(result.response.status === 201, `account creation failed: ${result.response.status}`);
  const accountId = result.body.account?.id;
  assert(typeof accountId === 'string', 'account id missing');
  console.log('PASS trading account');

  result = await request('/trades', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ trading_account_id: accountId, symbol: 'SMOKE', direction: 'long', setup: 'Smoke', strategy: 'FIFO' }),
  });
  assert(result.response.status === 201, `trade creation failed: ${result.response.status}`);
  const tradeId = result.body.trade?.id;
  assert(typeof tradeId === 'string', 'trade id missing');
  console.log('PASS trade');

  const executions = [
    { side: 'buy', quantity: 10, price: 100, executed_at: '2026-09-06T10:00:00Z', total_charges: 1 },
    { side: 'buy', quantity: 5, price: 110, executed_at: '2026-09-06T10:01:00Z', total_charges: 2 },
    { side: 'sell', quantity: 12, price: 120, executed_at: '2026-09-06T10:02:00Z', total_charges: 3 },
    { side: 'sell', quantity: 3, price: 125, executed_at: '2026-09-06T10:03:00Z', total_charges: 1 },
  ];
  for (const execution of executions) {
    result = await request(`/trades/${tradeId}/executions`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: JSON.stringify(execution),
    });
    assert(result.response.status === 201, `execution failed: ${result.response.status} ${JSON.stringify(result.body)}`);
  }
  console.log('PASS 4 executions + atomic position validation');

  result = await request(`/trades/${tradeId}/summary`, { headers: { Cookie: cookie } });
  assert(result.response.status === 200, `summary failed: ${result.response.status}`);
  const summary = result.body.summary;
  assert(summary?.status === 'CLOSED', `expected CLOSED, got ${summary?.status}`);
  assert(Number(summary.gross_realized_pnl) === 265, `expected gross P&L 265, got ${summary?.gross_realized_pnl}`);
  assert(Number(summary.total_charges) === 7, `expected charges 7, got ${summary?.total_charges}`);
  assert(Number(summary.net_realized_pnl) === 258, `expected net P&L 258, got ${summary?.net_realized_pnl}`);
  assert(Number(summary.remaining_quantity) === 0, `expected remaining quantity 0, got ${summary?.remaining_quantity}`);
  assert(Number(summary.execution_count) === 4, `expected 4 executions, got ${summary?.execution_count}`);
  console.log('PASS FIFO P&L: gross 265, charges 7, net 258');

  result = await request('/journal', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ trade_id: tradeId, title: 'Smoke Journal', content: 'Production smoke test entry.', entry_at: '2026-09-06T10:04:00Z' }),
  });
  assert(result.response.status === 201, `journal creation failed: ${result.response.status}`);
  const entryId = result.body.entry?.id;
  assert(typeof entryId === 'string', 'journal entry id missing');
  console.log('PASS journal entry');

  result = await request(`/journal/${entryId}`, { headers: { Cookie: cookie } });
  assert(result.response.status === 200 && result.body.entry?.trade_id === tradeId, 'journal lookup/link failed');
  console.log('PASS journal lookup + trade link');

  result = await request('/accounts', { headers: { Cookie: cookie } });
  assert(result.response.status === 200 && result.body.accounts?.some((account) => account.id === accountId), 'account list failed');
  result = await request(`/trades/${tradeId}`, { headers: { Cookie: cookie } });
  assert(result.response.status === 200 && result.body.trade?.id === tradeId, 'trade lookup failed');
  result = await request('/journal', { headers: { Cookie: cookie } });
  assert(result.response.status === 200 && result.body.entries?.some((entry) => entry.id === entryId), 'journal list failed');
  console.log('PASS resource list/read paths');

  result = await request('/auth/logout', { method: 'POST', headers: { Cookie: cookie }, body: '{}' });
  assert(result.response.status === 204, `logout failed: ${result.response.status}`);
  result = await request('/auth/me', { headers: { Cookie: cookie } });
  assert(result.response.status === 401, 'revoked session remained authenticated');
  console.log('PASS logout + session revocation');

  const counts = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE id = $1) AS users,
       (SELECT COUNT(*) FROM trading_accounts WHERE user_id = $1) AS accounts,
       (SELECT COUNT(*) FROM trades t JOIN trading_accounts a ON a.id = t.trading_account_id WHERE a.user_id = $1) AS trades,
       (SELECT COUNT(*) FROM executions e JOIN trades t ON t.id = e.trade_id JOIN trading_accounts a ON a.id = t.trading_account_id WHERE a.user_id = $1) AS executions,
       (SELECT COUNT(*) FROM journal_entries WHERE user_id = $1) AS journal_entries`,
    [testUserId],
  );
  const row = counts.rows[0];
  assert(row.users === '1' && row.accounts === '1' && row.trades === '1' && row.executions === '4' && row.journal_entries === '1', `unexpected production rows: ${JSON.stringify(row)}`);
  console.log('PASS production database rows verified');
  console.log('PRODUCTION SMOKE TEST PASSED');
}

async function cleanup() {
  if (testUserId) {
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    console.log('Smoke-test data cleaned up.');
  } else {
    await pool.query('DELETE FROM users WHERE email = $1', [email]);
  }
  await pool.end();
  if (child && !child.killed) child.kill('SIGTERM');
}

try {
  await main();
} finally {
  await cleanup();
}

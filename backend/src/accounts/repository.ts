import { query } from '../db/client.js';

export type TradingAccount = {
  id: string;
  user_id: string;
  name: string;
  broker: string | null;
  base_currency: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export async function createAccount(
  userId: string,
  input: { name: string; broker: string | null; baseCurrency: string },
): Promise<TradingAccount> {
  const result = await query<TradingAccount>(
    `INSERT INTO trading_accounts (user_id, name, broker, base_currency)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, name, broker, base_currency, is_active, created_at, updated_at`,
    [userId, input.name, input.broker, input.baseCurrency],
  );
  return result.rows[0];
}

export async function listAccounts(userId: string): Promise<TradingAccount[]> {
  const result = await query<TradingAccount>(
    `SELECT id, user_id, name, broker, base_currency, is_active, created_at, updated_at
       FROM trading_accounts
      WHERE user_id = $1
      ORDER BY is_active DESC, created_at ASC`,
    [userId],
  );
  return result.rows;
}

export async function findAccountById(userId: string, accountId: string): Promise<TradingAccount | null> {
  const result = await query<TradingAccount>(
    `SELECT id, user_id, name, broker, base_currency, is_active, created_at, updated_at
       FROM trading_accounts
      WHERE id = $1 AND user_id = $2
      LIMIT 1`,
    [accountId, userId],
  );
  return result.rows[0] ?? null;
}

export async function updateAccount(
  userId: string,
  accountId: string,
  input: { name?: string; broker?: string | null; baseCurrency?: string; isActive?: boolean },
): Promise<TradingAccount | null> {
  const result = await query<TradingAccount>(
    `UPDATE trading_accounts
        SET name = COALESCE($3, name),
            broker = CASE WHEN $4::boolean THEN $5::text ELSE broker END,
            base_currency = COALESCE($6, base_currency),
            is_active = COALESCE($7, is_active),
            updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, name, broker, base_currency, is_active, created_at, updated_at`,
    [
      accountId,
      userId,
      input.name ?? null,
      Object.prototype.hasOwnProperty.call(input, 'broker'),
      input.broker ?? null,
      input.baseCurrency ?? null,
      input.isActive ?? null,
    ],
  );
  return result.rows[0] ?? null;
}

export async function deactivateAccount(userId: string, accountId: string): Promise<boolean> {
  const result = await query(
    `UPDATE trading_accounts
        SET is_active = FALSE, updated_at = NOW()
      WHERE id = $1 AND user_id = $2 AND is_active = TRUE`,
    [accountId, userId],
  );
  return result.rowCount === 1;
}

import { query } from '../db/client.js';

export type JournalEntry = {
  id: string;
  user_id: string;
  trade_id: string | null;
  title: string | null;
  content: string;
  entry_at: Date;
  created_at: Date;
  updated_at: Date;
};

const FIELDS = `id, user_id, trade_id, title, content, entry_at, created_at, updated_at`;

export async function createJournalEntry(
  userId: string,
  input: { tradeId: string | null; title: string | null; content: string; entryAt: Date },
): Promise<JournalEntry | null> {
  const result = await query<JournalEntry>(
    `INSERT INTO journal_entries (user_id, trade_id, title, content, entry_at)
     SELECT $1, t.id, $3, $4, $5
       FROM (SELECT $2::uuid AS id) requested
       LEFT JOIN trades t ON t.id = requested.id AND EXISTS (
         SELECT 1 FROM trading_accounts a
          WHERE a.id = t.trading_account_id AND a.user_id = $1
       )
     WHERE $2::uuid IS NULL OR t.id IS NOT NULL
     RETURNING ${FIELDS}`,
    [userId, input.tradeId, input.title, input.content, input.entryAt],
  );
  return result.rows[0] ?? null;
}

export async function listJournalEntries(userId: string): Promise<JournalEntry[]> {
  const result = await query<JournalEntry>(
    `SELECT ${FIELDS}
       FROM journal_entries
      WHERE user_id = $1
      ORDER BY entry_at DESC, created_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function findJournalEntry(userId: string, entryId: string): Promise<JournalEntry | null> {
  const result = await query<JournalEntry>(
    `SELECT ${FIELDS}
       FROM journal_entries
      WHERE id = $1 AND user_id = $2
      LIMIT 1`,
    [entryId, userId],
  );
  return result.rows[0] ?? null;
}

export async function updateJournalEntry(
  userId: string,
  entryId: string,
  input: { tradeId?: string | null; title?: string | null; content?: string; entryAt?: Date },
): Promise<JournalEntry | null> {
  const hasTrade = Object.prototype.hasOwnProperty.call(input, 'tradeId');
  const hasTitle = Object.prototype.hasOwnProperty.call(input, 'title');
  const result = await query<JournalEntry>(
    `UPDATE journal_entries j
        SET trade_id = CASE WHEN $3::boolean THEN (
              SELECT t.id FROM trades t
               JOIN trading_accounts a ON a.id = t.trading_account_id AND a.user_id = $2
              WHERE t.id = $4::uuid
            ) ELSE j.trade_id END,
            title = CASE WHEN $5::boolean THEN $6::text ELSE j.title END,
            content = COALESCE($7, j.content),
            entry_at = COALESCE($8::timestamptz, j.entry_at),
            updated_at = NOW()
      WHERE j.id = $1 AND j.user_id = $2
        AND ($3::boolean = FALSE OR $4::uuid IS NULL OR EXISTS (
          SELECT 1 FROM trades t
           JOIN trading_accounts a ON a.id = t.trading_account_id AND a.user_id = $2
          WHERE t.id = $4::uuid
        ))
      RETURNING ${FIELDS}`,
    [
      entryId,
      userId,
      hasTrade,
      input.tradeId ?? null,
      hasTitle,
      input.title ?? null,
      input.content ?? null,
      input.entryAt ?? null,
    ],
  );
  return result.rows[0] ?? null;
}

export async function deleteJournalEntry(userId: string, entryId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM journal_entries WHERE id = $1 AND user_id = $2`,
    [entryId, userId],
  );
  return result.rowCount === 1;
}

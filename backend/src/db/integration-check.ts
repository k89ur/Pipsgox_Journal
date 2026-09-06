import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });

const expectedTables = [
  'users',
  'sessions',
  'trading_accounts',
  'trades',
  'executions',
  'journal_entries',
  'schema_migrations',
];

async function checkSchema(): Promise<void> {
  try {
    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])
       ORDER BY table_name`,
      [expectedTables],
    );

    const found = new Set(tables.rows.map((row) => row.table_name));
    const missing = expectedTables.filter((table) => !found.has(table));
    if (missing.length) {
      throw new Error(`Missing tables: ${missing.join(', ')}`);
    }

    const constraints = await pool.query<{ constraint_name: string }>(
      `SELECT constraint_name
       FROM information_schema.table_constraints
       WHERE table_schema = 'public'
       AND constraint_name IN (
         'users_email_unique',
         'sessions_token_hash_unique',
         'sessions_expiry_check',
         'trading_accounts_currency_check',
         'trades_direction_check',
         'executions_side_check',
         'executions_quantity_check',
         'executions_price_check',
         'executions_total_charges_check'
       )`,
    );

    if (constraints.rowCount !== 9) {
      throw new Error(`Expected 9 core constraints, found ${constraints.rowCount ?? 0}`);
    }

    const migrations = await pool.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version',
    );
    if (migrations.rowCount !== 1 || migrations.rows[0]?.version !== '001_initial_schema.sql') {
      throw new Error('Expected initial schema migration to be recorded exactly once');
    }

    console.log('PostgreSQL integration check passed.');
    console.log(`Verified tables: ${expectedTables.join(', ')}`);
  } finally {
    await pool.end();
  }
}

checkSchema().catch((error) => {
  console.error('PostgreSQL integration check failed:', error);
  process.exitCode = 1;
});

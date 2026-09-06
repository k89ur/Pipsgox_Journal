import type { QueryResultRow } from 'pg';

export { pool, checkDatabaseConnection, closeDatabasePool } from './pool.js';

import { pool } from './pool.js';

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  return pool.query<T>(text, values);
}

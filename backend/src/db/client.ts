export { pool, checkDatabaseConnection, closeDatabasePool } from './pool.js';

import { pool } from './pool.js';

export async function query<T = unknown>(text: string, values: unknown[] = []) {
  return pool.query<T>(text, values);
}

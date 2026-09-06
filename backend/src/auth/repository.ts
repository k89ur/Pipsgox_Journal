import { pool, query } from '../db/client.js';

export type UserRecord = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  status: 'active' | 'inactive' | 'blocked';
};

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const result = await query<UserRecord>(
    `SELECT id, email, password_hash, display_name, status
       FROM users
      WHERE email = $1
      LIMIT 1`,
    [email],
  );
  return result.rows[0] ?? null;
}

export async function createUser(
  email: string,
  passwordHash: string,
  displayName: string,
): Promise<UserRecord> {
  const result = await query<UserRecord>(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING id, email, password_hash, display_name, status`,
    [email, passwordHash, displayName],
  );
  return result.rows[0];
}

export async function createUserAndSession(
  email: string,
  passwordHash: string,
  displayName: string,
  sessionTokenHash: string,
  expiresAt: Date,
): Promise<UserRecord> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query<UserRecord>(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, password_hash, display_name, status`,
      [email, passwordHash, displayName],
    );
    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO sessions (user_id, session_token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, sessionTokenHash, expiresAt],
    );

    await client.query('COMMIT');
    return user;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createSession(
  userId: string,
  sessionTokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await query(
    `INSERT INTO sessions (user_id, session_token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, sessionTokenHash, expiresAt],
  );
}

export async function findSessionUser(sessionTokenHash: string): Promise<UserRecord | null> {
  const result = await query<UserRecord>(
    `SELECT u.id, u.email, u.password_hash, u.display_name, u.status
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.session_token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
        AND u.status = 'active'
      LIMIT 1`,
    [sessionTokenHash],
  );

  if (!result.rows[0]) return null;

  await query(
    `UPDATE sessions
        SET last_seen_at = NOW()
      WHERE session_token_hash = $1`,
    [sessionTokenHash],
  );

  return result.rows[0];
}

export async function revokeSession(sessionTokenHash: string): Promise<void> {
  await query(
    `UPDATE sessions
        SET revoked_at = COALESCE(revoked_at, NOW())
      WHERE session_token_hash = $1`,
    [sessionTokenHash],
  );
}

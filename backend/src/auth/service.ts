import {
  createSession,
  createUserAndSession,
  findSessionUser,
  findUserByEmail,
  revokeSession,
  type UserRecord,
} from './repository.js';
import { hashPassword, verifyPassword } from './password.js';
import { createSessionToken, hashSessionToken, sessionExpiry } from './session.js';
import {
  normalizeEmail,
  validateDisplayName,
  validateEmail,
  validatePassword,
} from './validation.js';

export type PublicUser = Pick<UserRecord, 'id' | 'email' | 'display_name' | 'status'>;

function publicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    status: user.status,
  };
}

export async function signup(input: {
  email: string;
  password: string;
  displayName: string;
}) {
  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim();

  if (!validateEmail(email)) throw new Error('INVALID_EMAIL');
  if (!validatePassword(input.password)) throw new Error('INVALID_PASSWORD');
  if (!validateDisplayName(displayName)) throw new Error('INVALID_DISPLAY_NAME');

  if (await findUserByEmail(email)) throw new Error('AUTH_FAILED');

  const passwordHash = await hashPassword(input.password);
  const token = createSessionToken();
  const expiresAt = sessionExpiry(false);
  const user = await createUserAndSession(
    email,
    passwordHash,
    displayName,
    hashSessionToken(token),
    expiresAt,
  );

  return { user: publicUser(user), token, expiresAt };
}

export async function login(input: {
  email: string;
  password: string;
  rememberDevice: boolean;
}) {
  const email = normalizeEmail(input.email);
  const user = await findUserByEmail(email);

  if (!user || user.status !== 'active' || !(await verifyPassword(input.password, user.password_hash))) {
    throw new Error('AUTH_FAILED');
  }

  const token = createSessionToken();
  const expiresAt = sessionExpiry(input.rememberDevice);
  await createSession(user.id, hashSessionToken(token), expiresAt);

  return { user: publicUser(user), token, expiresAt };
}

export async function authenticateSession(token: string | undefined) {
  if (!token) return null;
  return findSessionUser(hashSessionToken(token));
}

export async function logout(token: string | undefined) {
  if (token) await revokeSession(hashSessionToken(token));
}

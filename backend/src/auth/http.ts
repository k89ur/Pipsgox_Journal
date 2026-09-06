import {
  authenticateSession,
  login,
  logout,
  signup,
} from './service.js';
import {
  clearSessionCookieOptions,
  SESSION_COOKIE,
  sessionCookieOptions,
} from './session.js';

export type AuthRequest = {
  cookies?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
};

export type AuthResponse = {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
  setCookie?: { name: string; value: string; options: ReturnType<typeof sessionCookieOptions> };
  clearCookie?: { name: string; options: ReturnType<typeof clearSessionCookieOptions> };
};

const production = process.env.NODE_ENV === 'production';

export async function signupHandler(req: AuthRequest): Promise<AuthResponse> {
  try {
    const result = await signup({
      email: String(req.body?.email ?? ''),
      password: String(req.body?.password ?? ''),
      displayName: String(req.body?.display_name ?? ''),
    });

    return {
      status: 201,
      body: { user: result.user },
      setCookie: {
        name: SESSION_COOKIE,
        value: result.token,
        options: sessionCookieOptions(production, result.expiresAt),
      },
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    if (code === 'INVALID_EMAIL' || code === 'INVALID_PASSWORD' || code === 'INVALID_DISPLAY_NAME') {
      return { status: 400, body: { error: code } };
    }
    return { status: 409, body: { error: 'AUTH_FAILED' } };
  }
}

export async function loginHandler(req: AuthRequest): Promise<AuthResponse> {
  try {
    const result = await login({
      email: String(req.body?.email ?? ''),
      password: String(req.body?.password ?? ''),
      rememberDevice: req.body?.remember_device === true,
    });

    return {
      status: 200,
      body: { user: result.user },
      setCookie: {
        name: SESSION_COOKIE,
        value: result.token,
        options: sessionCookieOptions(production, result.expiresAt),
      },
    };
  } catch {
    return { status: 401, body: { error: 'AUTH_FAILED' } };
  }
}

export async function meHandler(req: AuthRequest): Promise<AuthResponse> {
  const user = await authenticateSession(req.cookies?.[SESSION_COOKIE]);
  if (!user) return { status: 401, body: { error: 'UNAUTHENTICATED' } };

  return {
    status: 200,
    body: {
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        status: user.status,
      },
    },
  };
}

export async function logoutHandler(req: AuthRequest): Promise<AuthResponse> {
  await logout(req.cookies?.[SESSION_COOKIE]);
  return {
    status: 204,
    body: {},
    clearCookie: {
      name: SESSION_COOKIE,
      options: clearSessionCookieOptions(production),
    },
  };
}

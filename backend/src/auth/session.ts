import crypto from "node:crypto";

export const SESSION_COOKIE = "pipsgox_session";
export const NORMAL_SESSION_DAYS = 7;
export const REMEMBERED_SESSION_DAYS = 30;

export function createSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function sessionExpiry(rememberDevice: boolean, now = new Date()): Date {
  const days = rememberDevice ? REMEMBERED_SESSION_DAYS : NORMAL_SESSION_DAYS;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export function sessionCookieOptions(isProduction: boolean, expires: Date) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export function clearSessionCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
  };
}

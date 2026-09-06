const allowedOrigin = process.env.CORS_ORIGIN?.trim() || null;

export function applySecurityHeaders(res: { setHeader(name: string, value: string): void }): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

export function applyCors(
  req: { headers: Record<string, string | string[] | undefined> },
  res: { setHeader(name: string, value: string): void },
): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (!allowedOrigin || origin !== allowedOrigin) return false;

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  return true;
}

export function isJsonContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  return contentType.split(';', 1)[0].trim().toLowerCase() === 'application/json';
}

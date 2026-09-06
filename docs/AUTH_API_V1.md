# Pipsgox Journal — Authentication API v1

## Endpoints

### POST `/auth/signup`

Request:
```json
{
  "email": "user@example.com",
  "password": "password",
  "display_name": "Trader"
}
```

Behavior:
- Normalize email before lookup/storage.
- Validate email, password and display name.
- Hash password with bcrypt before storage.
- Create the user and a login session atomically.
- Set the session in a secure HttpOnly cookie.
- Return the authenticated user profile.

### POST `/auth/login`

Request:
```json
{
  "email": "user@example.com",
  "password": "password",
  "remember_device": false
}
```

Behavior:
- Normalize email.
- Verify password hash.
- Create a new session only after successful authentication.
- `remember_device=false` → 7-day session.
- `remember_device=true` → 30-day session.
- Invalid credentials return a generic authentication failure and create no session.

### GET `/auth/me`

Behavior:
- Read the HttpOnly session cookie.
- Hash the presented token and look up the session.
- Reject missing, revoked or expired sessions with HTTP 401.
- Return the authenticated user's profile for a valid session.

### POST `/auth/logout`

Behavior:
- Read the current session cookie.
- Revoke the matching server-side session when present.
- Clear the session cookie.
- Safe to call even when no valid session exists.

## Security Rules

- Passwords are never stored in plaintext.
- Session tokens are random 256-bit values.
- Only a SHA-256 hash of a session token is stored in PostgreSQL.
- Session cookies are HttpOnly, SameSite=Lax, and Secure in production.
- Backend authorization uses the authenticated session's user ID; frontend-supplied user IDs are never trusted.
- Production deployment must add rate limiting/brute-force protection.
- Error responses must not reveal whether an email address exists.

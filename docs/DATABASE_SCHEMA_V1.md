# Pipsgox Journal — Database Schema v1

## Status
Planning / Design — no application code is changed by this document.

## 1. Design Goals

- PostgreSQL is the system of record for application data.
- The browser never connects directly to PostgreSQL.
- Authentication and authorization are handled by the backend.
- Every private record is owned by, or traceable to, an authenticated user.
- Passwords are never stored in plaintext.
- Database credentials and session secrets remain server-side environment secrets.
- Schema should support future journal features without premature complexity.

## 2. Core Relationship

```text
users
  ├── sessions
  ├── trading_accounts
  │      └── trades
  └── journal_entries
```

## 3. users

Purpose: identity and account-level information.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| email | VARCHAR | Required, normalized, unique |
| password_hash | TEXT | Required |
| display_name | VARCHAR | Required |
| status | VARCHAR/enum | Required; active/inactive/blocked |
| created_at | TIMESTAMPTZ | Required |
| updated_at | TIMESTAMPTZ | Required |

Notes:
- Email comparison/uniqueness policy must be defined consistently during implementation.
- Password hashing is performed only by the backend.

## 4. sessions

Purpose: server-side login sessions.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | Required; FK → users.id |
| session_token_hash | TEXT | Required, unique |
| created_at | TIMESTAMPTZ | Required |
| expires_at | TIMESTAMPTZ | Required |
| last_seen_at | TIMESTAMPTZ | Required |
| revoked_at | TIMESTAMPTZ | Nullable |

Rules:
- Store only a hash of the session token server-side.
- Browser receives only the session credential through a secure cookie mechanism.
- Revoked or expired sessions cannot authenticate requests.
- Multiple sessions per user are allowed.

Indexes:
- Unique index on session token hash.
- Index on user_id.
- Index supporting expiry cleanup.

## 5. trading_accounts

Purpose: separate trading accounts/brokers belonging to a user.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | Required; FK → users.id |
| name | VARCHAR | Required |
| broker | VARCHAR | Nullable initially |
| base_currency | VARCHAR(3) | Required |
| is_active | BOOLEAN | Required, default true |
| created_at | TIMESTAMPTZ | Required |
| updated_at | TIMESTAMPTZ | Required |

Ownership rule: a trading account can only be accessed through its owning user_id.

## 6. trades

Purpose: central trading-journal record.

Initial conceptual fields:

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| trading_account_id | UUID | Required; FK → trading_accounts.id |
| symbol | VARCHAR | Required |
| direction | VARCHAR/enum | Required; long/short |
| quantity | NUMERIC | Required |
| entry_price | NUMERIC | Required |
| exit_price | NUMERIC | Nullable until closed |
| entry_at | TIMESTAMPTZ | Required |
| exit_at | TIMESTAMPTZ | Nullable |
| fees | NUMERIC | Default 0 |
| realized_pnl | NUMERIC | Nullable until closed/calculated |
| setup | VARCHAR | Nullable initially |
| notes | TEXT | Nullable |
| created_at | TIMESTAMPTZ | Required |
| updated_at | TIMESTAMPTZ | Required |

The exact trading model will be finalized before implementation, especially handling partial exits, multiple entries, screenshots, tags, and calculated metrics.

## 7. journal_entries

Purpose: non-trade-specific journal notes and observations.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | Required; FK → users.id |
| trade_id | UUID | Nullable; FK → trades.id when applicable |
| title | VARCHAR | Nullable initially |
| content | TEXT | Required |
| entry_at | TIMESTAMPTZ | Required |
| created_at | TIMESTAMPTZ | Required |
| updated_at | TIMESTAMPTZ | Required |

## 8. Authorization Rule

Every private request follows:

```text
Request
  ↓
Authenticate session
  ↓
Get authenticated user_id
  ↓
Authorize requested resource
  ↓
Query only records owned by / belonging to user_id
```

The frontend must never be trusted to supply an arbitrary user_id for authorization.

## 9. Database Connection Lifecycle

```text
Application startup
  ↓
Load DATABASE_URL from server environment
  ↓
Create PostgreSQL connection pool
  ↓
Run migrations / health checks
  ↓
Accept requests

Request
  ↓
Authentication
  ↓
Authorization
  ↓
Acquire pooled DB connection
  ↓
Parameterized query or transaction
  ↓
Return result
  ↓
Release connection to pool
```

## 10. Transactions

Operations that must succeed or fail together use a database transaction.

Example:

```text
BEGIN
  create/update trade
  create related journal/tag records
COMMIT
```

Any failure causes rollback so partial data is not committed.

## 11. Future Schema Extensions

Possible later additions:

- email verification
- password reset tokens
- two-factor authentication
- device/session management
- tags
- setups/strategies
- screenshots/attachments via object storage
- trade executions for multiple-entry/multiple-exit trades
- imported broker executions
- analytics/materialized reporting structures

These are deliberately not included in v1 until the core model is proven.

## 12. Next Design Step

Before creating migrations or application code, finalize:

1. Exact PostgreSQL data types and constraints.
2. Trade model, including partial entries/exits.
3. Index strategy.
4. Delete/cascade behavior.
5. Authentication API contract.
6. Session lifetime and expiry policy.

Only after those decisions are approved should implementation begin.

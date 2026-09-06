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
  │             └── executions
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

Purpose: one trading idea/position. A trade may contain multiple entries and exits.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| trading_account_id | UUID | Required; FK → trading_accounts.id |
| symbol | VARCHAR | Required |
| direction | VARCHAR/enum | Required; long/short |
| status | VARCHAR/enum | Calculated; open/closed |
| setup | VARCHAR | Nullable initially |
| strategy | VARCHAR | Nullable initially |
| notes | TEXT | Nullable |
| opened_at | TIMESTAMPTZ | Calculated/from executions |
| closed_at | TIMESTAMPTZ | Nullable; calculated/from executions |
| created_at | TIMESTAMPTZ | Required |
| updated_at | TIMESTAMPTZ | Required |

Trade-level values such as total quantity, average entry, average exit, realized P&L, total charges, and holding time should be calculated from executions rather than manually duplicated here.

## 7. executions

Purpose: one actual buy/sell execution/fill belonging to a trade. Executions are the source of truth for position and realized P&L calculations.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| trade_id | UUID | Required; FK → trades.id |
| side | VARCHAR/enum | Required; buy/sell |
| quantity | NUMERIC | Required; positive |
| price | NUMERIC | Required; positive |
| executed_at | TIMESTAMPTZ | Required |
| total_charges | NUMERIC | System-calculated; default 0 |
| broker_execution_id | VARCHAR | Nullable; useful for imports/deduplication |
| notes | TEXT | Nullable |
| created_at | TIMESTAMPTZ | Required |

### Execution charge model

Pipsgox Journal v1 stores **one charge field only**:

```text
Total Charges
```

`Total Charges` represents all applicable transaction costs for that execution, including brokerage, STT, exchange charges, SEBI charges, GST, stamp duty, and other applicable charges.

The system calculates this total using the supported Zerodha charge-calculation logic. Individual charge components are not stored as separate execution fields in v1.

Trade-level reporting can then calculate:

```text
Gross P&L
   - total execution charges
   = Net P&L
```

## 8. Position and P&L Rules

- A trade is one trading idea/position, regardless of the number of executions.
- Long trades normally open with buy-side quantity and close with sell-side quantity.
- Short trades normally open with sell-side quantity and close with buy-side quantity.
- Partial entries and partial exits are supported.
- Remaining position quantity is calculated from executions.
- A trade is open while its net position quantity is non-zero.
- A trade becomes closed when its net position quantity reaches zero.
- Realized P&L uses **FIFO (First In, First Out)** as the authoritative execution-matching method.
- Gross P&L and net P&L remain distinguishable.
- Net P&L includes all recorded execution-level Total Charges.
- User-facing trade summaries may show average entry, average exit, quantity, gross P&L, total charges, and net P&L as calculated values.

## 9. journal_entries

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

## 10. Authorization Rule

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

## 11. Database Connection Lifecycle

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

## 12. Transactions

Operations that must succeed or fail together use a database transaction.

Example:

```text
BEGIN
  create/update trade
  insert execution(s)
  create related journal/tag records
COMMIT
```

Any failure causes rollback so partial data is not committed.

## 13. Future Schema Extensions

Possible later additions:

- email verification
- password reset tokens
- two-factor authentication
- device/session management
- tags
- setups/strategies as normalized entities
- screenshots/attachments via object storage
- richer execution/import metadata
- broker CSV/API imports
- analytics/materialized reporting structures
- additional broker charge-calculation engines

These are deliberately not included in v1 until the core model is proven.

## 14. Next Design Step

Before creating migrations or application code, finalize:

1. Exact PostgreSQL data types and constraints.
2. Index strategy.
3. Delete/cascade behavior.
4. Authentication API contract.
5. Session lifetime and expiry policy.
6. Broker/import reconciliation rules.
7. Exact Zerodha calculation inputs required by the trade-entry workflow.

Only after those decisions are approved should implementation begin.

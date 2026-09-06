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

### Session Policy v1

- Normal login: 7 days.
- Remember this device OFF: 7 days.
- Remember this device ON: 30 days.
- No separate short idle timeout in v1.
- Logout revokes the current session and clears its cookie.
- Multiple device sessions are allowed.
- Expired/revoked sessions return 401.
- Session credential uses a secure HttpOnly cookie; production also uses Secure and an appropriate SameSite policy.

Indexes:
- Unique session_token_hash.
- user_id.
- expires_at for cleanup.

## 5. trading_accounts

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

## 6. trades

A trade is one trading idea/position and may contain multiple entries and exits.

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

Trade summaries such as average entry, average exit, realized P&L, total charges, and holding time are derived from executions.

## 7. executions

One actual buy/sell entry or exit belonging to a trade.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| trade_id | UUID | Required; FK → trades.id |
| side | VARCHAR/enum | Required; buy/sell |
| quantity | NUMERIC | Required; positive |
| price | NUMERIC | Required; positive |
| executed_at | TIMESTAMPTZ | Required |
| total_charges | NUMERIC | User input; required/default 0; must be >= 0 |
| broker_execution_id | VARCHAR | Nullable; useful for future imports |
| notes | TEXT | Nullable |
| created_at | TIMESTAMPTZ | Required |

### Total Charges — v1 locked rule

Pipsgox Journal does **not** calculate brokerage or statutory charges in v1.

There is only one user-entered field:

```text
Total Charges
```

It represents the combined brokerage, taxes, duties and other charges for that execution.

**Total Charges must appear on both the Entry Position form and the Exit Position form**, because charges may be incurred on both buy and sell transactions.

For a trade with multiple executions:

```text
Entry execution 1 → Total Charges
Entry execution 2 → Total Charges
Exit execution 1  → Total Charges
Exit execution 2  → Total Charges
```

Trade-level total charges are the sum of all execution `total_charges` values.

```text
Gross P&L
   - Entry-side Total Charges
   - Exit-side Total Charges
   = Net P&L
```

No Zerodha charge calculator or broker-specific charge-calculation engine is required for v1.

## 8. Position and P&L Rules

- One trade represents one trading idea/position.
- Long trades normally open with buy executions and close with sell executions.
- Short trades normally open with sell executions and close with buy executions.
- Partial entries and partial exits are supported.
- Remaining position quantity is derived from executions.
- A trade is open while net position quantity is non-zero.
- It is closed when net position quantity reaches zero.
- Realized P&L uses FIFO (First In, First Out).
- Gross P&L and Net P&L remain separate.
- Net P&L deducts Total Charges from all entry and exit executions.

## 9. journal_entries

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | Required; FK → users.id |
| trade_id | UUID | Nullable; FK → trades.id |
| title | VARCHAR | Nullable initially |
| content | TEXT | Required |
| entry_at | TIMESTAMPTZ | Required |
| created_at | TIMESTAMPTZ | Required |
| updated_at | TIMESTAMPTZ | Required |

## 10. Authorization Rule

```text
Request
  ↓
Authenticate session
  ↓
Get authenticated user_id
  ↓
Authorize requested resource
  ↓
Query only records belonging to that user
```

Frontend-supplied user_id is never trusted for authorization.

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
```

Requests acquire a pooled connection, execute parameterized queries/transactions, then release it back to the pool.

## 12. Transactions

Operations that must succeed/fail together use a database transaction so partially saved trades are not committed.

## 13. Future Schema Extensions

Possible later additions include email verification, password reset, 2FA, tags, normalized strategies/setups, screenshots, broker imports and analytics structures.

## 14. Remaining Design Steps

Before migrations/application code:

1. Exact PostgreSQL data types and constraints.
2. Index strategy.
3. Delete/cascade behavior.
4. Authentication API contract.
5. Session policy — done.
6. Broker/import reconciliation rules can be deferred until broker import is planned.

The Zerodha calculation-input requirement has been removed from v1.

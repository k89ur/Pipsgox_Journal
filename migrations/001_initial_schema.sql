-- Pipsgox Journal — Initial PostgreSQL Schema v1
-- Status: Planning-approved migration baseline

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(320) NOT NULL,
    password_hash TEXT NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_status_check CHECK (status IN ('active', 'inactive', 'blocked'))
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,

    CONSTRAINT sessions_token_hash_unique UNIQUE (session_token_hash),
    CONSTRAINT sessions_expiry_check CHECK (expires_at > created_at)
);

CREATE TABLE trading_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    broker VARCHAR(100),
    base_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT trading_accounts_currency_check CHECK (base_currency = UPPER(base_currency))
);

CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trading_account_id UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
    symbol VARCHAR(50) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'open',
    setup VARCHAR(100),
    strategy VARCHAR(100),
    notes TEXT,
    opened_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT trades_direction_check CHECK (direction IN ('long', 'short')),
    CONSTRAINT trades_status_check CHECK (status IN ('open', 'closed')),
    CONSTRAINT trades_closed_at_check CHECK (closed_at IS NULL OR opened_at IS NULL OR closed_at >= opened_at)
);

CREATE TABLE executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    side VARCHAR(4) NOT NULL,
    quantity NUMERIC(20,6) NOT NULL,
    price NUMERIC(20,8) NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL,
    total_charges NUMERIC(20,8) NOT NULL DEFAULT 0,
    broker_execution_id VARCHAR(150),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT executions_side_check CHECK (side IN ('buy', 'sell')),
    CONSTRAINT executions_quantity_check CHECK (quantity > 0),
    CONSTRAINT executions_price_check CHECK (price > 0),
    CONSTRAINT executions_total_charges_check CHECK (total_charges >= 0)
);

CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
    title VARCHAR(200),
    content TEXT NOT NULL,
    entry_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Authentication/session indexes.
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- User-owned account and journal lookup indexes.
CREATE INDEX idx_trading_accounts_user_id ON trading_accounts(user_id);
CREATE INDEX idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX idx_journal_entries_trade_id ON journal_entries(trade_id);

-- Trade/execution lookup indexes.
CREATE INDEX idx_trades_account_id ON trades(trading_account_id);
CREATE INDEX idx_trades_account_status ON trades(trading_account_id, status);
CREATE INDEX idx_executions_trade_id_executed_at ON executions(trade_id, executed_at, created_at);

-- Future broker import deduplication. Multiple NULLs remain allowed.
CREATE UNIQUE INDEX idx_executions_broker_execution_id
    ON executions(broker_execution_id)
    WHERE broker_execution_id IS NOT NULL;

COMMIT;

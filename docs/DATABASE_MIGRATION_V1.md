# Pipsgox Journal — Database Migration v1

## Status
Migration created — application code is not changed yet.

## Migration
`migrations/001_initial_schema.sql`

## Scope

Creates the initial PostgreSQL schema for:

- users
- sessions
- trading_accounts
- trades
- executions
- journal_entries

Also creates the required foreign keys, validation constraints, ownership/lookup indexes, and future broker execution deduplication index.

## Delete behavior

- Deleting a user cascades to sessions, trading accounts, trades, executions, and journal entries.
- Deleting a trading account cascades to its trades and executions.
- Deleting a trade cascades to its executions.
- Deleting a trade sets a linked journal entry's `trade_id` to NULL so the journal entry is preserved.

## Important

This migration defines the database structure only. It does not connect the application to PostgreSQL and does not create application code.

## Next step

After schema review, implement the database connection layer and migration runner, then add the authentication backend.

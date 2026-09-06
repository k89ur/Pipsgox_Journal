import {
  createAccount,
  deactivateAccount,
  findAccountById,
  listAccounts,
  updateAccount,
  type TradingAccount,
} from './repository.js';

export type AccountInput = {
  name: string;
  broker?: string | null;
  baseCurrency?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUserId(userId: string): void {
  if (!UUID_RE.test(userId)) throw new Error('UNAUTHENTICATED');
}

function validateName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_NAME');
  const name = value.trim();
  if (name.length < 1 || name.length > 100) throw new Error('INVALID_NAME');
  return name;
}

function validateBroker(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error('INVALID_BROKER');
  const broker = value.trim();
  if (broker.length > 100) throw new Error('INVALID_BROKER');
  return broker || null;
}

function validateCurrency(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_CURRENCY');
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('INVALID_CURRENCY');
  return currency;
}

function publicAccount(account: TradingAccount) {
  return {
    id: account.id,
    name: account.name,
    broker: account.broker,
    base_currency: account.base_currency,
    is_active: account.is_active,
    created_at: account.created_at,
    updated_at: account.updated_at,
  };
}

export async function createTradingAccount(userId: string, input: AccountInput) {
  requireUserId(userId);
  const name = validateName(input.name);
  const broker = validateBroker(input.broker);
  const baseCurrency = validateCurrency(input.baseCurrency ?? 'INR');
  return publicAccount(await createAccount(userId, { name, broker, baseCurrency }));
}

export async function getTradingAccounts(userId: string) {
  requireUserId(userId);
  const accounts = await listAccounts(userId);
  return accounts.map(publicAccount);
}

export async function getTradingAccount(userId: string, accountId: string) {
  requireUserId(userId);
  if (!UUID_RE.test(accountId)) return null;
  const account = await findAccountById(userId, accountId);
  return account ? publicAccount(account) : null;
}

export async function updateTradingAccount(
  userId: string,
  accountId: string,
  input: Record<string, unknown>,
) {
  requireUserId(userId);
  if (!UUID_RE.test(accountId)) return null;

  const update: {
    name?: string;
    broker?: string | null;
    baseCurrency?: string;
    isActive?: boolean;
  } = {};

  if (Object.prototype.hasOwnProperty.call(input, 'name')) update.name = validateName(input.name);
  if (Object.prototype.hasOwnProperty.call(input, 'broker')) update.broker = validateBroker(input.broker);
  if (Object.prototype.hasOwnProperty.call(input, 'base_currency')) update.baseCurrency = validateCurrency(input.base_currency);
  if (Object.prototype.hasOwnProperty.call(input, 'is_active')) {
    if (typeof input.is_active !== 'boolean') throw new Error('INVALID_ACTIVE_FLAG');
    update.isActive = input.is_active;
  }

  if (!Object.keys(update).length) throw new Error('NO_FIELDS');
  const account = await updateAccount(userId, accountId, update);
  return account ? publicAccount(account) : null;
}

export async function deleteTradingAccount(userId: string, accountId: string): Promise<boolean> {
  requireUserId(userId);
  if (!UUID_RE.test(accountId)) return false;
  return deactivateAccount(userId, accountId);
}

import { authenticateSession, type PublicUser } from '../auth/service.js';
import {
  createTradingAccount,
  deleteTradingAccount,
  getTradingAccount,
  getTradingAccounts,
  updateTradingAccount,
} from './service.js';

export type AccountRequest = {
  user: PublicUser;
  body?: Record<string, unknown>;
  accountId?: string;
};

export type AccountResponse = {
  status: number;
  body: Record<string, unknown>;
};

export async function authenticateAccountRequest(
  token: string | undefined,
): Promise<PublicUser | null> {
  const user = await authenticateSession(token);
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    status: user.status,
  };
}

export async function createAccountHandler(req: AccountRequest): Promise<AccountResponse> {
  try {
    const account = await createTradingAccount(req.user.id, {
      name: String(req.body?.name ?? ''),
      broker: req.body?.broker === undefined ? null : req.body.broker as string | null,
      baseCurrency: req.body?.base_currency === undefined ? 'INR' : String(req.body.base_currency),
    });
    return { status: 201, body: { account } };
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INVALID_ACCOUNT';
    return { status: 400, body: { error: code } };
  }
}

export async function listAccountsHandler(req: AccountRequest): Promise<AccountResponse> {
  return { status: 200, body: { accounts: await getTradingAccounts(req.user.id) } };
}

export async function getAccountHandler(req: AccountRequest): Promise<AccountResponse> {
  const account = await getTradingAccount(req.user.id, req.accountId ?? '');
  if (!account) return { status: 404, body: { error: 'ACCOUNT_NOT_FOUND' } };
  return { status: 200, body: { account } };
}

export async function updateAccountHandler(req: AccountRequest): Promise<AccountResponse> {
  try {
    const account = await updateTradingAccount(req.user.id, req.accountId ?? '', req.body ?? {});
    if (!account) return { status: 404, body: { error: 'ACCOUNT_NOT_FOUND' } };
    return { status: 200, body: { account } };
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INVALID_ACCOUNT';
    return { status: 400, body: { error: code } };
  }
}

export async function deleteAccountHandler(req: AccountRequest): Promise<AccountResponse> {
  const deleted = await deleteTradingAccount(req.user.id, req.accountId ?? '');
  if (!deleted) return { status: 404, body: { error: 'ACCOUNT_NOT_FOUND' } };
  return { status: 204, body: {} };
}

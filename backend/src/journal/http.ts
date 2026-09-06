import { authenticateSession } from '../auth/service.js';
import {
  createEntry,
  deleteEntry,
  getEntry,
  listEntries,
  updateEntry,
} from './service.js';

export type JournalRequest = {
  userId?: string;
  entryId?: string;
  body?: Record<string, unknown>;
  cookies?: Record<string, string | undefined>;
};

export type JournalResponse = {
  status: number;
  body: Record<string, unknown>;
};

export async function authenticateJournalRequest(token: string | undefined) {
  return authenticateSession(token);
}

function validationStatus(code: string): number {
  return ['INVALID_TRADE_ID', 'INVALID_TITLE', 'INVALID_CONTENT', 'INVALID_ENTRY_AT', 'NO_FIELDS'].includes(code) ? 400 : 422;
}

export async function createJournalEntryHandler(req: JournalRequest): Promise<JournalResponse> {
  try {
    return { status: 201, body: { entry: await createEntry(req.userId!, req.body ?? {}) } };
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
    if (code === 'TRADE_NOT_FOUND') return { status: 404, body: { error: code } };
    if (code.startsWith('INVALID_') || code === 'NO_FIELDS') return { status: validationStatus(code), body: { error: code } };
    throw error;
  }
}

export async function listJournalEntriesHandler(req: JournalRequest): Promise<JournalResponse> {
  return { status: 200, body: { entries: await listEntries(req.userId!) } };
}

export async function getJournalEntryHandler(req: JournalRequest): Promise<JournalResponse> {
  const entry = await getEntry(req.userId!, req.entryId!);
  return entry ? { status: 200, body: { entry } } : { status: 404, body: { error: 'NOT_FOUND' } };
}

export async function updateJournalEntryHandler(req: JournalRequest): Promise<JournalResponse> {
  try {
    const entry = await updateEntry(req.userId!, req.entryId!, req.body ?? {});
    return entry ? { status: 200, body: { entry } } : { status: 404, body: { error: 'NOT_FOUND' } };
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
    if (code === 'TRADE_NOT_FOUND') return { status: 404, body: { error: code } };
    if (code.startsWith('INVALID_') || code === 'NO_FIELDS') return { status: validationStatus(code), body: { error: code } };
    throw error;
  }
}

export async function deleteJournalEntryHandler(req: JournalRequest): Promise<JournalResponse> {
  const deleted = await deleteEntry(req.userId!, req.entryId!);
  return deleted ? { status: 204, body: {} } : { status: 404, body: { error: 'NOT_FOUND' } };
}

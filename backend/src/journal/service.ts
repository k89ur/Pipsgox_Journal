import {
  createJournalEntry,
  deleteJournalEntry,
  findJournalEntry,
  listJournalEntries,
  updateJournalEntry,
  type JournalEntry,
} from './repository.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUserId(userId: string): void {
  if (!UUID_RE.test(userId)) throw new Error('UNAUTHENTICATED');
}

function validateEntryId(entryId: string): boolean {
  return UUID_RE.test(entryId);
}

function validateTradeId(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw new Error('INVALID_TRADE_ID');
  return value;
}

function validateTitle(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error('INVALID_TITLE');
  const title = value.trim();
  if (title.length > 200) throw new Error('INVALID_TITLE');
  return title || null;
}

function validateContent(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_CONTENT');
  const content = value.trim();
  if (!content || content.length > 1_000_000) throw new Error('INVALID_CONTENT');
  return content;
}

function validateEntryAt(value: unknown): Date {
  if (typeof value !== 'string' || !value.trim()) throw new Error('INVALID_ENTRY_AT');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('INVALID_ENTRY_AT');
  return date;
}

function publicEntry(entry: JournalEntry) {
  return {
    id: entry.id,
    trade_id: entry.trade_id,
    title: entry.title,
    content: entry.content,
    entry_at: entry.entry_at,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };
}

export async function createEntry(
  userId: string,
  input: { trade_id?: unknown; title?: unknown; content: unknown; entry_at: unknown },
) {
  requireUserId(userId);
  const tradeId = validateTradeId(input.trade_id);
  const title = validateTitle(input.title);
  const content = validateContent(input.content);
  const entryAt = validateEntryAt(input.entry_at);
  const entry = await createJournalEntry(userId, { tradeId, title, content, entryAt });
  if (!entry) throw new Error('TRADE_NOT_FOUND');
  return publicEntry(entry);
}

export async function listEntries(userId: string) {
  requireUserId(userId);
  return (await listJournalEntries(userId)).map(publicEntry);
}

export async function getEntry(userId: string, entryId: string) {
  requireUserId(userId);
  if (!validateEntryId(entryId)) return null;
  const entry = await findJournalEntry(userId, entryId);
  return entry ? publicEntry(entry) : null;
}

export async function updateEntry(userId: string, entryId: string, input: Record<string, unknown>) {
  requireUserId(userId);
  if (!validateEntryId(entryId)) return null;

  const update: { tradeId?: string | null; title?: string | null; content?: string; entryAt?: Date } = {};
  if (Object.prototype.hasOwnProperty.call(input, 'trade_id')) update.tradeId = validateTradeId(input.trade_id);
  if (Object.prototype.hasOwnProperty.call(input, 'title')) update.title = validateTitle(input.title);
  if (Object.prototype.hasOwnProperty.call(input, 'content')) update.content = validateContent(input.content);
  if (Object.prototype.hasOwnProperty.call(input, 'entry_at')) update.entryAt = validateEntryAt(input.entry_at);
  if (!Object.keys(update).length) throw new Error('NO_FIELDS');

  const entry = await updateJournalEntry(userId, entryId, update);
  return entry ? publicEntry(entry) : null;
}

export async function deleteEntry(userId: string, entryId: string): Promise<boolean> {
  requireUserId(userId);
  if (!validateEntryId(entryId)) return false;
  return deleteJournalEntry(userId, entryId);
}

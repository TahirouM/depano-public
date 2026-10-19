import { badRequest } from './errors';

/** Curseur opaque : décalage encodé (suffisant pour le MVP, stable avec un tri déterministe). */
export function decodeOffset(cursor?: string | null): number {
  if (!cursor) return 0;
  const n = Number(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (!Number.isInteger(n) || n < 0) throw badRequest('invalid_cursor', 'Curseur de pagination invalide.');
  return n;
}
export const encodeOffset = (n: number) => Buffer.from(String(n), 'utf8').toString('base64url');

export function paginate<T>(rows: T[], offset: number, limit: number) {
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? encodeOffset(offset + limit) : null };
}

/** Curseur temporel (createdAt|id) pour les listes triées par date décroissante. */
export function encodeTimeCursor(createdAt: Date, id: string) {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString('base64url');
}
export function decodeTimeCursor(cursor?: string | null): { at: Date; id: string } | null {
  if (!cursor) return null;
  const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const at = new Date(iso ?? '');
  if (!id || Number.isNaN(at.getTime())) throw badRequest('invalid_cursor', 'Curseur de pagination invalide.');
  return { at, id };
}

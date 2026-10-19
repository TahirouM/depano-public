import * as Crypto from 'expo-crypto';

/** Identifiant client (optimistic UI + idempotence côté API). */
export function newClientId(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

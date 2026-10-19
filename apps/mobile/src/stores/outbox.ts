import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { asyncJSONStorage } from './storage';

/** Message en attente d'envoi (optimistic UI + file hors ligne). */
export interface OutboxMessage {
  clientId: string;
  conversationId: string;
  kind: 'text' | 'image' | 'voice';
  body?: string;
  /** Fichier local à téléverser avant l'envoi. */
  localUri?: string;
  contentType?: string;
  fileId?: string;
  durationMs?: number;
  createdAt: string;
  status: 'pending' | 'failed';
}

interface OutboxState {
  items: Record<string, OutboxMessage[]>;
  upsert: (m: OutboxMessage) => void;
  update: (conversationId: string, clientId: string, patch: Partial<OutboxMessage>) => void;
  remove: (conversationId: string, clientId: string) => void;
  clear: () => void;
}

export const useOutboxStore = create<OutboxState>()(
  persist(
    (set) => ({
      items: {},
      upsert: (m) =>
        set((s) => {
          const list = s.items[m.conversationId] ?? [];
          const idx = list.findIndex((x) => x.clientId === m.clientId);
          const next = idx >= 0 ? list.map((x, i) => (i === idx ? { ...x, ...m } : x)) : [...list, m];
          return { items: { ...s.items, [m.conversationId]: next } };
        }),
      update: (conversationId, clientId, patch) =>
        set((s) => ({
          items: {
            ...s.items,
            [conversationId]: (s.items[conversationId] ?? []).map((x) => (x.clientId === clientId ? { ...x, ...patch } : x)),
          },
        })),
      remove: (conversationId, clientId) =>
        set((s) => ({
          items: { ...s.items, [conversationId]: (s.items[conversationId] ?? []).filter((x) => x.clientId !== clientId) },
        })),
      clear: () => set({ items: {} }),
    }),
    { name: 'depano.outbox', storage: asyncJSONStorage, version: 1 },
  ),
);

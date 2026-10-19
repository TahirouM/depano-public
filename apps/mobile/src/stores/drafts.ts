import type { CreateBookingBody, DomainCode, ScheduledType } from '@depano/schemas';
import { useCallback } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { asyncJSONStorage } from './storage';

/**
 * Brouillons des formulaires multi-étapes, persistés : on ne perd jamais une saisie
 * (retour arrière, app tuée, passage par la connexion).
 */
export interface DraftsState {
  drafts: Record<string, { data: Record<string, unknown>; updatedAt: number }>;
  patch: (key: string, data: Record<string, unknown>) => void;
  reset: (key: string) => void;
  resetAll: () => void;
}

export const useDraftsStore = create<DraftsState>()(
  persist(
    (set) => ({
      drafts: {},
      patch: (key, data) =>
        set((s) => ({
          drafts: { ...s.drafts, [key]: { data: { ...(s.drafts[key]?.data ?? {}), ...data }, updatedAt: Date.now() } },
        })),
      reset: (key) =>
        set((s) => {
          const { [key]: _removed, ...rest } = s.drafts;
          return { drafts: rest };
        }),
      resetAll: () => set({ drafts: {} }),
    }),
    { name: 'depano.drafts', storage: asyncJSONStorage, version: 1 },
  ),
);

/** Champs saisis dans le parcours urgence (étapes domaine → motif → adresse → paiement). */
export interface UrgentDraft {
  domain?: DomainCode;
  serviceId?: string;
  problemReason?: string;
  problemDescription?: string;
  /** Fichiers déjà téléversés (ids) + aperçus locaux. */
  problemFileIds?: string[];
  problemPhotoUris?: string[];
  addressId?: string;
  address?: CreateBookingBody['address'];
  withGuarantee?: boolean;
  waivesWithdrawal?: boolean;
}

/** Champs saisis dans le parcours RDV (type → motif → créneau → récap). */
export interface ScheduledDraft extends Omit<UrgentDraft, 'waivesWithdrawal'> {
  artisanId?: string;
  scheduledType?: ScheduledType;
  scheduledAt?: string;
}

export const DRAFT_KEYS = {
  urgent: 'urgent',
  scheduled: (artisanId: string) => `rdv:${artisanId}`,
} as const;

/**
 * `const [draft, patch, reset] = useDraft<UrgentDraft>(DRAFT_KEYS.urgent)`
 */
export function useDraft<T extends object>(key: string): [Partial<T>, (p: Partial<T>) => void, () => void] {
  const data = useDraftsStore((s) => s.drafts[key]?.data) as Partial<T> | undefined;
  const patchStore = useDraftsStore((s) => s.patch);
  const resetStore = useDraftsStore((s) => s.reset);
  const patch = useCallback((p: Partial<T>) => patchStore(key, p as Record<string, unknown>), [key, patchStore]);
  const reset = useCallback(() => resetStore(key), [key, resetStore]);
  return [data ?? EMPTY, patch, reset];
}

const EMPTY = Object.freeze({}) as Partial<never>;

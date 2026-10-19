import { beforeEach, describe, expect, it } from 'vitest';
import { mem } from './setup';
import { useAppStore } from '../app';
import { selectIsSignedIn, useAuthStore } from '../auth';
import { DRAFT_KEYS, useDraftsStore } from '../drafts';
import { useOutboxStore } from '../outbox';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('auth store', () => {
  beforeEach(() => useAuthStore.getState().clear());

  it('ouvre et ferme une session', async () => {
    expect(selectIsSignedIn(useAuthStore.getState())).toBe(false);
    useAuthStore.getState().setSession({ accessToken: 'a'.repeat(30), refreshToken: 'r'.repeat(30) }, 'u1');
    expect(selectIsSignedIn(useAuthStore.getState())).toBe(true);
    await flush();
    const persisted = JSON.parse(mem.get('depano.session') ?? '{}');
    expect(persisted.state.refreshToken).toBe('r'.repeat(30));
    expect(persisted.state.returnTo).toBeUndefined(); // non persisté
    useAuthStore.getState().clear();
    expect(useAuthStore.getState().userId).toBeNull();
  });

  it('mémorise le retour après connexion', () => {
    useAuthStore.getState().setReturnTo('/urgence/paiement', 'Pour payer');
    expect(useAuthStore.getState().returnTo).toBe('/urgence/paiement');
    expect(useAuthStore.getState().authReason).toBe('Pour payer');
  });
});

describe('app store', () => {
  it('rôle actif et onboarding', () => {
    const s = useAppStore.getState();
    expect(s.activeRole).toBe('client');
    s.setActiveRole('artisan');
    s.setOnboardingSeen();
    expect(useAppStore.getState().activeRole).toBe('artisan');
    expect(useAppStore.getState().onboardingSeen).toBe(true);
    useAppStore.getState().resetForSignOut();
    expect(useAppStore.getState().activeRole).toBe('client');
    expect(useAppStore.getState().onboardingSeen).toBe(true);
  });
});

describe('drafts store', () => {
  beforeEach(() => useDraftsStore.getState().resetAll());

  it('fusionne les étapes sans perdre la saisie', async () => {
    const { patch } = useDraftsStore.getState();
    patch(DRAFT_KEYS.urgent, { domain: 'plomberie' });
    patch(DRAFT_KEYS.urgent, { problemReason: 'Fuite sous évier' });
    expect(useDraftsStore.getState().drafts.urgent?.data).toEqual({ domain: 'plomberie', problemReason: 'Fuite sous évier' });
    await flush();
    expect(mem.get('depano.drafts')).toContain('Fuite sous évier');
  });

  it('isole les brouillons par artisan et les réinitialise', () => {
    const { patch, reset } = useDraftsStore.getState();
    patch(DRAFT_KEYS.scheduled('a1'), { scheduledType: 'maintenance' });
    patch(DRAFT_KEYS.scheduled('a2'), { scheduledType: 'repair' });
    reset(DRAFT_KEYS.scheduled('a1'));
    expect(useDraftsStore.getState().drafts['rdv:a1']).toBeUndefined();
    expect(useDraftsStore.getState().drafts['rdv:a2']?.data).toEqual({ scheduledType: 'repair' });
  });
});

describe('outbox store', () => {
  beforeEach(() => useOutboxStore.getState().clear());

  it('file d’envoi : ajout, échec, suppression', () => {
    const o = useOutboxStore.getState();
    const msg = { clientId: 'c1', conversationId: 'conv', kind: 'text' as const, body: 'Bonjour', createdAt: new Date().toISOString(), status: 'pending' as const };
    o.upsert(msg);
    o.upsert({ ...msg, body: 'Bonjour !' }); // même clientId : pas de doublon
    expect(useOutboxStore.getState().items.conv).toHaveLength(1);
    o.update('conv', 'c1', { status: 'failed' });
    expect(useOutboxStore.getState().items.conv?.[0]?.status).toBe('failed');
    o.remove('conv', 'c1');
    expect(useOutboxStore.getState().items.conv).toHaveLength(0);
  });
});

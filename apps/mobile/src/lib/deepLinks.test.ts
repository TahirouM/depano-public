import { describe, expect, it } from 'vitest';
import { DEEP_LINKS } from '@depano/schemas';
import { normalizeLinkPath, resolveDeepLink } from './deepLinks';

describe('resolveDeepLink', () => {
  it('normalise les schémas', () => {
    expect(normalizeLinkPath('depano://intervention/abc')).toBe('/intervention/abc');
    expect(normalizeLinkPath('https://depano.fr/messages/1/')).toBe('/messages/1');
  });
  it('intervention → espace actif', () => {
    expect(resolveDeepLink(DEEP_LINKS.intervention('b1'), 'client')).toBe('/activite/b1');
    expect(resolveDeepLink(DEEP_LINKS.intervention('b1'), 'artisan')).toBe('/pro/interventions/b1');
  });
  it('conversation → chat du bon espace', () => {
    expect(resolveDeepLink(DEEP_LINKS.conversation('c1'), 'client')).toBe('/messages/c1');
    expect(resolveDeepLink(DEEP_LINKS.conversation('c1'), 'artisan')).toBe('/pro/messages/c1');
  });
  it('offre et fiche artisan', () => {
    expect(resolveDeepLink(DEEP_LINKS.offer('o1'), 'artisan')).toBe('/pro/offre/o1');
    expect(resolveDeepLink(DEEP_LINKS.artisan('a1'), 'client')).toBe('/artisan/a1');
  });
  it('onglets client : rendez-vous, interventions réalisées, parrainage', () => {
    expect(resolveDeepLink('depano://rendez-vous', 'client')).toBe('/activite');
    expect(resolveDeepLink('depano://rendez-vous/b1', 'client')).toBe('/activite/b1');
    expect(resolveDeepLink('depano://interventions', 'client')).toBe('/interventions');
    expect(resolveDeepLink('depano://interventions/b1', 'client')).toBe('/interventions/b1');
    expect(resolveDeepLink('depano://interventions/b1', 'artisan')).toBe('/pro/interventions/b1');
    expect(resolveDeepLink('depano://parrainage', 'client')).toBe('/profil/parrainage');
    // La recherche n'est plus un onglet mais garde son URL.
    expect(resolveDeepLink('depano://recherche', 'client')).toBe('/recherche');
    expect(resolveDeepLink('depano://artisan', 'client')).toBe('/recherche');
  });
  it('lien vide', () => {
    expect(resolveDeepLink(null, 'client')).toBeNull();
    expect(resolveDeepLink('depano://', 'client')).toBeNull();
  });
});

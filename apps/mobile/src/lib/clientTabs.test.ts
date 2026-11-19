import { describe, expect, it } from 'vitest';
import { CLIENT_TABS, clientTab } from './clientTabs';

describe('onglets client', () => {
  it("suivent l'ordre de la maquette, sans onglet Recherche", () => {
    expect(CLIENT_TABS.map((t) => t.label)).toEqual(['Accueil', 'Rendez-vous', 'Interventions', 'Messages', 'Profil']);
    expect(CLIENT_TABS.some((t) => t.name === ('recherche' as never))).toBe(false);
  });
  it('gardent le dossier activite pour les rendez-vous (liens /activite/{id})', () => {
    expect(clientTab('activite').label).toBe('Rendez-vous');
    expect(clientTab('activite').badge).toBe('activity');
    expect(clientTab('messages').badge).toBe('messages');
  });
  it('ont des testID uniques', () => {
    expect(new Set(CLIENT_TABS.map((t) => t.testID)).size).toBe(CLIENT_TABS.length);
  });
});

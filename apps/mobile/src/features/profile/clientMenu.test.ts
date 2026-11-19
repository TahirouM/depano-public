import { describe, expect, it } from 'vitest';
import { CLIENT_MENU, CLIENT_MENU_MORE, clientSinceLabel, takeGuestLoginPrompt } from './clientMenu';

describe('profil client', () => {
  it('suit la maquette', () => {
    expect(CLIENT_MENU.map((e) => e.title)).toEqual(['Favoris', 'Parrainer un ami', 'Compte', 'Paiement', 'Assistance', 'Informations légales', 'Notifications', 'Sécurité']);
  });
  it('garde les raccourcis existants', () => {
    expect(CLIENT_MENU_MORE.map((e) => e.key)).toEqual(['adresses', 'factures', 'parametres']);
  });
  it('« Client depuis »', () => {
    expect(clientSinceLabel('2026-03-02T10:00:00Z')).toBe('Client depuis 2026');
    expect(clientSinceLabel(null)).toBeNull();
  });
  it('propose la connexion au visiteur une seule fois', () => {
    expect(takeGuestLoginPrompt()).toBe(true);
    expect(takeGuestLoginPrompt()).toBe(false);
  });
});

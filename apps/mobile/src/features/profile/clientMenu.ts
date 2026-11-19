import type { Href } from 'expo-router';

/** Entrées du profil client, dans l'ordre de la maquette, puis les raccourcis conservés. */
export interface ClientMenuEntry {
  key: string;
  title: string;
  href: Href;
  subtitle?: string;
}

export const CLIENT_MENU: readonly ClientMenuEntry[] = [
  { key: 'favoris', title: 'Favoris', href: '/profil/favoris' },
  { key: 'parrainage', title: 'Parrainer un ami', href: '/profil/parrainage' },
  { key: 'compte', title: 'Compte', href: '/parametres/compte' },
  { key: 'paiement', title: 'Paiement', href: '/profil/paiement' },
  { key: 'assistance', title: 'Assistance', href: '/profil/aide' },
  { key: 'legal', title: 'Informations légales', href: '/parametres/legal' },
  { key: 'notifications', title: 'Notifications', href: '/parametres/notifications' },
  { key: 'securite', title: 'Sécurité', href: '/parametres/securite' },
];

/** Raccourcis existants absents de la maquette, regroupés sous « Plus ». */
export const CLIENT_MENU_MORE: readonly ClientMenuEntry[] = [
  { key: 'adresses', title: 'Adresses', href: '/profil/adresses' },
  { key: 'factures', title: 'Factures', href: '/profil/factures' },
  { key: 'parametres', title: 'Paramètres', subtitle: 'Apparence, suppression du compte', href: '/parametres' },
];

/** « Client depuis 2026 » (année d'inscription, heure de Paris). */
export function clientSinceLabel(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const year = new Intl.DateTimeFormat('fr-FR', { year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date(createdAt));
  return `Client depuis ${year}`;
}

/** Un visiteur qui ouvre le Profil se voit proposer la connexion une seule fois par lancement. */
let guestPrompted = false;
export function takeGuestLoginPrompt(): boolean {
  if (guestPrompted) return false;
  guestPrompted = true;
  return true;
}

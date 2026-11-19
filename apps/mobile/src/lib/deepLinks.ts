/**
 * Résolution des liens profonds (DEEP_LINKS de @depano/schemas) vers les routes de l'app,
 * selon l'espace actif. Utilisé par +native-intent (liens système/SMS) et par le tap sur
 * une notification. Fonction pure, testée.
 */
export type Role = 'client' | 'artisan';

export function normalizeLinkPath(link: string): string {
  let p = link.trim();
  p = p.replace(/^depano:\/\//, '/');
  p = p.replace(/^https?:\/\/[^/]+/, '');
  if (!p.startsWith('/')) p = `/${p}`;
  return p.replace(/\/+$/, '') || '/';
}

export function resolveDeepLink(link: string | null | undefined, role: Role): string | null {
  if (!link) return null;
  const path = normalizeLinkPath(link);
  const [, head, id] = path.split('?')[0]!.split('/');
  const pro = role === 'artisan';
  switch (head) {
    case 'intervention':
      if (!id) return pro ? '/pro/interventions' : '/activite';
      return pro ? `/pro/interventions/${id}` : `/activite/${id}`;
    case 'rendez-vous':
      // Onglet « Rendez-vous » du client (dossier `activite`).
      if (pro) return '/pro/planning';
      return id ? `/activite/${id}` : '/activite';
    case 'interventions':
      // Historique des interventions réalisées (client) ; liste des interventions (artisan).
      if (!id) return pro ? '/pro/interventions' : '/interventions';
      return pro ? `/pro/interventions/${id}` : `/interventions/${id}`;
    case 'parrainage':
      return pro ? '/pro/profil' : '/profil/parrainage';
    case 'messages':
      if (!id) return pro ? '/pro/messages' : '/messages';
      return pro ? `/pro/messages/${id}` : `/messages/${id}`;
    case 'offre':
      return id ? `/pro/offre/${id}` : '/pro/accueil';
    case 'artisan':
      return id ? `/artisan/${id}` : '/recherche';
    case 'notifications':
      return '/notifications';
    case undefined:
    case '':
      return null;
    default:
      // Chemin interne déjà résolu (ex. /pro/planning) : on le laisse passer.
      return path;
  }
}

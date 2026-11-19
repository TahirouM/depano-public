/** Catalogue de référence des prestations (seed de démo et initialisation de production). */
export const CATALOG: Record<'plomberie' | 'electricite' | 'energetique', [slug: string, name: string, kind: 'maintenance' | 'repair' | 'both', price: number, minutes: number, urgent: boolean][]> = {
  plomberie: [
    ['fuite-eau', "Recherche et réparation de fuite d'eau", 'repair', 9000, 60, true],
    ['debouchage', 'Débouchage canalisation / WC', 'repair', 8500, 60, true],
    ['chauffe-eau-panne', 'Dépannage chauffe-eau / ballon', 'repair', 11000, 90, true],
    ['robinetterie', 'Remplacement robinet / mitigeur', 'repair', 7500, 45, false],
    ['chasse-eau', "Réparation chasse d'eau", 'repair', 6500, 45, false],
    ['entretien-chauffe-eau', 'Détartrage chauffe-eau', 'maintenance', 12000, 90, false],
  ],
  electricite: [
    ['panne-courant', 'Panne de courant / disjoncteur', 'repair', 9500, 60, true],
    ['prise-interrupteur', 'Remplacement prise ou interrupteur', 'repair', 6000, 30, false],
    ['tableau-electrique', 'Mise en sécurité tableau électrique', 'repair', 18000, 180, false],
    ['luminaire', 'Pose de luminaire', 'repair', 6500, 45, false],
    ['diagnostic-elec', 'Diagnostic installation électrique', 'maintenance', 13000, 90, false],
  ],
  energetique: [
    ['chaudiere-panne', 'Dépannage chaudière gaz', 'repair', 12000, 90, true],
    ['entretien-chaudiere', 'Entretien annuel chaudière', 'maintenance', 11000, 60, false],
    ['clim-panne', 'Dépannage climatisation / PAC', 'repair', 13000, 90, true],
    ['entretien-clim', 'Entretien climatisation', 'maintenance', 9500, 60, false],
    ['radiateur', 'Purge et équilibrage radiateurs', 'maintenance', 8000, 60, false],
  ],
};

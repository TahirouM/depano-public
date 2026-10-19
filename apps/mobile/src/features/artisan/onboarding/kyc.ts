import type { CompanyInfoDto, DomainCode, KycChecklistDto } from '@depano/schemas';
import type { Href } from 'expo-router';
import type { Rule } from '../components/WeekRulesEditor';

/** Brouillon local du parcours KYC (retour sans perte, app tuée). */
export interface OnboardingDraft {
  siret?: string;
  company?: CompanyInfoDto;
  domains?: DomainCode[];
  /** Prestations cochées → prix (centimes). */
  prices?: Record<string, number>;
  durations?: Record<string, number>;
  travelFeeCents?: number;
  city?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  rules?: Rule[];
  expiry?: {
    insurance_decennale?: string;
    insurance_rc_pro?: string;
    identity?: string;
    qualification?: string;
  };
}

export const ONBOARDING_DRAFT_KEY = 'artisan:onboarding';

export interface KycStep {
  key: 'siret' | 'metiers' | 'zone' | 'documents' | 'iban';
  title: string;
  question: string;
  href: Href;
  done: (c: KycChecklistDto) => boolean;
}

export const KYC_STEPS: KycStep[] = [
  {
    key: 'siret',
    title: 'Entreprise (SIRET)',
    question: 'Quel est le SIRET de votre entreprise ?',
    href: '/pro/onboarding/siret',
    done: (c) => c.siret,
  },
  {
    key: 'metiers',
    title: 'Métiers et tarifs',
    question: 'Quels métiers et quelles prestations proposez-vous ?',
    href: '/pro/onboarding/metiers',
    done: (c) => c.domains && c.services,
  },
  {
    key: 'zone',
    title: 'Zone et horaires',
    question: 'Où et quand intervenez-vous ?',
    href: '/pro/onboarding/zone',
    done: (c) => c.zone && c.availability,
  },
  {
    key: 'documents',
    title: "Pièce d'identité et assurance",
    question: 'Ajoutez vos justificatifs',
    href: '/pro/onboarding/documents',
    done: (c) => c.identity && c.insurance,
  },
  {
    key: 'iban',
    title: 'Compte bancaire (IBAN)',
    question: 'Où recevoir vos paiements ?',
    href: '/pro/onboarding/iban',
    done: (c) => c.payouts,
  },
];

export const KYC_TOTAL = KYC_STEPS.length;

export function stepIndex(key: KycStep['key']): number {
  return KYC_STEPS.findIndex((s) => s.key === key) + 1;
}

/** Étape suivante non terminée après `key` (ou la première non terminée). */
export function nextStepHref(c: KycChecklistDto | undefined, after?: KycStep['key']): Href {
  const start = after ? KYC_STEPS.findIndex((s) => s.key === after) + 1 : 0;
  const rest = [...KYC_STEPS.slice(start), ...KYC_STEPS.slice(0, start)];
  const next = c ? rest.find((s) => !s.done(c)) : KYC_STEPS[start];
  return next?.href ?? '/pro/onboarding';
}

/** Libellés des éléments de la checklist (écran « en vérification »). */
export const CHECKLIST_LABELS: Record<keyof KycChecklistDto, string> = {
  siret: 'SIRET actif vérifié',
  domains: 'Métiers déclarés',
  services: 'Prestations et tarifs',
  zone: "Zone d'intervention",
  availability: 'Horaires types',
  identity: "Pièce d'identité",
  insurance: 'Assurance décennale ou RC pro',
  payouts: 'Compte bancaire pour les virements',
};

/** Code APE → libellé lisible du contrôle de cohérence. */
export function apeWarning(info: CompanyInfoDto): string | null {
  if (!info.active)
    return 'Cette entreprise est indiquée comme fermée au répertoire SIRENE. Votre dossier ne pourra pas être validé.';
  if (!info.apeMatchesTrade)
    return `Le code APE ${info.apeCode ?? 'inconnu'}${info.apeLabel ? ` (${info.apeLabel})` : ''} ne correspond pas à la plomberie, l'électricité ou l'énergétique. Vous pouvez continuer : un conseiller vérifiera votre activité.`;
  return null;
}

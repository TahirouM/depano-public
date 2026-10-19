/**
 * Règles métier (section 7 du plan produit). Centralisées ici pour que l'API,
 * les workers, l'app et le back-office appliquent exactement les mêmes valeurs.
 * Tous les montants sont en centimes.
 */
export const RULES = {
  currency: 'EUR',
  /** Frais d'urgence fixes ajoutés au prix de base. */
  urgentFeeCents: 3000,
  /** Garantie annulation optionnelle. */
  cancellationGuaranteeCents: 1000,
  /** Commission DEPANO par défaut (modifiable par zone dans le back-office). */
  defaultCommissionRate: 0.15,
  /** Un devis supérieur de plus de 20 % au montant autorisé exige une nouvelle validation. */
  quoteOverrunThreshold: 0.2,
  dispatch: {
    offerTimeoutSeconds: 60,
    artisansPerWave: 3,
    radiiKm: [5, 10, 20] as const,
  },
  cancellation: {
    freeUntilHoursBefore: 2,
    lateArtisanMinutes: 30,
  },
  artisanReliability: {
    maxCancellationsIn30Days: 3,
  },
  completionCode: {
    length: 4,
    maxAttempts: 3,
    autoCaptureAfterHours: 24,
  },
  otp: {
    length: 6,
    ttlSeconds: 300,
    maxAttempts: 3,
  },
  reviewWindowDays: 14,
  /** Au-delà, on enregistre la carte (SetupIntent) et on autorise 24 h avant. */
  authorizationMaxDaysAhead: 6,
  documentExpiryReminderDays: 30,
  kycReviewBusinessHours: 48,
  dataRetention: {
    chatAndPhotosYears: 3,
    invoicesYears: 10,
  },
} as const;

export interface PriceBreakdown {
  baseCents: number;
  urgentFeeCents: number;
  guaranteeCents: number;
  travelFeeCents: number;
  totalCents: number;
  /** Fourchette annoncée au client (le devis sur place peut varier dans cette fourchette). */
  rangeMinCents: number;
  rangeMaxCents: number;
}

export function computePrice(input: {
  basePriceCents: number;
  travelFeeCents: number;
  urgent: boolean;
  withGuarantee: boolean;
}): PriceBreakdown {
  const urgentFeeCents = input.urgent ? RULES.urgentFeeCents : 0;
  const guaranteeCents = input.withGuarantee ? RULES.cancellationGuaranteeCents : 0;
  const totalCents = input.basePriceCents + input.travelFeeCents + urgentFeeCents + guaranteeCents;
  return {
    baseCents: input.basePriceCents,
    urgentFeeCents,
    guaranteeCents,
    travelFeeCents: input.travelFeeCents,
    totalCents,
    rangeMinCents: totalCents,
    rangeMaxCents: Math.round(totalCents * (1 + RULES.quoteOverrunThreshold)),
  };
}

/** Commission prélevée à la capture, jamais sur les frais de déplacement seuls. */
export function computeCommission(input: {
  capturedCents: number;
  travelOnly: boolean;
  commissionRate: number;
}): number {
  if (input.travelOnly) return 0;
  return Math.round(input.capturedCents * input.commissionRate);
}

export function quoteNeedsNewAuthorization(quoteTotalCents: number, authorizedCents: number): boolean {
  return quoteTotalCents > authorizedCents * (1 + RULES.quoteOverrunThreshold);
}

/** Annulation client gratuite jusqu'à 2 h avant (ou garantie souscrite, ou artisan en retard). */
export function clientCancellationIsFree(input: {
  scheduledAt: Date;
  now: Date;
  hasGuarantee: boolean;
  artisanLateMinutes?: number;
  status: string;
}): boolean {
  if (input.hasGuarantee) return true;
  if (['pending_payment', 'searching'].includes(input.status)) return true;
  if ((input.artisanLateMinutes ?? 0) > RULES.cancellation.lateArtisanMinutes) return true;
  const hoursBefore = (input.scheduledAt.getTime() - input.now.getTime()) / 3_600_000;
  return hoursBefore >= RULES.cancellation.freeUntilHoursBefore;
}

export function formatEuros(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

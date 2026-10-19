import { formatEuros, type UrgentOfferDto } from '@depano/schemas';
import { Card, DomainChip, formatDistance, Text, useTheme } from '@depano/ui';
import { ChevronRight, Siren } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

/** Secondes restantes avant `expiresAt` (rafraîchi chaque seconde). */
export function useCountdown(expiresAt: string | undefined): number {
  const calc = () =>
    expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0;
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    if (!expiresAt) return;
    const h = setInterval(() => setLeft(calc()), 500);
    return () => clearInterval(h);
  }, [expiresAt]); // eslint-disable-line react-hooks/exhaustive-deps
  return left;
}

/** Demande d'urgence en attente (accueil) : motif, distance, gain net, temps restant. */
export function OfferCard({ offer, onPress }: { offer: UrgentOfferDto; onPress: () => void }) {
  const t = useTheme();
  const left = useCountdown(offer.expiresAt);
  return (
    <Card
      onPress={onPress}
      variant="outline"
      style={{ gap: t.spacing.sm, borderColor: t.colors.tone.urgent.solid, borderWidth: 2 }}
      accessibilityLabel={`Urgence : ${offer.problemReason}, à ${formatDistance(offer.distanceKm)}, gain net ${formatEuros(offer.estimatedEarningsCents)}, ${left} secondes pour répondre`}
      accessibilityHint="Ouvre la demande pour accepter ou refuser"
      testID={`offer-card-${offer.id}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
        <Siren size={20} color={t.colors.tone.urgent.text} />
        <Text variant="label" tone="urgent" style={{ flex: 1 }}>
          Urgence · {left > 0 ? `${left} s pour répondre` : 'expirée'}
        </Text>
        <ChevronRight size={20} color={t.colors.text.secondary} />
      </View>
      <Text variant="title2">{offer.problemReason}</Text>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, flexWrap: 'wrap' }}
      >
        <DomainChip domain={offer.domain} size="sm" />
        <Text variant="callout" tone="secondary">
          {formatDistance(offer.distanceKm)} · {offer.city}
        </Text>
      </View>
      <Text variant="bodyStrong" tone="success">
        Gain net estimé : {formatEuros(offer.estimatedEarningsCents)}
      </Text>
    </Card>
  );
}

import { formatEuros, type PriceBreakdown } from '@depano/schemas';
import { Divider, PriceRow, Text, useTheme } from '@depano/ui';
import { View } from 'react-native';

export interface BookingPriceSummaryProps {
  price: PriceBreakdown;
  showRange?: boolean;
  note?: string;
  baseLabel?: string;
}

/**
 * Récap prix d'une réservation, comme `PriceSummary` (@depano/ui) avec en plus la réduction
 * parrainage (`discountCents`) déduite avant le total TTC.
 */
export function BookingPriceSummary({ price, showRange = false, note, baseLabel = 'Intervention' }: BookingPriceSummaryProps) {
  const t = useTheme();
  const discount = price.discountCents ?? 0;
  return (
    <View style={{ gap: t.spacing.sm }}>
      <PriceRow label={baseLabel} cents={price.baseCents} />
      {price.travelFeeCents > 0 ? <PriceRow label="Déplacement" cents={price.travelFeeCents} /> : null}
      {price.urgentFeeCents > 0 ? <PriceRow label="Frais d'urgence" cents={price.urgentFeeCents} /> : null}
      {price.guaranteeCents > 0 ? <PriceRow label="Garantie annulation" cents={price.guaranteeCents} /> : null}
      {discount > 0 ? <PriceRow label="Réduction parrainage" hint="Déduite du total" cents={-discount} /> : null}
      <Divider />
      <PriceRow label="Total TTC" cents={price.totalCents} total />
      {showRange && price.rangeMaxCents > price.rangeMinCents ? (
        <Text variant="callout" tone="secondary">
          Fourchette annoncée : {formatEuros(price.rangeMinCents)} – {formatEuros(price.rangeMaxCents)}. Au-delà, un nouveau devis vous sera soumis.
        </Text>
      ) : null}
      {note ? (
        <Text variant="callout" tone="success">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

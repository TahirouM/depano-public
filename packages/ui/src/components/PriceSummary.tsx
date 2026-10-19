import { formatEuros, type PriceBreakdown } from '@depano/schemas';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Divider } from './Divider';
import { Text } from './Text';

export interface PriceRowProps {
  label: string;
  cents: number;
  /** Ligne de total : plus grande et en gras. */
  total?: boolean;
  hint?: string;
}

export function PriceRow({ label, cents, total, hint }: PriceRowProps) {
  return (
    <View accessible accessibilityLabel={`${label} : ${formatEuros(cents)}`} style={styles.row}>
      <View style={styles.flex}>
        <Text variant={total ? 'bodyStrong' : 'body'}>{label}</Text>
        {hint ? (
          <Text variant="caption" tone="secondary">
            {hint}
          </Text>
        ) : null}
      </View>
      <Text variant={total ? 'title2' : 'body'} weight={total ? 'bold' : undefined}>
        {formatEuros(cents)}
      </Text>
    </View>
  );
}

export interface PriceSummaryProps {
  price: PriceBreakdown;
  /** Affiche la fourchette annoncée (le devis sur place peut varier dedans). */
  showRange?: boolean;
  /** Microcopy rassurante sous le total. */
  note?: string;
  baseLabel?: string;
}

/** Récap prix : toujours avec le total TTC visible (principe « prix avant engagement »). */
export function PriceSummary({ price, showRange = false, note, baseLabel = 'Intervention' }: PriceSummaryProps) {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing.sm }}>
      <PriceRow label={baseLabel} cents={price.baseCents} />
      {price.travelFeeCents > 0 ? <PriceRow label="Déplacement" cents={price.travelFeeCents} /> : null}
      {price.urgentFeeCents > 0 ? <PriceRow label="Frais d'urgence" cents={price.urgentFeeCents} /> : null}
      {price.guaranteeCents > 0 ? <PriceRow label="Garantie annulation" cents={price.guaranteeCents} /> : null}
      <Divider />
      <PriceRow label="Total TTC" cents={price.totalCents} total />
      {showRange && price.rangeMaxCents > price.rangeMinCents ? (
        <Text variant="callout" tone="secondary">
          Fourchette annoncée : {formatEuros(price.rangeMinCents)} – {formatEuros(price.rangeMaxCents)}. Au-delà, un nouveau devis
          vous sera soumis.
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  flex: { flex: 1 },
});

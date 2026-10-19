import { Pressable, StyleSheet, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../tokens/scale';
import { formatRating } from '../utils/format';
import { haptic } from '../utils/haptics';
import { Text } from './Text';

export interface StarRatingProps {
  value: number | null;
  /** Nombre d'avis, affiché à côté de la note. */
  count?: number;
  size?: number;
  /** Mode saisie : rend 5 étoiles cliquables (48 × 48). */
  onChange?: (v: number) => void;
}

const STAR_LABELS = ['Très décevant', 'Décevant', 'Correct', 'Bien', 'Excellent'];

export function StarRating({ value, count, size = 16, onChange }: StarRatingProps) {
  const t = useTheme();
  const gold = t.colors.domain.electricite.solid;
  if (onChange) {
    const v = value ?? 0;
    return (
      <View accessibilityRole="radiogroup" accessibilityLabel="Note sur 5" style={styles.row}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityLabel={`${n} étoile${n > 1 ? 's' : ''} sur 5, ${STAR_LABELS[n - 1]}`}
            accessibilityState={{ checked: v === n }}
            onPress={() => {
              haptic('selection');
              onChange(n);
            }}
            style={styles.touch}
          >
            <Star size={36} color={n <= v ? gold : t.colors.border.input} fill={n <= v ? gold : 'transparent'} strokeWidth={1.75} />
          </Pressable>
        ))}
      </View>
    );
  }
  if (value == null) {
    return (
      <Text variant="callout" tone="secondary">
        Nouveau
      </Text>
    );
  }
  const label = `Note ${formatRating(value)} sur 5${count != null ? `, ${count} avis` : ''}`;
  return (
    <View accessible accessibilityLabel={label} style={[styles.row, { gap: 4 }]}>
      <Star size={size} color={gold} fill={gold} />
      <Text variant="label">{formatRating(value)}</Text>
      {count != null ? (
        <Text variant="callout" tone="secondary">
          ({count})
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  touch: { width: MIN_TOUCH + 8, height: MIN_TOUCH + 8, alignItems: 'center', justifyContent: 'center' },
});

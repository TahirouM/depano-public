import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { Tone } from '../tokens/colors';
import { Text } from './Text';

export interface BadgeProps {
  /** Compteur (0 = masqué). Affiche « 99+ » au-delà. */
  count?: number;
  /** Libellé texte (ex. « Nouveau »). */
  label?: string;
  tone?: Tone;
  /** Variante pastille teintée (label) ou pleine (compteur). */
  appearance?: 'solid' | 'soft';
  accessibilityLabel?: string;
}

export function Badge({ count, label, tone = 'brand', appearance, accessibilityLabel }: BadgeProps) {
  const t = useTheme();
  const c = t.colors.tone[tone];
  if (!label && (!count || count <= 0)) return null;
  const text = label ?? (count! > 99 ? '99+' : String(count));
  const soft = (appearance ?? (label ? 'soft' : 'solid')) === 'soft';
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        { backgroundColor: soft ? c.soft : c.solid, borderRadius: t.radius.full, minWidth: label ? undefined : 20 },
      ]}
    >
      <Text variant={label ? 'caption' : 'overline'} weight="semibold" color={soft ? c.text : c.onSolid} align="center">
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { paddingHorizontal: 6, paddingVertical: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
});

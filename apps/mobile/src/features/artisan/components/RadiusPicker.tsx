import { Chip, IconButton, Text, useTheme } from '@depano/ui';
import { Minus, Plus } from 'lucide-react-native';
import { View } from 'react-native';

const PRESETS = [5, 10, 15, 20, 30, 50];

/** Rayon d'intervention (1 à 50 km) : gros boutons −/+ et raccourcis. Réglable au lecteur d'écran. */
export function RadiusPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (km: number) => void;
}) {
  const t = useTheme();
  const set = (v: number) => onChange(Math.max(1, Math.min(50, Math.round(v))));
  return (
    <View style={{ gap: t.spacing.md }}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Rayon d'intervention"
        accessibilityValue={{ min: 1, max: 50, now: value, text: `${value} kilomètres` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) =>
          set(value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))
        }
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <IconButton
          icon={Minus}
          variant="filled"
          accessibilityLabel="Réduire le rayon"
          onPress={() => set(value - (value > 10 ? 5 : 1))}
          disabled={value <= 1}
        />
        <Text variant="display" testID="radius-value">
          {value} km
        </Text>
        <IconButton
          icon={Plus}
          variant="filled"
          accessibilityLabel="Augmenter le rayon"
          onPress={() => set(value + (value >= 10 ? 5 : 1))}
          disabled={value >= 50}
        />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
        {PRESETS.map((km) => (
          <Chip key={km} label={`${km} km`} selected={value === km} onPress={() => set(km)} />
        ))}
      </View>
    </View>
  );
}

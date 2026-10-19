import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { SlotDay } from '@depano/schemas';
import { CalendarDays } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../tokens/scale';
import { formatDateLong, formatTime } from '../utils/format';
import { haptic } from '../utils/haptics';
import { EmptyState } from './EmptyState';
import { Text } from './Text';

export interface SlotPickerProps {
  days: SlotDay[];
  /** Créneau sélectionné (ISO de début). */
  value: string | null;
  onChange: (slotIso: string) => void;
  /** Jour affiché (YYYY-MM-DD) ; par défaut le premier jour ayant des créneaux. */
  selectedDay?: string;
  onSelectDay?: (day: string) => void;
  /** Pour les tests : heure de référence. */
  now?: Date;
  emptyAction?: { label: string; onPress: () => void };
}

const dayParts = (date: string) => {
  const d = new Date(`${date}T12:00:00`);
  const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d).replace('.', '');
  return { weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1), day: d.getDate(), month: new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(d) };
};

/**
 * Jours en scroll horizontal + créneaux en grille.
 * Les créneaux passés et les jours sans créneau sont MASQUÉS (pas grisés).
 */
export function SlotPicker({ days, value, onChange, selectedDay, onSelectDay, now, emptyAction }: SlotPickerProps) {
  const t = useTheme();
  const visibleDays = useMemo(() => {
    const ref = (now ?? new Date()).getTime();
    return days
      .map((d) => ({ ...d, slots: d.slots.filter((s) => new Date(s).getTime() > ref) }))
      .filter((d) => d.slots.length > 0);
  }, [days, now]);

  const current = visibleDays.find((d) => d.date === selectedDay) ?? visibleDays[0];

  if (!current) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Aucun créneau disponible"
        message="Cet artisan n'a plus de disponibilité sur la période. Essayez un autre artisan ou revenez plus tard."
        action={emptyAction}
      />
    );
  }

  return (
    <View style={{ gap: t.spacing.lg }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.spacing.sm, paddingVertical: 2 }} accessibilityRole="tablist">
        {visibleDays.map((d) => {
          const selected = d.date === current.date;
          const p = dayParts(d.date);
          return (
            <Pressable
              key={d.date}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${formatDateLong(`${d.date}T12:00:00`)}, ${d.slots.length} créneau${d.slots.length > 1 ? 'x' : ''}`}
              onPress={() => {
                haptic('selection');
                onSelectDay?.(d.date);
              }}
              style={[
                styles.day,
                {
                  minHeight: MIN_TOUCH + 24,
                  borderRadius: t.radius.md,
                  backgroundColor: selected ? t.colors.brand.primary : t.colors.background.surface,
                  borderColor: selected ? t.colors.brand.primary : t.colors.border.subtle,
                },
              ]}
            >
              <Text variant="caption" color={selected ? t.colors.brand.onPrimary : t.colors.text.secondary}>
                {p.weekday}
              </Text>
              <Text variant="title2" color={selected ? t.colors.brand.onPrimary : t.colors.text.primary}>
                {p.day}
              </Text>
              <Text variant="caption" color={selected ? t.colors.brand.onPrimary : t.colors.text.secondary}>
                {p.month}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={[styles.grid, { gap: t.spacing.sm }]} accessibilityRole="radiogroup" accessibilityLabel="Créneaux disponibles">
        {current.slots.map((s) => {
          const selected = s === value;
          return (
            <Pressable
              key={s}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${formatTime(s)}`}
              onPress={() => {
                haptic('selection');
                onChange(s);
              }}
              style={[
                styles.slot,
                {
                  minHeight: MIN_TOUCH,
                  borderRadius: t.radius.sm,
                  backgroundColor: selected ? t.colors.brand.primary : t.colors.background.surface,
                  borderColor: selected ? t.colors.brand.primary : t.colors.border.input,
                },
              ]}
            >
              <Text variant="label" color={selected ? t.colors.brand.onPrimary : t.colors.text.primary}>
                {formatTime(s)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  day: { width: 64, alignItems: 'center', justifyContent: 'center', borderWidth: 1, paddingVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  slot: { width: '23%', flexGrow: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});

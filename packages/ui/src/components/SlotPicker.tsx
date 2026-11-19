import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { SlotDay } from '@depano/schemas';
import { CalendarDays, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../tokens/scale';
import { formatDateLong, formatTime } from '../utils/format';
import { haptic } from '../utils/haptics';
import { EmptyState } from './EmptyState';
import { Icon } from './Icon';
import { IconCircle } from './IconCircle';
import { Text } from './Text';

export interface SlotPickerProps {
  days: SlotDay[];
  /** Créneau sélectionné (ISO de début). */
  value: string | null;
  onChange: (slotIso: string) => void;
  /** Jour déplié (YYYY-MM-DD) ; par défaut le premier jour ayant des créneaux. */
  selectedDay?: string;
  onSelectDay?: (day: string) => void;
  /** Pour les tests : heure de référence. */
  now?: Date;
  emptyAction?: { label: string; onPress: () => void };
}

const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** « Aujourd'hui », « Demain », sinon « Lundi 16 mars ». */
export function slotDayLabel(date: string, now: Date = new Date()): string {
  const today = localKey(now);
  const tomorrow = localKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  if (date === today) return "Aujourd'hui";
  if (date === tomorrow) return 'Demain';
  const label = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Un bloc par jour (accordéon) : le jour déplié montre ses créneaux en pastilles.
 * Les créneaux passés et les jours sans créneau sont MASQUÉS (pas grisés).
 */
export function SlotPicker({ days, value, onChange, selectedDay, onSelectDay, now, emptyAction }: SlotPickerProps) {
  const t = useTheme();
  const [localDay, setLocalDay] = useState<string | undefined>(undefined);
  const visibleDays = useMemo(() => {
    const ref = (now ?? new Date()).getTime();
    return days
      .map((d) => ({ ...d, slots: d.slots.filter((s) => new Date(s).getTime() > ref) }))
      .filter((d) => d.slots.length > 0);
  }, [days, now]);

  const wanted = selectedDay ?? localDay;
  const current = visibleDays.find((d) => d.date === wanted) ?? visibleDays[0];

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
    <View style={{ gap: t.spacing.md }}>
      {visibleDays.map((d) => {
        const open = d.date === current.date;
        const label = slotDayLabel(d.date, now);
        return (
          <View
            key={d.date}
            style={[
              styles.day,
              {
                borderRadius: t.radius.md,
                borderColor: t.colors.border.subtle,
                backgroundColor: t.colors.background.surface,
              },
              t.elevation(1),
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={`${formatDateLong(`${d.date}T12:00:00`)}, ${d.slots.length} créneau${d.slots.length > 1 ? 'x' : ''}`}
              onPress={() => {
                haptic('selection');
                setLocalDay(d.date);
                onSelectDay?.(d.date);
              }}
              style={[styles.header, { minHeight: MIN_TOUCH + 8, paddingHorizontal: t.spacing.lg, gap: t.spacing.md }]}
            >
              <IconCircle icon={CalendarDays} size={36} />
              <Text variant="bodyStrong" style={styles.flex}>
                {label}
              </Text>
              <Icon icon={open ? ChevronUp : ChevronDown} size={20} color={t.colors.text.secondary} />
            </Pressable>
            {open ? (
              <View
                style={[styles.grid, { gap: t.spacing.sm, paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.lg }]}
                accessibilityRole="radiogroup"
                accessibilityLabel={`Créneaux disponibles, ${label}`}
              >
                {d.slots.map((s) => {
                  const selected = s === value;
                  return (
                    <Pressable
                      key={s}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={formatTime(s)}
                      onPress={() => {
                        haptic('selection');
                        onChange(s);
                      }}
                      style={[
                        styles.slot,
                        {
                          minHeight: MIN_TOUCH - 4,
                          borderRadius: t.radius.full,
                          backgroundColor: selected ? t.colors.brand.primary : t.colors.background.subtle,
                          borderColor: selected ? t.colors.brand.primary : t.colors.border.subtle,
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
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  day: { borderWidth: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  slot: { width: '22.5%', alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});

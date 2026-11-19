import { IconButton, Text, useTheme } from '@depano/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { addMonths, dayLong, localDayKey, monthLabel } from '../dates';
import type { DayDot } from './calendar';
import { monthWeeks } from './calendar';
import { eventColor } from './eventColors';

const WEEK_HEAD = ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'];
const WEEK_HEAD_A11Y = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export interface MonthCalendarProps {
  month: Date;
  onMonthChange: (m: Date) => void;
  selected: Date | null;
  onSelect: (d: Date) => void;
  /** Pastilles sous le jour (interventions, événements). */
  dotsFor?: (d: Date) => DayDot[];
  /** Complément lu par le lecteur d'écran (« 2 interventions, indisponible »). */
  describe?: (d: Date) => string | null;
  /** Jour non sélectionnable (ex. date passée pour un report). */
  isDisabled?: (d: Date) => boolean;
  testID?: string;
}

/**
 * Calendrier du mois (maquette « Mon planning ») : carte beige, semaine du lundi au dimanche,
 * jour sélectionné entouré, pastilles colorées sous les jours occupés. Utilisé par le planning
 * et par le choix d'une nouvelle date (intervention reprogrammée).
 */
export function MonthCalendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  dotsFor,
  describe,
  isDisabled,
  testID,
}: MonthCalendarProps) {
  const t = useTheme();
  const weeks = monthWeeks(month);
  const today = localDayKey(new Date());
  const sel = selected ? localDayKey(selected) : null;

  return (
    <View
      style={{
        backgroundColor: t.colors.brand.surface,
        borderRadius: t.radius.lg,
        padding: t.spacing.md,
        gap: t.spacing.sm,
      }}
      testID={testID}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconButton
          icon={ChevronLeft}
          accessibilityLabel="Mois précédent"
          onPress={() => onMonthChange(addMonths(month, -1))}
          testID={testID ? `${testID}-prev` : undefined}
        />
        <Text variant="bodyStrong" align="center" accessibilityRole="header" style={{ flex: 1 }}>
          {monthLabel(month)}
        </Text>
        <IconButton
          icon={ChevronRight}
          accessibilityLabel="Mois suivant"
          onPress={() => onMonthChange(addMonths(month, 1))}
          testID={testID ? `${testID}-next` : undefined}
        />
      </View>
      <View
        style={{
          flexDirection: 'row',
          paddingBottom: t.spacing.xs,
          borderBottomWidth: 1,
          borderBottomColor: t.colors.border.subtle,
        }}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {WEEK_HEAD.map((h, i) => (
          <Text
            key={h}
            variant="label"
            tone="secondary"
            align="center"
            style={{ flex: 1 }}
            accessibilityLabel={WEEK_HEAD_A11Y[i]}
            maxFontSizeMultiplier={1.3}
          >
            {h}
          </Text>
        ))}
      </View>
      {weeks.map((week, w) => (
        <View key={w} style={{ flexDirection: 'row' }}>
          {week.map((d, i) => {
            if (!d) return <View key={`empty-${w}-${i}`} style={{ flex: 1, minHeight: 48 }} />;
            const k = localDayKey(d);
            const isSel = k === sel;
            const isToday = k === today;
            const disabled = isDisabled?.(d) ?? false;
            const dots = dotsFor?.(d) ?? [];
            const extra = describe?.(d);
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel, disabled }}
                accessibilityLabel={`${dayLong(d)}${isToday ? ", aujourd'hui" : ''}${extra ? ` : ${extra}` : ''}`}
                disabled={disabled}
                onPress={() => onSelect(d)}
                style={{ flex: 1, minHeight: 48, alignItems: 'center', gap: 2, paddingTop: 2 }}
                testID={`day-cell-${k}`}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: isSel ? 2 : isToday ? 1 : 0,
                    borderColor: isSel ? t.colors.text.primary : t.colors.text.brand,
                    backgroundColor: isSel ? t.colors.background.surface : 'transparent',
                  }}
                >
                  <Text
                    variant={isSel || isToday ? 'bodyStrong' : 'body'}
                    color={disabled ? t.colors.text.disabled : t.colors.text.primary}
                    maxFontSizeMultiplier={1.3}
                  >
                    {String(d.getDate()).padStart(2, '0')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 2, height: 7, alignItems: 'center' }}>
                  {dots.map((dot) => (
                    <Dot key={dot.key} dot={dot} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Pastille : rond (RDV), carré (urgence), anneau (demande), trait (indisponible). */
export function Dot({ dot, size = 7 }: { dot: DayDot; size?: number }) {
  const t = useTheme();
  if (dot.type === 'unavailable')
    return (
      <View
        style={{
          width: size + 3,
          height: 3,
          borderRadius: 2,
          backgroundColor: t.colors.text.secondary,
        }}
      />
    );
  const color =
    dot.type === 'event' ? eventColor(dot.color, t).solid : t.colors.domain[dot.domain].solid;
  const requested = dot.type === 'domain' && dot.requested;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: dot.type === 'domain' && dot.urgent ? 1 : size / 2,
        backgroundColor: requested ? 'transparent' : color,
        borderWidth: requested ? 1.5 : 0,
        borderColor: color,
      }}
    />
  );
}

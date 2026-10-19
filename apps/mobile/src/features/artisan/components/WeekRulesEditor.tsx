import {
  BottomSheet,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  Switch,
  Text,
  useTheme,
} from '@depano/ui';
import { ArrowRight, Copy, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DEFAULT_RULES, rulesError, WEEK_ORDER, WEEKDAY_LABELS, type Rule } from '../format';

export { DEFAULT_RULES, rulesError, WEEK_ORDER, WEEKDAY_LABELS, type Rule };

const TIMES = Array.from({ length: 35 }, (_, i) => {
  const m = 5 * 60 + i * 30; // 05:00 → 22:00
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}).concat('23:00', '23:30');

/** Éditeur des horaires types par jour (plages multiples, copie lundi → semaine). */
export function WeekRulesEditor({
  rules,
  onChange,
}: {
  rules: Rule[];
  onChange: (r: Rule[]) => void;
}) {
  const t = useTheme();
  const [editing, setEditing] = useState<{
    weekday: number;
    index: number;
    field: 'start' | 'end';
  } | null>(null);

  const dayRules = (d: number) => rules.filter((r) => r.weekday === d);
  const setDay = (d: number, next: Rule[]) =>
    onChange([...rules.filter((r) => r.weekday !== d), ...next]);

  const current = editing ? dayRules(editing.weekday)[editing.index] : undefined;

  return (
    <View style={{ gap: t.spacing.md }}>
      <Button
        label="Copier le lundi sur lun.–ven."
        icon={Copy}
        variant="ghost"
        size="sm"
        onPress={() => {
          const mon = dayRules(1);
          onChange([
            ...rules.filter((r) => r.weekday === 0 || r.weekday === 6 || r.weekday === 1),
            ...[2, 3, 4, 5].flatMap((weekday) => mon.map((r) => ({ ...r, weekday }))),
          ]);
        }}
      />
      <Card padding="none">
        {WEEK_ORDER.map((d, i) => {
          const list = dayRules(d);
          const on = list.length > 0;
          return (
            <View key={d}>
              {i > 0 ? <Divider /> : null}
              <View style={{ paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.xs }}>
                <Switch
                  label={WEEKDAY_LABELS[d]!}
                  description={on ? list.map((r) => `${r.start}–${r.end}`).join(' · ') : 'Fermé'}
                  value={on}
                  onValueChange={(v) =>
                    setDay(
                      d,
                      v
                        ? [
                            { weekday: d, start: '08:00', end: '12:00' },
                            { weekday: d, start: '14:00', end: '19:00' },
                          ]
                        : [],
                    )
                  }
                  testID={`day-${d}`}
                />
                {on ? (
                  <View style={{ gap: t.spacing.sm, paddingBottom: t.spacing.md }}>
                    {list.map((r, idx) => (
                      <View
                        key={`${r.start}-${idx}`}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}
                      >
                        <TimeButton
                          label={r.start}
                          a11y={`${WEEKDAY_LABELS[d]}, plage ${idx + 1}, début ${r.start}`}
                          onPress={() => setEditing({ weekday: d, index: idx, field: 'start' })}
                        />
                        <ArrowRight size={20} color={t.colors.text.secondary} />
                        <TimeButton
                          label={r.end}
                          a11y={`${WEEKDAY_LABELS[d]}, plage ${idx + 1}, fin ${r.end}`}
                          onPress={() => setEditing({ weekday: d, index: idx, field: 'end' })}
                        />
                        <IconButton
                          icon={X}
                          accessibilityLabel={`Supprimer la plage ${r.start}–${r.end} du ${WEEKDAY_LABELS[d]}`}
                          onPress={() =>
                            setDay(
                              d,
                              list.filter((_, j) => j !== idx),
                            )
                          }
                        />
                      </View>
                    ))}
                    {list.length < 4 ? (
                      <Button
                        label="Ajouter une plage"
                        icon={Plus}
                        variant="ghost"
                        size="sm"
                        style={{ alignSelf: 'flex-start' }}
                        onPress={() => {
                          const last = list[list.length - 1];
                          const start = last && last.end < '20:00' ? last.end : '18:00';
                          setDay(d, [
                            ...list,
                            { weekday: d, start, end: start < '21:00' ? '21:00' : '23:30' },
                          ]);
                        }}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </Card>
      <BottomSheet
        visible={!!editing}
        onClose={() => setEditing(null)}
        title={
          editing
            ? `${WEEKDAY_LABELS[editing.weekday]} — ${editing.field === 'start' ? 'début' : 'fin'}`
            : undefined
        }
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
          {TIMES.map((time) => (
            <Chip
              key={time}
              label={time}
              selected={current?.[editing!.field] === time}
              onPress={() => {
                if (!editing) return;
                const list = dayRules(editing.weekday);
                setDay(
                  editing.weekday,
                  list.map((r, j) => (j === editing.index ? { ...r, [editing.field]: time } : r)),
                );
                setEditing(null);
              }}
            />
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

function TimeButton({
  label,
  a11y,
  onPress,
}: {
  label: string;
  a11y: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint="Choisir une autre heure"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        minWidth: 88,
        paddingHorizontal: t.spacing.md,
        borderRadius: t.radius.sm,
        borderWidth: 1,
        borderColor: t.colors.border.input,
        backgroundColor: pressed ? t.colors.background.subtle : t.colors.background.surface,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Text variant="bodyStrong">{label}</Text>
    </Pressable>
  );
}

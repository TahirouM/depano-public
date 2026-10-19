import { StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { formatDateTime } from '../utils/format';
import { Icon } from './Icon';
import { Text } from './Text';

export interface TimelineItem {
  key: string;
  label: string;
  /** Horodatage ISO : chaque statut est daté (confiance mesurable). */
  at?: string | null;
  state: 'done' | 'current' | 'upcoming';
  note?: string | null;
}

/** Timeline verticale des statuts d'une intervention. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  const t = useTheme();
  return (
    <View accessibilityRole="list">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        const done = it.state === 'done';
        const current = it.state === 'current';
        const dot = done ? t.colors.tone.success.solid : current ? t.colors.brand.primary : t.colors.border.input;
        const stateLabel = done ? 'terminé' : current ? 'en cours' : 'à venir';
        return (
          <View
            key={it.key}
            accessible
            accessibilityLabel={`${it.label}, ${stateLabel}${it.at ? `, ${formatDateTime(it.at)}` : ''}`}
            style={styles.row}
          >
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: done || current ? dot : 'transparent', borderColor: dot }]}>
                {done ? <Icon icon={Check} size={12} color={t.colors.tone.success.onSolid} strokeWidth={3} /> : null}
              </View>
              {!last ? <View style={[styles.line, { backgroundColor: done ? dot : t.colors.border.subtle }]} /> : null}
            </View>
            <View style={[styles.body, { paddingBottom: last ? 0 : t.spacing.lg }]}>
              <Text variant={current ? 'bodyStrong' : 'body'} tone={it.state === 'upcoming' ? 'secondary' : 'primary'}>
                {it.label}
              </Text>
              {it.at ? (
                <Text variant="caption" tone="secondary">
                  {formatDateTime(it.at)}
                </Text>
              ) : null}
              {it.note ? (
                <Text variant="callout" tone="secondary">
                  {it.note}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 20 },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, marginVertical: 2 },
  body: { flex: 1, gap: 2 },
});

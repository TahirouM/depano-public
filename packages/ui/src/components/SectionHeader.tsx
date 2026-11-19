import { StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';

export interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  const t = useTheme();
  return (
    <View style={[styles.row, { marginTop: t.spacing.xl, marginBottom: t.spacing.sm }]}>
      <Text variant="title2" weight="bold" style={styles.title}>
        {title}
      </Text>
      {action ? <Button variant="ghost" size="sm" label={action.label} iconRight={ChevronRight} onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flexShrink: 1 },
});

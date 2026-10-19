import { Card, Divider, Text, useTheme } from '@depano/ui';
import { Children, type ReactNode } from 'react';
import { View } from 'react-native';

/** Groupe de lignes de paramètres avec titre. */
export function SettingsSection({ title, children }: { title?: string; children: ReactNode }) {
  const t = useTheme();
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View style={{ gap: t.spacing.sm }}>
      {title ? (
        <Text variant="overline" tone="secondary" accessibilityRole="header" style={{ paddingHorizontal: t.spacing.xs }}>
          {title}
        </Text>
      ) : null}
      <Card padding="none">
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 ? <Divider inset={56} /> : null}
            {child}
          </View>
        ))}
      </Card>
    </View>
  );
}

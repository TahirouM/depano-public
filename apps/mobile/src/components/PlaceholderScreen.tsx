import { Card, EmptyState, ListItem, Screen, Text, useTheme } from '@depano/ui';
import { router, Stack, type Href } from 'expo-router';
import { Hammer } from 'lucide-react-native';
import { View } from 'react-native';

export interface PlaceholderScreenProps {
  title: string;
  /** Qui implémente : agent « client » ou « artisan ». */
  owner: 'client' | 'artisan';
  /** Contenu attendu (repris de l'inventaire, section 5 du plan). */
  description: string;
  /** États à prévoir. */
  states?: string;
  /** Liens de navigation de dev pour parcourir le shell. */
  links?: { label: string; href: Href }[];
  inTabs?: boolean;
  /** Masquer l'en-tête (écrans plein écran). */
  headerShown?: boolean;
}

/** Écran provisoire : titre correct + « À venir ». À remplacer par l'implémentation. */
export function PlaceholderScreen({ title, owner, description, states, links, inTabs, headerShown }: PlaceholderScreenProps) {
  const t = useTheme();
  return (
    <Screen inTabs={inTabs}>
      <Stack.Screen options={{ title, ...(headerShown === undefined ? null : { headerShown }) }} />
      <EmptyState icon={Hammer} title="À venir" message={description} />
      <Card variant="flat" style={{ gap: t.spacing.xs }}>
        <Text variant="overline" tone="secondary">
          Écran {owner === 'client' ? 'client' : 'artisan'} · {title}
        </Text>
        {states ? (
          <Text variant="callout" tone="secondary">
            États à prévoir : {states}
          </Text>
        ) : null}
      </Card>
      {links?.length ? (
        <View style={{ marginTop: t.spacing.lg }}>
          {links.map((l) => (
            <ListItem key={String(l.href)} title={l.label} onPress={() => router.push(l.href)} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

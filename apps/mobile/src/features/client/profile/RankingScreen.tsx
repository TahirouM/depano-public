import { RULES } from '@depano/schemas';
import { Card, Icon, Screen, Text, useTheme, type LucideIcon } from '@depano/ui';
import { Stack } from 'expo-router';
import { BadgeCheck, CalendarCheck, MapPin, Star, ThumbsUp, TrendingDown } from 'lucide-react-native';
import { View } from 'react-native';
import { features } from '@/lib/env';

const CRITERIA: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: MapPin, title: 'Distance', body: 'Les artisans les plus proches de l’adresse d’intervention sont présentés en premier.' },
  { icon: Star, title: 'Note des clients', body: 'Moyenne des avis vérifiés : seul un client ayant eu une intervention terminée peut noter, dans les 14 jours.' },
  { icon: ThumbsUp, title: "Taux d'acceptation", body: 'Part des demandes acceptées par l’artisan.' },
  { icon: CalendarCheck, title: 'Disponibilité', body: features.urgent ? 'Prochain créneau libre et disponibilité pour les urgences.' : 'Prochain créneau libre.' },
  {
    icon: TrendingDown,
    title: 'Fiabilité',
    body: features.urgent
      ? `Les annulations répétées font baisser le classement ; ${RULES.artisanReliability.maxCancellationsIn30Days} annulations en 30 jours suspendent les urgences.`
      : 'Les annulations répétées font baisser le classement.',
  },
  { icon: BadgeCheck, title: 'Vérification', body: 'Seuls les artisans vérifiés (SIRET actif, identité, assurance) apparaissent.' },
];

/** Information sur le classement des offres (obligation des plateformes en ligne). */
export function RankingScreen() {
  const t = useTheme();
  return (
    <Screen inTabs>
      <Stack.Screen options={{ title: 'Classement des artisans' }} />
      <View style={{ gap: t.spacing.lg }} testID="ranking">
        <Text variant="title1">Comment sont classés les artisans</Text>
        <Text tone="secondary">
          Le tri « Pertinence » combine les critères ci-dessous. Vous pouvez aussi trier par distance, note ou prix depuis les filtres de recherche.
        </Text>
        {CRITERIA.map((c) => (
          <Card key={c.title} style={{ flexDirection: 'row', gap: t.spacing.md }}>
            <Icon icon={c.icon} color={t.colors.text.brand} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{c.title}</Text>
              <Text variant="callout" tone="secondary">
                {c.body}
              </Text>
            </View>
          </Card>
        ))}
        <Text variant="callout" tone="secondary">
          {features.urgent
            ? `Pour les urgences, les artisans disponibles sont contactés par vagues de ${RULES.dispatch.artisansPerWave}, dans un rayon de ${RULES.dispatch.radiiKm.join(', puis ')} km, classés par distance, note et taux d'acceptation. `
            : null}
          Toute mise en avant rémunérée est signalée comme telle.
        </Text>
      </View>
    </Screen>
  );
}

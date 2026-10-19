import { formatEuros, RULES, type EarningsDto } from '@depano/schemas';
import {
  Button,
  Card,
  Divider,
  formatDateLong,
  ListItem,
  Screen,
  SectionHeader,
  SkeletonList,
  Text,
  useTheme,
  useToast,
} from '@depano/ui';
import { router, Stack } from 'expo-router';
import { Download, Landmark, PiggyBank, Receipt } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { useEarnings } from '../queries';
import { earningsCsv } from '../format';
import { shareCsv } from '../shareCsv';

const PAYOUT_STATUS: Record<string, string> = {
  paid: 'Versé',
  pending: 'En cours',
  in_transit: 'En cours',
  failed: 'Échec',
  canceled: 'Annulé',
};

/** Revenus : solde, virements, commission, export comptable (CSV) ; état « aucun gain ». */
export function EarningsScreen() {
  const t = useTheme();
  const toast = useToast();
  const q = useEarnings();
  const [exporting, setExporting] = useState(false);

  const exportCsv = async (e: EarningsDto) => {
    setExporting(true);
    try {
      await shareCsv(`depano-revenus-${new Date().toISOString().slice(0, 10)}.csv`, earningsCsv(e));
    } catch {
      toast.error("L'export n'a pas pu être créé. Réessayez.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen
      inTabs
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      testID="earnings-screen"
    >
      <Stack.Screen options={{ title: 'Revenus' }} />
      <QueryView
        query={q}
        loading={<SkeletonList count={4} />}
        isEmpty={(e) =>
          e.lifetimeCents === 0 &&
          e.lines.length === 0 &&
          e.payouts.length === 0 &&
          e.pendingCents === 0
        }
        empty={{
          icon: PiggyBank,
          title: 'Aucun gain pour l’instant',
          message:
            'Vos revenus apparaissent ici dès votre première intervention clôturée par le code de fin.',
          action: { label: 'Recevoir des urgences', onPress: () => router.push('/pro/accueil') },
        }}
      >
        {(e) => (
          <View style={{ gap: t.spacing.xl }}>
            <Card variant="brand" style={{ gap: t.spacing.xs }} testID="earnings-balance">
              <Text variant="label" tone="secondary">
                Solde disponible
              </Text>
              <Text variant="display">{formatEuros(e.availableCents)}</Text>
              <Text variant="callout" tone="secondary">
                En attente de virement : {formatEuros(e.pendingCents)}
              </Text>
            </Card>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <Card style={{ flex: 1, gap: 4 }} padding="md">
                <Text variant="caption" tone="secondary">
                  Gagné depuis le début
                </Text>
                <Text variant="title2">{formatEuros(e.lifetimeCents)}</Text>
              </Card>
              <Card style={{ flex: 1, gap: 4 }} padding="md">
                <Text variant="caption" tone="secondary">
                  Commission DEPANO
                </Text>
                <Text variant="title2">{formatEuros(e.commissionLifetimeCents)}</Text>
              </Card>
            </View>
            <Text variant="caption" tone="secondary">
              Commission de {Math.round(RULES.defaultCommissionRate * 100)} % prélevée à la capture,
              jamais sur les frais de déplacement seuls.
            </Text>

            <View style={{ gap: t.spacing.sm }}>
              <SectionHeader title="Virements" />
              {e.payouts.length ? (
                <Card padding="none">
                  {e.payouts.map((p, i) => (
                    <View key={p.id}>
                      {i > 0 ? <Divider inset={56} /> : null}
                      <ListItem
                        icon={Landmark}
                        title={formatEuros(p.amountCents)}
                        subtitle={
                          p.arrivalDate ? `Arrivée le ${formatDateLong(p.arrivalDate)}` : null
                        }
                        value={PAYOUT_STATUS[p.status] ?? p.status}
                        chevron={false}
                      />
                    </View>
                  ))}
                </Card>
              ) : (
                <Text tone="secondary">
                  Aucun virement pour l'instant. Les virements partent automatiquement vers votre
                  IBAN.
                </Text>
              )}
            </View>

            <View style={{ gap: t.spacing.sm }}>
              <SectionHeader title="Détail par intervention" />
              {e.lines.length ? (
                <Card padding="none">
                  {e.lines.map((l, i) => (
                    <View key={`${l.bookingId}-${i}`}>
                      {i > 0 ? <Divider inset={56} /> : null}
                      <ListItem
                        icon={Receipt}
                        title={`${l.reference} · ${formatEuros(l.netCents)} net`}
                        subtitle={`${formatDateLong(l.date)} · encaissé ${formatEuros(l.grossCents)}, commission ${formatEuros(l.commissionCents)}`}
                        onPress={() =>
                          router.push({
                            pathname: '/pro/interventions/[id]',
                            params: { id: l.bookingId },
                          })
                        }
                      />
                    </View>
                  ))}
                </Card>
              ) : (
                <Text tone="secondary">Aucune intervention clôturée.</Text>
              )}
            </View>

            <Button
              label="Export comptable (CSV)"
              icon={Download}
              variant="secondary"
              size="lg"
              fullWidth
              loading={exporting}
              disabled={!e.lines.length}
              onPress={() => void exportCsv(e)}
              testID="earnings-export"
            />
          </View>
        )}
      </QueryView>
    </Screen>
  );
}

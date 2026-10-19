import { formatEuros, type InvoiceDto } from '@depano/schemas';
import { Card, Divider, ListItem, Screen, SkeletonList, formatDateLong, useToast } from '@depano/ui';
import { Stack } from 'expo-router';
import { FileText, Receipt } from 'lucide-react-native';
import { View } from 'react-native';
import { AuthGate } from '@/components/AuthGate';
import { QueryView } from '@/components/QueryView';
import { useInvoices } from '../queries';
import { openDocument } from '../openFile';

/** Factures : liste, ouverture du PDF via URL signée (régénérée si expirée). */
export function InvoicesScreen() {
  return (
    <AuthGate title="Factures" message="Connectez-vous pour retrouver vos factures.">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const toast = useToast();
  const q = useInvoices();
  const open = async (inv: InvoiceDto) => {
    // Les URL signées expirent vite : on relit la liste pour en obtenir une fraîche.
    const fresh = (await q.refetch()).data?.find((i) => i.id === inv.id) ?? inv;
    if (!fresh.pdfUrl) {
      toast.show('Facture en cours de génération. Réessayez dans un instant.');
      return;
    }
    await openDocument(fresh.pdfUrl);
  };
  return (
    <Screen inTabs refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Stack.Screen options={{ title: 'Factures' }} />
      <QueryView
        query={q}
        loading={<SkeletonList count={3} variant="row" />}
        isEmpty={(d) => d.length === 0}
        empty={{ icon: Receipt, title: 'Aucune facture', message: 'Vos factures apparaissent ici après chaque intervention terminée. Conservées 10 ans.' }}
      >
        {(list) => (
          <Card padding="none" testID="invoice-list">
            {list.map((inv, i) => (
              <View key={inv.id}>
                {i > 0 ? <Divider inset={56} /> : null}
                <ListItem
                  icon={FileText}
                  title={`Facture ${inv.number}`}
                  subtitle={formatDateLong(inv.issuedAt)}
                  value={formatEuros(inv.totalCents)}
                  onPress={() => void open(inv)}
                  accessibilityHint="Ouvre le PDF"
                />
              </View>
            ))}
          </Card>
        )}
      </QueryView>
    </Screen>
  );
}

import { DOMAIN_CODES, DOMAIN_LABELS, type DomainCode } from '@depano/schemas';
import { DOMAIN_ICONS, Icon, ProgressHeader, Screen, Text, useTheme } from '@depano/ui';
import { router, Stack } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { DRAFT_KEYS, useDraft } from '@/stores/drafts';
import type { UrgentFlowDraft } from '../drafts';

const HINTS: Record<DomainCode, string> = {
  plomberie: 'Fuite, WC bouché, plus d’eau chaude',
  electricite: 'Panne de courant, disjoncteur, prise',
  energetique: 'Chaudière, chauffage, pompe à chaleur',
};

/** Urgence 1 sur 4 : trois grandes tuiles métier. */
export function UrgentDomainScreen() {
  const t = useTheme();
  const [draft, patch] = useDraft<UrgentFlowDraft>(DRAFT_KEYS.urgent);

  const choose = (d: DomainCode) => {
    if (draft.domain !== d) patch({ domain: d, serviceId: undefined, problemReason: undefined, customReason: false });
    router.push('/urgence/motif');
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Urgence', headerShown: true }} />
      <View style={{ gap: t.spacing.lg }}>
        <ProgressHeader step={1} total={4} title="Quel est le métier concerné ?" subtitle="Un artisan vérifié chez vous au plus vite." />
        {DOMAIN_CODES.map((d) => {
          const c = t.colors.domain[d];
          const selected = draft.domain === d;
          return (
            <Pressable
              key={d}
              testID={`urgent-domain-${d}`}
              onPress={() => choose(d)}
              accessibilityRole="button"
              accessibilityLabel={`${DOMAIN_LABELS[d]} : ${HINTS[d]}`}
              accessibilityState={{ selected }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.lg,
                minHeight: 112,
                padding: t.spacing.lg,
                borderRadius: t.radius.md,
                backgroundColor: c.soft,
                borderWidth: 2,
                borderColor: selected ? c.solid : 'transparent',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.solid, alignItems: 'center', justifyContent: 'center' }}>
                <Icon icon={DOMAIN_ICONS[d]} size={32} color={c.onSolid} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title2" color={c.text}>
                  {DOMAIN_LABELS[d]}
                </Text>
                <Text variant="callout" tone="secondary">
                  {HINTS[d]}
                </Text>
              </View>
              <Icon icon={ChevronRight} color={c.text} />
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

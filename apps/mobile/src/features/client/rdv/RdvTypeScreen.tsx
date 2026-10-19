import { DOMAIN_LABELS, SCHEDULED_TYPES, type ScheduledType } from '@depano/schemas';
import { DomainChip, Icon, ProgressHeader, Screen, Text, useTheme } from '@depano/ui';
import { router, Stack } from 'expo-router';
import { ChevronRight, Hammer, ShieldCheck } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { RdvArtisanBanner } from './RdvArtisanBanner';
import { SCHEDULED_TYPE_LABELS, useRdv } from './useRdv';

const ICONS = { maintenance: ShieldCheck, repair: Hammer } as const;

/** RDV 1 sur 4 : métier (si plusieurs) puis entretien ou dépannage. */
export function RdvTypeScreen({ artisanId }: { artisanId: string }) {
  const t = useTheme();
  const rdv = useRdv(artisanId);
  const { artisan, draft, patch, domain } = rdv;
  const multi = (artisan.data?.domains.length ?? 0) > 1;

  const choose = (kind: ScheduledType) => {
    const changed = draft.scheduledType !== kind || draft.domain !== domain;
    patch({ artisanId, domain, scheduledType: kind, ...(changed ? { serviceId: undefined, problemReason: undefined, customReason: false, scheduledAt: undefined } : null) });
    router.push({ pathname: '/rdv/motif', params: { artisanId } });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Rendez-vous', headerShown: true }} />
      <View style={{ gap: t.spacing.xl }}>
        <ProgressHeader step={1} total={4} title="De quoi avez-vous besoin ?" />
        <RdvArtisanBanner artisan={artisan} />
        {multi ? (
          <View style={{ gap: t.spacing.sm }}>
            <Text variant="label">Métier</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {artisan.data!.domains.map((d) => (
                <DomainChip key={d} domain={d} selected={domain === d} onPress={() => patch({ domain: d, serviceId: undefined, problemReason: undefined, scheduledAt: undefined })} />
              ))}
            </View>
          </View>
        ) : null}
        {SCHEDULED_TYPES.map((k) => {
          const offered = rdv.ofKind(k)?.length ?? 0;
          const disabled = !domain || (rdv.services !== undefined && offered === 0);
          const selected = draft.scheduledType === k;
          return (
            <Pressable
              key={k}
              testID={`rdv-type-${k}`}
              disabled={disabled}
              onPress={() => choose(k)}
              accessibilityRole="button"
              accessibilityState={{ disabled, selected }}
              accessibilityLabel={`${SCHEDULED_TYPE_LABELS[k].title} : ${SCHEDULED_TYPE_LABELS[k].hint}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.lg,
                minHeight: 96,
                padding: t.spacing.lg,
                borderRadius: t.radius.md,
                backgroundColor: t.colors.background.surface,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? t.colors.brand.primary : t.colors.border.subtle,
                opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
                ...t.elevation(1),
              })}
            >
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.colors.background.brand, alignItems: 'center', justifyContent: 'center' }}>
                <Icon icon={ICONS[k]} size={28} color={t.colors.text.brand} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title2">{SCHEDULED_TYPE_LABELS[k].title}</Text>
                <Text variant="callout" tone="secondary">
                  {disabled && domain ? `Non proposé en ${DOMAIN_LABELS[domain].toLowerCase()}` : !domain ? 'Choisissez d’abord le métier' : SCHEDULED_TYPE_LABELS[k].hint}
                </Text>
              </View>
              <Icon icon={ChevronRight} color={t.colors.text.secondary} />
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

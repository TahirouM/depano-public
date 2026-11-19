import type { ServiceDto } from '@depano/schemas';
import { Icon, Skeleton, Text, TextField, useTheme } from '@depano/ui';
import { CircleCheck, Circle, PenLine } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

export interface ReasonValue {
  serviceId?: string;
  problemReason?: string;
  customReason?: boolean;
}

export interface ReasonPickerProps {
  services: ServiceDto[] | undefined;
  value: ReasonValue;
  onChange: (v: ReasonValue) => void;
  /** Prix affiché à droite de chaque motif (centimes), si connu. */
  priceFor?: (s: ServiceDto) => string | null;
  loading?: boolean;
  /** Personnalisation de « Autre problème » (RDV : besoin hors catalogue, prix sur devis). */
  other?: { label?: string; subtitle?: string; fieldLabel?: string; placeholder?: string; helper?: string; maxLength?: number; multiline?: boolean };
}

function Option({ title, subtitle, selected, onPress, icon, testID }: { title: string; subtitle?: string | null; selected: boolean; onPress: () => void; icon?: typeof PenLine; testID?: string }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        minHeight: 56,
        paddingHorizontal: t.spacing.lg,
        paddingVertical: t.spacing.md,
        borderRadius: t.radius.md,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? t.colors.brand.primary : t.colors.border.subtle,
        backgroundColor: selected ? t.colors.background.brand : t.colors.background.surface,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icon icon={selected ? CircleCheck : icon ?? Circle} color={selected ? t.colors.brand.primary : t.colors.text.secondary} />
      <Text variant="bodyStrong" style={{ flex: 1 }}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="callout" tone="secondary">
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Motifs prédéfinis (prestations du métier) + « Autre problème » en texte libre. */
export function ReasonPicker({ services, value, onChange, priceFor, loading, other }: ReasonPickerProps) {
  const t = useTheme();
  if (loading || !services) {
    return (
      <View style={{ gap: t.spacing.sm }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={56} radius={t.radius.md} />
        ))}
      </View>
    );
  }
  return (
    <View style={{ gap: t.spacing.sm }} accessibilityRole="radiogroup">
      {services.map((s) => (
        <Option
          key={s.id}
          testID={`reason-${s.slug}`}
          title={s.name}
          subtitle={priceFor?.(s) ?? null}
          selected={!value.customReason && value.serviceId === s.id}
          onPress={() => onChange({ serviceId: s.id, problemReason: s.name, customReason: false })}
        />
      ))}
      <Option
        testID="reason-other"
        title={other?.label ?? 'Autre problème'}
        subtitle={other?.subtitle}
        icon={PenLine}
        selected={!!value.customReason}
        onPress={() => onChange({ serviceId: undefined, problemReason: '', customReason: true })}
      />
      {value.customReason ? (
        <TextField
          label={other?.fieldLabel ?? 'En quelques mots'}
          value={value.problemReason ?? ''}
          onChangeText={(v) => onChange({ serviceId: undefined, problemReason: v.slice(0, other?.maxLength ?? 120), customReason: true })}
          placeholder={other?.placeholder ?? 'Ex. : radiateur qui fuit'}
          helper={other?.helper}
          maxLength={other?.maxLength ?? 120}
          multiline={other?.multiline}
          autoFocus
          testID="reason-custom"
        />
      ) : null}
    </View>
  );
}

import { DOMAIN_LABELS, formatEuros, type DomainCode, type DomainDto } from '@depano/schemas';
import { Badge, Card, Divider, IconButton, Text, TextField, useTheme } from '@depano/ui';
import { Check, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { centsToInput, parseEuros } from '../format';

export { centsToInput, parseEuros };

export interface ServicesEditorProps {
  catalog: DomainDto[];
  domains: DomainCode[];
  /** serviceId → prix en centimes (présent = proposé). */
  prices: Record<string, number>;
  onChange: (prices: Record<string, number>) => void;
}

/**
 * Prestations par métier : case à cocher (ligne entière) + prix, avec le prix indicatif
 * du marché proposé par défaut.
 */
export function ServicesEditor({ catalog, domains, prices, onChange }: ServicesEditorProps) {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing.lg }}>
      {catalog
        .filter((d) => domains.includes(d.code))
        .map((d) => (
          <View key={d.code} style={{ gap: t.spacing.sm }}>
            <Text variant="overline" tone="secondary" accessibilityRole="header">
              {DOMAIN_LABELS[d.code]}
            </Text>
            <Card padding="none">
              {d.services.map((s, i) => {
                const on = prices[s.id] != null;
                return (
                  <View key={s.id}>
                    {i > 0 ? <Divider /> : null}
                    <ServiceRow
                      name={s.name}
                      reference={s.referencePriceCents}
                      on={on}
                      cents={prices[s.id]}
                      onToggle={() => {
                        const next = { ...prices };
                        if (on) delete next[s.id];
                        else next[s.id] = s.referencePriceCents;
                        onChange(next);
                      }}
                      onPrice={(c) => onChange({ ...prices, [s.id]: c })}
                      testID={`service-${s.slug}`}
                    />
                  </View>
                );
              })}
            </Card>
          </View>
        ))}
    </View>
  );
}

export interface ServiceRowProps {
  name: string;
  /** Prix indicatif du marché (motifs du catalogue) ; null pour un motif personnel. */
  reference: number | null;
  on: boolean;
  /** Prix de l'artisan (conservé quand le motif est désactivé, écran Tarifs). */
  cents: number | undefined;
  onToggle: () => void;
  onPrice: (c: number) => void;
  /** Ligne secondaire à la place du prix du marché (motif personnel : type et durée). */
  caption?: string;
  /** Motif personnel : badge « Personnel » et action de suppression. */
  custom?: boolean;
  onDelete?: () => void;
  testID?: string;
}

/** Une prestation : case à cocher (ligne entière, active / désactive) + prix TTC si cochée. */
export function ServiceRow({
  name,
  reference,
  on,
  cents,
  onToggle,
  onPrice,
  caption,
  custom,
  onDelete,
  testID,
}: ServiceRowProps) {
  const t = useTheme();
  const [text, setText] = useState(centsToInput(cents));
  const [err, setErr] = useState<string | null>(null);
  // Valeur arrivée après coup (reprise du brouillon / profil) : on resynchronise le champ.
  useEffect(() => {
    if (cents != null && parseEuros(text) !== cents) setText(centsToInput(cents));
  }, [cents]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View
      style={{ paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.sm, gap: t.spacing.sm }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: on }}
          accessibilityLabel={`${name}${custom ? ', motif personnel' : ''}, ${
            reference != null ? `prix du marché ${formatEuros(reference)}` : (caption ?? '')
          }`}
          onPress={() => {
            // Réactivation : le prix déjà saisi est conservé ; sinon prix du marché proposé.
            if (!on && cents == null && reference != null) setText(centsToInput(reference));
            onToggle();
          }}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.md,
            minHeight: 48,
          }}
          testID={testID}
        >
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: on ? t.colors.brand.primary : t.colors.border.input,
              backgroundColor: on ? t.colors.brand.primary : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {on ? <Check size={18} color={t.colors.brand.onPrimary} strokeWidth={3} /> : null}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.xs,
                flexWrap: 'wrap',
              }}
            >
              <Text variant="body" tone={on ? 'primary' : 'secondary'} style={{ flexShrink: 1 }}>
                {name}
              </Text>
              {custom ? <Badge label="Personnel" tone="brand" appearance="soft" /> : null}
            </View>
            <Text variant="caption" tone="secondary">
              {reference != null ? `Prix du marché : ${formatEuros(reference)}` : caption}
              {!on && cents != null ? ` · désactivé (${formatEuros(cents)})` : ''}
            </Text>
          </View>
        </Pressable>
        {onDelete ? (
          <IconButton
            icon={Trash2}
            accessibilityLabel={`Supprimer le motif ${name}`}
            onPress={onDelete}
            color={t.colors.text.secondary}
            testID={testID ? `${testID}-delete` : undefined}
          />
        ) : null}
      </View>
      {on ? (
        <TextField
          label="Votre prix TTC (€)"
          value={text}
          keyboardType="decimal-pad"
          inputMode="decimal"
          onChangeText={(v) => {
            setText(v);
            const c = parseEuros(v);
            if (c == null || c <= 0) setErr('Indiquez un prix supérieur à 0 €.');
            else {
              setErr(null);
              onPrice(c);
            }
          }}
          error={err}
          helper={cents != null && reference ? diffHint(cents, reference) : undefined}
          accessibilityLabel={`Votre prix TTC pour ${name}, en euros`}
          testID={testID ? `${testID}-price` : undefined}
        />
      ) : null}
    </View>
  );
}

function diffHint(cents: number, ref: number): string {
  const pct = Math.round(((cents - ref) / ref) * 100);
  if (Math.abs(pct) < 5) return 'Dans la moyenne du marché.';
  return pct > 0 ? `${pct} % au-dessus du marché.` : `${-pct} % en dessous du marché.`;
}

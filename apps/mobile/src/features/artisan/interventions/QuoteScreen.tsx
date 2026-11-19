import {
  formatEuros,
  quoteNeedsNewAuthorization,
  RULES,
  type BookingDetailDto,
  type QuoteLineKind,
} from '@depano/schemas';
import {
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  PriceRow,
  Screen,
  SectionHeader,
  SkeletonList,
  Switch,
  Text,
  TextField,
  useTheme,
  useToast,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import {
  Car,
  Hammer,
  Minus,
  Package,
  Plus,
  Send,
  Trash2,
  TriangleAlert,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { api, errorMessage } from '@/lib/api';
import { useBookingLive } from '@/lib/realtime/hooks';
import { useDraft } from '@/stores/drafts';
import { centsToInput, parseEuros } from '../components/ServicesEditor';
import { setBookingDetail, useArtisanProfile } from '../queries';

interface Line {
  key: string;
  kind: QuoteLineKind;
  label: string;
  quantity: number;
  unitPriceCents: number;
}
interface QuoteDraft {
  lines?: Line[];
  keepReplacedParts?: boolean;
}

const KIND_LABEL: Record<QuoteLineKind, string> = {
  labor: "Main-d'œuvre",
  part: 'Pièce',
  travel: 'Déplacement',
};
const KIND_ICON = { labor: Hammer, part: Package, travel: Car } as const;
let seq = 0;
const newKey = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`;

function defaultLines(b: BookingDetailDto): Line[] {
  if (b.quote && (b.quote.status === 'refused' || b.quote.status === 'expired')) {
    return b.quote.lines.map((l) => ({
      key: newKey(),
      kind: l.kind,
      label: l.label,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
    }));
  }
  const lines: Line[] = [
    {
      key: newKey(),
      kind: 'labor',
      label: b.serviceName ?? "Main-d'œuvre",
      quantity: 1,
      unitPriceCents: b.price.baseCents,
    },
  ];
  if (b.price.urgentFeeCents > 0)
    lines.push({
      key: newKey(),
      kind: 'labor',
      label: 'Majoration urgence',
      quantity: 1,
      unitPriceCents: b.price.urgentFeeCents,
    });
  if (b.price.travelFeeCents > 0)
    lines.push({
      key: newKey(),
      kind: 'travel',
      label: 'Déplacement',
      quantity: 1,
      unitPriceCents: b.price.travelFeeCents,
    });
  return lines;
}

/** Devis sur place : obligatoire avant toute prestation (arrêté du 24 janvier 2017). */
export function QuoteScreen({ id }: { id: string }) {
  const q = useBookingLive(id);
  return (
    <>
      <Stack.Screen options={{ title: 'Devis sur place' }} />
      <QueryView query={q} loading={<SkeletonList count={3} variant="row" />}>
        {(b) => <QuoteForm b={b} />}
      </QueryView>
    </>
  );
}

function QuoteForm({ b }: { b: BookingDetailDto }) {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const profile = useArtisanProfile();
  const [draft, patch, reset] = useDraft<QuoteDraft>(`quote:${b.id}`);

  useEffect(() => {
    if (!draft.lines) patch({ lines: defaultLines(b), keepReplacedParts: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lines = draft.lines ?? [];
  const keep = draft.keepReplacedParts ?? true;
  const total = lines.reduce((s, l) => s + Math.round(l.quantity * l.unitPriceCents), 0);
  const overrun = quoteNeedsNewAuthorization(total, b.authorizedCents);
  const valid =
    lines.length > 0 &&
    lines.every((l) => l.label.trim().length > 0 && l.quantity > 0) &&
    total > 0;

  const setLine = (key: string, p: Partial<Line>) =>
    patch({ lines: lines.map((l) => (l.key === key ? { ...l, ...p } : l)) });
  const add = (l: Omit<Line, 'key'>) => patch({ lines: [...lines, { ...l, key: newKey() }] });

  const send = useMutation({
    mutationFn: () =>
      api.bookings.sendQuote(b.id, {
        lines: lines.map((l) => ({
          kind: l.kind,
          label: l.label.trim(),
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
        })),
        keepReplacedParts: keep,
      }),
    onSuccess: (nb) => {
      setBookingDetail(qc, nb);
      reset();
      toast.success('Devis envoyé au client.');
      router.back();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (b.status !== 'arrived') {
    return (
      <Screen
        inTabs
        footer={
          <Button
            label="Retour à l'intervention"
            size="lg"
            fullWidth
            variant="secondary"
            onPress={() => router.back()}
          />
        }
      >
        <Card style={{ gap: t.spacing.sm }}>
          <Text variant="title2">
            {b.quote
              ? `Devis ${b.quote.status === 'sent' ? 'en attente du client' : b.quote.status === 'accepted' ? 'accepté' : 'clos'}`
              : 'Devis indisponible'}
          </Text>
          {b.quote ? (
            <>
              {b.quote.lines.map((l) => (
                <PriceRow
                  key={l.id}
                  label={`${l.label} × ${String(l.quantity).replace('.', ',')}`}
                  cents={l.totalCents}
                />
              ))}
              <Divider />
              <PriceRow label="Total TTC" cents={b.quote.totalCents} total />
            </>
          ) : (
            <Text tone="secondary">Le devis se fait une fois arrivé chez le client.</Text>
          )}
        </Card>
      </Screen>
    );
  }

  const refused = b.quote?.status === 'refused' || b.quote?.status === 'expired';
  return (
    <Screen
      inTabs
      footer={
        <View style={{ gap: t.spacing.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="bodyStrong">Total TTC</Text>
            <Text variant="title2" testID="quote-total">
              {formatEuros(total)}
            </Text>
          </View>
          <Button
            label="Envoyer le devis au client"
            icon={Send}
            size="lg"
            fullWidth
            haptic="success"
            disabled={!valid}
            loading={send.isPending}
            onPress={() => send.mutate()}
            testID="quote-send"
          />
        </View>
      }
      testID="quote-screen"
    >
      <View style={{ gap: t.spacing.lg }}>
        {refused ? (
          <Card
            variant="outline"
            style={{ gap: 4, borderColor: t.colors.tone.danger.solid }}
            testID="quote-refused-banner"
          >
            <Text variant="bodyStrong" tone="danger">
              {b.quote?.status === 'expired'
                ? 'Le devis précédent a expiré'
                : 'Le client a refusé le devis précédent'}
            </Text>
            <Text variant="callout" tone="secondary">
              Ajustez les lignes puis renvoyez-le, ou revenez en arrière pour clôturer en «
              Déplacement seulement ».
            </Text>
          </Card>
        ) : null}
        <Text tone="secondary">
          Détaillez la main-d'œuvre, les pièces et le déplacement. Le client valide dans l'app avant
          que vous commenciez.
        </Text>

        {lines.map((l, i) => (
          <LineEditor
            key={l.key}
            index={i}
            line={l}
            onChange={(p) => setLine(l.key, p)}
            onRemove={() => patch({ lines: lines.filter((x) => x.key !== l.key) })}
          />
        ))}

        <View style={{ gap: t.spacing.sm }}>
          <Text variant="label">Ajouter une ligne</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
            <Chip
              label="Main-d'œuvre"
              icon={Hammer}
              onPress={() =>
                add({ kind: 'labor', label: "Main-d'œuvre", quantity: 1, unitPriceCents: 0 })
              }
              testID="add-labor"
            />
            <Chip
              label="Pièce"
              icon={Package}
              onPress={() => add({ kind: 'part', label: '', quantity: 1, unitPriceCents: 0 })}
              testID="add-part"
            />
            <Chip
              label="Déplacement"
              icon={Car}
              onPress={() =>
                add({
                  kind: 'travel',
                  label: 'Déplacement',
                  quantity: 1,
                  unitPriceCents: profile.data?.travelFeeCents ?? 0,
                })
              }
            />
          </View>
        </View>

        {profile.data?.services.some((s) => s.active && s.domain === b.domain) ? (
          <View style={{ gap: t.spacing.sm }}>
            <Text variant="label">Ajout rapide depuis vos prestations</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {profile.data.services
                .filter((s) => s.active && s.domain === b.domain)
                .map((s) => (
                  <Chip
                    key={s.serviceId}
                    label={`${s.name} · ${formatEuros(s.priceCents)}`}
                    icon={Plus}
                    onPress={() =>
                      add({
                        kind: 'labor',
                        label: s.name,
                        quantity: 1,
                        unitPriceCents: s.priceCents,
                      })
                    }
                  />
                ))}
            </View>
          </View>
        ) : null}

        <Card variant="flat" style={{ gap: t.spacing.sm }}>
          <PriceRow label="Montant autorisé par le client" cents={b.authorizedCents} />
          <PriceRow label="Ce devis" cents={total} total />
        </Card>

        {overrun ? (
          <Card
            variant="outline"
            style={{
              flexDirection: 'row',
              gap: t.spacing.sm,
              borderColor: t.colors.tone.warning.solid,
            }}
            testID="quote-overrun"
          >
            <TriangleAlert size={22} color={t.colors.tone.warning.text} />
            <Text variant="callout" style={{ flex: 1 }}>
              Ce devis dépasse de plus de {Math.round(RULES.quoteOverrunThreshold * 100)} % le
              montant autorisé ({formatEuros(b.authorizedCents)}). Le client devra valider une
              autorisation de paiement complémentaire dans l'app.
            </Text>
          </Card>
        ) : null}

        <SectionHeader title="Pièces remplacées" />
        <Switch
          label="Conserver les pièces remplacées pour le client"
          description="Mention légale : les pièces remplacées sont restituées au client, sauf s'il renonce expressément à les conserver."
          value={keep}
          onValueChange={(v) => patch({ keepReplacedParts: v })}
          testID="keep-parts"
        />
        <Text variant="caption" tone="secondary">
          Devis gratuit et obligatoire avant toute prestation de dépannage à domicile. Valable 30
          minutes. Prix TTC.
        </Text>
      </View>
    </Screen>
  );
}

function LineEditor({
  line,
  index,
  onChange,
  onRemove,
}: {
  line: Line;
  index: number;
  onChange: (p: Partial<Line>) => void;
  onRemove: () => void;
}) {
  const t = useTheme();
  const [price, setPrice] = useState(centsToInput(line.unitPriceCents));
  const [err, setErr] = useState<string | null>(null);
  const Icon = KIND_ICON[line.kind];
  const step = line.kind === 'labor' && /heure|h\b/i.test(line.label) ? 0.5 : 1;
  return (
    <Card style={{ gap: t.spacing.sm }} testID={`quote-line-${index}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
        <Icon size={20} color={t.colors.text.brand} />
        <Text variant="overline" tone="secondary" style={{ flex: 1 }}>
          {KIND_LABEL[line.kind]}
        </Text>
        <Text variant="bodyStrong">
          {formatEuros(Math.round(line.quantity * line.unitPriceCents))}
        </Text>
        <IconButton
          icon={Trash2}
          accessibilityLabel={`Supprimer la ligne ${line.label || KIND_LABEL[line.kind]}`}
          onPress={onRemove}
        />
      </View>
      <TextField
        label="Désignation"
        value={line.label}
        onChangeText={(v) => onChange({ label: v })}
        placeholder={line.kind === 'part' ? 'Ex. Flexible inox 50 cm' : undefined}
        maxLength={200}
        testID={`quote-line-${index}-label`}
      />
      <View style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'flex-end' }}>
        <View style={{ gap: 4 }}>
          <Text variant="label">Quantité</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
            <IconButton
              icon={Minus}
              variant="filled"
              accessibilityLabel="Diminuer la quantité"
              disabled={line.quantity <= step}
              onPress={() => onChange({ quantity: Math.max(step, line.quantity - step) })}
            />
            <Text
              variant="bodyStrong"
              style={{ minWidth: 32 }}
              align="center"
              accessibilityLabel={`Quantité ${line.quantity}`}
            >
              {String(line.quantity).replace('.', ',')}
            </Text>
            <IconButton
              icon={Plus}
              variant="filled"
              accessibilityLabel="Augmenter la quantité"
              onPress={() => onChange({ quantity: line.quantity + step })}
            />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="Prix unitaire TTC (€)"
            value={price}
            keyboardType="decimal-pad"
            inputMode="decimal"
            onChangeText={(v) => {
              setPrice(v);
              const c = parseEuros(v);
              if (c == null) setErr('Montant invalide');
              else {
                setErr(null);
                onChange({ unitPriceCents: c });
              }
            }}
            error={err}
            testID={`quote-line-${index}-price`}
          />
        </View>
      </View>
    </Card>
  );
}

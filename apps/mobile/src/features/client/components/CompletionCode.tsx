import { Card, Icon, Text, useTheme } from '@depano/ui';
import { KeyRound } from 'lucide-react-native';
import { View } from 'react-native';

/**
 * Code de fin à 4 chiffres, affiché en très grand pour être dicté ou montré à l'artisan.
 * VoiceOver lit les chiffres un par un.
 */
export function CompletionCode({ code, attemptsLeft, compact }: { code: string; attemptsLeft?: number; compact?: boolean }) {
  const t = useTheme();
  const digits = code.split('');
  const size = compact ? 40 : 64;
  return (
    <Card variant="brand" style={{ gap: t.spacing.md, alignItems: 'center' }} testID="completion-code">
      <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
        <Icon icon={KeyRound} size={20} color={t.colors.text.brand} />
        <Text variant="label" tone="brand">
          Votre code de fin
        </Text>
      </View>
      <View
        style={{ flexDirection: 'row', gap: t.spacing.sm }}
        accessible
        accessibilityRole="text"
        accessibilityLabel={`Code de fin : ${digits.join(' ')}`}
      >
        {digits.map((d, i) => (
          <View
            key={i}
            style={{
              width: size + 12,
              height: size + 24,
              borderRadius: t.radius.md,
              backgroundColor: t.colors.background.surface,
              alignItems: 'center',
              justifyContent: 'center',
              ...t.elevation(1),
            }}
          >
            <Text variant="display" weight="bold" style={{ fontSize: size, lineHeight: size + 8 }} maxFontSizeMultiplier={1.3}>
              {d}
            </Text>
          </View>
        ))}
      </View>
      <Text variant="callout" tone="secondary" align="center">
        Donnez-le à l'artisan seulement quand le travail est terminé et vous convient. C'est lui qui déclenche le paiement.
        {attemptsLeft != null && attemptsLeft < 3 ? ` Essais restants pour l'artisan : ${attemptsLeft}.` : ''}
      </Text>
    </Card>
  );
}

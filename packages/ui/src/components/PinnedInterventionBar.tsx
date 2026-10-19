import type { BookingStatus } from '@depano/schemas';
import { Platform, PlatformColor, Pressable, StyleSheet, View, type ColorValue } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, ReduceMotion, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';
import { useLiquidGlass } from '../glass/useLiquidGlass';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../tokens/scale';
import { Glass } from './Glass';
import { Icon } from './Icon';
import { bookingStatusMeta, type Perspective } from './meta';
import { Text } from './Text';

export interface PinnedInterventionBarProps {
  status: BookingStatus;
  /** Ex. « Fuite sous évier ». */
  title: string;
  /** Ex. « Karim B. · arrivée dans 12 min ». */
  subtitle?: string | null;
  perspective?: Perspective;
  onPress: () => void;
  /**
   * - `solid` (défaut) : carte opaque au-dessus de la tab bar (web).
   * - `glass` : capsule Liquid Glass flottante (repli opaque hors iOS 26 / transparence réduite).
   * - `none` : aucun fond, pour l'accessoire natif de la tab bar iOS 26 (le système dessine le verre).
   */
  surface?: 'solid' | 'glass' | 'none';
  /** Une seule ligne (accessoire « inline » quand la tab bar est réduite). */
  compact?: boolean;
}

/** Couleurs système dynamiques : l'accessoire natif change de clair/sombre selon le contenu dessous. */
const systemLabel = (fallback: string): ColorValue => (Platform.OS === 'ios' ? PlatformColor('label') : fallback);
const systemSecondary = (fallback: string): ColorValue => (Platform.OS === 'ios' ? PlatformColor('secondaryLabel') : fallback);

/** Intervention en cours épinglée au-dessus de la tab bar, comme un mini-lecteur audio. */
export function PinnedInterventionBar({ status, title, subtitle, perspective = 'client', onPress, surface = 'solid', compact = false }: PinnedInterventionBarProps) {
  const t = useTheme();
  const glass = useLiquidGlass();
  const m = bookingStatusMeta(status, perspective);
  const tone = t.colors.tone[m.tone];
  const label = `Intervention en cours : ${m.label}. ${title}${subtitle ? `. ${subtitle}` : ''}`;
  const line = subtitle ? `${title} · ${subtitle}` : title;

  if (surface === 'none') {
    // Contenu de l'accessoire natif : hauteur fixe imposée par le système, taille de texte bornée.
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Ouvre le suivi"
        onPress={onPress}
        style={[styles.accessory, { paddingHorizontal: compact ? t.spacing.sm : t.spacing.md, gap: t.spacing.sm }]}
        testID="pinned-intervention"
      >
        <View style={[styles.iconSm, { backgroundColor: tone.soft, borderRadius: t.radius.full }]}>
          <Icon icon={m.icon} size={16} color={tone.text} />
        </View>
        <View style={styles.flex}>
          <Text variant="label" numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ color: systemLabel(t.colors.text.primary) }}>
            {compact ? `${m.label} · ${title}` : m.label}
          </Text>
          {compact ? null : (
            <Text variant="caption" numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ color: systemSecondary(t.colors.text.secondary) }}>
              {line}
            </Text>
          )}
        </View>
      </Pressable>
    );
  }

  const onGlass = surface === 'glass';
  const useGlassMotion = onGlass && glass.enabled;
  // Le verre ne supporte pas une opacité < 1 (Apple) : glissement seul quand il est actif.
  const entering = (useGlassMotion ? SlideInDown : FadeInDown).duration(250).reduceMotion(ReduceMotion.System);
  const exiting = (useGlassMotion ? SlideOutDown : FadeOutDown).duration(200).reduceMotion(ReduceMotion.System);

  const content = (
    <>
      <View style={[styles.icon, { backgroundColor: tone.soft, borderRadius: t.radius.full }]}>
        <Icon icon={m.icon} size={20} color={tone.text} />
      </View>
      <View style={styles.flex}>
        <Text variant="label" tone={m.tone} numberOfLines={1}>
          {m.label}
        </Text>
        <Text variant="callout" numberOfLines={1}>
          {line}
        </Text>
      </View>
      <Icon icon={ChevronRight} size={20} color={t.colors.text.secondary} />
    </>
  );

  return (
    <Animated.View entering={entering} exiting={exiting} style={{ paddingHorizontal: t.spacing.sm, paddingBottom: t.spacing.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Ouvre le suivi"
        onPress={onPress}
        testID="pinned-intervention"
        style={({ pressed }) =>
          onGlass
            ? { transform: [{ scale: pressed ? 0.98 : 1 }] }
            : [
                styles.bar,
                {
                  minHeight: MIN_TOUCH + 8,
                  borderRadius: t.radius.md,
                  backgroundColor: t.colors.background.surface,
                  paddingHorizontal: t.spacing.md,
                  gap: t.spacing.md,
                  opacity: pressed ? 0.9 : 1,
                  borderLeftWidth: 4,
                  borderLeftColor: tone.solid,
                },
                t.elevation(3),
              ]
        }
      >
        {onGlass ? (
          <Glass legible radius={t.radius.full} style={[styles.bar, { minHeight: MIN_TOUCH + 8, paddingHorizontal: t.spacing.sm, paddingRight: t.spacing.md, gap: t.spacing.md }]}>
            {content}
          </Glass>
        ) : (
          content
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  accessory: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconSm: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});

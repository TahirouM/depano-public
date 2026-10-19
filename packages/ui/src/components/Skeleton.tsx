import { useEffect } from 'react';
import { View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, ReduceMotion } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/** Bloc de chargement (pas de spinner plein écran). Statique si « réduire les animations ». */
export function Skeleton({ width = '100%', height = 16, radius, style }: SkeletonProps) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    o.value = withRepeat(withTiming(0.5, { duration: 800, reduceMotion: ReduceMotion.System }), -1, true);
  }, [o, reduce]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius ?? t.radius.sm, backgroundColor: t.colors.skeleton }, anim, style]}
    />
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing.sm }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} height={14} />
      ))}
    </View>
  );
}

/** Squelette d'une carte (ArtisanCard / InterventionCard). */
export function SkeletonCard() {
  const t = useTheme();
  return (
    <View style={{ padding: t.spacing.lg, borderRadius: t.radius.md, backgroundColor: t.colors.background.surface, gap: t.spacing.md, ...t.elevation(1) }}>
      <View style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}>
        <Skeleton width={48} height={48} radius={24} />
        <View style={{ flex: 1, gap: t.spacing.sm }}>
          <Skeleton width="70%" height={16} />
          <Skeleton width="40%" height={12} />
        </View>
      </View>
      <Skeleton width="50%" height={24} radius={t.radius.full} />
    </View>
  );
}

export function SkeletonList({ count = 4, variant = 'card' }: { count?: number; variant?: 'card' | 'row' }) {
  const t = useTheme();
  return (
    <View accessible accessibilityLabel="Chargement en cours" style={{ gap: t.spacing.md }}>
      {Array.from({ length: count }, (_, i) =>
        variant === 'card' ? (
          <SkeletonCard key={i} />
        ) : (
          <View key={i} style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center', paddingHorizontal: t.spacing.lg }}>
            <Skeleton width={48} height={48} radius={24} />
            <View style={{ flex: 1, gap: t.spacing.sm }}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="90%" height={12} />
            </View>
          </View>
        ),
      )}
    </View>
  );
}

import { hexWithAlpha, useReduceMotion, useTheme } from '@depano/ui';
import { Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Image, Platform, RefreshControl, StyleSheet, View, type ImageSourcePropType, type LayoutChangeEvent } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * Photo d'ambiance de l'en-tête (artisan au travail…). Aucune photo pour l'instant : l'en-tête est un
 * dégradé aux couleurs du thème. Pour en ajouter une : `require('@/../assets/images/hero.jpg')`
 * (cadrée à droite, recadrée en disque par `HeroBackground`).
 */
export const HERO_IMAGE: ImageSourcePropType | null = null;

/** Débord de la feuille de contenu sur l'en-tête (rayon des coins arrondis). */
const SHEET_OVERLAP = 28;
const TOP_BAR_HEIGHT = 56;
/** Hauteur supposée de l'en-tête avant la première mesure (évite un saut de la feuille). */
const HERO_ESTIMATE = 260;
/**
 * Débord du fond sous le haut de la feuille : le fond continue sous les coins arrondis et l'ombre
 * de la feuille, quelle que soit la position de défilement (jamais de bande de canvas entre les deux).
 */
const BACKGROUND_BLEED = SHEET_OVERLAP * 3;

/** Fond de l'en-tête : dégradé de marque + formes, lisible en clair comme en sombre (tokens uniquement). */
export function HeroBackground({ image = HERO_IMAGE }: { image?: ImageSourcePropType | null }) {
  const t = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    // Onglet encore masqué (web) : dimensions nulles, on garde la mesure précédente.
    if (w > 0 && h > 0) setSize({ w, h });
  };
  const r = Math.max(120, size.h * 0.62);
  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      {/* Dimensions relatives : pas de mesure nécessaire (onglets web montés masqués). */}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={t.colors.background.brand} />
            <Stop offset="1" stopColor={t.colors.background.canvas} />
          </LinearGradient>
          <LinearGradient id="blob" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={t.colors.text.brand} stopOpacity={t.scheme === 'dark' ? 0.32 : 0.22} />
            <Stop offset="1" stopColor={t.colors.text.brand} stopOpacity={0.04} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#hero)" />
        <Circle cx="92%" cy="22%" r="48%" fill="url(#blob)" />
        <Circle cx="95%" cy="96%" r="14%" fill={hexWithAlpha(t.colors.text.brand, 0.1)} />
      </Svg>
      {image && size.w > 0 ? (
        <Image
          source={image}
          resizeMode="cover"
          style={{ position: 'absolute', right: -r * 0.3, top: TOP_BAR_HEIGHT, width: r * 1.3, height: r * 1.3, borderRadius: r * 0.65 }}
        />
      ) : null}
    </View>
  );
}

export interface HeroSheetLayoutProps {
  /** Barre fixe tout en haut (sélecteur de position, cloche…). */
  topBar: ReactNode;
  /** Contenu fixe de l'en-tête (titre, sous-titre), recouvert par la feuille au défilement. */
  hero: ReactNode;
  /** Contenu de la feuille (coins arrondis) qui glisse par-dessus l'en-tête. */
  children: ReactNode;
  image?: ImageSourcePropType | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Fin de liste atteinte (pagination). */
  onEndReached?: () => void;
  testID?: string;
}

/**
 * En-tête fixe (fond de marque, titre) + feuille de contenu aux coins arrondis qui monte par-dessus
 * au défilement. La barre du haut reste accessible et prend un fond opaque quand la feuille l'atteint.
 * Réduction des animations : pas de parallaxe (le recouvrement suit simplement le doigt).
 */
export function HeroSheetLayout({ topBar, hero, children, image, refreshing, onRefresh, onEndReached, testID }: HeroSheetLayoutProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [heroHeight, setHeroHeight] = useState(HERO_ESTIMATE);
  const y = useSharedValue(0);
  const barHeight = insets.top + TOP_BAR_HEIGHT;
  // Position de défilement où la feuille touche la barre du haut.
  const covered = Math.max(1, heroHeight - SHEET_OVERLAP - barHeight);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      y.value = e.contentOffset.y;
    },
  });
  // Le fond ne suit pas le défilement : il reste en place derrière la feuille. En tirant vers le bas
  // (pull-to-refresh, rebond iOS), il s'étire depuis le haut pour toujours rejoindre la feuille.
  const backgroundHeight = heroHeight + BACKGROUND_BLEED;
  const backgroundStyle = useAnimatedStyle(() => {
    const pull = Math.max(0, -y.value);
    return { transform: [{ scale: 1 + pull / backgroundHeight }] };
  });
  // Parallaxe sur le texte seulement (aucune sur le fond, donc aucun vide possible). Le texte s'efface
  // avant de passer sous la barre du haut (encore transparente) pour ne pas se superposer à elle.
  const heroStyle = useAnimatedStyle(() => {
    const opacity = interpolate(y.value, [covered * 0.2, covered * 0.6], [1, 0], Extrapolation.CLAMP);
    if (reduce) return { opacity };
    return { opacity, transform: [{ translateY: interpolate(y.value, [-200, 0, covered], [0, 0, -covered * 0.25], Extrapolation.CLAMP) }] };
  });
  const barBackground = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [covered - 24, covered], [0, 1], Extrapolation.CLAMP) }));

  return (
    <View style={[styles.flex, { backgroundColor: t.colors.background.canvas }]} testID={testID}>
      <Stack.Screen options={{ headerShown: false }} />
      <Animated.View style={[styles.background, { height: backgroundHeight }, backgroundStyle]} pointerEvents="none">
        <HeroBackground image={image} />
      </Animated.View>
      <Animated.View style={[styles.hero, heroStyle]}>
        <View
          onLayout={(e) => {
            // Onglet encore masqué (web) : hauteur nulle, on garde la mesure précédente.
            const h = Math.round(e.nativeEvent.layout.height);
            if (h > 0) setHeroHeight(h);
          }}
          style={{ paddingTop: barHeight + t.spacing.xs, paddingHorizontal: t.spacing.lg, paddingBottom: SHEET_OVERLAP + t.spacing.xl }}
        >
          {hero}
        </View>
      </Animated.View>

      <Animated.ScrollView
        style={styles.flex}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        // L'en-tête gère lui-même la zone de statut : pas d'ajustement automatique iOS.
        contentInsetAdjustmentBehavior="never"
        scrollIndicatorInsets={{ top: barHeight }}
        contentContainerStyle={{ paddingTop: Math.max(0, heroHeight - SHEET_OVERLAP), flexGrow: 1 }}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.colors.brand.primary} progressViewOffset={barHeight} />
          ) : undefined
        }
        onMomentumScrollEnd={(e) => {
          const n = e.nativeEvent;
          if (onEndReached && n.contentOffset.y + n.layoutMeasurement.height >= n.contentSize.height - 400) onEndReached();
        }}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: t.colors.background.canvas,
              borderTopLeftRadius: SHEET_OVERLAP,
              borderTopRightRadius: SHEET_OVERLAP,
              padding: t.spacing.lg,
              paddingTop: t.spacing.xl,
              // iOS : le SafeAreaProvider de l'onglet donne la hauteur de la tab bar native dans insets.bottom.
              paddingBottom: (Platform.OS === 'ios' ? insets.bottom : 0) + t.spacing.xxxl,
              gap: t.spacing.xl,
              shadowColor: t.colors.shadow,
            },
          ]}
        >
          {children}
        </View>
      </Animated.ScrollView>

      <View style={[styles.bar, { paddingTop: insets.top, height: barHeight, paddingHorizontal: t.spacing.sm }]} pointerEvents="box-none">
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.background.canvas, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border.subtle }, barBackground]}
        />
        {topBar}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { position: 'absolute', top: 0, left: 0, right: 0 },
  // Mise à l'échelle depuis le bord haut : le haut reste collé à l'écran, le bas descend avec la feuille.
  background: { position: 'absolute', top: 0, left: 0, right: 0, transformOrigin: 'top' },
  sheet: { flexGrow: 1, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 6 },
  bar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

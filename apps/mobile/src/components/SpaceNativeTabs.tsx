import { buildColors, PinnedInterventionBar, useLiquidGlass, useTheme } from '@depano/ui';
import { DarkTheme, DefaultTheme, ThemeProvider, useSegments, type Theme as NavTheme } from 'expo-router';
import { NativeTabs, type MaterialIcon, type NativeTabsProps, type SFSymbolIcon } from 'expo-router/native-tabs';
import { useMemo } from 'react';
import { DynamicColorIOS, Platform } from 'react-native';
import { useBadges } from '@/lib/query/hooks';
import { isTabBarHiddenOn, tabAccessibilityLabel, tabBadgeText } from '@/lib/tabBar';
import { PinnedInterventionProvider, usePinnedIntervention, type PinnedIntervention } from './PinnedInterventionHost';

export interface NativeTabDef {
  name: string;
  label: string;
  /** SF Symbol (iOS) : contour par défaut, plein quand l'onglet est actif. */
  sf: SFSymbolIcon['sf'];
  /** Material Symbol (Android). */
  md: MaterialIcon['md'];
  testID: string;
  badge?: 'activity' | 'messages';
}


/**
 * Tab bar native (iOS : UITabBarController, Liquid Glass automatique sur iOS 26 ; Android : Material 3).
 * Web : voir `_layout.web.tsx` (tab bar JS `AppTabBar`, la navigation native n'existe pas sur web).
 */
export function SpaceNativeTabs({ as, tabs }: { as: 'client' | 'artisan'; tabs: NativeTabDef[] }) {
  const t = useTheme();
  const glass = useLiquidGlass();
  const badges = useBadges();
  const segments = useSegments() as string[];
  const tabBarHidden = isTabBarHiddenOn(segments);
  const pinned = usePinnedIntervention(as);
  // iOS 26 : l'intervention épinglée devient l'accessoire natif de la tab bar (au-dessus, en verre,
  // et intégré à la barre quand elle se réduit au défilement). Ailleurs : en bas de chaque pile.
  const useAccessory = Platform.OS === 'ios' && glass.available;
  const shownPinned = tabBarHidden ? null : pinned;

  // Fond de navigation = fond de l'app (évite le flash blanc au changement d'onglet sur iOS 26).
  const navTheme = useMemo<NavTheme>(() => {
    const base = t.scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: t.colors.brand.primary,
        background: t.colors.background.canvas,
        card: t.colors.background.canvas,
        text: t.colors.text.primary,
        border: t.colors.border.subtle,
        notification: t.colors.tone.urgent.solid,
      },
    };
  }, [t]);

  const platformProps = useMemo<Partial<NativeTabsProps>>(() => {
    if (Platform.OS === 'ios') {
      // Le verre passe du clair au sombre selon le contenu dessous : couleur dynamique, pas de valeur figée.
      const light = buildColors('light', t.accent).text.brand;
      const dark = buildColors('dark', t.accent).text.brand;
      return {
        tintColor: DynamicColorIOS({ light, dark }),
        badgeBackgroundColor: t.colors.tone.urgent.solid,
        minimizeBehavior: 'onScrollDown',
        // iOS ≤ 18 : barre opaque même en bout de liste (FlatList détecte mal le bord de défilement).
        disableTransparentOnScrollEdge: true,
      };
    }
    const font = t.fonts ? { fontFamily: t.fonts.medium } : null;
    return {
      backgroundColor: t.colors.background.surface,
      tintColor: t.colors.text.brand,
      iconColor: { default: t.colors.text.secondary, selected: t.colors.text.brand },
      labelStyle: { default: { ...font, color: t.colors.text.secondary }, selected: { ...font, color: t.colors.text.brand } },
      indicatorColor: t.colors.tone.brand.soft,
      rippleColor: t.colors.background.subtle,
      badgeBackgroundColor: t.colors.tone.urgent.solid,
      badgeTextColor: t.colors.tone.urgent.onSolid,
      labelVisibilityMode: 'labeled',
    };
  }, [t]);

  return (
    <ThemeProvider value={navTheme}>
      <PinnedInterventionProvider pinned={shownPinned} inStack={!useAccessory}>
        <NativeTabs {...platformProps} hidden={tabBarHidden}>
          {useAccessory && shownPinned ? (
            <NativeTabs.BottomAccessory>
              <PinnedAccessory pinned={shownPinned} />
            </NativeTabs.BottomAccessory>
          ) : null}
          {tabs.map((tab) => {
            const count = tab.badge ? (badges.data?.[tab.badge] ?? 0) : 0;
            return (
              <NativeTabs.Trigger
                key={tab.name}
                name={tab.name}
                testID={tab.testID}
                accessibilityLabel={tabAccessibilityLabel(tab.label, count)}
              >
                <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} />
                <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Badge hidden={!count}>{count ? tabBadgeText(count) : undefined}</NativeTabs.Trigger.Badge>
              </NativeTabs.Trigger>
            );
          })}
        </NativeTabs>
      </PinnedInterventionProvider>
    </ThemeProvider>
  );
}

/** Contenu de l'accessoire : rendu en double par le système (régulier + inline), sans état local. */
function PinnedAccessory({ pinned }: { pinned: PinnedIntervention }) {
  const placement = NativeTabs.BottomAccessory.usePlacement();
  return <PinnedInterventionBar {...pinned} surface="none" compact={placement === 'inline'} />;
}

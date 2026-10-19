import { Badge, MAX_FONT_SCALE, MIN_TOUCH, Text, useTheme, haptic } from '@depano/ui';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useSegments } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { isTabBarHiddenOn, tabAccessibilityLabel } from '@/lib/tabBar';
import { PinnedInterventionHost } from './PinnedInterventionHost';


/**
 * Tab bar DEPANO (web ; natif : tab bar système, voir SpaceNativeTabs) : 5 onglets max, libellés toujours visibles, badges chiffrés,
 * intervention en cours épinglée au-dessus (comme un mini-lecteur audio).
 */
export function AppTabBar({ state, descriptors, emitter, navigateToTab, insets, as }: BottomTabBarProps & { as: 'client' | 'artisan' }) {
  const t = useTheme();
  const segments = useSegments() as string[];
  if (isTabBarHiddenOn(segments)) return null;

  return (
    <View style={{ backgroundColor: t.colors.background.canvas }}>
      <PinnedInterventionHost as={as} />
      <View
        accessibilityRole="tablist"
        style={[
          styles.bar,
          {
            backgroundColor: t.colors.background.surface,
            paddingBottom: insets.bottom,
            borderTopColor: t.colors.border.subtle,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = index === state.index;
          const { options } = descriptors[route.key]!;
          const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : (options.title ?? route.name);
          const badge = typeof options.tabBarBadge === 'number' ? options.tabBarBadge : undefined;
          const color = focused ? t.colors.text.brand : t.colors.text.secondary;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              haptic('selection');
              navigateToTab(route.key);
            }
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tabAccessibilityLabel(label, badge ?? 0)}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              style={styles.item}
            >
              <View style={[styles.pill, { backgroundColor: focused ? t.colors.tone.brand.soft : 'transparent', borderRadius: t.radius.full }]}>
                {options.tabBarIcon?.({ focused, color, size: 24 })}
                {badge ? (
                  <View style={styles.badge}>
                    <Badge count={badge} tone="urgent" />
                  </View>
                ) : null}
              </View>
              <Text
                variant="caption"
                weight={focused ? 'semibold' : 'medium'}
                color={color}
                numberOfLines={1}
                maxFontSizeMultiplier={Math.min(1.5, MAX_FONT_SCALE)}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: MIN_TOUCH + 8, gap: 2 },
  pill: { paddingHorizontal: 16, paddingVertical: 4, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: 4 },
});

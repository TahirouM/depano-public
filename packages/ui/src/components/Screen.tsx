import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { StickyFooter } from './StickyFooter';

export interface ScreenProps {
  children: ReactNode;
  /** Contenu défilant (défaut true). false pour les listes virtualisées (FlatList gère son scroll). */
  scroll?: boolean;
  /** CTA collé en bas (zone du pouce). */
  footer?: ReactNode;
  /** true si l'écran est dans un onglet : la tab bar gère l'inset bas. */
  inTabs?: boolean;
  /** Bords protégés par la safe area. Par défaut : aucun en haut (l'en-tête natif s'en charge). */
  edges?: Edge[];
  padded?: boolean;
  background?: 'canvas' | 'surface' | 'brand';
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  /** Décalage clavier (hauteur d'en-tête) pour KeyboardAvoidingView. */
  keyboardOffset?: number;
  testID?: string;
}

/** Conteneur d'écran : safe area + évitement clavier + scroll + footer collant. */
export function Screen({
  children,
  scroll = true,
  footer,
  inTabs = false,
  edges,
  padded = true,
  background = 'canvas',
  refreshing,
  onRefresh,
  contentStyle,
  keyboardOffset = 0,
  testID,
}: ScreenProps) {
  const t = useTheme();
  const bg = t.colors.background[background];
  const resolvedEdges: Edge[] = edges ?? (inTabs || footer ? ['left', 'right'] : ['left', 'right', 'bottom']);
  const pad = padded ? { padding: t.spacing.lg } : null;
  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentContainerStyle={[styles.grow, pad, { paddingBottom: t.spacing.xxl }, contentStyle]}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.colors.brand.primary} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, pad, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView testID={testID} edges={resolvedEdges} style={[styles.flex, { backgroundColor: bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={keyboardOffset}>
        {body}
        {footer ? <StickyFooter aboveTabBar={inTabs}>{footer}</StickyFooter> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
});

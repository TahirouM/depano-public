import { useEffect, useState, type ReactNode } from 'react';
import { Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Sous-titre / question posée. */
  description?: string;
  children?: ReactNode;
  /** Actions collées en bas du sheet. */
  footer?: ReactNode;
  /** false : pas de fermeture par geste/voile (action obligatoire). */
  dismissible?: boolean;
  /** Le contenu défile si plus haut que 85 % de l'écran. */
  scrollable?: boolean;
  testID?: string;
}

const SCREEN_H = Dimensions.get('window').height;

/**
 * Bottom sheet pour les choix courts (motif, créneau, paiement, annulation) :
 * l'utilisateur garde le contexte. Geste vers le bas, voile ou bouton Fermer pour quitter.
 */
export function BottomSheet({ visible, onClose, title, description, children, footer, dismissible = true, scrollable = true, testID }: BottomSheetProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const y = useSharedValue(SCREEN_H);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      y.value = SCREEN_H;
      y.value = withTiming(0, { duration: 280, reduceMotion: ReduceMotion.System });
    } else if (mounted) {
      y.value = withTiming(SCREEN_H, { duration: 220, reduceMotion: ReduceMotion.System }, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(setMounted, false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const requestClose = () => {
    if (dismissible) onClose();
  };

  const pan = usePanGesture({
    enabled: dismissible,
    activeOffsetY: [-8, 8],
    onUpdate: (e) => {
      'worklet';
      y.value = Math.max(0, e.translationY);
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > 120 || e.velocityY > 900) {
        scheduleOnRN(onClose);
      } else {
        y.value = withSpring(0, { damping: 20, stiffness: 220, reduceMotion: ReduceMotion.System });
      }
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, y.value / 400) }));

  if (!mounted) return null;

  const Body = scrollable ? ScrollView : View;

  return (
    <Modal transparent visible animationType="none" onRequestClose={requestClose} statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView style={styles.flex}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.background.scrim }, scrimStyle]}>
          <Pressable
            style={styles.flex}
            onPress={requestClose}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            importantForAccessibility={dismissible ? 'yes' : 'no-hide-descendants'}
          />
        </Animated.View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.end} pointerEvents="box-none">
          <Animated.View
            testID={testID}
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                backgroundColor: t.colors.background.surface,
                borderTopLeftRadius: t.radius.lg,
                borderTopRightRadius: t.radius.lg,
                paddingBottom: insets.bottom + t.spacing.md,
                maxHeight: SCREEN_H * 0.9,
              },
              t.elevation(3),
              sheetStyle,
            ]}
          >
            <GestureDetector gesture={pan}>
              <View style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.sm }}>
                <View style={[styles.handle, { backgroundColor: t.colors.border.input }]} accessibilityElementsHidden />
                {title || dismissible ? (
                  <View style={styles.header}>
                    <View style={styles.flex}>
                      {title ? <Text variant="title2">{title}</Text> : null}
                    </View>
                    {dismissible ? <IconButton icon={X} accessibilityLabel="Fermer" onPress={onClose} /> : null}
                  </View>
                ) : null}
                {description ? (
                  <Text variant="body" tone="secondary" style={{ marginBottom: t.spacing.sm }}>
                    {description}
                  </Text>
                ) : null}
              </View>
            </GestureDetector>
            <Body
              style={scrollable ? styles.shrink : undefined}
              contentContainerStyle={scrollable ? { paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.md } : undefined}
              keyboardShouldPersistTaps="handled"
            >
              {scrollable ? children : <View style={{ paddingHorizontal: t.spacing.lg }}>{children}</View>}
            </Body>
            {footer ? <View style={{ paddingHorizontal: t.spacing.lg, gap: t.spacing.sm, paddingTop: t.spacing.sm }}>{footer}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  end: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: '100%' },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  shrink: { flexShrink: 1 },
});

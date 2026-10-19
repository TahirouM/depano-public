import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleAlert, CircleCheck, Info } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { haptic } from '../utils/haptics';
import { Icon } from './Icon';
import { Text } from './Text';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  action?: { label: string; onPress: () => void };
  /** ms (défaut 3500, 6000 avec action). */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastApi {
  show: (o: ToastOptions | string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  hide: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback(
    (o: ToastOptions | string) => {
      const opts: ToastOptions = typeof o === 'string' ? { message: o } : o;
      if (timer.current) clearTimeout(timer.current);
      const item = { ...opts, id: ++seq.current };
      setToast(item);
      AccessibilityInfo.announceForAccessibility(opts.message);
      if (opts.type === 'error') haptic('error');
      timer.current = setTimeout(() => setToast((cur) => (cur?.id === item.id ? null : cur)), opts.duration ?? (opts.action ? 6000 : 3500));
    },
    [],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      hide,
      success: (message) => show({ message, type: 'success' }),
      error: (message) => show({ message, type: 'error' }),
    }),
    [show, hide],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onClose={hide} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const type = toast.type ?? 'info';
  const icon = type === 'success' ? CircleCheck : type === 'error' ? CircleAlert : Info;
  const iconColor = type === 'success' ? t.colors.tone.success.solid : type === 'error' ? t.colors.tone.danger.solid : t.colors.tone.info.solid;
  return (
    <Animated.View
      entering={FadeInUp.duration(250).reduceMotion(ReduceMotion.System)}
      exiting={FadeOutUp.duration(200).reduceMotion(ReduceMotion.System)}
      style={[styles.host, { top: insets.top + t.spacing.sm, left: t.spacing.lg, right: t.spacing.lg }]}
      pointerEvents="box-none"
    >
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[
          styles.toast,
          { backgroundColor: t.colors.background.inverse, borderRadius: t.radius.md, padding: t.spacing.md, gap: t.spacing.md },
          t.elevation(3),
        ]}
      >
        <Icon icon={icon} color={iconColor} />
        <Pressable style={styles.flex} onPress={onClose} accessibilityRole="button" accessibilityLabel={`${toast.message}. Fermer`}>
          <Text tone="inverse" variant="callout">
            {toast.message}
          </Text>
        </Pressable>
        {toast.action ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => {
              toast.action?.onPress();
              onClose();
            }}
          >
            <Text variant="label" color={t.scheme === 'light' ? t.colors.brand.surface : t.colors.text.brand}>
              {toast.action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

/** `const toast = useToast(); toast.success('Message envoyé')`. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans <ToastProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  host: { position: 'absolute', zIndex: 1000 },
  toast: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  flex: { flex: 1 },
});

import { useState, type ReactNode, type Ref } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';
import { CircleAlert } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MAX_FONT_SCALE } from '../tokens/typography';
import { MIN_TOUCH } from '../tokens/scale';
import { Icon } from './Icon';
import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  helper?: string;
  /** Message d'erreur : affiché avec une icône (jamais la couleur seule). */
  error?: string | null;
  left?: ReactNode;
  right?: ReactNode;
  ref?: Ref<TextInputInstance>;
}

export function TextField({ label, helper, error, left, right, ref, multiline, onFocus, onBlur, editable = true, ...rest }: TextFieldProps) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? t.colors.tone.danger.text : focused ? t.colors.border.focus : t.colors.border.input;
  return (
    <View style={{ gap: t.spacing.xs }}>
      <Text variant="label">{label}</Text>
      <View
        style={[
          styles.box,
          {
            minHeight: multiline ? 96 : MIN_TOUCH + 4,
            borderRadius: t.radius.sm,
            borderColor,
            borderWidth: focused || error ? 2 : 1,
            backgroundColor: editable ? t.colors.background.surface : t.colors.background.subtle,
            paddingHorizontal: t.spacing.md,
            gap: t.spacing.sm,
          },
        ]}
      >
        {left}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? helper}
          aria-invalid={!!error}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          placeholderTextColor={t.colors.text.secondary}
          selectionColor={t.colors.brand.primary}
          editable={editable}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            t.text('body'),
            { color: t.colors.text.primary, paddingVertical: t.spacing.md, textAlignVertical: multiline ? 'top' : 'center' },
          ]}
          {...rest}
        />
        {right}
      </View>
      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Icon icon={CircleAlert} size={16} color={t.colors.tone.danger.text} />
          <Text variant="callout" tone="danger" style={styles.flex}>
            {error}
          </Text>
        </View>
      ) : helper ? (
        <Text variant="callout" tone="secondary">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center' },
  // Le cadre porte déjà le focus : pas de contour navigateur en plus sur le web.
  input: { flex: 1, minHeight: MIN_TOUCH, ...(Platform.OS === 'web' ? ({ outlineWidth: 0, outlineStyle: 'none' } as object) : null) },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
});

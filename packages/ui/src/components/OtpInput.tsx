import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { useShake } from '../utils/shake';
import { MAX_FONT_SCALE } from '../tokens/typography';
import { Text } from './Text';

export interface OtpInputProps {
  /** 6 pour l'OTP SMS, 4 pour le code de fin d'intervention. */
  length?: 4 | 6;
  value: string;
  onChange: (code: string) => void;
  /** Appelé dès que tous les chiffres sont saisis. */
  onComplete?: (code: string) => void;
  error?: boolean;
  autoFocus?: boolean;
  label?: string;
  /** Saisie SMS : active l'autoremplissage iOS/Android du code reçu. */
  smsAutofill?: boolean;
  disabled?: boolean;
  testID?: string;
}

/** Champ code à N chiffres : un seul TextInput (autofill one-time-code), cases visuelles. */
export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  error,
  autoFocus = true,
  label,
  smsAutofill = length === 6,
  disabled,
  testID,
}: OtpInputProps) {
  const t = useTheme();
  const ref = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  const lastCompleted = useRef<string | null>(null);

  useEffect(() => {
    if (value.length === length && value !== lastCompleted.current) {
      lastCompleted.current = value;
      onComplete?.(value);
    }
    if (value.length < length) lastCompleted.current = null;
  }, [value, length, onComplete]);

  // Secousse quand l'erreur apparaît (front montant uniquement ; l'haptique reste à l'appelant).
  const { style: shakeStyle, shake } = useShake();
  const prevError = useRef(!!error);
  useEffect(() => {
    if (error && !prevError.current) shake();
    prevError.current = !!error;
  }, [error, shake]);

  const a11yLabel = label ?? `Code à ${length} chiffres`;
  const boxSize = length === 6 ? 48 : 60;

  return (
    <Pressable
      onPress={() => ref.current?.focus()}
      accessible={false}
      style={styles.wrap}
      testID={testID}
    >
      <Animated.View
        style={[styles.row, { gap: length === 6 ? t.spacing.sm : t.spacing.md }, shakeStyle]}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {Array.from({ length }, (_, i) => {
          const char = value[i];
          const active = focused && (i === value.length || (i === length - 1 && value.length === length));
          return (
            <View
              key={i}
              style={[
                styles.box,
                {
                  width: boxSize,
                  minHeight: boxSize + 8,
                  borderRadius: t.radius.sm,
                  backgroundColor: t.colors.background.surface,
                  borderWidth: active || error ? 2 : 1,
                  borderColor: error ? t.colors.tone.danger.text : active ? t.colors.border.focus : t.colors.border.input,
                },
              ]}
            >
              <Text variant="title1" align="center">
                {char ?? ''}
              </Text>
            </View>
          );
        })}
      </Animated.View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, length))}
        maxLength={length}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType={smsAutofill ? 'oneTimeCode' : 'none'}
        autoComplete={smsAutofill ? (Platform.OS === 'android' ? 'sms-otp' : 'one-time-code') : 'off'}
        autoFocus={autoFocus}
        editable={!disabled}
        accessibilityLabel={a11yLabel}
        accessibilityHint={`${value.length} chiffre${value.length > 1 ? 's' : ''} saisi${value.length > 1 ? 's' : ''} sur ${length}`}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        caretHidden
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center' },
  box: { alignItems: 'center', justifyContent: 'center' },
  hiddenInput: { ...StyleSheet.absoluteFill, opacity: 0.011, color: 'transparent' },
});

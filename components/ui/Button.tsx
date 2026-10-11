import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../app/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';

export const BUTTON_COOLDOWN_MS = 800;

interface ButtonProps {
  title: string;
  onPress: () => void | Promise<unknown>;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  cooldownMs?: number;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  cooldownMs = BUTTON_COOLDOWN_MS,
  icon,
  style,
  textStyle,
}) => {
  const theme = useAppTheme();
  const c = theme.colors;

  const inFlightRef = useRef(false);
  const coolingDownRef = useRef(false);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [internalBusy, setInternalBusy] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handlePress = useCallback(() => {
    if (disabled || loading || inFlightRef.current || coolingDownRef.current) {
      return;
    }

    inFlightRef.current = true;
    let isAsync = false;

    try {
      const maybePromise = onPress();
      if (maybePromise && typeof (maybePromise as Promise<unknown>).then === 'function') {
        isAsync = true;
        if (mountedRef.current) {
          setInternalBusy(true);
        }
        (maybePromise as Promise<unknown>).then(
          () => {
            inFlightRef.current = false;
            if (mountedRef.current) {
              setInternalBusy(false);
            }
            if (cooldownMs > 0 && mountedRef.current) {
              coolingDownRef.current = true;
              timerRef.current = setTimeout(() => {
                coolingDownRef.current = false;
              }, cooldownMs);
            }
          },
          () => {
            inFlightRef.current = false;
            if (mountedRef.current) {
              setInternalBusy(false);
            }
          }
        );
      }
    } finally {
      if (!isAsync) {
        inFlightRef.current = false;
        if (cooldownMs > 0 && mountedRef.current) {
          coolingDownRef.current = true;
          timerRef.current = setTimeout(() => {
            coolingDownRef.current = false;
          }, cooldownMs);
        }
      }
    }
  }, [disabled, loading, onPress, cooldownMs]);

  type Scheme = { bg: string; fg: string; border: string; pressed: string };
  const schemes: Record<ButtonVariant, Scheme> = {
    primary: { bg: c.primary, fg: c.primaryText, border: 'transparent', pressed: c.primaryDark },
    danger: { bg: c.danger, fg: '#FFFFFF', border: 'transparent', pressed: c.dangerText },
    soft: { bg: c.primarySoft, fg: c.primary, border: 'transparent', pressed: c.surfaceAlt },
    secondary: { bg: c.surface, fg: c.text, border: c.borderStrong, pressed: c.surfaceAlt },
    ghost: { bg: 'transparent', fg: c.primary, border: 'transparent', pressed: c.primarySoft },
  };
  const scheme = schemes[variant];

  const isBusy = loading || internalBusy;
  const inactive = disabled || isBusy;
  const bg = disabled && variant === 'primary' ? c.borderStrong : scheme.bg;

  return (
    <Pressable
      onPress={handlePress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: isBusy }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed && !inactive ? scheme.pressed : bg,
          borderColor: scheme.border,
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          borderRadius: theme.radii.button,
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      {isBusy ? (
        <ActivityIndicator color={scheme.fg} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={18} color={scheme.fg} /> : null}
          <Text style={[styles.text, { color: scheme.fg }, textStyle]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontSize: 16, fontWeight: '700', letterSpacing: -0.1 },
});


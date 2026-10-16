import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../app/theme';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
}

export interface ToastContextValue {
  currentToast: (Required<ToastOptions> & { id: number }) | null;
  showToast: (messageOrOptions: string | ToastOptions, variant?: ToastVariant) => void;
  hideToast: () => void;
}

const DEFAULT_TOAST_DURATION_MS = 3200;

let globalToastListener: ((options: ToastOptions) => void) | null = null;
let toastSeq = 0;

/**
 * Imperative helper to display a toast from any screen after a database write confirms.
 * Shows one toast at a time and auto-dismisses.
 */
export function showToast(
  messageOrOptions: string | ToastOptions,
  variant: ToastVariant = 'success'
): void {
  const normalized: ToastOptions =
    typeof messageOrOptions === 'string'
      ? { message: messageOrOptions, variant }
      : {
          message: messageOrOptions.message,
          variant: messageOrOptions.variant || variant,
          durationMs: messageOrOptions.durationMs,
        };

  if (!normalized.message || !normalized.message.trim()) {
    return;
  }

  if (globalToastListener) {
    globalToastListener(normalized);
  }
}

const ToastContext = createContext<ToastContextValue>({
  currentToast: null,
  showToast: (msg, variant) => showToast(msg, variant),
  hideToast: () => {},
});

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useAppTheme();
  const [currentToast, setCurrentToast] = useState<(Required<ToastOptions> & { id: number }) | null>(
    null
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const hideToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setCurrentToast(null);
    });
  }, [fadeAnim]);

  const triggerToast = useCallback(
    (messageOrOptions: string | ToastOptions, variant: ToastVariant = 'success') => {
      const normalized: ToastOptions =
        typeof messageOrOptions === 'string'
          ? { message: messageOrOptions, variant }
          : {
              message: messageOrOptions.message,
              variant: messageOrOptions.variant || variant,
              durationMs: messageOrOptions.durationMs,
            };

      const message = (normalized.message || '').trim();
      if (!message) return;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      toastSeq += 1;
      const durationMs = normalized.durationMs ?? DEFAULT_TOAST_DURATION_MS;
      const nextToast = {
        id: toastSeq,
        message,
        variant: normalized.variant || 'success',
        durationMs,
      };

      setCurrentToast(nextToast);
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }).start();

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setCurrentToast((prev) => (prev?.id === nextToast.id ? null : prev));
      }, durationMs);
    },
    [fadeAnim]
  );

  useEffect(() => {
    globalToastListener = (opts) => triggerToast(opts, opts.variant || 'success');
    return () => {
      if (globalToastListener) {
        globalToastListener = null;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [triggerToast]);

  const getToastColors = (variant: ToastVariant) => {
    if (variant === 'error') {
      return {
        bg: theme.colors.danger,
        border: theme.colors.dangerText,
        text: '#FFFFFF',
        icon: 'alert-circle' as const,
      };
    }
    if (variant === 'info') {
      return {
        bg: theme.colors.primaryDark,
        border: theme.colors.primary,
        text: '#FFFFFF',
        icon: 'information-circle' as const,
      };
    }
    return {
      bg: theme.colors.success,
      border: theme.colors.successText,
      text: '#FFFFFF',
      icon: 'checkmark-circle' as const,
    };
  };

  return (
    <ToastContext.Provider value={{ currentToast, showToast: triggerToast, hideToast }}>
      {children}
      {currentToast ? (
        <View pointerEvents="box-none" style={styles.overlay}>
          <Animated.View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[
              styles.toastCard,
              {
                backgroundColor: getToastColors(currentToast.variant).bg,
                borderColor: getToastColors(currentToast.variant).border,
                opacity: fadeAnim,
              },
            ]}
          >
            <Pressable style={styles.toastRow} onPress={hideToast}>
              <Ionicons
                name={getToastColors(currentToast.variant).icon}
                size={20}
                color={getToastColors(currentToast.variant).text}
              />
              <Text
                style={[styles.toastText, { color: getToastColors(currentToast.variant).text }]}
                numberOfLines={3}
              >
                {currentToast.message}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 84,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastCard: {
    maxWidth: 480,
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    elevation: 6,
  },
  toastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});

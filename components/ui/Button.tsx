import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../app/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
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
  icon,
  style,
  textStyle,
}) => {
  const theme = useAppTheme();
  const c = theme.colors;

  type Scheme = { bg: string; fg: string; border: string; pressed: string };
  const schemes: Record<ButtonVariant, Scheme> = {
    primary: { bg: c.primary, fg: c.primaryText, border: 'transparent', pressed: c.primaryDark },
    danger: { bg: c.danger, fg: '#FFFFFF', border: 'transparent', pressed: c.dangerText },
    soft: { bg: c.primarySoft, fg: c.primary, border: 'transparent', pressed: c.surfaceAlt },
    secondary: { bg: c.surface, fg: c.text, border: c.borderStrong, pressed: c.surfaceAlt },
    ghost: { bg: 'transparent', fg: c.primary, border: 'transparent', pressed: c.primarySoft },
  };
  const scheme = schemes[variant];

  const inactive = disabled || loading;
  const bg = disabled && variant === 'primary' ? c.borderStrong : scheme.bg;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
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
      {loading ? (
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

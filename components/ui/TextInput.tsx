import React, { useState } from 'react';
import { View, Text, TextInput as RNTextInput, StyleSheet, Pressable, TextInputProps, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../app/theme';
import { strings } from '../../constants/strings';

interface Props extends TextInputProps {
  label: string;
  error?: string | null;
  helperText?: string;
  isPassword?: boolean;
}

export const TextInput: React.FC<Props> = ({
  label,
  error,
  helperText,
  isPassword = false,
  style,
  onFocus,
  onBlur,
  ...props
}) => {
  const theme = useAppTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  const borderColor = error ? theme.colors.danger : focused ? theme.colors.primary : theme.colors.border;

  // Auto-generate safe id and name from label if not explicitly provided (fixes DevTools form field issue)
  const safeId = (props as any).id || props.nativeID || `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const safeName = (props as any).name || label.toLowerCase().replace(/[^a-z0-9]+/g, '_');

  // Normalize autoComplete for web standards (fixes non-standard autocomplete attribute warning)
  let normalizedAutoComplete = props.autoComplete;
  if (Platform.OS === 'web' && normalizedAutoComplete === ('password' as any)) {
    normalizedAutoComplete = 'current-password';
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <View style={styles.inputContainer}>
        <RNTextInput
          nativeID={safeId}
          accessibilityLabel={label}
          autoComplete={normalizedAutoComplete}
          {...(Platform.OS === 'web' ? { id: safeId, name: safeName } : null)}
          style={[
            styles.input,
            {
              borderColor,
              borderWidth: focused || error ? 2 : 1,
              backgroundColor: focused ? theme.colors.surface : theme.colors.surfaceAlt,
              color: theme.colors.text,
              borderRadius: theme.radii.input,
            },
            isPassword && styles.passwordInput,
            style,
          ]}
          placeholderTextColor={theme.colors.muted}
          secureTextEntry={isPassword && !showPassword}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
        {isPassword && (
          <Pressable
            style={styles.toggleBtn}
            onPress={() => setShowPassword(!showPassword)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? strings.auth.passwordHide : strings.auth.passwordShow}
            hitSlop={8}
          >
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={theme.colors.muted} />
          </Pressable>
        )}
      </View>
      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={14} color={theme.colors.dangerText} style={{ marginTop: 1 }} />
          <Text style={[styles.error, { color: theme.colors.dangerText }]}>{error}</Text>
        </View>
      ) : helperText ? (
        <Text style={[styles.helper, { color: theme.colors.muted }]}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 13.5, fontWeight: '700', marginBottom: 7, letterSpacing: 0.1 },
  inputContainer: { position: 'relative' },
  input: {
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  passwordInput: { paddingRight: 52 },
  toggleBtn: {
    position: 'absolute',
    right: 6,
    top: 5,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 5,
  },
  error: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 16 },
  helper: { fontSize: 12, marginTop: 4 },
});

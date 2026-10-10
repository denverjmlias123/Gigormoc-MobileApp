import React, { useState } from 'react';
import { View, Text, TextInput as RNTextInput, StyleSheet, Pressable, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../app/theme';

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

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <View style={styles.inputContainer}>
        <RNTextInput
          style={[
            styles.input,
            {
              borderColor,
              borderWidth: focused || error ? 2 : 1,
              backgroundColor: theme.colors.surface,
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
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            hitSlop={8}
          >
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={theme.colors.muted} />
          </Pressable>
        )}
      </View>
      {error ? (
        <Text style={[styles.error, { color: theme.colors.dangerText }]}>{error}</Text>
      ) : helperText ? (
        <Text style={[styles.helper, { color: theme.colors.muted }]}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  inputContainer: { position: 'relative' },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  passwordInput: { paddingRight: 52 },
  toggleBtn: { position: 'absolute', right: 14, top: 13 },
  error: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  helper: { fontSize: 12, marginTop: 4 },
});

import React, { useState } from 'react';
import { View, Text, TextInput as RNTextInput, StyleSheet, TouchableOpacity, TextInputProps } from 'react-native';
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
  ...props
}) => {
  const theme = useAppTheme();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <View style={styles.inputContainer}>
        <RNTextInput
          style={[
            styles.input,
            {
              borderColor: error ? theme.colors.danger : theme.colors.border,
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
              borderRadius: theme.radii.input,
            },
            isPassword && styles.passwordInput,
            style,
          ]}
          placeholderTextColor={theme.colors.muted}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            style={styles.toggleBtn}
            onPress={() => setShowPassword(!showPassword)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 13 }}>
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text>
      ) : helperText ? (
        <Text style={[styles.helper, { color: theme.colors.muted }]}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  passwordInput: {
    paddingRight: 64,
  },
  toggleBtn: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  error: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  helper: {
    fontSize: 12,
    marginTop: 4,
  },
});

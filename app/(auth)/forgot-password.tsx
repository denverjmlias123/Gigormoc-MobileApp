import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../theme';
import { authService } from '../../services/auth';
import { toAppError } from '../../lib/errors';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (loading) return;
    setError(null);
    const normalizedEmail = authService.normalizeEmail(email);
    const check = authService.validateEmailInput(normalizedEmail);
    if (!check.valid) {
      setError(check.message || 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(normalizedEmail);
      setSent(true);
    } catch (err: any) {
      setError(toAppError(err, 'Could not send reset email. Please try again.').message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: theme.colors.text }]}>Reset Password</Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
          Enter the email associated with your account and we will send password reset instructions.
        </Text>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: theme.colors.dangerSoft, borderLeftColor: theme.colors.danger }]}>
            <Text style={[styles.errorText, { color: theme.colors.dangerText }]}>{error}</Text>
          </View>
        )}

        {sent ? (
          <View style={[styles.successBox, { backgroundColor: theme.colors.successSoft, borderLeftColor: theme.colors.success }]}>
            <Text style={[styles.successTitle, { color: theme.colors.successText }]}>Check your email</Text>
            <Text style={[styles.successText, { color: theme.colors.successText }]}>
              A password reset link has been dispatched to {email.trim()}.
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.primary, marginTop: 16 }]}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={styles.buttonText}>Return to Log In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Email Address</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={theme.colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.primary }, loading && { opacity: 0.7 }]}
              onPress={handleReset}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(auth)/login');
                }
              }}
              disabled={loading}
            >
              <Text style={{ color: theme.colors.muted, textAlign: 'center' }}>← Back to Log In</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  errorBox: {
    backgroundColor: '#FDE8EA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#D92D3E',
  },
  errorText: {
    color: '#D92D3E',
    fontSize: 14,
  },
  successBox: {
    backgroundColor: '#DDF5EA',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#12805C',
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#12805C',
    marginBottom: 4,
  },
  successText: {
    fontSize: 14,
    color: '#0B5C41',
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 24,
    padding: 8,
  },
});

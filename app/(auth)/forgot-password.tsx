import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../theme';
import { authService } from '../../services/auth';
import { toAppError } from '../../lib/errors';
import { strings } from '../../constants/strings';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';

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
    if (!normalizedEmail) {
      setError(strings.auth.loginEmailRequired);
      return;
    }

    const check = authService.validateEmailInput(normalizedEmail);
    if (!check.valid) {
      setError(check.message || strings.auth.invalidEmailFormat);
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(normalizedEmail);
      setSent(true);
    } catch (err: any) {
      setError(toAppError(err, strings.auth.passwordResetSendFailed).message);
    } finally {
      setLoading(false);
    }
  };

  const normalizedEmail = authService.normalizeEmail(email);
  const emailError = error && (!normalizedEmail || !authService.validateEmailInput(normalizedEmail).valid)
    ? error
    : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[theme.type.title, { color: theme.colors.text }]}>{strings.auth.forgotPasswordTitle}</Text>
        <Text style={[theme.type.body, styles.subtitle, { color: theme.colors.muted }]}>
          {strings.auth.passwordResetDescription}
        </Text>

        {error && !emailError ? (
          <View
            accessibilityRole="alert"
            style={[styles.message, { backgroundColor: theme.colors.dangerSoft, borderLeftColor: theme.colors.danger }]}
          >
            <Text style={[theme.type.body, { color: theme.colors.dangerText }]}>{error}</Text>
          </View>
        ) : null}

        {sent ? (
          <View
            accessibilityRole="summary"
            style={[styles.message, { backgroundColor: theme.colors.successSoft, borderLeftColor: theme.colors.success }]}
          >
            <Text style={[theme.type.body, styles.messageTitle, { color: theme.colors.successText }]}>
              {strings.auth.passwordResetSentTitle}
            </Text>
            <Text style={[theme.type.body, { color: theme.colors.successText }]}>{strings.auth.passwordResetSent}</Text>
            <Button
              title={strings.auth.passwordResetReturnToLogin}
              variant="secondary"
              onPress={() => router.replace('/(auth)/login')}
              style={styles.returnButton}
            />
          </View>
        ) : (
          <>
            <TextInput
              label={strings.auth.passwordResetEmailLabel}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (error) setError(null);
              }}
              placeholder={strings.auth.passwordResetEmailPlaceholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={emailError}
            />
            <Button
              title={strings.auth.passwordResetSend}
              onPress={handleReset}
              loading={loading}
              disabled={loading}
            />
            <Button
              title={strings.auth.passwordResetReturnToLogin}
              variant="ghost"
              onPress={() => router.replace('/(auth)/login')}
              disabled={loading}
              style={styles.returnButton}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, padding: 24, paddingTop: 48, justifyContent: 'center' },
  subtitle: { marginTop: 8, marginBottom: 24 },
  message: { borderLeftWidth: 4, borderRadius: 12, padding: 14, marginBottom: 16, gap: 6 },
  messageTitle: { fontWeight: '700' },
  returnButton: { marginTop: 12 },
});

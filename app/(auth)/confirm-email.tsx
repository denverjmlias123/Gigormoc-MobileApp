import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../theme';
import { authService } from '../../services/auth';
import { toAppError } from '../../lib/errors';
import { Button } from '../../components/ui/Button';

export default function ConfirmEmailScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ email?: string }>();
  const [resending, setResending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleResend = async () => {
    if (!params.email || resending) return;
    setStatusMessage(null);
    setErrorMessage(null);
    setResending(true);
    try {
      await authService.resendConfirmationEmail(params.email);
      setStatusMessage('A fresh confirmation email has been sent. Please check your inbox and spam folder.');
    } catch (err: any) {
      const appErr = toAppError(err);
      setErrorMessage(appErr.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Confirm Your Email</Text>
        <Text style={[styles.description, { color: theme.colors.muted }]}>
          We have sent a confirmation email to:
        </Text>
        <Text style={[styles.emailHighlight, { color: theme.colors.primary }]}>
          {params.email || 'your email address'}
        </Text>
        <Text style={[styles.instructions, { color: theme.colors.text }]}>
          Please check your inbox and click the confirmation link to activate your account.
        </Text>

        {statusMessage && (
          <View style={[styles.banner, { backgroundColor: theme.colors.successSoft, borderColor: theme.colors.success }]}>
            <Text style={[styles.bannerText, { color: theme.colors.successText }]}>{statusMessage}</Text>
          </View>
        )}

        {errorMessage && (
          <View style={[styles.banner, { backgroundColor: theme.colors.dangerSoft, borderColor: theme.colors.danger }]}>
            <Text style={[styles.bannerText, { color: theme.colors.dangerText }]}>{errorMessage}</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {params.email ? (
          <Button
            title={resending ? 'Sending...' : 'Resend Confirmation Email'}
            variant="secondary"
            onPress={handleResend}
            loading={resending}
            disabled={resending}
            style={{ marginBottom: 12 }}
          />
        ) : null}
        <Button
          title="Go to Log In"
          onPress={() => router.replace('/(auth)/login')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
  emailHighlight: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  banner: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    width: '100%',
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    marginBottom: 20,
  },
});

import React, { useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../theme';
import { authService } from '../../services/auth';
import { toAppError } from '../../lib/errors';
import { strings } from '../../constants/strings';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { OtpInput } from '../../components/ui/OtpInput';
import { showToast } from '../../components/ui/Toast';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

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
      setOtp('');
      setCooldown(60);
    } catch (err: any) {
      setError(toAppError(err, strings.auth.passwordResetSendFailed).message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resending || cooldown > 0) return;
    setError(null);
    const normalizedEmail = authService.normalizeEmail(email);
    setResending(true);
    try {
      await authService.resetPassword(normalizedEmail);
      setCooldown(60);
      showToast(strings.auth.passwordReauthCodeSent, 'success');
    } catch (err: any) {
      setError(toAppError(err, strings.auth.passwordResetSendFailed).message);
    } finally {
      setResending(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = (codeToVerify ?? otp).trim();
    if (verifying) return;
    setError(null);
    if (!code) {
      setError(strings.auth.otpCodeRequired);
      return;
    }
    if (code.length !== 6) {
      setError(strings.auth.otpCodeLength);
      return;
    }

    setVerifying(true);
    try {
      const normalizedEmail = authService.normalizeEmail(email);
      await authService.verifyPasswordResetOtp(normalizedEmail, code);
      showToast(strings.auth.otpConfirmedSuccess, 'success');
      router.replace('/(auth)/reset-password');
    } catch (err: any) {
      setError(strings.auth.otpInvalidOrExpired);
    } finally {
      setVerifying(false);
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

        {error && !emailError && !sent ? (
          <View
            accessibilityRole="alert"
            style={[styles.message, { backgroundColor: theme.colors.dangerSoft, borderLeftColor: theme.colors.danger }]}
          >
            <Text style={[theme.type.body, { color: theme.colors.dangerText }]}>{error}</Text>
          </View>
        ) : null}

        {sent ? (
          <View style={styles.otpSection}>
            <View
              accessibilityRole="summary"
              style={[styles.message, { backgroundColor: theme.colors.successSoft, borderLeftColor: theme.colors.success }]}
            >
              <Text style={[theme.type.body, styles.messageTitle, { color: theme.colors.successText }]}>
                {strings.auth.passwordResetSentTitle}
              </Text>
              <Text style={[theme.type.body, { color: theme.colors.successText }]}>{strings.auth.passwordResetSent}</Text>
              <Text style={[theme.type.small, { color: theme.colors.successText, marginTop: 4 }]}>
                {strings.auth.otpCodeSentNotice(normalizedEmail)}
              </Text>
            </View>

            <OtpInput
              value={otp}
              onChangeText={(val) => {
                setOtp(val);
                if (error) setError(null);
              }}
              error={error}
              disabled={verifying}
              onComplete={(completedCode) => handleVerifyOtp(completedCode)}
            />

            <View style={styles.actions}>
              <Button
                title={verifying ? strings.auth.otpVerifying : strings.auth.otpVerifyButton}
                onPress={() => handleVerifyOtp()}
                loading={verifying}
                disabled={verifying || otp.length < 6}
              />

              <Button
                title={cooldown > 0 ? strings.auth.otpResendIn(cooldown) : strings.auth.otpResendNow}
                variant="secondary"
                onPress={handleResendOtp}
                loading={resending}
                disabled={resending || cooldown > 0 || verifying}
              />

              <Button
                title={strings.auth.passwordResetReturnToLogin}
                variant="ghost"
                onPress={() => router.replace('/(auth)/login')}
                disabled={verifying}
              />
            </View>
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
  otpSection: { width: '100%' },
  actions: { gap: 10, marginTop: 14 },
  returnButton: { marginTop: 12 },
});

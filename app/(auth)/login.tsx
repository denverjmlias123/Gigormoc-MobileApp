import React, { useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth';
import { toAppError } from '../../lib/errors';
import { strings } from '../../constants/strings';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { useNetworkStatus } from '../../components/ui/OfflineBanner';

export default function LoginScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { authNotice, clearAuthNotice } = useAuth();
  const { isOffline } = useNetworkStatus();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFieldError, setEmailFieldError] = useState<string | null>(null);
  const [passwordFieldError, setPasswordFieldError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const handleLogin = async () => {
    if (loading || inFlightRef.current) return;
    clearAuthNotice();
    setError(null);
    setEmailFieldError(null);
    setPasswordFieldError(null);
    setResendMessage(null);
    setNeedsConfirmation(false);

    const normalizedEmail = authService.normalizeEmail(email);
    const emailCheck = authService.validateEmailInput(normalizedEmail);
    if (!normalizedEmail) {
      setEmailFieldError('Please enter your email address.');
      return;
    }
    if (!emailCheck.valid) {
      setEmailFieldError(emailCheck.message || strings.auth.invalidEmailFormat);
      return;
    }
    if (!password) {
      setPasswordFieldError('Please enter your password.');
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    try {
      const data = await authService.signIn({
        email: normalizedEmail,
        password,
      });

      const userId = data?.user?.id;
      if (userId) {
        const profile = await authService.getCurrentProfile(userId);
        if (profile && (profile.status === 'suspended' || profile.status === 'deactivated')) {
          await authService.signOut({ scope: 'local' });
          setError(strings.errors.accountSuspended);
          return;
        }
        // Single navigation replace directly to the right destination (never two redirects)
        if (!profile || !profile.onboarding_complete) {
          router.replace('/(onboarding)/step1-mode');
        } else {
          router.replace('/(tabs)');
        }
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      const appErr = toAppError(err, strings.errors.wrongCredentials);
      setError(appErr.message);
      if (appErr.action === 'resend_confirmation' || err?.code === 'EMAIL_NOT_CONFIRMED') {
        setNeedsConfirmation(true);
      }
      if (appErr.field === 'email') {
        setEmailFieldError(appErr.message);
      }
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (resending) return;
    setResendMessage(null);
    const normalizedEmail = authService.normalizeEmail(email);
    if (!normalizedEmail) {
      setEmailFieldError('Please enter your email address first.');
      return;
    }

    setResending(true);
    try {
      await authService.resendConfirmationEmail(normalizedEmail);
      setResendMessage(`Confirmation email sent to ${normalizedEmail}. Please check your inbox.`);
    } catch (err: any) {
      const appErr = toAppError(err);
      setError(appErr.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(auth)/welcome');
            }
          }}
          hitSlop={12}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>

        <Text style={[theme.type.display, { color: theme.colors.text }]}>Welcome back</Text>
        <Text style={[theme.type.body, styles.subtitle, { color: theme.colors.muted }]}>
          Log in to pick up where you left off.
        </Text>

        {authNotice && !error && (
          <Pressable
            onPress={clearAuthNotice}
            style={[styles.noticeBox, { backgroundColor: theme.colors.primarySoft, borderLeftColor: theme.colors.primary }]}
          >
            <Ionicons name="information-circle" size={18} color={theme.colors.primary} />
            <Text style={[styles.errorText, { color: theme.colors.text }]}>{authNotice}</Text>
          </Pressable>
        )}

        {error && (
          <View style={[styles.errorBox, { backgroundColor: theme.colors.dangerSoft, borderLeftColor: theme.colors.danger }]}>
            <View style={styles.errorHeaderRow}>
              <Ionicons name="alert-circle" size={18} color={theme.colors.dangerText} />
              <Text style={[styles.errorText, { color: theme.colors.dangerText }]}>{error}</Text>
            </View>
            {needsConfirmation && (
              <Button
                title={resending ? 'Sending...' : 'Resend confirmation email'}
                variant="secondary"
                onPress={handleResendConfirmation}
                loading={resending}
                disabled={resending || isOffline}
                style={{ marginTop: 10 }}
              />
            )}
          </View>
        )}

        {resendMessage && (
          <View style={[styles.noticeBox, { backgroundColor: theme.colors.successSoft, borderLeftColor: theme.colors.success }]}>
            <Ionicons name="checkmark-circle" size={18} color={theme.colors.successText} />
            <Text style={[styles.errorText, { color: theme.colors.successText }]}>{resendMessage}</Text>
          </View>
        )}

        <TextInput
          label="Email"
          value={email}
          onChangeText={(val) => {
            setEmail(val);
            if (emailFieldError) setEmailFieldError(null);
          }}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          error={emailFieldError}
        />

        <TextInput
          label="Password"
          value={password}
          onChangeText={(val) => {
            setPassword(val);
            if (passwordFieldError) setPasswordFieldError(null);
          }}
          placeholder="Your password"
          isPassword
          autoCapitalize="none"
          autoComplete="password"
          error={passwordFieldError}
        />

        <Pressable style={styles.forgotPassword} onPress={() => router.push('/(auth)/forgot-password')} hitSlop={8}>
          <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '700' }}>Forgot password?</Text>
        </Pressable>

        <Button
          title={isOffline ? 'Offline — Check Connection' : 'Log in'}
          onPress={handleLogin}
          loading={loading}
          disabled={loading || isOffline}
        />

        <Pressable style={styles.linkButton} onPress={() => router.push('/(auth)/signup-step1')}>
          <Text style={{ color: theme.colors.muted }}>
            New to Gigormoc? <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Create an account</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 56 },
  back: { marginBottom: 24, alignSelf: 'flex-start' },
  subtitle: { marginTop: 8, marginBottom: 28 },
  errorBox: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  errorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  errorText: { fontSize: 14, flex: 1, fontWeight: '600' },
  forgotPassword: { alignSelf: 'flex-end', marginBottom: 20 },
  linkButton: { alignItems: 'center', marginTop: 24, padding: 8 },
});

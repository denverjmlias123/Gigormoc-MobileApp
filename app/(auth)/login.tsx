import React, { useState, useRef, useEffect } from 'react';
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
import { showToast } from '../../components/ui/Toast';
import { SHOW_ACCOUNT_NOT_FOUND } from '../../constants/featureFlags';
import { formatLockoutCountdown, resolveLoginFailure } from '../../utils/loginFailure';

export default function LoginScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { authNotice, clearAuthNotice, signOut } = useAuth();
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
  const [accountNotFound, setAccountNotFound] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);
  const [lockoutAttemptsLeft, setLockoutAttemptsLeft] = useState<number | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (lockoutSeconds === null || lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((remaining) => remaining === null ? null : Math.max(0, remaining - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds !== null && lockoutSeconds > 0]);

  const handleLogin = async () => {
    if (loading || inFlightRef.current) return;
    clearAuthNotice();
    setError(null);
    setEmailFieldError(null);
    setPasswordFieldError(null);
    setResendMessage(null);
    setNeedsConfirmation(false);
    setAccountNotFound(false);
    setLockoutSeconds(null);
    setLockoutAttemptsLeft(null);

    const normalizedEmail = authService.normalizeEmail(email);
    const emailCheck = authService.validateEmailInput(normalizedEmail);
    if (!normalizedEmail) {
      setEmailFieldError(strings.auth.loginEmailRequired);
      return;
    }
    if (!emailCheck.valid) {
      setEmailFieldError(emailCheck.message || strings.auth.invalidEmailFormat);
      return;
    }
    if (!password) {
      setPasswordFieldError(strings.auth.loginPasswordRequired);
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    let authenticated = false;
    try {
      const data = await authService.signIn({
        email: normalizedEmail,
        password,
      });
      authenticated = true;

      const userId = data?.user?.id;
      let greetingName = strings.auth.loginNameFallback;
      if (userId) {
        const profile = await authService.getCurrentProfile(userId);
        if (profile && (profile.status === 'suspended' || profile.status === 'deactivated')) {
          await signOut({ scope: 'local' });
          setError(strings.errors.accountSuspended);
          return;
        }
        if (!profile) {
          throw new Error(strings.auth.loginProfileUnavailable);
        }
        greetingName = profile?.display_name || greetingName;
      }
      // RootNavigation owns post-auth routing, so this screen does not compete with its redirect.
      showToast(strings.auth.loginSuccess(greetingName), 'success');
    } catch (err: any) {
      // A profile read can fail after Auth has established a local session. Clear it so a
      // transient database failure cannot leave a signed-in user stranded on the login screen.
      if (authenticated) {
        await signOut({ scope: 'local' });
      }
      const loginFailure = resolveLoginFailure(err, SHOW_ACCOUNT_NOT_FOUND, {
        accountNotFound: strings.auth.loginAccountNotFound,
        wrongCredentials: strings.errors.wrongCredentials,
        locked: () => strings.auth.loginLocked,
      });
      if (loginFailure) {
        setAccountNotFound(loginFailure.kind === 'account_not_found');
        if (loginFailure.kind === 'locked') {
          setLockoutSeconds(loginFailure.secondsLeft ?? 0);
          setLockoutAttemptsLeft(loginFailure.attemptsLeft ?? null);
        }
        setError(loginFailure.message);
        return;
      }
      const attemptsLeft = Number(err?.attempts_left ?? err?.attemptsLeft);
      if (Number.isFinite(attemptsLeft) && attemptsLeft >= 0 && attemptsLeft <= 3) {
        setLockoutAttemptsLeft(Math.floor(attemptsLeft));
      }
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
      setEmailFieldError(strings.auth.loginResendEmailRequired);
      return;
    }

    setResending(true);
    try {
      await authService.resendConfirmationEmail(normalizedEmail);
      setResendMessage(strings.auth.confirmationEmailSent(normalizedEmail));
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
          accessibilityLabel={strings.auth.loginBackLabel}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>

        <Text style={[theme.type.display, { color: theme.colors.text }]}>{strings.auth.loginTitle}</Text>
        <Text style={[theme.type.body, styles.subtitle, { color: theme.colors.muted }]}>
          {strings.auth.loginReturnSubtitle}
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
              <Text style={[styles.errorText, { color: theme.colors.dangerText }]}>
                {lockoutSeconds !== null ? strings.auth.loginLocked : error}
                {lockoutSeconds !== null && lockoutSeconds > 0 ? ` ${formatLockoutCountdown(lockoutSeconds)}` : ''}
              </Text>
            </View>
            {lockoutSeconds === 0 && (
              <Text style={[styles.errorText, { color: theme.colors.dangerText }]}>{strings.auth.loginLockoutEnded}</Text>
            )}
            {lockoutAttemptsLeft !== null && lockoutSeconds !== null && lockoutSeconds > 0 && (
              <Text style={[styles.errorText, { color: theme.colors.dangerText }]}>
                {strings.auth.loginAttemptsLeft(lockoutAttemptsLeft)}
              </Text>
            )}
            {lockoutAttemptsLeft !== null && lockoutSeconds === null && (
              <Text style={[styles.errorText, { color: theme.colors.dangerText }]}>
                {strings.auth.loginAttemptsLeftCount(lockoutAttemptsLeft)}
              </Text>
            )}
            {needsConfirmation && (
              <Button
                title={resending ? strings.auth.loginResendSending : strings.auth.loginResendConfirmation}
                variant="secondary"
                onPress={handleResendConfirmation}
                loading={resending}
                disabled={resending || isOffline}
                style={{ marginTop: 10 }}
              />
            )}
            {accountNotFound && (
              <Button
                title={strings.auth.loginCreateAccount}
                variant="secondary"
                onPress={() => router.push({
                  pathname: '/(auth)/signup-step1',
                  params: { email: authService.normalizeEmail(email) },
                })}
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
          label={strings.auth.loginEmailLabel}
          value={email}
          onChangeText={(val) => {
            setEmail(val);
            if (lockoutSeconds !== null) {
              setLockoutSeconds(null);
              setLockoutAttemptsLeft(null);
              setError(null);
            }
            setAccountNotFound(false);
            if (accountNotFound) setError(null);
            if (emailFieldError) setEmailFieldError(null);
          }}
          placeholder={strings.auth.loginEmailPlaceholder}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          onEndEditing={() => {
            const normalizedEmail = authService.normalizeEmail(email);
            void authService.getLoginGuardState(normalizedEmail).then((guard) => {
              if (guard.locked) {
                setLockoutSeconds(Math.max(0, Number(guard.seconds_left) || 0));
                setLockoutAttemptsLeft(0);
                setError(strings.auth.loginLocked);
              } else if (typeof guard.attempts_left === 'number') {
                setLockoutSeconds(null);
                setLockoutAttemptsLeft(guard.attempts_left);
              }
            }).catch(() => undefined);
          }}
          error={emailFieldError}
        />

        <TextInput
          label={strings.auth.loginPasswordLabel}
          value={password}
          onChangeText={(val) => {
            setPassword(val);
            if (passwordFieldError) setPasswordFieldError(null);
          }}
          placeholder={strings.auth.loginPasswordPlaceholder}
          isPassword
          autoCapitalize="none"
          autoComplete="password"
          error={passwordFieldError}
        />

        <Pressable style={styles.forgotPassword} onPress={() => router.push('/(auth)/forgot-password')} hitSlop={8}>
          <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '700' }}>{strings.auth.forgotPassword}</Text>
        </Pressable>

        <Button
          title={lockoutSeconds !== null && lockoutSeconds > 0
            ? `${strings.auth.loginButton} (${formatLockoutCountdown(lockoutSeconds)})`
            : isOffline ? strings.auth.loginOffline : strings.auth.loginButton}
          onPress={handleLogin}
          loading={loading}
          disabled={loading || isOffline || (lockoutSeconds !== null && lockoutSeconds > 0)}
        />

        <Pressable style={styles.linkButton} onPress={() => router.push('/(auth)/signup-step1')}>
          <Text style={{ color: theme.colors.muted }}>
            {strings.auth.loginNewAccount} <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>{strings.auth.loginCreateAccount}</Text>
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

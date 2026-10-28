import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme, useResponsiveLayout } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth';
import { toAppError } from '../../lib/errors';
import { strings } from '../../constants/strings';
import { TextInput } from '../../components/ui/TextInput';
import { Button, IconButton } from '../../components/ui/Button';
import { Card, AlertBox } from '../../components/ui/Card';
import { useNetworkStatus } from '../../components/ui/OfflineBanner';
import { showToast } from '../../components/ui/Toast';
import { SHOW_ACCOUNT_NOT_FOUND } from '../../constants/featureFlags';
import { formatLockoutCountdown, resolveLoginFailure } from '../../utils/loginFailure';

export default function LoginScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { isWide, topSpace, bottomSpace } = useResponsiveLayout();
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

  const resetFormFeedback = () => {
    clearAuthNotice();
    setError(null);
    setEmailFieldError(null);
    setPasswordFieldError(null);
    setResendMessage(null);
    setNeedsConfirmation(false);
    setAccountNotFound(false);
    setLockoutSeconds(null);
    setLockoutAttemptsLeft(null);
  };

  const handleLogin = async () => {
    if (loading || inFlightRef.current) return;
    resetFormFeedback();

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
      showToast(strings.auth.loginSuccess(greetingName), 'success');
    } catch (err: any) {
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
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: isWide ? 48 : topSpace + 8, paddingBottom: isWide ? 48 : bottomSpace + 16 },
          isWide && styles.scrollContentWide,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Card
          tone={isWide ? 'neo-glass' : 'raised'}
          padding="lg"
          style={[styles.formCard, isWide && styles.formCardWide]}
        >
          <View style={styles.backRow}>
            <IconButton
              icon="arrow-back"
              variant="secondary"
              size="sm"
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(auth)/welcome');
                }
              }}
              accessibilityLabel={strings.auth.loginBackLabel}
            />
          </View>

          <Text style={[theme.type.display, { color: theme.colors.text }]}>{strings.auth.loginTitle}</Text>
          <Text style={[theme.type.body, styles.subtitle, { color: theme.colors.muted }]}>
            {strings.auth.loginReturnSubtitle}
          </Text>

          {authNotice && !error && (
            <AlertBox
              tone="info"
              message={authNotice}
              onDismiss={clearAuthNotice}
              style={{ marginBottom: 16 }}
            />
          )}

          {error && (
            <View style={[styles.errorBox, { backgroundColor: theme.colors.dangerSoft, borderColor: theme.colors.danger }]}>
              <View style={styles.errorHeaderRow}>
                <Ionicons name="alert-circle" size={18} color={theme.colors.dangerText} />
                <Text style={[styles.errorText, { color: theme.colors.dangerText }]}>
                  {lockoutSeconds !== null ? strings.auth.loginLocked : error}
                  {lockoutSeconds !== null && lockoutSeconds > 0 ? ` ${formatLockoutCountdown(lockoutSeconds)}` : ''}
                </Text>
              </View>
              {lockoutSeconds === 0 && (
                <Text style={[styles.errorSubText, { color: theme.colors.dangerText }]}>{strings.auth.loginLockoutEnded}</Text>
              )}
              {lockoutAttemptsLeft !== null && lockoutSeconds !== null && lockoutSeconds > 0 && (
                <Text style={[styles.errorSubText, { color: theme.colors.dangerText }]}>
                  {strings.auth.loginAttemptsLeft(lockoutAttemptsLeft)}
                </Text>
              )}
              {lockoutAttemptsLeft !== null && lockoutSeconds === null && (
                <Text style={[styles.errorSubText, { color: theme.colors.dangerText }]}>
                  {strings.auth.loginAttemptsLeftCount(lockoutAttemptsLeft)}
                </Text>
              )}
              {needsConfirmation && (
                <Button
                  title={resending ? strings.auth.loginResendSending : strings.auth.loginResendConfirmation}
                  variant="secondary"
                  size="sm"
                  icon="mail-outline"
                  onPress={handleResendConfirmation}
                  loading={resending}
                  disabled={resending || isOffline}
                  style={{ marginTop: 8 }}
                />
              )}
              {accountNotFound && (
                <Button
                  title={strings.auth.loginCreateAccount}
                  variant="secondary"
                  size="sm"
                  icon="person-add-outline"
                  onPress={() => router.push({
                    pathname: '/(auth)/signup-step1',
                    params: { email: authService.normalizeEmail(email) },
                  })}
                  style={{ marginTop: 8 }}
                />
              )}
            </View>
          )}

          {resendMessage && (
            <AlertBox
              tone="success"
              message={resendMessage}
              style={{ marginBottom: 16 }}
            />
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
            returnKeyType="next"
            leftIcon="mail-outline"
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
            autoComplete="current-password"
            returnKeyType="go"
            leftIcon="lock-closed-outline"
            onSubmitEditing={handleLogin}
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
            icon="log-in-outline"
            fullWidth
          />

          <Pressable style={styles.linkButton} onPress={() => router.push('/(auth)/signup-step1')}>
            <Text style={{ color: theme.colors.muted }}>
              {strings.auth.loginNewAccount} <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>{strings.auth.loginCreateAccount}</Text>
            </Text>
          </Pressable>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, justifyContent: 'center' },
  scrollContentWide: { justifyContent: 'center', alignItems: 'center' },
  formCard: { width: '100%', maxWidth: 440, alignSelf: 'center', borderRadius: 20 },
  formCardWide: { padding: 36 },
  backRow: { marginBottom: 20, alignSelf: 'flex-start' },
  subtitle: { marginTop: 6, marginBottom: 24, fontSize: 15, lineHeight: 22 },
  errorBox: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    gap: 6,
  },
  errorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: { fontSize: 13.5, flex: 1, fontWeight: '600', lineHeight: 19 },
  errorSubText: { fontSize: 12.5, fontWeight: '500', marginLeft: 26 },
  forgotPassword: { alignSelf: 'flex-end', marginTop: 4, marginBottom: 20, paddingVertical: 4 },
  linkButton: { alignItems: 'center', marginTop: 20, paddingVertical: 10 },
});

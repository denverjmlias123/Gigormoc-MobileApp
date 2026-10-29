import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme, useResponsiveLayout } from '../theme';
import { authService, RESEND_CONFIRMATION_COOLDOWN_SECONDS } from '../../services/auth';
import { supabase } from '../../lib/supabase';
import { toAppError } from '../../lib/errors';
import { Button } from '../../components/ui/Button';
import { Card, AlertBox } from '../../components/ui/Card';
import { OtpInput } from '../../components/ui/OtpInput';
import { showToast } from '../../components/ui/Toast';

export default function ConfirmEmailScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { isWide, topSpace, bottomSpace } = useResponsiveLayout();
  const params = useLocalSearchParams<{ email?: string }>();
  const [resending, setResending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // If the confirmation link was clicked in a browser or deep-linked in the same app instance,
    // Supabase will automatically receive the session and update the user state.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && (session.user.email_confirmed_at || event === 'SIGNED_IN')) {
        router.replace('/(onboarding)/step1-mode');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = (codeToVerify ?? otp).trim();
    if (verifying || !params.email) return;
    setErrorMessage(null);
    setStatusMessage(null);
    if (!code || code.length < 6) {
      setErrorMessage('Please enter the complete 6-digit code sent to your email.');
      return;
    }

    setVerifying(true);
    try {
      await authService.verifySignupOtp(params.email, code);
      showToast('Email confirmed successfully!', 'success');
      router.replace('/(onboarding)/step1-mode');
    } catch (err: any) {
      setErrorMessage(toAppError(err, 'Invalid or expired confirmation code.').message);
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!params.email || resending || cooldown > 0) return;
    setStatusMessage(null);
    setErrorMessage(null);
    setResending(true);
    try {
      await authService.resendConfirmationEmail(params.email);
      setCooldown(RESEND_CONFIRMATION_COOLDOWN_SECONDS);
      setStatusMessage('A fresh confirmation email has been sent. Please check your inbox and spam folder.');
    } catch (err: any) {
      const appErr = toAppError(err);
      if (err?.retryAfterSeconds) {
        setCooldown(err.retryAfterSeconds);
      }
      setErrorMessage(appErr.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: isWide ? 48 : topSpace + 12, paddingBottom: isWide ? 48 : bottomSpace + 16 },
      ]}
    >
      <Card
        tone="raised"
        padding="lg"
        style={[styles.card, isWide && styles.cardWide]}
      >
        <View style={styles.content}>
          <View style={[styles.iconCircle, { backgroundColor: theme.colors.primarySoft }]}>
            <Ionicons name="mail-unread-outline" size={32} color={theme.colors.primary} />
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>Confirm Your Email</Text>
          <Text style={[styles.description, { color: theme.colors.muted }]}>
            We have sent a confirmation email to:
          </Text>
          <Text style={[styles.emailHighlight, { color: theme.colors.primary }]}>
            {params.email || 'your email address'}
          </Text>
          <Text style={[styles.instructions, { color: theme.colors.text }]}>
            Please check your inbox and click the confirmation link, or enter the 6-digit confirmation code below:
          </Text>

          <View style={{ width: '100%', marginVertical: 14 }}>
            <OtpInput
              value={otp}
              onChangeText={(val) => {
                setOtp(val);
                if (errorMessage) setErrorMessage(null);
              }}
              onComplete={handleVerifyOtp}
              disabled={verifying}
              label="Enter 6-Digit Code"
            />
            <Button
              title={verifying ? 'Checking...' : 'Confirm Account with Code'}
              icon="checkmark-circle-outline"
              onPress={() => handleVerifyOtp()}
              loading={verifying}
              disabled={verifying || otp.length < 6}
              fullWidth
              style={{ marginTop: 12 }}
            />
          </View>

          {statusMessage && (
            <AlertBox
              tone="success"
              message={statusMessage}
              style={{ marginTop: 16, width: '100%' }}
            />
          )}

          {errorMessage && (
            <AlertBox
              tone="danger"
              message={errorMessage}
              style={{ marginTop: 16, width: '100%' }}
            />
          )}
        </View>

        <View style={styles.footer}>
          {params.email ? (
            <Button
              title={resending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Confirmation Email'}
              variant="secondary"
              icon="refresh-outline"
              onPress={handleResend}
              loading={resending}
              disabled={resending || cooldown > 0}
              fullWidth
              style={{ marginBottom: 12 }}
            />
          ) : null}
          <Button
            title="I've confirmed my email → Log In"
            icon="log-in-outline"
            onPress={() =>
              router.replace({
                pathname: '/(auth)/login',
                params: params.email ? { email: params.email } : undefined,
              })
            }
            fullWidth
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    gap: 24,
  },
  cardWide: {
    padding: 36,
    gap: 28,
  },
  content: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  footer: {
    width: '100%',
  },
});

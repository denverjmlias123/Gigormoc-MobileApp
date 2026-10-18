import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { authService } from '../../services/auth';
import { strings } from '../../constants/strings';
import { toAppError } from '../../lib/errors';
import { showToast } from '../../components/ui/Toast';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { PasswordPolicyChecklist } from '../../components/ui/PasswordPolicyChecklist';

function readUrlValue(url: URL, key: string): string | null {
  return url.searchParams.get(key) ?? new URLSearchParams(url.hash.replace(/^#/, '')).get(key);
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user, profile } = useAuth();
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const subscription = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && active) {
        setReady(true);
        setProcessing(false);
      }
    }).data.subscription;

    const processRecoveryUrl = async (rawUrl: string | null) => {
      if (!rawUrl) {
        if (active) setProcessing(false);
        return;
      }
      try {
        const url = new URL(rawUrl);
        const type = readUrlValue(url, 'type');
        const code = readUrlValue(url, 'code');
        const accessToken = readUrlValue(url, 'access_token');
        const refreshToken = readUrlValue(url, 'refresh_token');
        const tokenHash = readUrlValue(url, 'token_hash');
        let authError: { message?: string } | null = null;

        if (code) {
          const result = await supabase.auth.exchangeCodeForSession(code);
          authError = result.error;
        } else if (accessToken && refreshToken) {
          const result = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          authError = result.error;
        } else if (tokenHash && type === 'recovery') {
          const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
          authError = result.error;
        }

        if (authError) throw authError;
        if (code || (accessToken && refreshToken) || (tokenHash && type === 'recovery')) {
          if (active) setReady(true);
        }
      } catch (err: any) {
        if (active) setError(toAppError(err, strings.errors.generic).message);
      } finally {
        if (active) setProcessing(false);
      }
    };

    const urlListener = Linking.addEventListener('url', ({ url }) => {
      void processRecoveryUrl(url);
    });
    void Linking.getInitialURL().then(processRecoveryUrl);

    return () => {
      active = false;
      subscription.unsubscribe();
      urlListener.remove();
    };
  }, []);

  useEffect(() => {
    if (user) {
      setReady(true);
      setProcessing(false);
    }
  }, [user]);

  const handleExitToLogin = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {}
    router.replace('/(auth)/login');
  };

  const handleSave = async () => {
    if (saving || !ready) return;
    setError(null);
    if (!authService.validatePasswordConfirmation(password, confirmation)) {
      setError(strings.auth.passwordMismatch);
      return;
    }
    setSaving(true);
    try {
      await authService.updatePassword({
        password,
        email: user?.email ?? '',
        displayName: profile?.display_name ?? '',
      });
      showToast(strings.toasts.passwordUpdated, 'success');
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(toAppError(err, strings.auth.passwordInvalid).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[theme.type.title, { color: theme.colors.text }]}>{strings.auth.forgotPasswordTitle}</Text>
        <Text style={[theme.type.body, styles.subtitle, { color: theme.colors.muted }]}>
          {ready ? strings.auth.passwordResetReady : strings.auth.passwordResetLinkRequired}
        </Text>
        {error ? <Text accessibilityRole="alert" style={[theme.type.body, styles.error, { color: theme.colors.dangerText }]}>{error}</Text> : null}
        {processing ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : ready ? (
          <View style={styles.actions}>
            <TextInput label={strings.auth.newPassword} value={password} onChangeText={setPassword} isPassword autoCapitalize="none" autoComplete="new-password" />
            <PasswordPolicyChecklist password={password} email={user?.email ?? ''} displayName={profile?.display_name ?? ''} />
            <TextInput label={strings.auth.confirmNewPassword} value={confirmation} onChangeText={setConfirmation} isPassword autoCapitalize="none" autoComplete="new-password" />
            <Button title={strings.common.save} onPress={handleSave} loading={saving} disabled={saving} />
            <Button title={strings.common.cancel} variant="secondary" onPress={handleExitToLogin} disabled={saving} />
          </View>
        ) : (
          <View style={styles.actions}>
            <Button title={strings.auth.duplicateEmailResetBtn} onPress={() => router.replace('/(auth)/forgot-password')} />
            <Button title={strings.auth.duplicateEmailLoginBtn} variant="secondary" onPress={handleExitToLogin} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, padding: 24, paddingTop: 48, justifyContent: 'center' },
  subtitle: { marginTop: 8, marginBottom: 24 },
  error: { marginBottom: 16 },
  actions: { gap: 12 },
});

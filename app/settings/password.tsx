import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth';
import { toAppError } from '../../lib/errors';
import { strings } from '../../constants/strings';
import { showToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { OtpInput } from '../../components/ui/OtpInput';
import { PasswordPolicyChecklist } from '../../components/ui/PasswordPolicyChecklist';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user, profile, refreshProfile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [reauthCode, setReauthCode] = useState('');
  const [needsReauthentication, setNeedsReauthentication] = useState(false);
  const [requestingCode, setRequestingCode] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    setError(null);
    setNotice(null);
    if (!currentPassword) {
      setError(strings.auth.passwordCurrentRequired);
      return;
    }
    if (!authService.validatePasswordConfirmation(password, confirmation)) {
      setError(strings.auth.passwordMismatch);
      return;
    }
    if (needsReauthentication && !reauthCode.trim()) {
      setError(strings.auth.passwordReauthCodeRequired);
      return;
    }
    setSaving(true);
    try {
      await authService.updatePassword({
        password,
        currentPassword,
        nonce: needsReauthentication ? reauthCode.trim() : undefined,
        email: user?.email ?? '',
        displayName: profile?.display_name ?? '',
      });
      if (profile?.must_change_password) {
        const refreshed = await refreshProfile();
        showToast(strings.toasts.passwordUpdated, 'success');
        router.replace(refreshed?.onboarding_complete ? '/(tabs)' : '/(onboarding)/step1-mode');
        return;
      }
      showToast(strings.toasts.passwordUpdated, 'success');
      setReauthCode('');
      setNeedsReauthentication(false);
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/profile');
    } catch (err: any) {
      const code = String(err?.code || '').toLowerCase();
      const rawMessage = String(err?.message || '').toLowerCase();
      if (!needsReauthentication && (code === 'reauthentication_needed' || rawMessage.includes('reauthentication required'))) {
        setRequestingCode(true);
        try {
          await authService.requestPasswordReauthentication();
          setNeedsReauthentication(true);
          setNotice(strings.auth.passwordReauthCodeSent);
          setError(null);
        } catch (reauthErr: any) {
          setError(toAppError(reauthErr, strings.errors.generic).message);
        } finally {
          setRequestingCode(false);
        }
      } else if (needsReauthentication && (code === 'reauthentication_needed' || code === 'reauthentication_failed' || code === 'invalid_nonce' || rawMessage.includes('invalid nonce'))) {
        setError(strings.auth.passwordReauthCodeIncorrect);
      } else if (rawMessage.includes('current password')) {
        setError(strings.auth.passwordCurrentIncorrect);
      } else {
        setError(toAppError(err, strings.auth.passwordInvalid).message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {!profile?.must_change_password && (
        <View style={[styles.topBar, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: theme.colors.text }]}>{strings.auth.changePassword}</Text>
          <View style={{ width: 40 }} />
        </View>
      )}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[theme.type.title, { color: theme.colors.text }]}>{strings.auth.changePassword}</Text>
        <Text style={[theme.type.body, styles.subtitle, { color: theme.colors.muted }]}>{strings.auth.passwordCurrentRequired}</Text>
        {error ? <Text accessibilityRole="alert" style={[theme.type.body, styles.error, { color: theme.colors.dangerText }]}>{error}</Text> : null}
        {notice ? <Text accessibilityLiveRegion="polite" style={[theme.type.body, styles.notice, { color: theme.colors.successText }]}>{notice}</Text> : null}
        <TextInput label={strings.auth.currentPassword} value={currentPassword} onChangeText={setCurrentPassword} isPassword autoCapitalize="none" autoComplete="current-password" />
        <TextInput label={strings.auth.newPassword} value={password} onChangeText={setPassword} isPassword autoCapitalize="none" autoComplete="new-password" />
        <PasswordPolicyChecklist password={password} email={user?.email ?? ''} displayName={profile?.display_name ?? ''} />
        <TextInput label={strings.auth.confirmNewPassword} value={confirmation} onChangeText={setConfirmation} isPassword autoCapitalize="none" autoComplete="new-password" />
        {needsReauthentication ? (
          <>
            <OtpInput
              label={strings.auth.passwordReauthCodeLabel}
              value={reauthCode}
              onChangeText={setReauthCode}
              disabled={requestingCode || saving}
            />
            <Button title={strings.auth.passwordReauthSendAgain} variant="secondary" onPress={async () => {
              if (requestingCode) return;
              setRequestingCode(true);
              setError(null);
              setNotice(null);
              setReauthCode('');
              try {
                await authService.requestPasswordReauthentication();
                setNotice(strings.auth.passwordReauthCodeSent);
              } catch (err: any) {
                setError(toAppError(err, strings.errors.generic).message);
              } finally {
                setRequestingCode(false);
              }
            }} loading={requestingCode} disabled={requestingCode || saving} />
          </>
        ) : null}
        <Button title={strings.common.save} onPress={handleSave} loading={saving} disabled={saving || requestingCode} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  content: { flexGrow: 1, padding: 24, paddingTop: 24 },
  subtitle: { marginTop: 8, marginBottom: 24 },
  error: { marginBottom: 16 },
  notice: { marginBottom: 16 },
});

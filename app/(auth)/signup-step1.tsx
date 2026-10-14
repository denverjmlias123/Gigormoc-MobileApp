import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../theme';
import { authService } from '../../services/auth';
import { strings } from '../../constants/strings';
import { clearSignupDraft, setSignupDraft } from '../../lib/signupDraft';
import { PasswordPolicyChecklist } from '../../components/ui/PasswordPolicyChecklist';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';

export default function SignUpStep1Screen() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ duplicateEmail?: string; email?: string }>();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState(params.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDuplicateEmail, setIsDuplicateEmail] = useState(params.duplicateEmail === '1');

  useEffect(() => {
    if (params.duplicateEmail === '1') {
      setIsDuplicateEmail(true);
      setError(strings.auth.duplicateEmailMessage);
    }
  }, [params.duplicateEmail]);

  const handleNext = () => {
    if (pending) return;
    setError(null);
    setIsDuplicateEmail(false);

    if (!displayName.trim() || displayName.trim().length < 2) {
      setError(strings.auth.signupDisplayNameRequired);
      return;
    }

    const normalizedEmail = authService.normalizeEmail(email);
    const emailValidation = authService.validateEmailInput(normalizedEmail);
    if (!emailValidation.valid) {
      setError(emailValidation.message || strings.auth.invalidEmailFormat);
      return;
    }

    const passwordCheck = authService.validatePassword(password, normalizedEmail, displayName);
    if (!passwordCheck.valid) {
      setError(strings.auth.passwordInvalid);
      return;
    }
    if (!authService.validatePasswordConfirmation(password, confirmPassword)) {
      setError(strings.auth.passwordMismatch);
      return;
    }
    if (!termsAccepted) {
      setError(strings.auth.signupTermsRequired);
      return;
    }

    setPending(true);
    try {
      setSignupDraft({ displayName: displayName.trim(), email: normalizedEmail, password });
      router.push('/(auth)/signup-step2');
    } finally {
      setPending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[styles.stepIndicator, { color: theme.colors.muted }]}>{strings.auth.signupStep1Indicator}</Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>{strings.auth.step1Title}</Text>

        {error && (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: theme.colors.dangerSoft, borderLeftColor: theme.colors.danger },
            ]}
          >
            <Text style={[styles.errorText, { color: theme.colors.dangerText }]}>{error}</Text>
            {isDuplicateEmail && (
              <View style={styles.dupActionsRow}>
                <TouchableOpacity
                  style={[styles.dupActionBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={() =>
                    router.push({
                      pathname: '/(auth)/login',
                      params: { email: authService.normalizeEmail(email) },
                    })
                  }
                >
                  <Text style={styles.dupActionBtnText}>{strings.auth.duplicateEmailLoginBtn}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.dupActionBtnOutline,
                    { borderColor: theme.colors.primary, backgroundColor: theme.colors.surface },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: '/(auth)/forgot-password',
                      params: { email: authService.normalizeEmail(email) },
                    })
                  }
                >
                  <Text style={[styles.dupActionBtnOutlineText, { color: theme.colors.primary }]}>
                    {strings.auth.duplicateEmailResetBtn}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <View style={styles.inputGroup}>
          <TextInput
            label={strings.auth.signupDisplayNameLabel}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={strings.auth.signupDisplayNamePlaceholder}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            label={strings.auth.signupEmailLabel}
            value={email}
            onChangeText={(val) => {
              setEmail(val);
              if (isDuplicateEmail) {
                setIsDuplicateEmail(false);
                setError(null);
              }
            }}
            placeholder={strings.auth.signupEmailPlaceholder}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            label={strings.auth.signupPasswordLabel}
            value={password}
            onChangeText={setPassword}
            placeholder={strings.auth.passwordLengthRule}
            isPassword
            autoCapitalize="none"
            autoComplete="new-password"
          />
          <PasswordPolicyChecklist password={password} email={email} displayName={displayName} />
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            label={strings.auth.signupConfirmPasswordLabel}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={strings.auth.signupConfirmPasswordPlaceholder}
            isPassword
            autoCapitalize="none"
            autoComplete="new-password"
          />
        </View>

        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => setTermsAccepted(!termsAccepted)}
          activeOpacity={0.8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: termsAccepted }}
          accessibilityLabel={strings.auth.signupTermsLabel}
        >
          <View
            style={[
              styles.checkbox,
              { borderColor: theme.colors.border },
              termsAccepted && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
            ]}
          >
            {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[styles.checkboxLabel, { color: theme.colors.text }]}>
            {strings.auth.signupTermsLabel}
          </Text>
        </TouchableOpacity>

        <Button
          title={strings.auth.signupContinue}
          onPress={handleNext}
          loading={pending}
          disabled={pending}
          style={styles.continueButton}
        />

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => {
            clearSignupDraft();
            router.push('/(auth)/login');
          }}
        >
          <Text style={{ color: theme.colors.muted }}>
            {strings.auth.signupAlreadyAccount} <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>{strings.auth.duplicateEmailLoginBtn}</Text>
          </Text>
        </TouchableOpacity>
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
    paddingTop: 40,
  },
  stepIndicator: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 24,
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dupActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  dupActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dupActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  dupActionBtnOutline: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  dupActionBtnOutlineText: {
    fontSize: 13,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 16,
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
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 16,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  continueButton: { marginTop: 8 },
  linkButton: {
    alignItems: 'center',
    marginTop: 20,
    padding: 8,
  },
});

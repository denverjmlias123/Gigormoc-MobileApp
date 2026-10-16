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
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';
import { authService } from '../../services/auth';
import { strings } from '../../constants/strings';
import { clearSignupDraft, getSignupDraft, setSignupDraft } from '../../lib/signupDraft';
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

  // Field-level inline errors (where & why)
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);

  useEffect(() => {
    const draft = getSignupDraft();
    if (draft) {
      if (!displayName && draft.displayName) setDisplayName(draft.displayName);
      if (!email && draft.email) setEmail(draft.email);
      if (!password && draft.password) {
        setPassword(draft.password);
        setConfirmPassword(draft.password);
      }
    }
  }, []);

  useEffect(() => {
    if (params.duplicateEmail === '1') {
      setIsDuplicateEmail(true);
      setError(strings.auth.duplicateEmailMessage);
      setEmailError(strings.auth.duplicateEmailMessage);
    }
  }, [params.duplicateEmail]);

  const handleNext = () => {
    if (pending) return;
    setError(null);
    setIsDuplicateEmail(false);
    setDisplayNameError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);
    setTermsError(null);

    let hasFieldError = false;

    if (!displayName.trim() || displayName.trim().length < 2) {
      const msg = strings.auth.signupDisplayNameRequired;
      setDisplayNameError(msg);
      setError(msg);
      hasFieldError = true;
    } else if (displayName.trim().length > 50) {
      const msg = 'Display name cannot exceed 50 characters.';
      setDisplayNameError(msg);
      setError(msg);
      hasFieldError = true;
    }

    const normalizedEmail = authService.normalizeEmail(email);
    const emailValidation = authService.validateEmailInput(normalizedEmail);
    if (!emailValidation.valid) {
      const msg = emailValidation.message || strings.auth.invalidEmailFormat;
      setEmailError(msg);
      if (!hasFieldError) setError(msg);
      hasFieldError = true;
    }

    const passwordCheck = authService.validatePassword(password, normalizedEmail, displayName);
    if (!passwordCheck.valid) {
      const msg = strings.auth.passwordInvalid;
      setPasswordError(msg);
      if (!hasFieldError) setError(msg);
      hasFieldError = true;
    }

    if (!authService.validatePasswordConfirmation(password, confirmPassword)) {
      const msg = strings.auth.passwordMismatch;
      setConfirmPasswordError(msg);
      if (!hasFieldError) setError(msg);
      hasFieldError = true;
    }

    if (!termsAccepted) {
      const msg = strings.auth.signupTermsRequired;
      setTermsError(msg);
      if (!hasFieldError) setError(msg);
      hasFieldError = true;
    }

    if (hasFieldError) return;

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
            onChangeText={(val) => {
              setDisplayName(val);
              if (displayNameError) setDisplayNameError(null);
            }}
            placeholder={strings.auth.signupDisplayNamePlaceholder}
            autoCapitalize="words"
            maxLength={50}
            returnKeyType="next"
            error={displayNameError}
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
              if (emailError) setEmailError(null);
            }}
            placeholder={strings.auth.signupEmailPlaceholder}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
            error={emailError}
          />
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            label={strings.auth.signupPasswordLabel}
            value={password}
            onChangeText={(val) => {
              setPassword(val);
              if (passwordError) setPasswordError(null);
            }}
            placeholder="e.g. Min 8 chars, 1 uppercase, 1 symbol"
            isPassword
            autoCapitalize="none"
            autoComplete="new-password"
            returnKeyType="next"
            error={passwordError}
          />
          <PasswordPolicyChecklist password={password} email={email} displayName={displayName} />
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            label={strings.auth.signupConfirmPasswordLabel}
            value={confirmPassword}
            onChangeText={(val) => {
              setConfirmPassword(val);
              if (confirmPasswordError) setConfirmPasswordError(null);
            }}
            placeholder="e.g. Re-enter matching password"
            isPassword
            autoCapitalize="none"
            autoComplete="new-password"
            returnKeyType="done"
            error={confirmPasswordError}
          />
        </View>

        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => {
            setTermsAccepted(!termsAccepted);
            if (termsError) setTermsError(null);
          }}
          activeOpacity={0.8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: termsAccepted }}
          accessibilityLabel={strings.auth.signupTermsLabel}
        >
          <View
            style={[
              styles.checkbox,
              { borderColor: termsError ? theme.colors.danger : theme.colors.border },
              termsAccepted && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
            ]}
          >
            {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[styles.checkboxLabel, { color: termsError ? theme.colors.dangerText : theme.colors.text }]}>
            {strings.auth.signupTermsLabel}
          </Text>
        </TouchableOpacity>
        {termsError ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: -6, marginBottom: 12, gap: 4 }}>
            <Ionicons name="alert-circle" size={14} color={theme.colors.dangerText} />
            <Text style={{ color: theme.colors.dangerText, fontSize: 12, fontWeight: '600' }}>
              {termsError}
            </Text>
          </View>
        ) : null}

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

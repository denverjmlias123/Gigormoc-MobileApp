import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
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

export default function SignUpStep1Screen() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ duplicateEmail?: string; email?: string }>();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState(params.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      setError('Please enter your display name (at least 2 characters).');
      return;
    }

    const normalizedEmail = authService.normalizeEmail(email);
    const emailValidation = authService.validateEmailInput(normalizedEmail);
    if (!emailValidation.valid) {
      setError(emailValidation.message || strings.auth.invalidEmailFormat);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!termsAccepted) {
      setError('You must accept the Terms of Service and Privacy Notice.');
      return;
    }

    setPending(true);
    try {
      router.push({
        pathname: '/(auth)/signup-step2',
        params: {
          displayName: displayName.trim(),
          email: normalizedEmail,
          password,
        },
      });
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
        <Text style={[styles.stepIndicator, { color: theme.colors.muted }]}>Step 1 of 2</Text>
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
          <Text style={[styles.label, { color: theme.colors.text }]}>Display Name</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="e.g. Maria Santos"
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Email Address</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
            value={email}
            onChangeText={(val) => {
              setEmail(val);
              if (isDuplicateEmail) {
                setIsDuplicateEmail(false);
                setError(null);
              }
            }}
            placeholder="you@example.com"
            placeholderTextColor={theme.colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.passwordInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Minimum 6 characters"
              placeholderTextColor={theme.colors.muted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.showButton}
            >
              <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Confirm Password</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repeat password"
            placeholderTextColor={theme.colors.muted}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => setTermsAccepted(!termsAccepted)}
          activeOpacity={0.8}
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
            I accept the Terms of Service, Privacy Notice, and confirm I am an Ormoc resident aged 18 or older.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.colors.primary },
            pending && { opacity: 0.7 },
          ]}
          onPress={handleNext}
          disabled={pending}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Continue to Step 2</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={{ color: theme.colors.muted }}>
            Already have an account? <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Log In</Text>
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
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingLeft: 14,
    paddingRight: 60,
    paddingVertical: 12,
    fontSize: 16,
  },
  showButton: {
    position: 'absolute',
    right: 14,
    top: 14,
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
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 20,
    padding: 8,
  },
});

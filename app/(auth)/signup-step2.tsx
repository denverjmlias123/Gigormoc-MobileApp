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
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { authService } from '../../services/auth';
import { toAppError } from '../../lib/errors';
import { strings } from '../../constants/strings';
import { clearSignupDraft, getSignupDraft } from '../../lib/signupDraft';
import { DateOfBirthField } from '../../components/ui/DateOfBirthField';
import { Button } from '../../components/ui/Button';
import { isAtLeast18, parseIsoDate } from '../../utils/dateOfBirth';

export default function SignUpStep2Screen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [draft] = useState(() => getSignupDraft());

  const [dateOfBirth, setDateOfBirth] = useState('');
  const [dateOfBirthError, setDateOfBirthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDuplicateEmail, setIsDuplicateEmail] = useState(false);

  useEffect(() => {
    if (!draft?.email || !draft.password || !draft.displayName) {
      router.replace('/(auth)/signup-step1');
    }
  }, [draft, router]);

  const handleRegister = async () => {
    if (loading) return;
    setError(null);
    setIsDuplicateEmail(false);

    if (!draft?.email || !draft.password || !draft.displayName) {
      router.replace('/(auth)/signup-step1');
      return;
    }

    const birthDate = parseIsoDate(dateOfBirth);
    if (!birthDate) {
      setDateOfBirthError(strings.auth.dateOfBirthInvalid);
      setError(strings.auth.dateOfBirthInvalid);
      return;
    }
    if (!isAtLeast18(dateOfBirth)) {
      setDateOfBirthError(strings.auth.dateOfBirthUnder18);
      setError(strings.auth.dateOfBirthUnder18);
      return;
    }

    const normalizedEmail = authService.normalizeEmail(draft.email);

    setLoading(true);
    try {
      await authService.signUp({
        email: normalizedEmail,
        password: draft.password,
        displayName: draft.displayName,
        dob: dateOfBirth,
      });
      clearSignupDraft();

      router.replace({
        pathname: '/(auth)/confirm-email',
        params: { email: normalizedEmail },
      });
    } catch (err: any) {
      if (
        err?.code === 'EMAIL_ALREADY_REGISTERED' ||
        authService.isDuplicateEmailAuthResult(err)
      ) {
        setIsDuplicateEmail(true);
        setError(strings.auth.duplicateEmailMessage);
      } else {
        setError(toAppError(err, strings.errors.generic).message);
      }
    } finally {
      setLoading(false);
    }
  };

  const normalizedEmail = authService.normalizeEmail(draft?.email || '');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[styles.stepIndicator, { color: theme.colors.muted }]}>{strings.auth.signupStep2Indicator}</Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>{strings.auth.step2Title}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
          {strings.auth.step2Subtitle}
        </Text>

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
                <Button
                  title={strings.auth.duplicateEmailLoginBtn}
                  style={styles.dupActionButton}
                  onPress={() => {
                    clearSignupDraft();
                    router.replace({
                      pathname: '/(auth)/login',
                      params: { email: normalizedEmail },
                    })
                  }}
                />
                <Button
                  title={strings.auth.duplicateEmailResetBtn}
                  variant="secondary"
                  style={styles.dupActionButton}
                  onPress={() => {
                    clearSignupDraft();
                    router.replace({
                      pathname: '/(auth)/forgot-password',
                      params: { email: normalizedEmail },
                    })
                  }}
                />
              </View>
            )}
          </View>
        )}

        <DateOfBirthField
          label={strings.auth.dateOfBirthLabel}
          value={dateOfBirth}
          onChange={(value) => {
            setDateOfBirth(value);
            setDateOfBirthError(null);
            setError(null);
          }}
          error={dateOfBirthError}
        />

        <Button
          title={strings.auth.signupComplete}
          onPress={handleRegister}
          loading={loading}
          disabled={loading}
        />

        <Button
          title={`← ${strings.auth.signupBackToStep1}`}
          variant="ghost"
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(auth)/signup-step1')}
          disabled={loading}
          style={styles.backButton}
        />
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
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
  dupActionButton: { flex: 1 },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  backButton: {
    marginTop: 20,
    padding: 8,
  },
});

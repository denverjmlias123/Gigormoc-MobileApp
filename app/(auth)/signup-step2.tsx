import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme, useResponsiveLayout } from '../theme';
import { authService } from '../../services/auth';
import { toAppError } from '../../lib/errors';
import { strings } from '../../constants/strings';
import { clearSignupDraft, getSignupDraft } from '../../lib/signupDraft';
import { DateOfBirthField } from '../../components/ui/DateOfBirthField';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { isAtLeast18, parseIsoDate } from '../../utils/dateOfBirth';

export default function SignUpStep2Screen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { isWide, topSpace, bottomSpace } = useResponsiveLayout();
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
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: isWide ? 40 : topSpace + 8, paddingBottom: isWide ? 40 : bottomSpace + 16 },
          isWide && styles.scrollContentWide,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Card
          tone="raised"
          padding="lg"
          style={[styles.formCard, isWide && styles.formCardWide]}
        >
          <Text style={[styles.stepIndicator, { color: theme.colors.muted }]}>{strings.auth.signupStep2Indicator}</Text>
          <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
            <View style={[styles.progressFill, { width: '100%', backgroundColor: theme.colors.primary }]} />
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>{strings.auth.step2Title}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
            {strings.auth.step2Subtitle}
          </Text>

          {error && (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: theme.colors.dangerSoft, borderColor: theme.colors.danger, borderLeftColor: theme.colors.danger },
              ]}
            >
              <Text style={[styles.errorText, { color: theme.colors.dangerText }]}>{error}</Text>
              {isDuplicateEmail && (
                <View style={styles.dupActionsRow}>
                  <Button
                    title={strings.auth.duplicateEmailLoginBtn}
                    size="sm"
                    icon="log-in-outline"
                    style={styles.dupActionButton}
                    onPress={() => {
                      clearSignupDraft();
                      router.replace({
                        pathname: '/(auth)/login',
                        params: { email: normalizedEmail },
                      });
                    }}
                  />
                  <Button
                    title={strings.auth.duplicateEmailResetBtn}
                    variant="secondary"
                    size="sm"
                    icon="key-outline"
                    style={styles.dupActionButton}
                    onPress={() => {
                      clearSignupDraft();
                      router.replace({
                        pathname: '/(auth)/forgot-password',
                        params: { email: normalizedEmail },
                      });
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
            icon="checkmark-circle-outline"
            fullWidth
          />

          <Button
            title={`← ${strings.auth.signupBackToStep1}`}
            variant="ghost"
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(auth)/signup-step1')}
            disabled={loading}
            fullWidth
            style={styles.backButton}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  scrollContentWide: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  formCard: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  formCardWide: {
    padding: 36,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  stepIndicator: {
    fontSize: 14,
    fontWeight: '600',
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
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dupActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  dupActionButton: { flex: 1 },
  backButton: {
    marginTop: 14,
  },
});

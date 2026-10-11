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
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../theme';
import { authService } from '../../services/auth';
import { toAppError } from '../../lib/errors';
import { strings } from '../../constants/strings';

export default function SignUpStep2Screen() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ displayName: string; email: string; password: string }>();

  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDuplicateEmail, setIsDuplicateEmail] = useState(false);

  useEffect(() => {
    if (!params.email || !params.password || !params.displayName) {
      router.replace('/(auth)/signup-step1');
    }
  }, [params.email, params.password, params.displayName]);

  const calculateAge = (birthDate: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleRegister = async () => {
    if (loading) return;
    setError(null);
    setIsDuplicateEmail(false);

    if (!params.email || !params.password || !params.displayName) {
      router.replace('/(auth)/signup-step1');
      return;
    }

    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);

    if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12 || d < 1 || d > 31 || y < 1900) {
      setError('Please enter a valid date of birth (YYYY-MM-DD).');
      return;
    }

    const birthDate = new Date(y, m - 1, d);
    if (birthDate.getFullYear() !== y || birthDate.getMonth() !== m - 1 || birthDate.getDate() !== d) {
      setError('Invalid calendar date.');
      return;
    }

    const age = calculateAge(birthDate);
    if (age < 18) {
      setError('You must be at least 18 years old to register for Gigormoc.');
      return;
    }

    const formattedDob = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const normalizedEmail = authService.normalizeEmail(params.email || '');

    setLoading(true);
    try {
      await authService.signUp({
        email: normalizedEmail,
        password: params.password,
        displayName: params.displayName,
        dob: formattedDob,
      });

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
        setError(toAppError(err, 'Registration failed. Please check your details and try again.').message);
      }
    } finally {
      setLoading(false);
    }
  };

  const normalizedEmail = authService.normalizeEmail(params.email || '');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[styles.stepIndicator, { color: theme.colors.muted }]}>Step 2 of 2</Text>
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
                <TouchableOpacity
                  style={[styles.dupActionBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={() =>
                    router.replace({
                      pathname: '/(auth)/login',
                      params: { email: normalizedEmail },
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
                    router.replace({
                      pathname: '/(auth)/forgot-password',
                      params: { email: normalizedEmail },
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

        <Text style={[styles.label, { color: theme.colors.text }]}>Date of Birth</Text>
        <View style={styles.dateRow}>
          <View style={styles.dateCol}>
            <Text style={[styles.subLabel, { color: theme.colors.muted }]}>Month (MM)</Text>
            <TextInput
              style={[styles.dateInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
              value={month}
              onChangeText={setMonth}
              placeholder="01"
              placeholderTextColor={theme.colors.muted}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>

          <View style={styles.dateCol}>
            <Text style={[styles.subLabel, { color: theme.colors.muted }]}>Day (DD)</Text>
            <TextInput
              style={[styles.dateInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
              value={day}
              onChangeText={setDay}
              placeholder="15"
              placeholderTextColor={theme.colors.muted}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>

          <View style={[styles.dateCol, { flex: 1.5 }]}>
            <Text style={[styles.subLabel, { color: theme.colors.muted }]}>Year (YYYY)</Text>
            <TextInput
              style={[styles.dateInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
              value={year}
              onChangeText={setYear}
              placeholder="2000"
              placeholderTextColor={theme.colors.muted}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }, loading && { opacity: 0.7 }]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Complete Registration</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(auth)/signup-step1');
            }
          }}
          disabled={loading}
        >
          <Text style={{ color: theme.colors.muted, textAlign: 'center' }}>← Back to Step 1</Text>
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
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  dateCol: {
    flex: 1,
  },
  subLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  dateInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 16,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 20,
    padding: 8,
  },
});

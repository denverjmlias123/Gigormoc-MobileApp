import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../theme';
import { authService } from '../../services/auth';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';

export default function LoginScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (loading) return;
    setError(null);
    const normalizedEmail = authService.normalizeEmail(email);
    if (!normalizedEmail || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      await authService.signIn({
        email: normalizedEmail,
        password,
      });

      // Session listener in useAuth will redirect or update app state
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(auth)/welcome');
            }
          }}
          hitSlop={12}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>

        <Text style={[theme.type.display, { color: theme.colors.text }]}>Welcome back</Text>
        <Text style={[theme.type.body, styles.subtitle, { color: theme.colors.muted }]}>
          Log in to pick up where you left off.
        </Text>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: theme.colors.dangerSoft, borderLeftColor: theme.colors.danger }]}>
            <Ionicons name="alert-circle" size={18} color={theme.colors.dangerText} />
            <Text style={[styles.errorText, { color: theme.colors.dangerText }]}>{error}</Text>
          </View>
        )}

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          isPassword
          autoCapitalize="none"
          autoComplete="password"
        />

        <Pressable style={styles.forgotPassword} onPress={() => router.push('/(auth)/forgot-password')} hitSlop={8}>
          <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '700' }}>Forgot password?</Text>
        </Pressable>

        <Button title="Log in" onPress={handleLogin} loading={loading} />

        <Pressable style={styles.linkButton} onPress={() => router.push('/(auth)/signup-step1')}>
          <Text style={{ color: theme.colors.muted }}>
            New to Gigormoc? <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Create an account</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 56 },
  back: { marginBottom: 24, alignSelf: 'flex-start' },
  subtitle: { marginTop: 8, marginBottom: 28 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  errorText: { fontSize: 14, flex: 1, fontWeight: '600' },
  forgotPassword: { alignSelf: 'flex-end', marginBottom: 20 },
  linkButton: { alignItems: 'center', marginTop: 24, padding: 8 },
});

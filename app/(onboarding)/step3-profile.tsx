import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth';

export default function OnboardingStep3ProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user, refreshProfile, signOut } = useAuth();

  const [bio, setBio] = useState('');
  const [area, setArea] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async (skip: boolean = false) => {
    setError(null);
    if (!user) {
      router.replace('/(tabs)');
      return;
    }

    setLoading(true);
    try {
      await authService.updateProfile(user.id, {
        bio: skip ? '' : bio.trim(),
        area: skip ? '' : area.trim(),
        onboarding_complete: true,
      });
      await refreshProfile();
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message || 'Failed to complete profile setup. Please try again.');
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Text style={[styles.stepIndicator, { color: theme.colors.muted }]}>Onboarding 3 of 3</Text>
          <TouchableOpacity onPress={() => signOut().then(() => router.replace('/(auth)/login'))}>
            <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '600' }}>Log Out</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.title, { color: theme.colors.text }]}>Introduce Yourself</Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
          Tell clients and collaborators in Ormoc a little bit about what you do.
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Barangay / Area in Ormoc</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
            value={area}
            onChangeText={setArea}
            placeholder="e.g. Cogon, Ormoc City"
            placeholderTextColor={theme.colors.muted}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Short Bio</Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              { borderColor: theme.colors.border, color: theme.colors.text },
            ]}
            value={bio}
            onChangeText={setBio}
            placeholder="Describe your background, services, or what you're looking for..."
            placeholderTextColor={theme.colors.muted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }, loading && { opacity: 0.7 }]}
          onPress={() => handleComplete(false)}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Finish Setup</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => handleComplete(true)}
          disabled={loading}
        >
          <Text style={{ color: theme.colors.muted, textAlign: 'center' }}>Skip for now</Text>
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
    paddingTop: 48,
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
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  errorBox: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#d32f2f',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 20,
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
  textArea: {
    minHeight: 110,
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
  skipButton: {
    marginTop: 16,
    padding: 8,
  },
});

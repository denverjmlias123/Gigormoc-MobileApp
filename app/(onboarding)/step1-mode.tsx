import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth';
import { strings } from '../../constants/strings';

type ModeChoice = 'find_work' | 'hire';

export default function OnboardingStep1ModeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user, refreshProfile, signOut } = useAuth();

  const [selectedMode, setSelectedMode] = useState<ModeChoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch {
      router.replace('/(auth)/welcome');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!selectedMode) {
      setError('Please select either Find Work or Hire Someone to continue.');
      return;
    }

    if (!user) {
      router.push('/(onboarding)/step2-skills');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await authService.chooseInitialMode(selectedMode);
      await refreshProfile();
      router.push('/(onboarding)/step2-skills');
    } catch (err: any) {
      // If mode is already set, proceed forward
      if (err?.message?.includes('already been chosen')) {
        await refreshProfile();
        router.push('/(onboarding)/step2-skills');
      } else {
        setError(err?.message || 'Could not save initial mode.');
      }
    } finally {
      setLoading(false);
    }
  };

  const options: { id: ModeChoice; title: string; desc: string; icon: string }[] = [
    {
      id: 'find_work',
      title: strings.modes.findWork,
      desc: strings.modes.findWorkDesc,
      icon: '🛠️',
    },
    {
      id: 'hire',
      title: strings.modes.hire,
      desc: strings.modes.hireDesc,
      icon: '💼',
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={[styles.stepIndicator, { color: theme.colors.muted }]}>Onboarding 1 of 3 (Required)</Text>
          <TouchableOpacity onPress={handleSignOut} disabled={loading} style={styles.headerLogoutBtn}>
            <Text style={[styles.headerLogoutText, { color: theme.colors.primary }]}>Log Out</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.title, { color: theme.colors.text }]}>Choose your account mode</Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
          Select your primary focus to personalize your home dashboard.
        </Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={handleSignOut} style={styles.errorActionBtn}>
            <Text style={styles.errorActionText}>Log Out & Return to Login</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.optionsList}>
        {options.map((opt) => {
          const isSelected = selectedMode === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                  borderWidth: isSelected ? 2 : 1,
                  borderRadius: theme.radii.card,
                },
                isSelected && { backgroundColor: theme.colors.primarySoft },
              ]}
              onPress={() => {
                setSelectedMode(opt.id);
                setError(null);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.cardIcon}>{opt.icon}</Text>
              <Text style={[styles.cardTitle, { color: theme.colors.text }, isSelected && { color: theme.colors.primary }]}>
                {opt.title}
              </Text>
              <Text style={[styles.cardDesc, { color: theme.colors.muted }]}>{opt.desc}</Text>
            </TouchableOpacity>
          );
        })}

        <Text style={[styles.switchNotice, { color: theme.colors.muted }]}>
          ℹ️ {strings.modes.switchNote}
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor: selectedMode ? theme.colors.primary : theme.colors.muted,
              borderRadius: theme.radii.button,
            },
            loading && { opacity: 0.7 },
          ]}
          onPress={handleContinue}
          disabled={loading || !selectedMode}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchAccountBtn}
          onPress={handleSignOut}
          disabled={loading}
        >
          <Text style={{ color: theme.colors.muted, fontSize: 14 }}>
            Want to use a different account?{' '}
            <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Log out</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
    paddingTop: 48,
  },
  header: {
    marginBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepIndicator: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerLogoutBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  headerLogoutText: {
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    marginBottom: 8,
  },
  errorActionBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  errorActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  optionsList: {
    gap: 16,
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    padding: 20,
  },
  cardIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  switchNotice: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  footer: {
    marginTop: 20,
    marginBottom: 10,
    gap: 12,
  },
  button: {
    minHeight: 48,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchAccountBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppTheme, lightFreelancerTheme, clientTheme } from '../theme';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth';
import { strings } from '../../constants/strings';
import { confirmDialog } from '../../lib/dialog';
import { runConfirmedLogout } from '../../utils/confirmedLogout';

type ModeChoice = 'find_work' | 'hire';

export default function OnboardingStep1ModeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user, refreshProfile, signOut } = useAuth();

  const [selectedMode, setSelectedMode] = useState<ModeChoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    if (loading) return;
    try {
      const confirmed = await runConfirmedLogout({
      requestConfirmation: () => confirmDialog({
          title: strings.auth.logoutConfirmTitle,
          message: strings.auth.logoutConfirmMessage,
          confirmText: strings.auth.logoutConfirmYes,
          cancelText: strings.common.cancel,
          destructive: true,
        }),
        signOut,
        onConfirmed: () => setLoading(true),
      });
      if (!confirmed) return;
      router.replace('/(auth)/login');
    } catch {
      router.replace('/(auth)/login');
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

  const options: {
    id: ModeChoice;
    title: string;
    desc: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    colors: { bg: string; fg: string; sub: string };
  }[] = [
    {
      id: 'find_work',
      title: strings.modes.findWork,
      desc: strings.modes.findWorkDesc,
      icon: 'search',
      colors: { bg: lightFreelancerTheme.colors.heroBg, fg: '#FFFFFF', sub: lightFreelancerTheme.colors.heroMuted },
    },
    {
      id: 'hire',
      title: strings.modes.hire,
      desc: strings.modes.hireDesc,
      icon: 'people',
      colors: { bg: clientTheme.colors.heroBg, fg: '#FFFFFF', sub: clientTheme.colors.heroMuted },
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={[theme.type.small, { color: theme.colors.muted }]}>Step 1 of 3</Text>
          <Pressable onPress={handleSignOut} disabled={loading} hitSlop={8} accessibilityRole="button">
            <Text style={[theme.type.small, { color: theme.colors.primary, fontWeight: '700' }]}>Log out</Text>
          </Pressable>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
          <View style={[styles.progressFill, { backgroundColor: theme.colors.primary }]} />
        </View>
        <Text style={[theme.type.display, { color: theme.colors.text }]}>How will you use Gigormoc?</Text>
        <Text style={[theme.type.body, { color: theme.colors.muted, marginTop: 8 }]}>
          Pick the side you'll use most. Your home screen is built around it.
        </Text>
      </View>

      {error && (
        <View style={[styles.errorBox, { backgroundColor: theme.colors.dangerSoft, borderLeftColor: theme.colors.danger }]}>
          <Text style={[styles.errorText, { color: theme.colors.dangerText }]}>{error}</Text>
        </View>
      )}

      <View style={styles.optionsList}>
        {options.map((opt) => {
          const isSelected = selectedMode === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => {
                setSelectedMode(opt.id);
                setError(null);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              style={[
                styles.card,
                {
                  backgroundColor: opt.colors.bg,
                  borderRadius: theme.radii.card,
                  borderColor: isSelected ? theme.colors.accent : 'transparent',
                  opacity: selectedMode && !isSelected ? 0.55 : 1,
                },
              ]}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardIcon}>
                  <Ionicons name={opt.icon} size={22} color={opt.colors.fg} />
                </View>
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={26}
                  color={opt.colors.fg}
                />
              </View>
              <Text style={[styles.cardTitle, { color: opt.colors.fg }]}>{opt.title}</Text>
              <Text style={[styles.cardDesc, { color: opt.colors.sub }]}>{opt.desc}</Text>
            </Pressable>
          );
        })}

        <View style={styles.noticeRow}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.muted} />
          <Text style={[theme.type.small, { color: theme.colors.muted, flexShrink: 1 }]}>{strings.modes.switchNote}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Button title="Continue" onPress={handleContinue} loading={loading} disabled={!selectedMode} />
        <Pressable style={styles.switchAccountBtn} onPress={handleSignOut} disabled={loading}>
          <Text style={{ color: theme.colors.muted, fontSize: 14 }}>
            Wrong account? <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Log out</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'space-between', paddingTop: 56 },
  header: { marginBottom: 16 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressTrack: { height: 4, borderRadius: 2, marginBottom: 24, overflow: 'hidden' },
  progressFill: { width: '33%', height: 4, borderRadius: 2 },
  errorBox: { padding: 12, borderRadius: 12, marginBottom: 12, borderLeftWidth: 4 },
  errorText: { fontSize: 14, fontWeight: '600' },
  optionsList: { gap: 14, flex: 1, justifyContent: 'center' },
  card: { padding: 20, borderWidth: 3 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginBottom: 6 },
  cardDesc: { fontSize: 14, lineHeight: 20 },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 4 },
  footer: { marginTop: 20, marginBottom: 10, gap: 12 },
  switchAccountBtn: { alignItems: 'center', paddingVertical: 8 },
});

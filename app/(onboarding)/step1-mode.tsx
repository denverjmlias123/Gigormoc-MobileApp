import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppTheme, lightFreelancerTheme, clientTheme, useResponsiveLayout } from '../theme';
import { Button } from '../../components/ui/Button';
import { AlertBox } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth';
import { strings } from '../../constants/strings';
import { confirmDialog } from '../../lib/dialog';
import { runConfirmedLogout } from '../../utils/confirmedLogout';

type ModeChoice = 'find_work' | 'hire';

export default function OnboardingStep1ModeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { isWide, topSpace, bottomSpace } = useResponsiveLayout();
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
    badge: string;
    bullets: string[];
    icon: React.ComponentProps<typeof Ionicons>['name'];
    colors: { bg: string; fg: string; sub: string; accent: string };
  }[] = [
    {
      id: 'find_work',
      title: strings.modes.findWork,
      desc: strings.modes.findWorkDesc,
      badge: 'Freelancer Workspace',
      bullets: ['Apply to open Ormoc gigs', 'Showcase skills & portfolio', 'Get paid per milestone'],
      icon: 'briefcase-outline',
      colors: {
        bg: lightFreelancerTheme.colors.heroBg,
        fg: '#FFFFFF',
        sub: lightFreelancerTheme.colors.heroMuted,
        accent: lightFreelancerTheme.colors.roleAccent,
      },
    },
    {
      id: 'hire',
      title: strings.modes.hire,
      desc: strings.modes.hireDesc,
      badge: 'Client Workspace',
      bullets: ['Post local jobs & budgets', 'Compare freelancer proposals', 'Approve milestones safely'],
      icon: 'people-outline',
      colors: {
        bg: clientTheme.colors.heroBg,
        fg: '#FFFFFF',
        sub: clientTheme.colors.heroMuted,
        accent: clientTheme.colors.roleAccent,
      },
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: isWide ? 48 : topSpace + 8, paddingBottom: isWide ? 48 : bottomSpace + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <Text style={[theme.type.small, { color: theme.colors.muted, fontWeight: '700' }]}>Step 1 of 3</Text>
              <Button
                title="Log out"
                variant="ghost"
                size="xs"
                icon="log-out-outline"
                onPress={handleSignOut}
                disabled={loading}
              />
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
            <AlertBox
              tone="danger"
              message={error}
            />
          )}

          <View style={[styles.optionsList, isWide && styles.optionsListWide]}>
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
                  style={({ hovered }: any) => [
                    styles.card,
                    isWide && { flex: 1 },
                    {
                      backgroundColor: opt.colors.bg,
                      borderRadius: theme.radii.card,
                      borderColor: isSelected ? opt.colors.accent : hovered ? 'rgba(255,255,255,0.35)' : 'transparent',
                      opacity: selectedMode && !isSelected ? 0.65 : 1,
                    },
                    theme.shadow.raised,
                    Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                  ]}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.cardIcon}>
                      <Ionicons name={opt.icon} size={22} color={opt.colors.fg} />
                    </View>
                    <View style={[styles.rolePill, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
                      <Text style={styles.rolePillText}>{opt.badge}</Text>
                    </View>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={26}
                      color={isSelected ? opt.colors.accent : opt.colors.fg}
                    />
                  </View>
                  <Text style={[styles.cardTitle, { color: opt.colors.fg }]}>{opt.title}</Text>
                  <Text style={[styles.cardDesc, { color: opt.colors.sub }]}>{opt.desc}</Text>
                  <View style={styles.bulletList}>
                    {opt.bullets.map((b) => (
                      <View key={b} style={styles.bulletRow}>
                        <Ionicons name="checkmark" size={14} color={opt.colors.accent} />
                        <Text style={[styles.bulletText, { color: opt.colors.sub }]}>{b}</Text>
                      </View>
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <AlertBox
            tone="info"
            message={strings.modes.switchNote}
          />

          <View style={styles.footer}>
            <Button
              title="Continue"
              onPress={handleContinue}
              loading={loading}
              disabled={!selectedMode}
              rightIcon="arrow-forward"
              fullWidth
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, justifyContent: 'center' },
  inner: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 18 },
  header: { marginBottom: 4 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressTrack: { height: 4, borderRadius: 2, marginBottom: 22, overflow: 'hidden' },
  progressFill: { width: '33%', height: 4, borderRadius: 2 },
  optionsList: { gap: 16 },
  optionsListWide: { flexDirection: 'row', alignItems: 'stretch', gap: 20 },
  card: { padding: 20, borderWidth: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8 },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    marginRight: 'auto',
  },
  rolePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginBottom: 6 },
  cardDesc: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  bulletList: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.16)', paddingTop: 14 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bulletText: { fontSize: 13, fontWeight: '500' },
  footer: { marginTop: 12, maxWidth: 420, width: '100%', alignSelf: 'center' },
});

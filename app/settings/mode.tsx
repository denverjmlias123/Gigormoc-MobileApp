import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { applicationsService, ModeSwitchStatus } from '../../services/applications';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../components/ui/Toast';
import { confirmDialog, notify } from '../../lib/dialog';
import { mapSqlErrorToFriendlyMessage, strings } from '../../constants/strings';

export default function ModeSettingsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { profile, refreshProfile, runSharedCleanup } = useAuth();

  const [status, setStatus] = useState<ModeSwitchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await applicationsService.getModeSwitchStatus();
      setStatus(data);
    } catch (err: any) {
      setError(mapSqlErrorToFriendlyMessage(err, 'Failed to check mode status.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const currentMode = profile?.active_mode || status?.current_mode;
  const targetMode = currentMode === 'find_work' ? 'hire' : 'find_work';
  const targetLabel = targetMode === 'find_work' ? 'Find Work (Freelancer)' : 'Hire (Client)';

  const handleSwitchMode = async () => {
    if (!status?.can_switch || switching) return;

    let warningText = '';
    if (currentMode === 'hire') {
      warningText = `Switching to Find Work mode will cancel any open or draft gigs you have posted (${status.pending_gigs_count} gig(s)).\n\nYou will not be able to switch back for 7 days.`;
    } else {
      warningText = `Switching to Hire mode will withdraw any pending job proposals you have submitted (${status.pending_apps_count} proposal(s)).\n\nYou will not be able to switch back for 7 days.`;
    }

    const confirmed = await confirmDialog({
      title: `Switch to ${targetLabel}?`,
      message: `${warningText}\n\nAre you sure you want to proceed?`,
      confirmText: 'Confirm & Switch Mode',
      destructive: true,
    });
    if (!confirmed) return;

    setSwitching(true);
    try {
      await applicationsService.switchMode(targetMode, true);
      try {
        await supabase.removeAllChannels();
        await runSharedCleanup();
      } catch {
        // Ignore channel cleanup errors
      }
      await refreshProfile();
      await fetchStatus();
      showToast(strings.toasts.modeSwitched);
      await notify('Mode Switched', `You are now in ${targetLabel} mode.`);
      router.replace('/(tabs)');
    } catch (err: any) {
      await notify('Switch Error', mapSqlErrorToFriendlyMessage(err, 'Could not switch mode.'));
    } finally {
      setSwitching(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/profile');
            }
          }}
          style={styles.backButton}
        >
          <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: theme.colors.text }]}>Account Mode</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Current Mode Card */}
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.label, { color: theme.colors.muted }]}>Current Active Mode</Text>
            <Text style={[styles.modeTitle, { color: theme.colors.primary }]}>
              {currentMode === 'find_work'
                ? '💼 Find Work (Freelancer)'
                : currentMode === 'hire'
                ? '🤝 Hire (Client)'
                : 'Not Set'}
            </Text>
            <Text style={[styles.modeDescription, { color: theme.colors.muted }]}>
              {currentMode === 'find_work'
                ? 'You can browse gigs, submit proposals, and complete projects for clients in Ormoc.'
                : 'You can post gigs, review applicants, and hire local talent in Ormoc.'}
            </Text>
          </View>

          {/* 7-Day Cooldown Notice */}
          <View style={[styles.infoCard, { backgroundColor: '#EEF2FA', borderColor: theme.colors.border }]}>
            <Text style={[styles.infoTitle, { color: theme.colors.text }]}>⏳ 7-Day Cooldown Policy</Text>
            <Text style={[styles.infoText, { color: theme.colors.muted }]}>
              Per Ormoc freelance safety rules, switching your mode has a mandatory 7-day cooldown to prevent market abuse and maintain identity accountability.
            </Text>
          </View>

          {/* Eligibility & Blockers */}
          {status && !status.can_switch && (
            <View style={[styles.errorCard, { backgroundColor: '#FDE8EA', borderColor: '#F3A6AE' }]}>
              <Text style={styles.errorCardTitle}>⚠️ Cannot Switch Mode Right Now</Text>

              {status.cooldown_remaining_days > 0 && (
                <Text style={styles.blockerItem}>
                  • Cooldown active: {status.cooldown_remaining_days} day(s) remaining before you can switch again.
                </Text>
              )}

              {status.blockers.map((b, idx) => (
                <Text key={idx} style={styles.blockerItem}>
                  • {b}
                </Text>
              ))}
            </View>
          )}

          {error && (
            <View style={[styles.errorCard, { backgroundColor: '#FDE8EA', borderColor: '#F3A6AE' }]}>
              <Text style={styles.errorCardTitle}>{error}</Text>
            </View>
          )}

          {/* Switch Action */}
          <View style={styles.actionContainer}>
            <Button
              title={
                switching
                  ? 'Switching...'
                  : `Switch to ${targetLabel}`
              }
              variant="danger"
              onPress={handleSwitchMode}
              disabled={!status?.can_switch || switching}
              loading={switching}
            />
            {status?.can_switch && (
              <Text style={[styles.actionDisclaimer, { color: theme.colors.muted }]}>
                Switching will withdraw active proposals or cancel open gigs automatically.
              </Text>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 6,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  modeTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  modeDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  errorCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  errorCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#A31F2D',
    marginBottom: 4,
  },
  blockerItem: {
    fontSize: 13,
    color: '#A31F2D',
    lineHeight: 18,
  },
  actionContainer: {
    marginTop: 8,
    gap: 10,
  },
  actionDisclaimer: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});

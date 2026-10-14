import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { showToast } from '../../components/ui/Toast';
import { confirmDialog } from '../../lib/dialog';
import { strings } from '../../constants/strings';
import { sessionService, UserSession } from '../../services/sessions';

export default function SessionsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [rows, activeId] = await Promise.all([
        sessionService.listMySessions(),
        sessionService.getCurrentSessionId(),
      ]);
      setSessions(rows);
      setCurrentId(activeId);
    } catch {
      setError(strings.auth.sessionsLoadFailed);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  const handleEndOtherSessions = async () => {
    if (busy) return;
    const accepted = await confirmDialog({
      title: strings.auth.sessionsLogOutOthers,
      message: strings.auth.sessionsLogOutOthersConfirm,
      confirmText: strings.auth.sessionsLogOutOthers,
      cancelText: strings.common.cancel,
      destructive: true,
    });
    if (!accepted) return;
    setBusy(true);
    try {
      const count = await sessionService.endOtherSessions();
      await loadSessions();
      showToast(strings.auth.sessionsLogOutOthersDone(count), 'success');
    } catch {
      setError(strings.auth.sessionsLoadFailed);
    } finally {
      setBusy(false);
    }
  };

  const formatLastActive = (value: string) => new Date(value).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[theme.type.title, { color: theme.colors.text }]}>{strings.auth.sessionsTitle}</Text>
      <Text style={[theme.type.body, styles.subtitle, { color: theme.colors.muted }]}>{strings.auth.sessionsSubtitle}</Text>

      {loading ? <ActivityIndicator accessibilityLabel={strings.common.loading} color={theme.colors.primary} /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={loadSessions} /> : null}
      {!loading && !error && sessions.length === 0 ? (
        <Card><Text style={[theme.type.body, { color: theme.colors.muted }]}>{strings.auth.sessionsEmpty}</Text></Card>
      ) : null}
      {!loading && !error ? sessions.map((item) => (
        <Card key={item.id} style={styles.sessionCard}>
          <View style={styles.sessionHeader}>
            <Text style={[theme.type.bodyStrong, { color: theme.colors.text }]}>{item.device_label}</Text>
            {item.id === currentId ? (
              <Text style={[theme.type.small, { color: theme.colors.primary }]}>{strings.auth.sessionsThisDevice}</Text>
            ) : null}
          </View>
          <Text style={[theme.type.small, { color: theme.colors.muted }]}>
            {item.ended_at ? strings.auth.sessionsEnded : strings.auth.sessionsLastActive(formatLastActive(item.last_seen_at))}
          </Text>
          <Text style={[theme.type.small, { color: theme.colors.muted }]}>{item.platform.toUpperCase()}</Text>
        </Card>
      )) : null}

      {!loading && !error && sessions.some((item) => !item.ended_at && item.id !== currentId) ? (
        <Button
          title={strings.auth.sessionsLogOutOthers}
          onPress={handleEndOtherSessions}
          loading={busy}
          disabled={busy}
          variant="secondary"
        />
      ) : null}
      <Button title={strings.common.back} variant="ghost" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 56, gap: 12 },
  subtitle: { marginBottom: 8 },
  sessionCard: { gap: 6 },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

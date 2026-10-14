import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { adminService } from '../../services/admin';
import { strings, mapSqlErrorToFriendlyMessage } from '../../constants/strings';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';

const metrics: Array<[string, string]> = [
  ['total_users', 'userCount'], ['new_users_7_days', 'newUsers'], ['active_gigs', 'activeGigs'],
  ['agreements_in_progress', 'inProgress'], ['completed_agreements', 'completed'], ['open_reports', 'openReports'],
  ['locked_accounts', 'lockedAccounts'], ['today_log_events', 'todayEvents'],
];

export default function AdminDashboard() {
  const theme = useAppTheme(); const router = useRouter();
  const [data, setData] = useState<Record<string, any> | null>(null); const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await adminService.dashboardMetrics()); }
    catch (e) { setError(mapSqlErrorToFriendlyMessage(e, strings.errors.serverError)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (error) return <ErrorState message={error} onRetry={load} />;
  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
      <Text style={[theme.type.title, { color: theme.colors.text }]}>{strings.admin.dashboard}</Text>
      {loading && !data ? <Text style={[theme.type.body, { color: theme.colors.muted }]}>{strings.common.loading}</Text> : (
        <View style={styles.grid}>{metrics.map(([key, label]) => {
          const copy = strings.admin[label as keyof typeof strings.admin];
          return <Card key={key} style={styles.metric}><Text style={[theme.type.title, { color: theme.colors.primary }]}>{Number(data?.[key] ?? 0).toLocaleString()}</Text>
            <Text style={[theme.type.small, { color: theme.colors.muted }]}>{typeof copy === 'string' ? copy : label}</Text></Card>;
        })}</View>
      )}
      <Button title={strings.admin.users} onPress={() => router.push('/admin/users')} />
      <Button title={strings.admin.logTrail} variant="secondary" onPress={() => router.push('/admin/log-trail')} />
      <Text style={[theme.type.bodyStrong, { color: theme.colors.text, marginTop: 20 }]}>{strings.admin.latestActivity}</Text>
      {(data?.latest_activity || []).length ? data?.latest_activity?.map((row: any) => (
        <Card key={row.id}><Text style={[theme.type.bodyStrong, { color: theme.colors.text }]}>{row.action}</Text>
          <Text style={[theme.type.small, { color: theme.colors.muted }]}>{row.actor_email || strings.admin.noActivity} · {new Date(row.created_at).toLocaleString()}</Text></Card>
      )) : !loading ? <Text style={[theme.type.body, { color: theme.colors.muted }]}>{strings.admin.noActivity}</Text> : null}
    </ScrollView>
  );
}
const styles = StyleSheet.create({ content: { padding: 20, gap: 12, maxWidth: 1000, width: '100%', alignSelf: 'center' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metric: { width: '48%', minWidth: 140, flexGrow: 1, gap: 6 } });

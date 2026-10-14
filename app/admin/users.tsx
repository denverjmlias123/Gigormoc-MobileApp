import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { adminService, AdminUser } from '../../services/admin';
import { strings, mapSqlErrorToFriendlyMessage } from '../../constants/strings';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';

export default function AdminUsers() {
  const theme = useAppTheme(); const router = useRouter();
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [mode, setMode] = useState('');
  const [page, setPage] = useState(1); const [rows, setRows] = useState<AdminUser[]>([]); const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (nextPage = 1) => {
    setLoading(true); setError(null);
    try { const result = await adminService.listUsers({ search, status, mode, page: nextPage }); setRows(result.rows); setPage(result.page); setTotal(result.total_count); }
    catch (e) { setError(mapSqlErrorToFriendlyMessage(e, strings.errors.serverError)); }
    finally { setLoading(false); }
  }, [search, status, mode]);
  useEffect(() => { void load(1); }, [load]);
  if (error && rows.length === 0) return <ErrorState message={error} onRetry={() => load(page)} />;
  const selectStyle = (active: boolean) => [styles.filter, { borderColor: active ? theme.colors.primary : theme.colors.border, backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface }];
  return <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
    <Text style={[theme.type.title, { color: theme.colors.text }]}>{strings.admin.users}</Text>
    <TextInput label={strings.admin.search} value={search} onChangeText={setSearch} autoCapitalize="none" />
    <View style={styles.filters}>{[['', 'All'], ['active', strings.admin.active], ['suspended', strings.admin.suspended], ['deleted', strings.admin.deleted]].map(([value, label]) =>
      <Pressable key={value || 'all-status'} style={selectStyle(status === value)} onPress={() => setStatus(value)} accessibilityRole="button"><Text style={{ color: theme.colors.text }}>{label}</Text></Pressable>)}</View>
    <View style={styles.filters}>{[['', 'All modes'], ['find_work', strings.admin.findWork], ['hire', strings.admin.hire], ['unselected', strings.admin.unselected]].map(([value, label]) =>
      <Pressable key={value || 'all-mode'} style={selectStyle(mode === value)} onPress={() => setMode(value)} accessibilityRole="button"><Text style={{ color: theme.colors.text }}>{label}</Text></Pressable>)}</View>
    <Button title={strings.admin.createUser} onPress={() => router.push('/admin/users/create')} />
    {error ? <ErrorState message={error} onRetry={() => load(page)} /> : null}
    {!loading && rows.length === 0 ? <Text style={[theme.type.body, { color: theme.colors.muted }]}>{strings.admin.noUsers}</Text> : null}
    <FlatList data={rows} keyExtractor={(item) => item.id} contentContainerStyle={styles.list}
      renderItem={({ item }) => <Pressable onPress={() => router.push({ pathname: '/admin/users/[id]', params: { id: item.id } })} accessibilityRole="button">
        <Card><Text style={[theme.type.bodyStrong, { color: theme.colors.text }]}>{item.display_name}</Text>
          <Text style={[theme.type.small, { color: theme.colors.muted }]}>{item.email}</Text>
          <Text style={[theme.type.small, { color: theme.colors.muted }]}>{item.active_mode === 'hire' ? strings.admin.hire : item.active_mode === 'find_work' ? strings.admin.findWork : strings.admin.unselected} · {item.status} · {item.admin_role || 'user'}</Text>
          <Text style={[theme.type.small, { color: theme.colors.muted }]}>{new Date(item.created_at).toLocaleDateString()} · {item.last_sign_in_at ? new Date(item.last_sign_in_at).toLocaleDateString() : 'No sign in yet'}</Text>
        </Card></Pressable>} />
    <View style={styles.pagination}><Button title="Previous" variant="secondary" disabled={page <= 1 || loading} onPress={() => load(page - 1)} />
      <Text style={[theme.type.small, { color: theme.colors.muted }]}>{page} / {Math.max(1, Math.ceil(total / 25))} · {total}</Text>
      <Button title="Next" variant="secondary" disabled={loading || page * 25 >= total} onPress={() => load(page + 1)} /></View>
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1, padding: 18, gap: 10 }, filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, filter: { paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1, borderRadius: 18, minHeight: 40, justifyContent: 'center' }, list: { gap: 8 }, pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 } });

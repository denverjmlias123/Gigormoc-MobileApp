import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppTheme } from '../../theme';
import { useAuth } from '../../../hooks/useAuth';
import { adminService } from '../../../services/admin';
import { strings, mapSqlErrorToFriendlyMessage } from '../../../constants/strings';
import { TextInput } from '../../../components/ui/TextInput';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { confirmDialog } from '../../../lib/dialog';
import { showToast } from '../../../components/ui/Toast';

export default function AdminUserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(); const theme = useAppTheme(); const router = useRouter(); const { user: currentUser } = useAuth();
  const [detail, setDetail] = useState<any>(null); const [superAdmin, setSuperAdmin] = useState(false);
  const [name, setName] = useState(''); const [area, setArea] = useState(''); const [status, setStatus] = useState<'active' | 'suspended'>('active');
  const [role, setRole] = useState<'user' | 'admin' | 'super_admin'>('user'); const [emailConfirm, setEmailConfirm] = useState('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [row, isSuper] = await Promise.all([adminService.userDetail(String(id)), adminService.isSuperAdmin()]);
      setDetail(row); setName(row.profile.display_name || ''); setArea(row.profile.area || ''); setStatus(row.profile.status === 'suspended' ? 'suspended' : 'active');
      setRole(row.admin_role || 'user'); setSuperAdmin(isSuper);
    } catch (e) { setError(mapSqlErrorToFriendlyMessage(e, strings.errors.serverError)); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  const act = async (fn: () => Promise<any>, message = strings.toasts.adminSaved) => {
    if (saving) return; setSaving(true); setError(null);
    try { await fn(); showToast(message); await load(); }
    catch (e) { setError(mapSqlErrorToFriendlyMessage(e, strings.errors.serverError)); }
    finally { setSaving(false); }
  };
  if (loading && !detail) return <View style={[styles.center, { backgroundColor: theme.colors.background }]}><Text style={[theme.type.body, { color: theme.colors.text }]}>{strings.common.loading}</Text></View>;
  if (!detail) return <ErrorState message={error || strings.errors.notFound} onRetry={load} />;
  const profile = detail.profile;
  const setRoleAction = () => act(() => adminService.setAdminRole(String(id), role));
  const sendReset = () => act(() => adminService.invokeUserAction({ action: 'send_password_reset', userId: id }), strings.toasts.adminResetSent);
  const unlock = () => act(() => adminService.unlockLogin(detail.email), strings.toasts.adminUnlocked);
  const endSessions = () => act(() => adminService.endSessions(String(id)));
  const removeUser = async () => {
    if (emailConfirm.trim().toLowerCase() !== String(detail.email).toLowerCase()) { setError(strings.admin.confirmEmail); return; }
    const confirmed = await confirmDialog({ title: strings.admin.deleteConfirm, message: `${strings.admin.delete}: ${detail.email}? Agreements and audit logs are retained.`, confirmText: strings.admin.delete, cancelText: strings.common.cancel, destructive: true });
    if (!confirmed) return;
    await act(() => adminService.invokeUserAction({ action: 'soft_delete_user', userId: id, confirmEmail: emailConfirm.trim() }), strings.toasts.adminDeleted);
    setEmailConfirm('');
  };
  return <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={[theme.type.title, { color: theme.colors.text }]}>{profile.display_name || detail.email}</Text>
    <Card><Text style={[theme.type.body, { color: theme.colors.text }]}>{detail.email}</Text><Text style={[theme.type.small, { color: theme.colors.muted }]}>{id}</Text>
      <Text style={[theme.type.small, { color: theme.colors.muted }]}>Created {new Date(detail.created_at).toLocaleString()} · Last sign in {detail.last_sign_in_at ? new Date(detail.last_sign_in_at).toLocaleString() : 'Never'}</Text>
      <Text style={[theme.type.small, { color: theme.colors.muted }]}>{profile.active_mode || strings.admin.unselected} · {profile.status}{profile.must_change_password ? ' · Must change password' : ''}</Text></Card>
    <TextInput label={strings.admin.name} value={name} onChangeText={setName} />
    <TextInput label={strings.admin.area} value={area} onChangeText={setArea} />
    <View style={styles.row}><Button title={`${strings.admin.active}${status === 'active' ? ' ✓' : ''}`} variant={status === 'active' ? 'primary' : 'secondary'} disabled={String(id) === currentUser?.id} onPress={() => setStatus('active')} />
      <Button title={`${strings.admin.suspended}${status === 'suspended' ? ' ✓' : ''}`} variant={status === 'suspended' ? 'primary' : 'secondary'} disabled={String(id) === currentUser?.id} onPress={() => setStatus('suspended')} /></View>
    <Button title={strings.admin.save} onPress={() => act(() => adminService.updateUser({ userId: String(id), displayName: name, area, status }))} loading={saving} disabled={saving || !name.trim()} />
    {superAdmin ? <>
      <Text style={[theme.type.bodyStrong, { color: theme.colors.text }]}>{strings.admin.role}: {detail.admin_role || 'user'}</Text>
      {(['user', 'admin', 'super_admin'] as const).map((value) => <Button key={value} title={`${value === 'user' ? strings.admin.userRole : value === 'admin' ? strings.admin.adminRole : strings.admin.superAdmin}${role === value ? ' ✓' : ''}`} variant={role === value ? 'primary' : 'secondary'} onPress={() => setRole(value)} />)}
      <Button title={strings.admin.role} variant="secondary" onPress={setRoleAction} loading={saving} disabled={saving || role === (detail.admin_role || 'user')} />
    </> : null}
    <Button title={strings.admin.resetPassword} variant="secondary" onPress={sendReset} loading={saving} disabled={saving || profile.status === 'deleted'} />
    <Button title={strings.admin.unlock} variant="secondary" onPress={unlock} loading={saving} disabled={saving || profile.status === 'deleted'} />
    <Button title={strings.admin.endSessions} variant="secondary" onPress={endSessions} loading={saving} disabled={saving} />
    <Text style={[theme.type.bodyStrong, { color: theme.colors.text, marginTop: 8 }]}>Sessions</Text>
    {(detail.sessions || []).map((session: any) => <Card key={session.id}><Text style={[theme.type.bodyStrong, { color: theme.colors.text }]}>{session.device_label} · {session.platform}</Text>
      <Text style={[theme.type.small, { color: theme.colors.muted }]}>{session.ended_at ? `Ended ${new Date(session.ended_at).toLocaleString()}` : `Active · ${new Date(session.last_seen_at).toLocaleString()}`}</Text></Card>)}
    {profile.status !== 'deleted' && String(id) !== currentUser?.id ? <>
      <TextInput label={strings.admin.confirmEmail} value={emailConfirm} onChangeText={setEmailConfirm} autoCapitalize="none" />
      <Button title={strings.admin.delete} variant="danger" onPress={removeUser} loading={saving} disabled={saving || emailConfirm.trim().toLowerCase() !== String(detail.email).toLowerCase()} />
    </> : null}
    {error ? <Text accessibilityRole="alert" style={[theme.type.body, { color: theme.colors.dangerText }]}>{error}</Text> : null}
    <Button title={strings.common.back} variant="ghost" onPress={() => router.canGoBack() ? router.back() : router.replace('/admin/users')} />
  </ScrollView>;
}
const styles = StyleSheet.create({ content: { padding: 20, gap: 12, maxWidth: 760, width: '100%', alignSelf: 'center' }, row: { flexDirection: 'row', gap: 8 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center' } });

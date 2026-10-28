import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useResponsiveLayout } from '../theme';
import { adminService } from '../../services/admin';
import { strings } from '../../constants/strings';
import { Button } from '../../components/ui/Button';

export default function AdminLayout() {
  const theme = useAppTheme();
  const { isWide, topSpace } = useResponsiveLayout();
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<'loading' | 'allowed' | 'denied' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  const check = useCallback(async () => {
    setState('loading');
    try {
      const allowed = await adminService.isAdmin();
      setState(allowed ? 'allowed' : 'denied');
      if (!allowed) router.replace('/(tabs)/profile');
    } catch {
      setState('error');
    }
  }, [router, attempt]);

  useEffect(() => {
    void check();
  }, [check]);

  if (state !== 'allowed') {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        {state === 'loading' ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <>
            <Text style={[theme.type.body, { color: theme.colors.text, textAlign: 'center' }]}>
              {state === 'denied' ? strings.admin.accessDenied : strings.errors.serverError}
            </Text>
            {state === 'error' ? (
              <Button title={strings.admin.retry} onPress={() => setAttempt((n) => n + 1)} />
            ) : null}
          </>
        )}
      </View>
    );
  }

  const adminLinks = [
    { label: strings.admin.dashboard, href: '/admin/dashboard', icon: 'speedometer-outline' as const, match: 'dashboard' },
    { label: strings.admin.users, href: '/admin/users', icon: 'people-outline' as const, match: 'users' },
    { label: 'AI Legit Queue', href: '/admin/verification', icon: 'shield-checkmark-outline' as const, match: 'verification' },
    { label: strings.admin.logTrail, href: '/admin/log-trail', icon: 'list-outline' as const, match: 'log-trail' },
  ];

  return (
    <View style={[styles.shell, isWide && styles.shellWide, { backgroundColor: theme.colors.background }]}>
      {isWide ? (
        <View style={styles.sidebar}>
          <View style={{ gap: 20 }}>
            <View style={styles.brandHeader}>
              <View style={styles.adminBadgeIcon}>
                <Ionicons name="shield-checkmark" size={20} color="#FBBF24" />
              </View>
              <View>
                <Text style={styles.sidebarTitle}>Gigormoc Admin</Text>
                <Text style={styles.sidebarSub}>Moderation & Security</Text>
              </View>
            </View>

            <View style={{ gap: 6 }}>
              {adminLinks.map((link) => {
                const active = pathname.includes(link.match);
                return (
                  <Pressable
                    key={link.href}
                    onPress={() => router.push(link.href as any)}
                    style={[
                      styles.sideNavBtn,
                      active && styles.sideNavBtnActive,
                    ]}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name={link.icon}
                      size={18}
                      color={active ? '#FFFFFF' : '#94A3B8'}
                    />
                    <Text style={[styles.sideNavText, active && styles.sideNavTextActive]}>
                      {link.label}
                    </Text>
                  </Pressable>
                );
              })}

              <Pressable
                onPress={() => router.push('/admin/users/create')}
                style={[styles.sideNavBtn, pathname.includes('/users/create') && styles.sideNavBtnActive]}
                accessibilityRole="button"
              >
                <Ionicons name="person-add-outline" size={18} color="#34D399" />
                <Text style={[styles.sideNavText, { color: '#34D399' }]}>
                  + {strings.admin.createUser}
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={styles.exitBtn}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back-outline" size={18} color="#E2E8F0" />
            <Text style={styles.exitBtnText}>Exit to Main App</Text>
          </Pressable>
        </View>
      ) : (
        <View
          style={[
            styles.mobileTopBar,
            {
              paddingTop: topSpace,
              backgroundColor: '#0B1445',
              borderBottomColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.mobileHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="shield-checkmark" size={18} color="#FBBF24" />
              <Text style={styles.mobileAdminTitle}>Admin Console</Text>
            </View>
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              style={styles.mobileExitPill}
              accessibilityRole="button"
            >
              <Ionicons name="exit-outline" size={14} color="#FFFFFF" />
              <Text style={styles.mobileExitText}>Exit</Text>
            </Pressable>
          </View>
          <View style={styles.mobileNavRow}>
            {adminLinks.map((link) => {
              const active = pathname.includes(link.match);
              return (
                <Pressable
                  key={link.href}
                  onPress={() => router.push(link.href as any)}
                  style={[styles.mobileNavPill, active && styles.mobileNavPillActive]}
                  accessibilityRole="button"
                >
                  <Ionicons name={link.icon} size={14} color={active ? '#0B1445' : '#CBD5E1'} />
                  <Text style={[styles.mobileNavPillText, active && styles.mobileNavPillTextActive]}>
                    {link.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  shell: { flex: 1 },
  shellWide: { flexDirection: 'row' },
  sidebar: {
    width: 248,
    backgroundColor: '#070B26',
    padding: 20,
    justifyContent: 'space-between',
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  adminBadgeIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(251, 191, 36, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  sidebarSub: { color: '#94A3B8', fontSize: 11.5, fontWeight: '600' },
  sideNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  sideNavBtnActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.35)',
  },
  sideNavText: { color: '#CBD5E1', fontSize: 14, fontWeight: '600' },
  sideNavTextActive: { color: '#FFFFFF', fontWeight: '800' },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  exitBtnText: { color: '#E2E8F0', fontSize: 13.5, fontWeight: '700' },
  mobileTopBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: 1,
  },
  mobileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mobileAdminTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  mobileExitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  mobileExitText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  mobileNavRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mobileNavPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  mobileNavPillActive: {
    backgroundColor: '#FBBF24',
  },
  mobileNavPillText: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
  mobileNavPillTextActive: { color: '#0B1445', fontWeight: '800' },
});


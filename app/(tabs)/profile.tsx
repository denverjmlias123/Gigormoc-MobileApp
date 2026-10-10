import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user, profile, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await signOut();
    } catch (err: any) {
      Alert.alert('Sign Out Error', err?.message || 'Could not sign out.');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>My Profile</Text>
        </View>

        {/* Profile Summary Card */}
        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.colors.muted }]}>Name</Text>
            <Text style={[styles.value, { color: theme.colors.text }]}>
              {profile?.display_name || user?.user_metadata?.display_name || 'No name set'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.colors.muted }]}>Email</Text>
            <Text style={[styles.value, { color: theme.colors.text }]}>
              {user?.email || 'Unknown'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.colors.muted }]}>Status</Text>
            <Text style={[styles.value, { color: profile?.status === 'active' ? '#2e7d32' : theme.colors.muted }]}>
              {profile?.status || 'active'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.colors.muted }]}>Freelancer Rating</Text>
            <Text style={[styles.value, { color: theme.colors.text }]}>
              ★ {Number(profile?.freelancer_rating_avg || 0).toFixed(1)} ({profile?.freelancer_rating_count || 0})
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.colors.muted }]}>Client Rating</Text>
            <Text style={[styles.value, { color: theme.colors.text }]}>
              ★ {Number(profile?.client_rating_avg || 0).toFixed(1)} ({profile?.client_rating_count || 0})
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.colors.muted }]}>Account Mode</Text>
            <Text style={[styles.value, { color: theme.colors.text }]}>
              {profile?.active_mode === 'find_work'
                ? 'Find Work (Freelancer)'
                : profile?.active_mode === 'hire'
                ? 'Hire Someone (Client)'
                : 'Not Selected'}
            </Text>
          </View>

          {profile?.area ? (
            <View style={styles.row}>
              <Text style={[styles.label, { color: theme.colors.muted }]}>Area</Text>
              <Text style={[styles.value, { color: theme.colors.text }]}>{profile.area}</Text>
            </View>
          ) : null}

          {profile?.bio ? (
            <View style={styles.bioContainer}>
              <Text style={[styles.label, { color: theme.colors.muted }]}>Bio</Text>
              <Text style={[styles.bioText, { color: theme.colors.text }]}>{profile.bio}</Text>
            </View>
          ) : null}
        </View>

        {/* Profile Management Menu */}
        <View style={styles.actionMenu}>
          <TouchableOpacity
            style={[styles.menuItem, { borderColor: theme.colors.border }]}
            onPress={() => router.push('/profile/edit')}
            activeOpacity={0.7}
          >
            <Text style={[styles.menuItemText, { color: theme.colors.text }]}>✏️ Edit Profile Details</Text>
            <Text style={{ color: theme.colors.muted }}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderColor: theme.colors.border }]}
            onPress={() => router.push('/settings/mode')}
            activeOpacity={0.7}
          >
            <Text style={[styles.menuItemText, { color: theme.colors.text }]}>🔄 Switch Account Mode</Text>
            <Text style={{ color: theme.colors.muted }}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderColor: theme.colors.border }]}
            onPress={() => router.push('/profile/skills')}
            activeOpacity={0.7}
          >
            <Text style={[styles.menuItemText, { color: theme.colors.text }]}>🛠️ Manage Skills</Text>
            <Text style={{ color: theme.colors.muted }}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderColor: theme.colors.border }]}
            onPress={() => router.push('/profile/portfolio')}
            activeOpacity={0.7}
          >
            <Text style={[styles.menuItemText, { color: theme.colors.text }]}>📂 Portfolio Items</Text>
            <Text style={{ color: theme.colors.muted }}>›</Text>
          </TouchableOpacity>

          {user ? (
            <TouchableOpacity
              style={[styles.menuItem, { borderColor: theme.colors.border }]}
              onPress={() => router.push({ pathname: '/profile/[id]', params: { id: user.id } })}
              activeOpacity={0.7}
            >
              <Text style={[styles.menuItemText, { color: theme.colors.text }]}>👁️ View Public Profile</Text>
              <Text style={{ color: theme.colors.muted }}>›</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Log Out Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { borderColor: '#d32f2f' }]}
          onPress={handleSignOut}
          disabled={loggingOut}
          activeOpacity={0.8}
        >
          {loggingOut ? (
            <ActivityIndicator color="#d32f2f" />
          ) : (
            <Text style={styles.logoutButtonText}>Log Out</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
    backgroundColor: '#fafafa',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
  bioContainer: {
    paddingTop: 12,
  },
  bioText: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  actionMenu: {
    marginBottom: 24,
    gap: 8,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#ffffff',
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#d32f2f',
    fontSize: 16,
    fontWeight: '600',
  },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ListRow } from '../../components/ui/ListRow';

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

  const displayName = profile?.display_name || user?.user_metadata?.display_name || 'No name set';
  const isHire = profile?.active_mode === 'hire';

  // Show the rating and completed count for the side the person is currently on.
  const mainRating = isHire ? profile?.client_rating_avg : profile?.freelancer_rating_avg;
  const mainRatingCount = isHire ? profile?.client_rating_count : profile?.freelancer_rating_count;
  const mainCompleted = isHire ? profile?.client_completed_gigs : profile?.freelancer_completed_gigs;
  const otherLabel = isHire ? 'As freelancer' : 'As client';
  const otherRating = isHire ? profile?.freelancer_rating_avg : profile?.client_rating_avg;
  const otherCount = isHire ? profile?.freelancer_rating_count : profile?.client_rating_count;

  const goEdit = () => router.push('/profile/edit');
  const goMode = () => router.push('/settings/mode');
  const goSkills = () => router.push('/profile/skills');
  const goPortfolio = () => router.push('/profile/portfolio');
  const goPublic = () => user && router.push({ pathname: '/profile/[id]', params: { id: user.id } });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: theme.colors.heroBg }]}>
          <Avatar name={displayName} size={72} onHero />
          <Text style={[theme.type.title, { color: theme.colors.heroText, marginTop: 12 }]}>{displayName}</Text>
          <Text style={[theme.type.small, { color: theme.colors.heroMuted }]}>{user?.email || 'Unknown'}</Text>

          <View style={styles.heroMeta}>
            <View style={[styles.heroChip, { backgroundColor: theme.colors.heroChip }]}>
              <Ionicons name={isHire ? 'people' : 'search'} size={13} color={theme.colors.heroText} />
              <Text style={[styles.heroChipText, { color: theme.colors.heroText }]}>
                {profile?.active_mode === 'find_work'
                  ? 'Freelancer'
                  : isHire
                  ? 'Client'
                  : 'No mode selected'}
              </Text>
            </View>
            {profile?.area ? (
              <View style={[styles.heroChip, { backgroundColor: theme.colors.heroChip }]}>
                <Ionicons name="location" size={13} color={theme.colors.heroText} />
                <Text style={[styles.heroChipText, { color: theme.colors.heroText }]}>{profile.area}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <View style={styles.statLine}>
                <Ionicons name="star" size={18} color={theme.colors.accent} />
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {Number(mainRating || 0).toFixed(1)}
                </Text>
              </View>
              <Text style={[theme.type.small, { color: theme.colors.muted }]}>
                {mainRatingCount || 0} {mainRatingCount === 1 ? 'review' : 'reviews'}
              </Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>{mainCompleted || 0}</Text>
              <Text style={[theme.type.small, { color: theme.colors.muted }]}>Gigs completed</Text>
            </Card>
          </View>

          <Text style={[theme.type.small, { color: theme.colors.muted, marginBottom: 12 }]}>
            {otherLabel}: ★ {Number(otherRating || 0).toFixed(1)} ({otherCount || 0})
          </Text>

          {profile?.bio ? (
            <Card>
              <Text style={[theme.type.bodyStrong, { color: theme.colors.text, marginBottom: 4 }]}>About</Text>
              <Text style={[theme.type.body, { color: theme.colors.muted }]}>{profile.bio}</Text>
            </Card>
          ) : null}

          <Card style={styles.menuCard}>
            <ListRow icon="create-outline" title="Edit profile" subtitle="Name, photo, bio, area" onPress={goEdit} />
            {isHire ? (
              <>
                {user ? <ListRow icon="eye-outline" title="View public profile" onPress={goPublic} /> : null}
                <ListRow icon="swap-horizontal-outline" title="Switch account mode" onPress={goMode} />
                <ListRow icon="construct-outline" title="Manage skills" onPress={goSkills} />
                <ListRow icon="folder-open-outline" title="Portfolio" onPress={goPortfolio} last />
              </>
            ) : (
              <>
                <ListRow icon="construct-outline" title="Manage skills" onPress={goSkills} />
                <ListRow icon="folder-open-outline" title="Portfolio" onPress={goPortfolio} />
                {user ? <ListRow icon="eye-outline" title="View public profile" onPress={goPublic} /> : null}
                <ListRow icon="swap-horizontal-outline" title="Switch account mode" onPress={goMode} last />
              </>
            )}
          </Card>

          <Button
            title="Log out"
            variant="secondary"
            icon="log-out-outline"
            onPress={handleSignOut}
            loading={loggingOut}
            textStyle={{ color: theme.colors.dangerText }}
            style={{ borderColor: theme.colors.danger }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  hero: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    alignItems: 'center',
  },
  heroMeta: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  heroChipText: { fontSize: 13, fontWeight: '700' },
  body: { padding: 20 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, marginBottom: 12 },
  statLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  menuCard: { padding: 0, overflow: 'hidden', marginBottom: 20 },
});

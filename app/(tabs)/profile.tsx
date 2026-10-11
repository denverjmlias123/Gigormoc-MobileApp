import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ListRow } from '../../components/ui/ListRow';
import {
  ProfileCompleteBadge,
  ProfileCompletenessCard,
} from '../../components/ui/ProfileCompleteness';
import {
  profileService,
  ProfileCompleteness,
  CompletenessMissingItem,
} from '../../services/profile';
import { strings } from '../../constants/strings';

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [completeness, setCompleteness] = useState<ProfileCompleteness | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const loadCompleteness = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await profileService.getProfileCompleteness(user.id);
      setCompleteness(res);
    } catch {
      // Non-blocking if RPC not yet applied
    }
  }, [user?.id]);

  useEffect(() => {
    loadCompleteness();
  }, [loadCompleteness, profile]);

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

  const handlePickAvatar = async (source: 'library' | 'camera') => {
    if (!user || photoBusy) return;
    setPhotoError(null);
    setShowPhotoMenu(false);
    setPhotoBusy(true);
    try {
      const url = await profileService.pickAndUploadAvatar(user.id, source);
      if (url) {
        await refreshProfile();
        await loadCompleteness();
      }
    } catch (err: any) {
      setPhotoError(err?.message || 'Could not upload profile photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user || photoBusy) return;
    setPhotoError(null);
    setShowPhotoMenu(false);
    setPhotoBusy(true);
    try {
      await profileService.removeAvatar(user.id);
      await refreshProfile();
      await loadCompleteness();
    } catch (err: any) {
      setPhotoError(err?.message || 'Could not remove profile photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleMissingItemPress = (item: CompletenessMissingItem) => {
    if (item.key === 'photo') {
      setShowPhotoMenu(true);
      return;
    }
    if (item.key === 'skills') {
      router.push('/profile/skills');
      return;
    }
    router.push({ pathname: '/profile/edit', params: { focus: item.key } });
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
          <Avatar
            name={displayName}
            imageUri={profile?.avatar_path}
            size={76}
            onHero
            editable
            onPress={() => setShowPhotoMenu((prev) => !prev)}
          />
          {photoBusy ? (
            <ActivityIndicator color={theme.colors.heroText} style={{ marginTop: 8 }} />
          ) : null}

          <View style={styles.nameRow}>
            <Text style={[theme.type.title, { color: theme.colors.heroText }]}>{displayName}</Text>
            {completeness?.complete ? <ProfileCompleteBadge onHero /> : null}
          </View>

          {profile?.headline ? (
            <Text style={[theme.type.body, { color: theme.colors.heroMuted, marginTop: 4, textAlign: 'center' }]}>
              {profile.headline}
            </Text>
          ) : null}

          <Text style={[theme.type.small, { color: theme.colors.heroMuted, marginTop: 2 }]}>
            {user?.email || 'Unknown'}
          </Text>

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
          {photoError ? (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: theme.colors.dangerSoft, borderColor: theme.colors.danger },
              ]}
            >
              <Text style={{ color: theme.colors.dangerText, fontSize: 13, fontWeight: '600' }}>
                {photoError}
              </Text>
            </View>
          ) : null}

          {showPhotoMenu ? (
            <Card style={styles.photoMenuCard}>
              <Text style={[theme.type.bodyStrong, { color: theme.colors.text, marginBottom: 10 }]}>
                {strings.profile.photoSectionTitle}
              </Text>
              <View style={styles.photoMenuBtns}>
                <Pressable
                  style={[styles.photoMenuBtn, { borderColor: theme.colors.border }]}
                  onPress={() => handlePickAvatar('library')}
                  disabled={photoBusy}
                >
                  <Ionicons name="images-outline" size={18} color={theme.colors.primary} />
                  <Text style={[styles.photoMenuBtnText, { color: theme.colors.text }]}>
                    {strings.profile.chooseFromLibraryBtn}
                  </Text>
                </Pressable>

                {Platform.OS !== 'web' ? (
                  <Pressable
                    style={[styles.photoMenuBtn, { borderColor: theme.colors.border }]}
                    onPress={() => handlePickAvatar('camera')}
                    disabled={photoBusy}
                  >
                    <Ionicons name="camera-outline" size={18} color={theme.colors.primary} />
                    <Text style={[styles.photoMenuBtnText, { color: theme.colors.text }]}>
                      {strings.profile.takePhotoBtn}
                    </Text>
                  </Pressable>
                ) : null}

                {profile?.avatar_path ? (
                  <Pressable
                    style={[styles.photoMenuBtn, { borderColor: theme.colors.danger }]}
                    onPress={handleRemoveAvatar}
                    disabled={photoBusy}
                  >
                    <Ionicons name="trash-outline" size={18} color={theme.colors.dangerText} />
                    <Text style={[styles.photoMenuBtnText, { color: theme.colors.dangerText }]}>
                      {strings.profile.removePhotoBtn}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>
          ) : null}

          <ProfileCompletenessCard
            completeness={completeness}
            onSelectMissingItem={handleMissingItemPress}
          />

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
            <ListRow
              icon="create-outline"
              title="Edit profile"
              subtitle="Name, photo, headline, bio, area, availability"
              onPress={goEdit}
            />
            {isHire ? (
              <>
                {user ? <ListRow icon="eye-outline" title="View public profile" onPress={goPublic} /> : null}
                <ListRow icon="swap-horizontal-outline" title="Switch account mode" onPress={goMode} last />
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  heroMeta: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  heroChipText: { fontSize: 13, fontWeight: '700' },
  body: { padding: 20 },
  errorBanner: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  photoMenuCard: {
    marginBottom: 16,
  },
  photoMenuBtns: {
    gap: 8,
  },
  photoMenuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  photoMenuBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, marginBottom: 12 },
  statLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  menuCard: { padding: 0, overflow: 'hidden', marginBottom: 20 },
});

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { gigsService } from '../../services/gigs';
import { GigCard, GigSummary } from '../../components/ui/GigCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Skeleton } from '../../components/ui/Skeleton';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { FreelancerCard } from '../../components/ui/FreelancerCard';
import { profileService, FreelancerSummary, Category } from '../../services/profile';
import { notificationsService } from '../../services/notifications';
import { strings, mapSqlErrorToFriendlyMessage } from '../../constants/strings';

export default function HomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user, profile } = useAuth();
  const userId = user?.id;

  const isFindWork = profile?.active_mode === 'find_work';
  const isHire = profile?.active_mode === 'hire';

  const [availableGigs, setAvailableGigs] = useState<GigSummary[]>([]);
  const [myGigs, setMyGigs] = useState<GigSummary[]>([]);
  const [topFreelancers, setTopFreelancers] = useState<FreelancerSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notificationLoadError, setNotificationLoadError] = useState<string | null>(null);

  const loadHomeData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setNotificationLoadError(null);
    try {
      if (isHire && userId) {
        const [gigs, freelancers, browseCats] = await Promise.all([
          gigsService.getMyGigs(userId),
          profileService.getTopFreelancers({ limit: 6 }).catch(() => []),
          gigsService.getBrowseCategories().catch(() => []),
        ]);
        setMyGigs(gigs);
        setTopFreelancers(freelancers);
        setCategories(browseCats);
      } else {
        const gigs = await gigsService.getGigs();
        setAvailableGigs(gigs);
      }
    } catch (err: any) {
      setLoadError(mapSqlErrorToFriendlyMessage(err, 'Could not load gigs. Please check your connection and try again.'));
    } finally {
      setLoading(false);
    }

    // Keep notification failures separate: they must not make the gigs query
    // look like it failed or hide gigs that were loaded successfully.
      if (userId) {
      try {
        const count = await notificationsService.getUnreadCount();
        setUnreadNotifications(count);
      } catch (err: any) {
        setNotificationLoadError(mapSqlErrorToFriendlyMessage(err, strings.errors.notificationCountLoadFailed));
      }
    }
  }, [isHire, userId]);

  const retryNotificationCount = async () => {
    if (!user?.id) return;
    setNotificationLoadError(null);
    try {
      setUnreadNotifications(await notificationsService.getUnreadCount());
    } catch (err: any) {
      setNotificationLoadError(mapSqlErrorToFriendlyMessage(err, strings.errors.notificationCountLoadFailed));
    }
  };

  useFocusEffect(
    useCallback(() => {
      void loadHomeData();
      if (!user?.id) return;
      return notificationsService.subscribeToNotifications(user.id, () => {
        // The database count is authoritative; notification updates can mark
        // items read on another screen or device as well as insert new rows.
        void loadHomeData();
      });
    }, [loadHomeData, user?.id])
  );

  const displayName = profile?.display_name || user?.user_metadata?.display_name || 'Ormocanon';
  const openGigs = myGigs.filter((g) => ['open', 'in_progress', 'draft'].includes(g.status?.toLowerCase()));
  const completedGigs = myGigs.filter((g) => ['completed', 'cancelled', 'expired'].includes(g.status?.toLowerCase()));
  const openCount = myGigs.filter((g) => g.status?.toLowerCase() === 'open').length;
  const draftCount = myGigs.filter((g) => g.status?.toLowerCase() === 'draft').length;

  const handleGigPress = useCallback((gigId: string) => {
    router.push({ pathname: '/gigs/[id]', params: { id: gigId } });
  }, [router]);

  const renderLoading = () => (
    <View>
      <Skeleton height={150} borderRadius={20} style={{ marginBottom: 12 }} />
      <Skeleton height={150} borderRadius={20} style={{ marginBottom: 12 }} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero: color and content change with the active mode */}
        <View style={[styles.hero, { backgroundColor: theme.colors.heroBg }]}>
          <View style={styles.heroTop}>
            <Avatar name={displayName} imageUri={profile?.avatar_path} size={44} onHero />
            <View style={styles.greetingCol}>
              <Text style={[theme.type.small, { color: theme.colors.heroMuted }]}>Maayong adlaw,</Text>
              <Text style={[styles.name, { color: theme.colors.heroText }]} numberOfLines={1}>
                {displayName}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                style={[styles.bellBtn, { backgroundColor: theme.colors.heroChip }]}
                onPress={() => router.push('/notifications')}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
              >
                <Ionicons name="notifications-outline" size={18} color={theme.colors.heroText} />
                {unreadNotifications > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </Text>
                  </View>
                )}
              </Pressable>

              <Pressable
                style={[styles.modePill, { backgroundColor: theme.colors.heroChip }]}
                onPress={() => router.push('/settings/mode')}
                accessibilityRole="button"
                accessibilityLabel="Current mode. Tap to view mode settings."
              >
                <Ionicons name={isHire ? 'people' : 'search'} size={14} color={theme.colors.heroText} />
                <Text style={[styles.modePillText, { color: theme.colors.heroText }]}>
                  {isFindWork ? 'Find work' : isHire ? 'Hiring' : 'Select mode'}
                </Text>
              </Pressable>
            </View>
          </View>

          {isHire ? (
            <>
              <Text style={[theme.type.title, { color: theme.colors.heroText, marginTop: 20 }]}>
                Your hiring at a glance
              </Text>
              <View style={styles.statRow}>
                <View style={[styles.stat, { backgroundColor: theme.colors.heroChip }]}>
                  <Text style={styles.statValue}>{loading ? '–' : openCount}</Text>
                  <Text style={[theme.type.small, { color: theme.colors.heroMuted }]}>Open</Text>
                </View>
                <View style={[styles.stat, { backgroundColor: theme.colors.heroChip }]}>
                  <Text style={styles.statValue}>{loading ? '–' : draftCount}</Text>
                  <Text style={[theme.type.small, { color: theme.colors.heroMuted }]}>Drafts</Text>
                </View>
                <View style={[styles.stat, { backgroundColor: theme.colors.heroChip }]}>
                  <Text style={styles.statValue}>{loading ? '–' : myGigs.length}</Text>
                  <Text style={[theme.type.small, { color: theme.colors.heroMuted }]}>All gigs</Text>
                </View>
              </View>
              <Pressable
                style={[styles.heroCta, { backgroundColor: '#FFFFFF' }]}
                onPress={() => router.push('/gigs/post')}
                accessibilityRole="button"
              >
                <Ionicons name="add-circle" size={20} color={theme.colors.primary} />
                <Text style={[styles.heroCtaText, { color: theme.colors.primaryDark }]}>Post a gig</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[theme.type.title, { color: theme.colors.heroText, marginTop: 20 }]}>
                Find your next gig in Ormoc
              </Text>
              <Pressable
                style={styles.searchShortcut}
                onPress={() => router.push('/(tabs)/gigs')}
                accessibilityRole="search"
                accessibilityLabel="Search gigs"
              >
                <Ionicons name="search" size={18} color={theme.colors.muted} />
                <Text style={{ color: theme.colors.muted, fontSize: 15 }}>{strings.gigs.searchPlaceholder}</Text>
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.body}>
          {notificationLoadError && (
            <ErrorState message={notificationLoadError} onRetry={retryNotificationCount} />
          )}
          {!profile?.avatar_path && (
            <Pressable
              style={[styles.banner, { backgroundColor: theme.colors.primarySoft }]}
              onPress={() => router.push('/profile/edit')}
              accessibilityRole="button"
            >
              <Ionicons name="camera-outline" size={22} color={theme.colors.primary} />
              <Text style={[styles.bannerText, { color: theme.colors.text }]}>
                {isHire
                  ? 'Add a profile photo and hiring details to complete your client profile.'
                  : 'Add a profile photo and skills so you can apply to gigs.'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
            </Pressable>
          )}

          {isHire ? (
            <View>
              {/* 1. Active & Open Gigs */}
              <SectionHeader
                title="Active & Open Gigs"
                actionLabel={openGigs.length > 0 ? 'View all' : undefined}
                onAction={openGigs.length > 0 ? () => router.push('/(tabs)/gigs') : undefined}
              />
              {loading ? (
                renderLoading()
              ) : loadError ? (
                <ErrorState message={loadError} onRetry={loadHomeData} />
              ) : openGigs.length === 0 ? (
                <EmptyState
                  icon="document-text-outline"
                  title={strings.gigs.noMyGigsTitle}
                  description={strings.gigs.noMyGigsDesc}
                  actionTitle={strings.gigs.postGig}
                  onAction={() => router.push('/gigs/post')}
                />
              ) : (
                openGigs.map((gig) => (
                  <GigCard
                    key={gig.id}
                    gig={gig}
                    onPress={() => handleGigPress(gig.id)}
                  />
                ))
              )}

              {/* 2. Top Freelancers in Ormoc */}
              <View style={{ marginTop: 12 }}>
                <SectionHeader
                  title="Top Freelancers in Ormoc"
                  actionLabel="Find more"
                  onAction={() =>
                    router.push({
                      pathname: '/(tabs)/gigs',
                      params: { tab: 'find_freelancers' },
                    })
                  }
                />
                {loading ? (
                  <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 4 }}>
                    <Skeleton height={140} width={220} borderRadius={16} />
                    <Skeleton height={140} width={220} borderRadius={16} />
                  </View>
                ) : topFreelancers.length === 0 ? (
                  <View
                    style={[
                      styles.emptyInlineCard,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Ionicons name="people-outline" size={24} color={theme.colors.muted} />
                    <Text style={[styles.emptyInlineText, { color: theme.colors.muted }]}>
                      Freelancers will appear here once registered.
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.freelancersScroll}
                  >
                    {topFreelancers.map((freelancer) => (
                      <FreelancerCard
                        key={freelancer.id}
                        freelancer={freelancer}
                        compact
                        onPress={() =>
                          router.push({
                            pathname: '/profile/[id]',
                            params: { id: freelancer.id },
                          })
                        }
                      />
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* 3. Browse Talent by Category */}
              {categories.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <SectionHeader title="Browse Talent by Category" />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryChipsScroll}
                  >
                    {categories.slice(0, 8).map((cat) => (
                      <Pressable
                        key={cat.id}
                        style={({ pressed }) => [
                          styles.categoryCard,
                          {
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.border,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}
                        onPress={() =>
                          router.push({
                            pathname: '/(tabs)/gigs',
                            params: { tab: 'find_freelancers', categoryId: cat.id },
                          })
                        }
                      >
                        <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                          {cat.name}
                        </Text>
                        <View style={styles.categoryArrowRow}>
                          <Text style={[styles.categoryHint, { color: theme.colors.primary }]}>
                            Browse
                          </Text>
                          <Ionicons
                            name="arrow-forward"
                            size={12}
                            color={theme.colors.primary}
                          />
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* 4. Completed & Past Gigs */}
              {completedGigs.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <SectionHeader
                    title="Completed & Past Gigs"
                    actionLabel={completedGigs.length > 2 ? 'See all' : undefined}
                    onAction={
                      completedGigs.length > 2
                        ? () => router.push('/(tabs)/gigs')
                        : undefined
                    }
                  />
                  {completedGigs.slice(0, 3).map((gig) => (
                    <GigCard
                      key={gig.id}
                      gig={gig}
                      onPress={() => handleGigPress(gig.id)}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View>
              <SectionHeader
                title={strings.gigs.availableGigs}
                actionLabel="See all"
                onAction={() => router.push('/(tabs)/gigs')}
              />
              {loading ? (
                renderLoading()
              ) : loadError ? (
                <ErrorState message={loadError} onRetry={loadHomeData} />
              ) : availableGigs.length === 0 ? (
                <EmptyState
                  icon="briefcase-outline"
                  title={strings.gigs.noGigsTitle}
                  description={strings.gigs.noGigsDesc}
                  actionTitle="Refresh"
                  onAction={loadHomeData}
                />
              ) : (
                availableGigs.slice(0, 5).map((gig) => (
                  <GigCard
                    key={gig.id}
                    gig={gig}
                    onPress={() => handleGigPress(gig.id)}
                  />
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  hero: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greetingCol: { flex: 1 },
  name: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  modePillText: { fontSize: 13, fontWeight: '700' },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  stat: { flex: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
  statValue: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
  },
  heroCtaText: { fontSize: 16, fontWeight: '800' },
  searchShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
  },
  body: { paddingHorizontal: 20, paddingTop: 20 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
  },
  bannerText: { fontSize: 14, flex: 1, lineHeight: 19, fontWeight: '500' },
  freelancersScroll: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  categoryChipsScroll: {
    paddingVertical: 4,
    paddingRight: 8,
    gap: 8,
  },
  categoryCard: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 120,
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '700',
  },
  categoryArrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  categoryHint: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyInlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  emptyInlineText: {
    fontSize: 13,
    flex: 1,
  },
});

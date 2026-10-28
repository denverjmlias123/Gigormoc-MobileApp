import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppTheme, useResponsiveLayout } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { gigsService } from '../../services/gigs';
import { GigCard, GigSummary, formatPrice } from '../../components/ui/GigCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card, AlertBox } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Skeleton, SkeletonGigList, SkeletonActivityList } from '../../components/ui/Skeleton';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { ScreenBackground } from '../../components/ui/ScreenBackground';
import { FreelancerCard } from '../../components/ui/FreelancerCard';
import { profileService, FreelancerSummary, Category, Skill } from '../../services/profile';
import { notificationsService } from '../../services/notifications';
import { applicationsService, AgreementItem, ApplicationItem } from '../../services/applications';
import { reviewsService, ReviewItem } from '../../services/reviews';
import { strings, mapSqlErrorToFriendlyMessage } from '../../constants/strings';

export default function HomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { isWide, isDesktop, topSpace } = useResponsiveLayout();
  const { user, profile } = useAuth();
  const userId = user?.id;

  const isFindWork = profile?.active_mode === 'find_work';
  const isHire = profile?.active_mode === 'hire';

  const [availableGigs, setAvailableGigs] = useState<GigSummary[]>([]);
  const [myGigs, setMyGigs] = useState<GigSummary[]>([]);
  const [topFreelancers, setTopFreelancers] = useState<FreelancerSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [myAgreements, setMyAgreements] = useState<AgreementItem[]>([]);
  const [myApplications, setMyApplications] = useState<ApplicationItem[]>([]);
  const [userSkills, setUserSkills] = useState<Skill[]>([]);
  const [myReviews, setMyReviews] = useState<ReviewItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notificationLoadError, setNotificationLoadError] = useState<string | null>(null);

  const loadHomeData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
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
        // Freelancer Dashboard Data Loading
        const [gigs, agreements, apps, skills, browseCats, revs] = await Promise.all([
          gigsService.getGigs(),
          userId ? applicationsService.getMyAgreements().catch(() => []) : Promise.resolve([]),
          userId ? applicationsService.getMyApplications().catch(() => []) : Promise.resolve([]),
          userId ? profileService.getUserSkills(userId).catch(() => []) : Promise.resolve([]),
          gigsService.getBrowseCategories().catch(() => []),
          userId ? reviewsService.getUserReviews(userId).catch(() => []) : Promise.resolve([]),
        ]);
        setAvailableGigs(gigs);
        setMyAgreements(agreements);
        setMyApplications(apps);
        setUserSkills(skills);
        setCategories(browseCats);
        setMyReviews(revs);
      }
    } catch (err: any) {
      setLoadError(mapSqlErrorToFriendlyMessage(err, 'Could not load gigs. Please check your connection and try again.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }

    // Keep notification failures separate
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
        void loadHomeData();
      });
    }, [loadHomeData, user?.id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    void loadHomeData(true);
  };

  const displayName = profile?.display_name || user?.user_metadata?.display_name || 'Ormocanon';

  // Client Computed Stats
  const openGigs = myGigs.filter((g) => ['open', 'in_progress', 'draft'].includes(g.status?.toLowerCase()));
  const completedClientGigs = myGigs.filter((g) => ['completed', 'cancelled', 'expired'].includes(g.status?.toLowerCase()));
  const openCount = myGigs.filter((g) => g.status?.toLowerCase() === 'open').length;
  const draftCount = myGigs.filter((g) => g.status?.toLowerCase() === 'draft').length;

  // Freelancer Computed Stats
  const activeAgreements = myAgreements.filter((a) => a.status === 'active');
  const completedAgreements = myAgreements.filter((a) => a.status === 'completed');
  const pendingApplications = myApplications.filter(
    (a) => a.status === 'applied' || a.status === 'countered' || a.status === 'accepted'
  );
  const acceptedApps = myApplications.filter((a) => a.status === 'accepted');
  const counteredApps = myApplications.filter((a) => a.status === 'countered');

  // Gigs matched to freelancer's skills
  const matchedGigs = availableGigs.filter((gig) => {
    if (!userSkills.length) return false;
    return userSkills.some((skill) => {
      const sName = skill.name.toLowerCase();
      return (
        (gig.category_name && gig.category_name.toLowerCase().includes(sName)) ||
        gig.title.toLowerCase().includes(sName)
      );
    });
  });

  const handleGigPress = useCallback((gigId: string) => {
    router.push({ pathname: '/gigs/[id]', params: { id: gigId } });
  }, [router]);

  const renderLoading = () => (
    isHire ? <SkeletonActivityList count={2} /> : <SkeletonGigList count={3} />
  );

  const renderFreelancerAlertsAndContracts = () => (
    <>
      {acceptedApps.length > 0 && (
        <AlertBox
          tone="success"
          title="Proposal Accepted!"
          message={`A client accepted your proposal for "${acceptedApps[0].gig?.title || 'Gig'}". Open the agreement to review terms and start work.`}
          actionLabel="View Agreement Terms ›"
          onAction={() => router.push({ pathname: '/gigs/[id]', params: { id: acceptedApps[0].gig_id } })}
          style={{ marginBottom: 14 }}
        />
      )}

      {counteredApps.length > 0 && (
        <AlertBox
          tone="info"
          title="Counter-Offer Received"
          message={`A client offered a new rate on "${counteredApps[0].gig?.title || 'Gig'}": ₱${formatPrice(counteredApps[0].counter_price || 0)}.`}
          actionLabel="Review Offer ›"
          onAction={() => router.push({ pathname: '/gigs/[id]', params: { id: counteredApps[0].gig_id } })}
          style={{ marginBottom: 14 }}
        />
      )}

      <View style={{ marginTop: 4 }}>
        <SectionHeader
          title={`Active Contracts (${activeAgreements.length})`}
          actionLabel={activeAgreements.length > 0 ? 'View activity' : undefined}
          onAction={() => router.push('/(tabs)/activity')}
        />
        {loading ? (
          renderLoading()
        ) : activeAgreements.length === 0 ? (
          <Card tone="inset" padding="md" style={styles.emptyInlineCard}>
            <Ionicons name="briefcase-outline" size={24} color={theme.colors.muted} />
            <Text style={[styles.emptyInlineText, { color: theme.colors.muted }]}>
              No active contracts in progress. Explore open gigs to submit proposals!
            </Text>
          </Card>
        ) : (
          activeAgreements.map((agr) => (
            <Card
              key={agr.id}
              tone="neo-glass"
              padding="md"
              accentPosition="left"
              accentColor={theme.colors.primary}
              style={{ marginBottom: 12, gap: 8 }}
            >
              <View style={styles.activeContractHeader}>
                <View style={[styles.contractStatusBadge, { backgroundColor: theme.colors.primarySoft }]}>
                  <View style={[styles.activePillDot, { backgroundColor: theme.colors.primary }]} />
                  <Text style={[styles.contractStatusText, { color: theme.colors.primary }]}>ACTIVE CONTRACT</Text>
                </View>
                <Text style={[styles.agreedPriceText, { color: theme.colors.primary }]}>
                  {formatPrice(agr.agreed_price)}
                </Text>
              </View>

              <Text style={[styles.contractGigTitle, { color: theme.colors.text }]}>
                {agr.gig?.title || 'Ongoing Contract'}
              </Text>

              <View style={styles.contractMetaRow}>
                <View style={styles.contractClientInfo}>
                  <Avatar
                    name={agr.client?.display_name || 'Client'}
                    imageUri={agr.client?.avatar_path}
                    size={22}
                  />
                  <Text style={[styles.contractClientName, { color: theme.colors.muted }]}>
                    {agr.client?.display_name || 'Client'}
                  </Text>
                </View>
                <Text style={[styles.contractDeadline, { color: theme.colors.muted }]}>
                  Due: {new Date(agr.deadline).toLocaleDateString()}
                </Text>
              </View>

              <View style={{ marginTop: 4 }}>
                <Button
                  title="Open Agreement & Milestones"
                  variant="soft"
                  size="sm"
                  rightIcon="chevron-forward"
                  onPress={() => router.push({ pathname: '/agreements/[id]', params: { id: agr.id } })}
                />
              </View>
            </Card>
          ))
        )}
      </View>
    </>
  );

  return (
    <ScreenBackground style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isWide && { paddingTop: 24, paddingHorizontal: 28 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Hero: Smooth gradient with active mode personality */}
        <LinearGradient
          colors={theme.gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.hero,
            { paddingTop: isWide ? 28 : topSpace + 8 },
            isWide && styles.heroWide,
          ]}
        >
          <View style={styles.heroTop}>
            <Avatar name={displayName} imageUri={profile?.avatar_path} size={46} onHero />
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
                  <View style={[styles.bellBadge, { backgroundColor: theme.colors.danger }]}>
                    <Text style={[styles.bellBadgeText, { color: theme.colors.heroText }]}>
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </Text>
                  </View>
                )}
              </Pressable>

              <Pressable
                style={[
                  styles.modePill,
                  {
                    backgroundColor: theme.colors.heroChip,
                    borderColor: 'rgba(255,255,255,0.2)',
                    borderWidth: 1,
                  },
                ]}
                onPress={() => router.push('/settings/mode')}
                accessibilityRole="button"
                accessibilityLabel="Current mode. Tap to view mode settings."
              >
                <View style={[styles.statusDot, { backgroundColor: theme.colors.roleAccent }]} />
                <Ionicons name={isHire ? 'people' : 'search'} size={14} color={theme.colors.heroText} />
                <Text style={[styles.modePillText, { color: theme.colors.heroText }]}>
                  {isFindWork ? 'Find work' : isHire ? 'Hiring' : 'Select mode'}
                </Text>
              </Pressable>
            </View>
          </View>

          {isHire ? (
            /* Client Hero Stats */
            <View style={isDesktop ? styles.heroStatsDesktopRow : undefined}>
              <View style={isDesktop ? { flex: 1 } : undefined}>
                <Text style={[theme.type.title, { color: theme.colors.heroText, marginTop: 20 }]}>
                  Your hiring at a glance
                </Text>
                <View style={styles.statRow}>
                  <View style={[styles.stat, { backgroundColor: theme.colors.heroChip }]}>
                    <Text style={[styles.statValue, { color: theme.colors.heroText }]}>{loading ? '–' : openCount}</Text>
                    <Text style={[theme.type.small, { color: theme.colors.heroMuted }]}>Open</Text>
                  </View>
                  <View style={[styles.stat, { backgroundColor: theme.colors.heroChip }]}>
                    <Text style={[styles.statValue, { color: theme.colors.heroText }]}>{loading ? '–' : draftCount}</Text>
                    <Text style={[theme.type.small, { color: theme.colors.heroMuted }]}>Drafts</Text>
                  </View>
                  <View style={[styles.stat, { backgroundColor: theme.colors.heroChip }]}>
                    <Text style={[styles.statValue, { color: theme.colors.heroText }]}>{loading ? '–' : myGigs.length}</Text>
                    <Text style={[theme.type.small, { color: theme.colors.heroMuted }]}>All gigs</Text>
                  </View>
                </View>
              </View>
              <Pressable
                style={[
                  styles.heroCta,
                  { backgroundColor: theme.colors.surface },
                  isDesktop && styles.heroCtaDesktop,
                ]}
                onPress={() => router.push('/gigs/post')}
                accessibilityRole="button"
              >
                <Ionicons name="add-circle" size={20} color={theme.colors.primary} />
                <Text style={[styles.heroCtaText, { color: theme.colors.primaryDark }]}>Post a gig</Text>
              </Pressable>
            </View>
          ) : (
            /* Freelancer Hero Stats */
            <View style={isDesktop ? styles.heroStatsDesktopRow : undefined}>
              <View style={isDesktop ? { flex: 1 } : undefined}>
                <Text style={[theme.type.title, { color: theme.colors.heroText, marginTop: 20 }]}>
                  Your freelancing at a glance
                </Text>
                <View style={styles.statRow}>
                  <View style={[styles.stat, { backgroundColor: theme.colors.heroChip }]}>
                    <Text style={[styles.statValue, { color: theme.colors.heroText }]}>{loading ? '–' : activeAgreements.length}</Text>
                    <Text style={[theme.type.small, { color: theme.colors.heroMuted }]}>Active work</Text>
                  </View>
                  <View style={[styles.stat, { backgroundColor: theme.colors.heroChip }]}>
                    <Text style={[styles.statValue, { color: theme.colors.heroText }]}>{loading ? '–' : pendingApplications.length}</Text>
                    <Text style={[theme.type.small, { color: theme.colors.heroMuted }]}>Proposals</Text>
                  </View>
                  <View style={[styles.stat, { backgroundColor: theme.colors.heroChip }]}>
                    <Text style={[styles.statValue, { color: theme.colors.heroText }]}>
                      {loading ? '–' : completedAgreements.length || profile?.freelancer_completed_gigs || 0}
                    </Text>
                    <Text style={[theme.type.small, { color: theme.colors.heroMuted }]}>Completed</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.freelancerHeroActions, isDesktop && styles.freelancerHeroActionsDesktop]}>
                <Pressable
                  style={[
                    styles.freelancerExploreBtn,
                    { backgroundColor: theme.colors.surface },
                    isDesktop && { flex: 0, paddingHorizontal: 22 },
                  ]}
                  onPress={() => router.push('/(tabs)/gigs')}
                  accessibilityRole="button"
                >
                  <Ionicons name="search" size={18} color={theme.colors.primary} />
                  <Text style={[styles.heroCtaText, { color: theme.colors.primaryDark }]}>Explore open gigs</Text>
                </Pressable>

                <Pressable
                  style={[styles.availabilityHeroPill, { backgroundColor: theme.colors.heroChip }]}
                  onPress={() => router.push('/profile/edit')}
                  accessibilityRole="button"
                >
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          profile?.availability === 'available_now' || !profile?.availability
                            ? theme.colors.success
                            : theme.colors.warning,
                      },
                    ]}
                  />
                  <Text style={[styles.availabilityText, { color: theme.colors.heroText }]}>
                    {profile?.availability === 'part_time'
                      ? 'Part-time'
                      : profile?.availability === 'weekends'
                      ? 'Weekends'
                      : profile?.availability === 'not_taking_work'
                      ? 'Busy'
                      : 'Available'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </LinearGradient>

        <View style={[styles.body, isWide && { paddingHorizontal: 0 }]}>
          {notificationLoadError && (
            <ErrorState message={notificationLoadError} onRetry={retryNotificationCount} />
          )}

          {!profile?.avatar_path && (
            <AlertBox
              tone="info"
              icon="camera-outline"
              message={
                isHire
                  ? 'Add a profile photo and hiring details to complete your client profile.'
                  : 'Add a profile photo and skills so you can apply to gigs.'
              }
              actionLabel="Complete Profile"
              onAction={() => router.push('/profile/edit')}
              style={{ marginBottom: 20 }}
            />
          )}

          {isHire ? (
            /* ==================== CLIENT DASHBOARD VIEW ==================== */
            <View style={isDesktop ? styles.desktopTwoCol : undefined}>
              {/* Left Column (Primary Active & Past Gigs) */}
              <View style={isDesktop ? styles.desktopMainCol : undefined}>
                <SectionHeader
                  title="Active & Open Gigs"
                  actionLabel={openGigs.length > 0 ? 'View all' : undefined}
                  onAction={openGigs.length > 0 ? () => router.push('/(tabs)/gigs') : undefined}
                />
                {loading ? (
                  renderLoading()
                ) : loadError ? (
                  <ErrorState message={loadError} onRetry={() => loadHomeData()} />
                ) : openGigs.length === 0 ? (
                  <EmptyState
                    icon="document-text-outline"
                    title={strings.gigs.noMyGigsTitle}
                    description={strings.gigs.noMyGigsDesc}
                    actionTitle={strings.gigs.postGig}
                    onAction={() => router.push('/gigs/post')}
                  />
                ) : (
                  <View style={isWide ? styles.cardGrid : undefined}>
                    {openGigs.map((gig) => (
                      <GigCard
                        key={gig.id}
                        gig={gig}
                        onPress={() => handleGigPress(gig.id)}
                        style={isWide ? styles.gridCardItem : undefined}
                      />
                    ))}
                  </View>
                )}

                {/* Completed & Past Gigs */}
                {completedClientGigs.length > 0 && (
                  <View style={{ marginTop: 20 }}>
                    <SectionHeader
                      title="Completed & Past Gigs"
                      actionLabel={completedClientGigs.length > 2 ? 'See all' : undefined}
                      onAction={
                        completedClientGigs.length > 2
                          ? () => router.push('/(tabs)/gigs')
                          : undefined
                      }
                    />
                    <View style={isWide ? styles.cardGrid : undefined}>
                      {completedClientGigs.slice(0, 4).map((gig) => (
                        <GigCard
                          key={gig.id}
                          gig={gig}
                          onPress={() => handleGigPress(gig.id)}
                          style={isWide ? styles.gridCardItem : undefined}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </View>

              {/* Right Column (Top Freelancers & Categories) */}
              <View style={isDesktop ? styles.desktopSideCol : undefined}>
                <View style={{ marginTop: isDesktop ? 0 : 12 }}>
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
                    <Card tone="inset" padding="md" style={styles.emptyInlineCard}>
                      <Ionicons name="people-outline" size={24} color={theme.colors.muted} />
                      <Text style={[styles.emptyInlineText, { color: theme.colors.muted }]}>
                        Freelancers will appear here once registered.
                      </Text>
                    </Card>
                  ) : isDesktop ? (
                    <View style={{ gap: 10 }}>
                      {topFreelancers.slice(0, 4).map((freelancer) => (
                        <FreelancerCard
                          key={freelancer.id}
                          freelancer={freelancer}
                          onPress={() =>
                            router.push({
                              pathname: '/profile/[id]',
                              params: { id: freelancer.id },
                            })
                          }
                        />
                      ))}
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

                {/* Browse Talent by Category */}
                {categories.length > 0 && (
                  <View style={{ marginTop: 18 }}>
                    <SectionHeader title="Browse Talent by Category" />
                    {isWide ? (
                      <View style={styles.categoryWrapGrid}>
                        {categories.slice(0, 8).map((cat) => (
                          <Card
                            key={cat.id}
                            tone="raised"
                            padding="sm"
                            style={styles.categoryCardWrapItem}
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
                          </Card>
                        ))}
                      </View>
                    ) : (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoryChipsScroll}
                      >
                        {categories.slice(0, 8).map((cat) => (
                          <Card
                            key={cat.id}
                            tone="raised"
                            padding="sm"
                            style={styles.categoryCard}
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
                          </Card>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                )}
              </View>
            </View>
          ) : (
            /* ==================== FREELANCER DASHBOARD VIEW ==================== */
            <View style={isDesktop ? styles.desktopTwoCol : undefined}>
              {/* Left Column: Matched Gigs, Categories, Available Gigs */}
              <View style={isDesktop ? styles.desktopMainCol : undefined}>
                {/* Mobile-only top alerts and active contracts */}
                {!isDesktop && renderFreelancerAlertsAndContracts()}

                {/* Gigs Matched To Your Skills */}
                {matchedGigs.length > 0 && (
                  <View style={{ marginTop: isDesktop ? 0 : 20 }}>
                    <SectionHeader
                      title={`Matched to Your Skills (${matchedGigs.length})`}
                      actionLabel="View all"
                      onAction={() => router.push('/(tabs)/gigs')}
                    />
                    <Text style={[styles.sectionSubtitle, { color: theme.colors.muted }]}>
                      Opportunities matching your skills in Ormoc
                    </Text>
                    <View style={isWide ? styles.cardGrid : undefined}>
                      {matchedGigs.slice(0, 4).map((gig) => (
                        <View
                          key={gig.id}
                          style={[styles.matchedGigWrapper, isWide && styles.gridCardItem]}
                        >
                          <View style={[styles.matchBadgeRow, { backgroundColor: theme.colors.primarySoft }]}>
                            <Ionicons name="sparkles" size={13} color={theme.colors.primary} />
                            <Text style={[styles.matchBadgeText, { color: theme.colors.primaryDark }]}>
                              Matches your profile skills
                            </Text>
                          </View>
                          <GigCard gig={gig} onPress={() => handleGigPress(gig.id)} style={{ flex: 1 }} />
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Skill Prompt Banner if freelancer has not added skills yet */}
                {userSkills.length === 0 && !loading && (
                  <Card
                    tone="role"
                    padding="md"
                    onPress={() => router.push('/profile/skills')}
                    style={styles.skillPromptCard}
                  >
                    <Ionicons name="sparkles" size={24} color={theme.colors.primary} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.skillPromptTitle, { color: theme.colors.text }]}>
                        Add your skills to get matched gigs
                      </Text>
                      <Text style={[styles.skillPromptSubtitle, { color: theme.colors.muted }]}>
                        Highlight your specialties so local Ormoc clients find you faster.
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={18} color={theme.colors.primary} />
                  </Card>
                )}

                {/* Browse Work by Category */}
                {categories.length > 0 && (
                  <View style={{ marginTop: 20 }}>
                    <SectionHeader title="Explore Work by Category" />
                    {isWide ? (
                      <View style={styles.categoryWrapGrid}>
                        {categories.slice(0, 8).map((cat) => (
                          <Card
                            key={cat.id}
                            tone="raised"
                            padding="sm"
                            style={styles.categoryCardWrapItem}
                            onPress={() =>
                              router.push({
                                pathname: '/(tabs)/gigs',
                                params: { categoryId: cat.id },
                              })
                            }
                          >
                            <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                              {cat.name}
                            </Text>
                            <View style={styles.categoryArrowRow}>
                              <Text style={[styles.categoryHint, { color: theme.colors.primary }]}>
                                View gigs
                              </Text>
                              <Ionicons
                                name="arrow-forward"
                                size={12}
                                color={theme.colors.primary}
                              />
                            </View>
                          </Card>
                        ))}
                      </View>
                    ) : (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoryChipsScroll}
                      >
                        {categories.slice(0, 8).map((cat) => (
                          <Card
                            key={cat.id}
                            tone="raised"
                            padding="sm"
                            style={styles.categoryCard}
                            onPress={() =>
                              router.push({
                                pathname: '/(tabs)/gigs',
                                params: { categoryId: cat.id },
                              })
                            }
                          >
                            <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                              {cat.name}
                            </Text>
                            <View style={styles.categoryArrowRow}>
                              <Text style={[styles.categoryHint, { color: theme.colors.primary }]}>
                                View gigs
                              </Text>
                              <Ionicons
                                name="arrow-forward"
                                size={12}
                                color={theme.colors.primary}
                              />
                            </View>
                          </Card>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                )}

                {/* All Available Gigs in Ormoc */}
                <View style={{ marginTop: 20 }}>
                  <SectionHeader
                    title={`Available Gigs in Ormoc (${availableGigs.length})`}
                    actionLabel="See all"
                    onAction={() => router.push('/(tabs)/gigs')}
                  />
                  {loading ? (
                    renderLoading()
                  ) : loadError ? (
                    <ErrorState message={loadError} onRetry={() => loadHomeData()} />
                  ) : availableGigs.length === 0 ? (
                    <EmptyState
                      icon="briefcase-outline"
                      title={strings.gigs.noGigsTitle}
                      description={strings.gigs.noGigsDesc}
                      actionTitle="Refresh"
                      onAction={() => loadHomeData()}
                    />
                  ) : (
                    <View style={isWide ? styles.cardGrid : undefined}>
                      {availableGigs.slice(0, 6).map((gig) => (
                        <GigCard
                          key={gig.id}
                          gig={gig}
                          onPress={() => handleGigPress(gig.id)}
                          style={isWide ? styles.gridCardItem : undefined}
                        />
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {/* Right Column on Desktop (or Bottom Stack on Mobile): Alerts, Active Contracts, Proposals, Reviews & Safety */}
              <View style={isDesktop ? styles.desktopSideCol : undefined}>
                {isDesktop && renderFreelancerAlertsAndContracts()}

                {/* Proposals Sent Tracker */}
                {pendingApplications.length > 0 && (
                  <View style={{ marginTop: 20 }}>
                    <SectionHeader
                      title={`Proposals Sent (${pendingApplications.length})`}
                      actionLabel="View in activity"
                      onAction={() => router.push('/(tabs)/activity')}
                    />
                    {pendingApplications.slice(0, 3).map((app) => (
                      <Card
                        key={app.id}
                        tone="neo-glass"
                        padding="md"
                        style={{ marginBottom: 10, gap: 6 }}
                        onPress={() => router.push({ pathname: '/gigs/[id]', params: { id: app.gig_id } })}
                      >
                        <View style={styles.proposalHeaderRow}>
                          <Text style={[styles.proposalGigTitle, { color: theme.colors.text }]} numberOfLines={1}>
                            {app.gig?.title || app.gig_title_snapshot || 'Gig Proposal'}
                          </Text>
                          <Badge status={app.status} />
                        </View>

                        <View style={styles.proposalMetaRow}>
                          <Text style={[styles.proposalPrice, { color: theme.colors.primary }]}>
                            Proposed: {formatPrice(app.proposed_price)}
                          </Text>
                          <Text style={[styles.proposalDate, { color: theme.colors.muted }]}>
                            Submitted: {new Date(app.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                      </Card>
                    ))}
                  </View>
                )}

                {/* Client Reviews & Feedback */}
                {myReviews.length > 0 && (
                  <View style={{ marginTop: 20 }}>
                    <SectionHeader
                      title={`Client Feedback (★ ${Number(profile?.freelancer_rating_avg || 0).toFixed(1)})`}
                      actionLabel="My profile"
                      onAction={() => user && router.push({ pathname: '/profile/[id]', params: { id: user.id } })}
                    />
                    {myReviews.slice(0, 2).map((rev) => (
                      <Card
                        key={rev.id}
                        tone="raised"
                        padding="md"
                        style={{ marginBottom: 10, gap: 8 }}
                      >
                        <View style={styles.testimonialHeader}>
                          <Avatar
                            name={rev.reviewer?.display_name || 'Client'}
                            imageUri={rev.reviewer?.avatar_path}
                            size={32}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.testimonialClientName, { color: theme.colors.text }]}>
                              {rev.reviewer?.display_name || 'Client'}
                            </Text>
                            <Text style={[styles.testimonialDate, { color: theme.colors.muted }]}>
                              {new Date(rev.created_at).toLocaleDateString()}
                            </Text>
                          </View>
                          <Text style={[styles.testimonialStars, { color: theme.colors.warning }]}>
                            {'★'.repeat(rev.rating)}
                          </Text>
                        </View>
                        {rev.comment ? (
                          <Text style={[styles.testimonialComment, { color: theme.colors.text }]}>
                            “{rev.comment}”
                          </Text>
                        ) : null}
                      </Card>
                    ))}
                  </View>
                )}

                {/* Direct Payment & Safety Guide */}
                <AlertBox
                  tone="success"
                  icon="shield-checkmark-outline"
                  title="Direct Payment & Milestone Protection"
                  message="You keep 100% of your agreed earnings. Clients pay you directly via GCash or Cash upon milestone delivery. Always record deliverables on GigOrmoc for dispute-free records."
                  style={{ marginTop: 20, marginBottom: 12 }}
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingBottom: 60,
    maxWidth: 1160,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroWide: {
    borderRadius: 28,
    paddingHorizontal: 28,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greetingCol: { flex: 1 },
  name: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modePillText: { fontSize: 13, fontWeight: '700' },
  heroStatsDesktopRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 24,
  },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  stat: { flex: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
  statValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
  },
  heroCtaDesktop: {
    paddingHorizontal: 24,
    height: 52,
    marginTop: 0,
  },
  heroCtaText: { fontSize: 15, fontWeight: '800' },
  freelancerHeroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  freelancerHeroActionsDesktop: {
    marginTop: 0,
  },
  freelancerExploreBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
  },
  availabilityHeroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 14,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  availabilityText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  body: { paddingHorizontal: 20, paddingTop: 20 },
  desktopTwoCol: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },
  desktopMainCol: {
    flex: 1.65,
  },
  desktopSideCol: {
    flex: 1,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  gridCardItem: {
    flexBasis: '48.2%',
    flexGrow: 1,
    marginBottom: 0,
  },
  freelancersScroll: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  categoryChipsScroll: {
    paddingVertical: 4,
    paddingRight: 8,
    gap: 8,
  },
  categoryWrapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    minWidth: 120,
    justifyContent: 'center',
  },
  categoryCardWrapItem: {
    flexBasis: '47%',
    flexGrow: 1,
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
    marginVertical: 4,
  },
  emptyInlineText: {
    fontSize: 13.5,
    flex: 1,
    lineHeight: 19,
  },
  activeContractHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contractStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  contractStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  agreedPriceText: {
    fontSize: 16,
    fontWeight: '800',
  },
  contractGigTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  contractMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  contractClientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contractClientName: {
    fontSize: 13,
    fontWeight: '500',
  },
  contractDeadline: {
    fontSize: 12.5,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: -8,
    marginBottom: 12,
  },
  matchedGigWrapper: {
    position: 'relative',
    marginBottom: 4,
  },
  matchBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  matchBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  skillPromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  skillPromptTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  skillPromptSubtitle: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  proposalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  proposalGigTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  proposalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  proposalPrice: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  proposalDate: {
    fontSize: 12,
  },
  testimonialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  testimonialClientName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  testimonialDate: {
    fontSize: 11.5,
  },
  testimonialStars: {
    fontSize: 14,
  },
  testimonialComment: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});

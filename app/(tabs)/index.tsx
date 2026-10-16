import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { gigsService } from '../../services/gigs';
import { GigCard, GigSummary, formatPrice } from '../../components/ui/GigCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
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

  return (
    <ScreenBackground style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero: Smooth gradient with active mode personality */}
        <LinearGradient
          colors={theme.gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
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
            /* Client Hero Stats */
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
            /* Freelancer Hero Stats */
            <>
              <Text style={[theme.type.title, { color: theme.colors.heroText, marginTop: 20 }]}>
                Your freelancing at a glance
              </Text>
              <View style={styles.statRow}>
                <View style={[styles.stat, { backgroundColor: theme.colors.heroChip }]}>
                  <Text style={styles.statValue}>{loading ? '–' : activeAgreements.length}</Text>
                  <Text style={[theme.type.small, { color: theme.colors.heroMuted }]}>Active work</Text>
                </View>
                <View style={[styles.stat, { backgroundColor: theme.colors.heroChip }]}>
                  <Text style={styles.statValue}>{loading ? '–' : pendingApplications.length}</Text>
                  <Text style={[theme.type.small, { color: theme.colors.heroMuted }]}>Proposals</Text>
                </View>
                <View style={[styles.stat, { backgroundColor: theme.colors.heroChip }]}>
                  <Text style={styles.statValue}>
                    {loading ? '–' : completedAgreements.length || profile?.freelancer_completed_gigs || 0}
                  </Text>
                  <Text style={[theme.type.small, { color: theme.colors.heroMuted }]}>Completed</Text>
                </View>
              </View>

              <View style={styles.freelancerHeroActions}>
                <Pressable
                  style={styles.freelancerExploreBtn}
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
                            ? '#10B981'
                            : '#F59E0B',
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
            </>
          )}
        </LinearGradient>

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
            /* ==================== CLIENT DASHBOARD VIEW ==================== */
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
                        backgroundColor: '#FFFFFF',
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
                            backgroundColor: '#FFFFFF',
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
              {completedClientGigs.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <SectionHeader
                    title="Completed & Past Gigs"
                    actionLabel={completedClientGigs.length > 2 ? 'See all' : undefined}
                    onAction={
                      completedClientGigs.length > 2
                        ? () => router.push('/(tabs)/gigs')
                        : undefined
                    }
                  />
                  {completedClientGigs.slice(0, 3).map((gig) => (
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
            /* ==================== FREELANCER DASHBOARD VIEW ==================== */
            <View>
              {/* 1. Actionable Alerts Hub */}
              {acceptedApps.length > 0 && (
                <View style={[styles.alertBanner, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                  <View style={styles.alertHeader}>
                    <Ionicons name="checkmark-circle" size={20} color="#059669" />
                    <Text style={[styles.alertTitle, { color: '#065F46' }]}>Proposal Accepted!</Text>
                  </View>
                  <Text style={[styles.alertDesc, { color: '#166534' }]}>
                    A client accepted your proposal for "{acceptedApps[0].gig?.title || 'Gig'}". Open the agreement to review terms and start work.
                  </Text>
                  <TouchableOpacity
                    style={[styles.alertBtn, { backgroundColor: '#059669' }]}
                    onPress={() => router.push({ pathname: '/gigs/[id]', params: { id: acceptedApps[0].gig_id } })}
                  >
                    <Text style={styles.alertBtnText}>View Agreement Terms ›</Text>
                  </TouchableOpacity>
                </View>
              )}

              {counteredApps.length > 0 && (
                <View style={[styles.alertBanner, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <View style={styles.alertHeader}>
                    <Ionicons name="chatbubble-ellipses" size={20} color="#2563EB" />
                    <Text style={[styles.alertTitle, { color: '#1E40AF' }]}>Counter-Offer Received</Text>
                  </View>
                  <Text style={[styles.alertDesc, { color: '#1E3A8A' }]}>
                    A client offered a new rate on "{counteredApps[0].gig?.title || 'Gig'}": ₱{formatPrice(counteredApps[0].counter_price || 0)}.
                  </Text>
                  <TouchableOpacity
                    style={[styles.alertBtn, { backgroundColor: '#2563EB' }]}
                    onPress={() => router.push({ pathname: '/gigs/[id]', params: { id: counteredApps[0].gig_id } })}
                  >
                    <Text style={styles.alertBtnText}>Review Offer ›</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* 2. Active Contracts In Progress */}
              <View style={{ marginTop: 4 }}>
                <SectionHeader
                  title={`Active Contracts In Progress (${activeAgreements.length})`}
                  actionLabel={activeAgreements.length > 0 ? 'View activity' : undefined}
                  onAction={() => router.push('/(tabs)/activity')}
                />
                {loading ? (
                  renderLoading()
                ) : activeAgreements.length === 0 ? (
                  <View
                    style={[
                      styles.emptyInlineCard,
                      { backgroundColor: '#FFFFFF', borderColor: theme.colors.border },
                    ]}
                  >
                    <Ionicons name="briefcase-outline" size={24} color={theme.colors.muted} />
                    <Text style={[styles.emptyInlineText, { color: theme.colors.muted }]}>
                      No active contracts in progress. Explore open gigs below to submit proposals!
                    </Text>
                  </View>
                ) : (
                  activeAgreements.map((agr) => (
                    <View
                      key={agr.id}
                      style={[
                        styles.activeContractCard,
                        { backgroundColor: '#FFFFFF', borderColor: theme.colors.border },
                      ]}
                    >
                      <View style={styles.activeContractHeader}>
                        <View style={styles.contractStatusBadge}>
                          <View style={styles.activePillDot} />
                          <Text style={styles.contractStatusText}>ACTIVE CONTRACT</Text>
                        </View>
                        <Text style={[styles.agreedPriceText, { color: theme.colors.primary }]}>
                          ₱{formatPrice(agr.agreed_price)}
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

                      <TouchableOpacity
                        style={[styles.viewAgreementBtn, { borderColor: theme.colors.border }]}
                        onPress={() => router.push({ pathname: '/agreements/[id]', params: { id: agr.id } })}
                      >
                        <Text style={[styles.viewAgreementText, { color: theme.colors.primary }]}>
                          Open Agreement & Milestones ›
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>

              {/* 3. Gigs Matched To Your Skills */}
              {matchedGigs.length > 0 && (
                <View style={{ marginTop: 20 }}>
                  <SectionHeader
                    title={`Matched to Your Skills (${matchedGigs.length})`}
                    actionLabel="View all"
                    onAction={() => router.push('/(tabs)/gigs')}
                  />
                  <Text style={[styles.sectionSubtitle, { color: theme.colors.muted }]}>
                    Opportunities matching your skills in Ormoc
                  </Text>
                  {matchedGigs.slice(0, 3).map((gig) => (
                    <View key={gig.id} style={styles.matchedGigWrapper}>
                      <View style={styles.matchBadgeRow}>
                        <Ionicons name="sparkles" size={13} color="#2563EB" />
                        <Text style={styles.matchBadgeText}>Matches your profile skills</Text>
                      </View>
                      <GigCard gig={gig} onPress={() => handleGigPress(gig.id)} />
                    </View>
                  ))}
                </View>
              )}

              {/* Skill Prompt Banner if freelancer has not added skills yet */}
              {userSkills.length === 0 && !loading && (
                <Pressable
                  style={[styles.skillPromptCard, { backgroundColor: '#FFFFFF', borderColor: '#DBEAFE' }]}
                  onPress={() => router.push('/profile/skills')}
                >
                  <Ionicons name="sparkles" size={24} color="#2563EB" />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.skillPromptTitle, { color: theme.colors.text }]}>
                      Add your skills to get matched gigs
                    </Text>
                    <Text style={[styles.skillPromptSubtitle, { color: theme.colors.muted }]}>
                      Highlight your specialties so local Ormoc clients find you faster.
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward" size={18} color="#2563EB" />
                </Pressable>
              )}

              {/* 4. Browse Work by Category */}
              {categories.length > 0 && (
                <View style={{ marginTop: 20 }}>
                  <SectionHeader title="Explore Work by Category" />
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
                            backgroundColor: '#FFFFFF',
                            borderColor: theme.colors.border,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}
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
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* 5. All Available Gigs in Ormoc */}
              <View style={{ marginTop: 20 }}>
                <SectionHeader
                  title={`Available Gigs in Ormoc (${availableGigs.length})`}
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

              {/* 6. Proposals Sent Tracker */}
              {pendingApplications.length > 0 && (
                <View style={{ marginTop: 20 }}>
                  <SectionHeader
                    title={`Proposals Sent (${pendingApplications.length})`}
                    actionLabel="View in activity"
                    onAction={() => router.push('/(tabs)/activity')}
                  />
                  {pendingApplications.slice(0, 3).map((app) => (
                    <TouchableOpacity
                      key={app.id}
                      style={[
                        styles.proposalCard,
                        { backgroundColor: '#FFFFFF', borderColor: theme.colors.border },
                      ]}
                      onPress={() => router.push({ pathname: '/gigs/[id]', params: { id: app.gig_id } })}
                    >
                      <View style={styles.proposalHeaderRow}>
                        <Text style={[styles.proposalGigTitle, { color: theme.colors.text }]} numberOfLines={1}>
                          {app.gig?.title || app.gig_title_snapshot || 'Gig Proposal'}
                        </Text>
                        <View
                          style={[
                            styles.proposalStatusChip,
                            {
                              backgroundColor:
                                app.status === 'accepted'
                                  ? '#DCFCE7'
                                  : app.status === 'countered'
                                  ? '#DBEAFE'
                                  : '#FEF3C7',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.proposalStatusChipText,
                              {
                                color:
                                  app.status === 'accepted'
                                    ? '#166534'
                                    : app.status === 'countered'
                                    ? '#1E40AF'
                                    : '#92400E',
                              },
                            ]}
                          >
                            {app.status === 'accepted'
                              ? 'Accepted'
                              : app.status === 'countered'
                              ? 'Counter-Offer'
                              : 'Under Review'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.proposalMetaRow}>
                        <Text style={[styles.proposalPrice, { color: theme.colors.primary }]}>
                          Proposed: ₱{formatPrice(app.proposed_price)}
                        </Text>
                        <Text style={[styles.proposalDate, { color: theme.colors.muted }]}>
                          Submitted: {new Date(app.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* 7. Client Reviews & Feedback */}
              {myReviews.length > 0 && (
                <View style={{ marginTop: 20 }}>
                  <SectionHeader
                    title={`Client Feedback (★ ${Number(profile?.freelancer_rating_avg || 0).toFixed(1)})`}
                    actionLabel="My profile"
                    onAction={() => user && router.push({ pathname: '/profile/[id]', params: { id: user.id } })}
                  />
                  {myReviews.slice(0, 2).map((rev) => (
                    <View
                      key={rev.id}
                      style={[
                        styles.testimonialCard,
                        { backgroundColor: '#FFFFFF', borderColor: theme.colors.border },
                      ]}
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
                        <Text style={styles.testimonialStars}>{'★'.repeat(rev.rating)}</Text>
                      </View>
                      {rev.comment ? (
                        <Text style={[styles.testimonialComment, { color: theme.colors.text }]}>
                          “{rev.comment}”
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}

              {/* 8. Direct Payment & Safety Guide */}
              <View style={[styles.safetyCard, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
                <Ionicons name="shield-checkmark-outline" size={24} color="#059669" />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.safetyTitle, { color: theme.colors.text }]}>
                    Direct Payment & Milestone Protection
                  </Text>
                  <Text style={[styles.safetyText, { color: theme.colors.muted }]}>
                    You keep 100% of your agreed earnings. Clients pay you directly via GCash or Cash upon milestone delivery. Always record deliverables on GigOrmoc for dispute-free records.
                  </Text>
                </View>
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
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
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
  heroCtaText: { fontSize: 15, fontWeight: '800' },
  freelancerHeroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  freelancerExploreBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
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
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 4,
  },
  emptyInlineText: {
    fontSize: 13.5,
    flex: 1,
    lineHeight: 19,
  },
  alertBanner: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  alertDesc: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  alertBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  alertBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  activeContractCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
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
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  contractStatusText: {
    color: '#2563EB',
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
  viewAgreementBtn: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    marginTop: 4,
    alignItems: 'center',
  },
  viewAgreementText: {
    fontSize: 13.5,
    fontWeight: '700',
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
    backgroundColor: '#EFF6FF',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  matchBadgeText: {
    color: '#1E40AF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  skillPromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
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
  proposalCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 6,
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
  proposalStatusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  proposalStatusChipText: {
    fontSize: 11,
    fontWeight: '700',
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
  testimonialCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 8,
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
    color: '#EAB308',
    fontSize: 14,
  },
  testimonialComment: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    marginBottom: 12,
  },
  safetyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  safetyText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
});

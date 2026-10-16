import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../theme';
import { Avatar } from '../../components/ui/Avatar';
import { ProfileCompleteBadge } from '../../components/ui/ProfileCompleteness';
import { ScreenBackground } from '../../components/ui/ScreenBackground';
import { profileService, PublicProfileData } from '../../services/profile';
import { reviewsService, ReviewItem } from '../../services/reviews';
import { strings } from '../../constants/strings';

export default function PublicProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [data, setData] = useState<PublicProfileData | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const [res, revList] = await Promise.all([
          profileService.getPublicProfile(id),
          reviewsService.getUserReviews(id),
        ]);
        if (mounted) {
          if (!res) {
            setError('Profile not found.');
          } else {
            setData(res);
            setReviews(revList);
          }
        }
      } catch (err: any) {
        if (mounted) setError(err?.message || 'Could not load profile.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      mounted = false;
    };
  }, [id, loadAttempt]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  };

  if (loading) {
    return (
      <ScreenBackground style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </ScreenBackground>
    );
  }

  if (error || !data) {
    return (
      <ScreenBackground style={styles.centerContainer}>
        <View style={[styles.errorCard, { backgroundColor: theme.colors.surface, borderColor: theme.glass.border }, theme.shadow.card]}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.dangerText} style={{ marginBottom: 12 }} />
          <Text style={[styles.errorTitle, { color: theme.colors.text }]}>Unable to load profile</Text>
          <Text style={[styles.errorDesc, { color: theme.colors.muted }]}>{error || 'Profile not found.'}</Text>
          <View style={styles.errorActionsRow}>
            {error ? (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => setLoadAttempt((attempt) => attempt + 1)}
              >
                <Text style={styles.actionBtnTextPrimary}>{strings.common.retry}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.actionBtnSecondary, { borderColor: theme.colors.border }]}
              onPress={handleBack}
            >
              <Text style={[styles.actionBtnTextSecondary, { color: theme.colors.text }]}>← Go back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScreenBackground>
    );
  }

  const { profile, skills, portfolioItems, hiringInterests, gigsPostedCount, completeness } = data;
  const isHire = profile.active_mode === 'hire';

  const availabilityOption = strings.profile.availabilityOptions.find(
    (o) => o.value === profile.availability
  );
  const availabilityLabel = availabilityOption?.label;

  const experienceLabel = strings.profile.experienceOptions.find(
    (o) => o.value === profile.experience_years
  )?.label;

  const clientTypeLabel = strings.profile.clientTypeOptions.find(
    (o) => o.value === profile.client_type
  )?.label;

  // Format availability indicator colors
  const getAvailabilityStatus = (val?: string | null) => {
    switch (val) {
      case 'available_now':
        return { color: '#10B981', label: availabilityLabel || 'Available now' };
      case 'part_time':
        return { color: '#F59E0B', label: availabilityLabel || 'Part-time' };
      case 'weekends':
        return { color: '#6366F1', label: availabilityLabel || 'Weekends' };
      case 'not_taking_work':
        return { color: '#9CA3AF', label: availabilityLabel || 'Busy' };
      default:
        return null;
    }
  };

  const availInfo = getAvailabilityStatus(profile.availability);

  // Gradient themes for cover banner
  const coverGradients: [string, string, string] = isHire
    ? ['#1E293B', '#1E3A8A', '#2563EB'] // Executive client indigo/navy
    : ['#064E3B', '#065F46', '#059669']; // Vibrant creative emerald

  return (
    <ScreenBackground style={styles.container}>
      {/* Top Navigation Bar */}
      <View style={styles.topNavWrapper}>
        <View style={styles.topNavContent}>
          <TouchableOpacity
            style={[
              styles.navBackBtn,
              { backgroundColor: theme.colors.surface, borderColor: theme.glass.border },
              theme.shadow.card,
            ]}
            onPress={handleBack}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={18} color={theme.colors.text} />
            <Text style={[styles.navBackText, { color: theme.colors.text }]}>Back</Text>
          </TouchableOpacity>

          <View style={styles.navTitleContainer}>
            <Text style={[styles.navHeaderTitle, { color: theme.colors.text }]}>
              {isHire ? 'Client Profile' : 'Freelancer Profile'}
            </Text>
          </View>

          <View style={styles.navPlaceholder} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainWrapper}>
          {/* Hero Profile Card */}
          <View
            style={[
              styles.heroCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.glass.border },
              theme.shadow.neoGlass,
            ]}
          >
            {/* Cover Banner */}
            <LinearGradient
              colors={coverGradients}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCover}
            >
              <View style={styles.heroCoverOverlay}>
                <View style={styles.heroCoverBadge}>
                  <Ionicons
                    name={isHire ? 'briefcase' : 'sparkles'}
                    size={12}
                    color="#FFFFFF"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.heroCoverBadgeText}>
                    {isHire ? 'Client Account' : 'Freelancer Pro'}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {/* Profile Identity Area */}
            <View style={styles.heroBody}>
              <View style={styles.avatarOverlapContainer}>
                <View style={[styles.avatarRing, { borderColor: theme.colors.surface }]}>
                  <Avatar
                    name={profile.display_name || 'User'}
                    imageUri={profile.avatar_path}
                    size={84}
                  />
                </View>
              </View>

              <View style={styles.identityDetails}>
                <View style={styles.nameBadgeRow}>
                  <Text style={[styles.displayName, { color: theme.colors.text }]}>
                    {profile.display_name || 'Anonymous User'}
                  </Text>
                  {completeness?.complete ? <ProfileCompleteBadge /> : null}
                </View>

                {/* Role Specific Headline / Business */}
                {!isHire && profile.headline ? (
                  <Text style={[styles.headlineText, { color: theme.colors.text }]}>
                    {profile.headline}
                  </Text>
                ) : null}

                {isHire && profile.business_name ? (
                  <View style={styles.businessBadge}>
                    <Ionicons name="business" size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.businessNameText, { color: theme.colors.text }]}>
                      {profile.business_name}
                    </Text>
                  </View>
                ) : null}

                {/* Location and Availability Row */}
                <View style={styles.locationAvailRow}>
                  {profile.area ? (
                    <View style={styles.locationChip}>
                      <Ionicons name="location-sharp" size={14} color={theme.colors.primary} />
                      <Text style={[styles.areaText, { color: theme.colors.muted }]}>{profile.area}</Text>
                    </View>
                  ) : null}

                  {!isHire && availInfo ? (
                    <View style={[styles.availChip, { backgroundColor: `${availInfo.color}15`, borderColor: `${availInfo.color}40` }]}>
                      <View style={[styles.availDot, { backgroundColor: availInfo.color }]} />
                      <Text style={[styles.availText, { color: availInfo.color }]}>{availInfo.label}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Key Metrics / Stat Counter Bar */}
            <View style={[styles.metricsContainer, { borderTopColor: theme.colors.border, backgroundColor: '#F8FAFC' }]}>
              {isHire ? (
                <>
                  <View style={styles.metricColumn}>
                    <Text style={[styles.metricValue, { color: theme.colors.text }]}>
                      ★ {Number(profile.client_rating_avg || 0).toFixed(1)}
                    </Text>
                    <Text style={[styles.metricLabel, { color: theme.colors.muted }]}>
                      Client: ★ {Number(profile.client_rating_avg || 0).toFixed(1)} ({profile.client_rating_count || 0})
                    </Text>
                  </View>

                  <View style={[styles.metricDivider, { backgroundColor: theme.colors.border }]} />

                  <View style={styles.metricColumn}>
                    <Text style={[styles.metricValue, { color: theme.colors.text }]}>
                      {gigsPostedCount || 0}
                    </Text>
                    <Text style={[styles.metricLabel, { color: theme.colors.muted }]}>
                      {gigsPostedCount || 0} gigs posted
                    </Text>
                  </View>

                  <View style={[styles.metricDivider, { backgroundColor: theme.colors.border }]} />

                  <View style={styles.metricColumn}>
                    <Text style={[styles.metricValue, { color: theme.colors.text }]}>
                      {profile.client_completed_gigs || 0}
                    </Text>
                    <Text style={[styles.metricLabel, { color: theme.colors.muted }]}>
                      {profile.client_completed_gigs || 0} completed as client
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.metricColumn}>
                    <Text style={[styles.metricValue, { color: theme.colors.text }]}>
                      ★ {Number(profile.freelancer_rating_avg || 0).toFixed(1)}
                    </Text>
                    <Text style={[styles.metricLabel, { color: theme.colors.muted }]}>
                      Freelancer: ★ {Number(profile.freelancer_rating_avg || 0).toFixed(1)} ({profile.freelancer_rating_count || 0})
                    </Text>
                  </View>

                  <View style={[styles.metricDivider, { backgroundColor: theme.colors.border }]} />

                  <View style={styles.metricColumn}>
                    <Text style={[styles.metricValue, { color: theme.colors.text }]}>
                      {profile.freelancer_completed_gigs || 0}
                    </Text>
                    <Text style={[styles.metricLabel, { color: theme.colors.muted }]}>
                      {profile.freelancer_completed_gigs || 0} gigs completed
                    </Text>
                  </View>

                  <View style={[styles.metricDivider, { backgroundColor: theme.colors.border }]} />

                  <View style={styles.metricColumn}>
                    <Text style={[styles.metricValue, { color: theme.colors.text }]}>
                      {experienceLabel ? experienceLabel.split(' ')[0] : 'Pro'}
                    </Text>
                    <Text style={[styles.metricLabel, { color: theme.colors.muted }]}>
                      {experienceLabel || 'Experience'}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Cross-role rating note if active in both roles */}
            {isHire && (profile.freelancer_completed_gigs || 0) > 0 ? (
              <View style={[styles.crossRoleNote, { borderTopColor: theme.colors.border }]}>
                <Ionicons name="information-circle-outline" size={14} color={theme.colors.muted} />
                <Text style={[styles.crossRoleText, { color: theme.colors.muted }]}>
                  Also active as Freelancer: ★ {Number(profile.freelancer_rating_avg || 0).toFixed(1)} ({profile.freelancer_completed_gigs} completed)
                </Text>
              </View>
            ) : !isHire && (profile.client_completed_gigs || 0) > 0 ? (
              <View style={[styles.crossRoleNote, { borderTopColor: theme.colors.border }]}>
                <Ionicons name="information-circle-outline" size={14} color={theme.colors.muted} />
                <Text style={[styles.crossRoleText, { color: theme.colors.muted }]}>
                  Client: ★ {Number(profile.client_rating_avg || 0).toFixed(1)} ({profile.client_rating_count || 0}) • {profile.client_completed_gigs || 0} gigs
                </Text>
              </View>
            ) : null}
          </View>

          {/* About Section Card */}
          {profile.bio || (isHire && profile.about_hiring) ? (
            <View
              style={[
                styles.contentCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.glass.border },
                theme.shadow.card,
              ]}
            >
              <View style={styles.cardHeader}>
                <Ionicons name="person-circle-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                  {isHire ? 'About the Client' : 'About'}
                </Text>
              </View>

              {profile.bio ? (
                <Text style={[styles.bioText, { color: theme.colors.text }]}>
                  {profile.bio}
                </Text>
              ) : null}

              {isHire && profile.about_hiring ? (
                <View style={[styles.highlightBox, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}>
                  <View style={styles.highlightHeader}>
                    <Ionicons name="bulb-outline" size={16} color="#0284C7" />
                    <Text style={[styles.highlightTitle, { color: '#0369A1' }]}>
                      What we usually hire for:
                    </Text>
                  </View>
                  <Text style={[styles.highlightContent, { color: '#0C4A6E' }]}>
                    {profile.about_hiring}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Profile Details & Overview Card */}
          <View
            style={[
              styles.contentCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.glass.border },
              theme.shadow.card,
            ]}
          >
            <View style={styles.cardHeader}>
              <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                {isHire ? 'Client Details' : 'Key Specifications'}
              </Text>
            </View>

            <View style={styles.detailsGrid}>
              {/* Client specific details */}
              {isHire && clientTypeLabel ? (
                <View style={[styles.detailRow, { borderBottomColor: theme.colors.border }]}>
                  <View style={styles.detailKeyWrap}>
                    <Ionicons name="business-outline" size={16} color={theme.colors.muted} />
                    <Text style={[styles.detailKey, { color: theme.colors.muted }]}>Client type:</Text>
                  </View>
                  <Text style={[styles.detailVal, { color: theme.colors.text }]}>{clientTypeLabel}</Text>
                </View>
              ) : null}

              {isHire && profile.business_name ? (
                <View style={[styles.detailRow, { borderBottomColor: theme.colors.border }]}>
                  <View style={styles.detailKeyWrap}>
                    <Ionicons name="storefront-outline" size={16} color={theme.colors.muted} />
                    <Text style={[styles.detailKey, { color: theme.colors.muted }]}>Business / Organization:</Text>
                  </View>
                  <Text style={[styles.detailVal, { color: theme.colors.text }]}>{profile.business_name}</Text>
                </View>
              ) : null}

              {isHire ? (
                <View style={[styles.detailRow, { borderBottomColor: theme.colors.border }]}>
                  <View style={styles.detailKeyWrap}>
                    <Ionicons name="layers-outline" size={16} color={theme.colors.muted} />
                    <Text style={[styles.detailKey, { color: theme.colors.muted }]}>Gigs posted:</Text>
                  </View>
                  <Text style={[styles.detailVal, { color: theme.colors.text }]}>{gigsPostedCount || 0} gigs posted</Text>
                </View>
              ) : null}

              {/* Freelancer specific details */}
              {!isHire && availabilityLabel ? (
                <View style={[styles.detailRow, { borderBottomColor: theme.colors.border }]}>
                  <View style={styles.detailKeyWrap}>
                    <Ionicons name="time-outline" size={16} color={theme.colors.muted} />
                    <Text style={[styles.detailKey, { color: theme.colors.muted }]}>Availability:</Text>
                  </View>
                  <Text style={[styles.detailVal, { color: theme.colors.text }]}>{availabilityLabel}</Text>
                </View>
              ) : null}

              {!isHire && experienceLabel ? (
                <View style={[styles.detailRow, { borderBottomColor: theme.colors.border }]}>
                  <View style={styles.detailKeyWrap}>
                    <Ionicons name="ribbon-outline" size={16} color={theme.colors.muted} />
                    <Text style={[styles.detailKey, { color: theme.colors.muted }]}>Experience:</Text>
                  </View>
                  <Text style={[styles.detailVal, { color: theme.colors.text }]}>{experienceLabel}</Text>
                </View>
              ) : null}

              {!isHire && profile.work_types && profile.work_types.length > 0 ? (
                <View style={[styles.detailRow, { borderBottomColor: theme.colors.border }]}>
                  <View style={styles.detailKeyWrap}>
                    <Ionicons name="laptop-outline" size={16} color={theme.colors.muted} />
                    <Text style={[styles.detailKey, { color: theme.colors.muted }]}>Work types:</Text>
                  </View>
                  <Text style={[styles.detailVal, { color: theme.colors.text }]}>
                    {profile.work_types
                      .map(
                        (wt) =>
                          strings.profile.workTypeOptions.find((o) => o.value === wt)?.label || wt
                      )
                      .join(', ')}
                  </Text>
                </View>
              ) : null}

              {!isHire && profile.starting_rate_note ? (
                <View style={[styles.detailRow, { borderBottomColor: theme.colors.border }]}>
                  <View style={styles.detailKeyWrap}>
                    <Ionicons name="pricetag-outline" size={16} color={theme.colors.muted} />
                    <Text style={[styles.detailKey, { color: theme.colors.muted }]}>Starting rate note:</Text>
                  </View>
                  <Text style={[styles.detailVal, { color: theme.colors.text }]}>{profile.starting_rate_note}</Text>
                </View>
              ) : null}

              {/* Shared details */}
              {profile.languages && profile.languages.length > 0 ? (
                <View style={[styles.detailRow, { borderBottomColor: theme.colors.border }]}>
                  <View style={styles.detailKeyWrap}>
                    <Ionicons name="globe-outline" size={16} color={theme.colors.muted} />
                    <Text style={[styles.detailKey, { color: theme.colors.muted }]}>Languages:</Text>
                  </View>
                  <Text style={[styles.detailVal, { color: theme.colors.text }]}>{profile.languages.join(', ')}</Text>
                </View>
              ) : null}

              {profile.preferred_contact ? (
                <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                  <View style={styles.detailKeyWrap}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.colors.muted} />
                    <Text style={[styles.detailKey, { color: theme.colors.muted }]}>Preferred contact:</Text>
                  </View>
                  <Text style={[styles.detailVal, { color: theme.colors.text }]}>{profile.preferred_contact}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Hiring Interests Section (shown for clients) */}
          {isHire ? (
            <View
              style={[
                styles.contentCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.glass.border },
                theme.shadow.card,
              ]}
            >
              <View style={styles.cardHeader}>
                <Ionicons name="sparkles-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                  Hiring Interests
                </Text>
              </View>

              {!hiringInterests || hiringInterests.length === 0 ? (
                <Text style={[styles.emptyNote, { color: theme.colors.muted }]}>
                  No hiring interests specified yet.
                </Text>
              ) : (
                <View style={styles.skillsGrid}>
                  {hiringInterests.map((cat) => (
                    <View
                      key={cat.id}
                      style={[
                        styles.interestChip,
                        { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
                      ]}
                    >
                      <Ionicons name="checkmark-circle" size={14} color="#2563EB" style={{ marginRight: 6 }} />
                      <Text style={[styles.interestChipText, { color: '#1E40AF' }]}>
                        {cat.name}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {/* Skills Section (shown for freelancers only) */}
          {!isHire ? (
            <View
              style={[
                styles.contentCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.glass.border },
                theme.shadow.card,
              ]}
            >
              <View style={styles.cardHeader}>
                <Ionicons name="construct-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                  Skills & Expertise
                </Text>
              </View>

              {skills.length === 0 ? (
                <Text style={[styles.emptyNote, { color: theme.colors.muted }]}>
                  No skills specified yet.
                </Text>
              ) : (
                <View style={styles.skillsGrid}>
                  {skills.map((skill) => (
                    <View
                      key={skill.id}
                      style={[
                        styles.skillChip,
                        { borderColor: '#D1FAE5', backgroundColor: '#ECFDF5' },
                      ]}
                    >
                      <Ionicons name="star" size={12} color="#059669" style={{ marginRight: 6 }} />
                      <Text style={[styles.skillChipText, { color: '#065F46' }]}>
                        {skill.name}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {/* Portfolio Section (shown for freelancers only) */}
          {!isHire ? (
            <View
              style={[
                styles.contentCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.glass.border },
                theme.shadow.card,
              ]}
            >
              <View style={styles.cardHeader}>
                <Ionicons name="images-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                  Portfolio ({portfolioItems.length})
                </Text>
              </View>

              {portfolioItems.length === 0 ? (
                <Text style={[styles.emptyNote, { color: theme.colors.muted }]}>
                  No portfolio items published yet.
                </Text>
              ) : (
                <View style={styles.portfolioList}>
                  {portfolioItems.map((item) => (
                    <View
                      key={item.id}
                      style={[
                        styles.portfolioCard,
                        { borderColor: theme.colors.border, backgroundColor: '#FAFAFA' },
                      ]}
                    >
                      <Text style={[styles.portfolioTitle, { color: theme.colors.text }]}>
                        {item.title}
                      </Text>
                      {item.description ? (
                        <Text style={[styles.portfolioDesc, { color: theme.colors.muted }]}>
                          {item.description}
                        </Text>
                      ) : null}
                      {item.file_paths && item.file_paths.length > 0 ? (
                        <View style={styles.portfolioFiles}>
                          {item.file_paths.map((f, idx) => (
                            <Image
                              key={idx}
                              source={{ uri: f }}
                              style={styles.portfolioThumb}
                              resizeMode="cover"
                            />
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {/* Reviews Section */}
          <View
            style={[
              styles.contentCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.glass.border },
              theme.shadow.card,
            ]}
          >
            <View style={styles.cardHeader}>
              <Ionicons name="star" size={20} color="#F59E0B" />
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                Reviews & Ratings ({reviews.length})
              </Text>
            </View>

            {reviews.length === 0 ? (
              <View style={styles.emptyReviewsBox}>
                <Ionicons name="chatbubbles-outline" size={32} color={theme.colors.muted} style={{ opacity: 0.5, marginBottom: 6 }} />
                <Text style={[styles.emptyNote, { color: theme.colors.muted }]}>
                  No reviews received yet.
                </Text>
              </View>
            ) : (
              <View style={styles.reviewsList}>
                {reviews.map((rev) => (
                  <View
                    key={rev.id}
                    style={[
                      styles.reviewCard,
                      { borderColor: theme.colors.border, backgroundColor: '#F8FAFC' },
                    ]}
                  >
                    <View style={styles.reviewCardHeader}>
                      <View style={styles.reviewerMetaRow}>
                        <Avatar
                          name={rev.reviewer?.display_name || 'Anonymous User'}
                          imageUri={rev.reviewer?.avatar_path}
                          size={36}
                        />
                        <View style={styles.reviewerDetails}>
                          <Text style={[styles.reviewerDisplayName, { color: theme.colors.text }]}>
                            {rev.reviewer?.display_name || 'Anonymous User'}
                          </Text>
                          <Text style={[styles.reviewDateText, { color: theme.colors.muted }]}>
                            {new Date(rev.created_at).toLocaleDateString()} • As {rev.role}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.starRatingBadge}>
                        <Text style={[styles.reviewStarsText, { color: '#F59E0B' }]}>
                          {'★'.repeat(rev.rating)}
                          {'☆'.repeat(Math.max(0, 5 - rev.rating))}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.reviewCommentText, { color: theme.colors.text }]}>
                      "{rev.comment}"
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  errorDesc: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnTextPrimary: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  actionBtnSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnTextSecondary: {
    fontWeight: '600',
    fontSize: 14,
  },
  topNavWrapper: {
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  topNavContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
  },
  navBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  navBackText: {
    fontSize: 14,
    fontWeight: '600',
  },
  navTitleContainer: {
    alignItems: 'center',
  },
  navHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  navPlaceholder: {
    width: 60,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  mainWrapper: {
    width: '100%',
    maxWidth: 780,
    alignSelf: 'center',
    gap: 16,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroCover: {
    height: 110,
    width: '100%',
    justifyContent: 'flex-start',
    padding: 12,
  },
  heroCoverOverlay: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  heroCoverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroCoverBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  heroBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  avatarOverlapContainer: {
    marginTop: -44,
    marginBottom: 12,
    flexDirection: 'row',
  },
  avatarRing: {
    borderWidth: 3.5,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  identityDetails: {
    gap: 4,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headlineText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  businessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  businessNameText: {
    fontSize: 15,
    fontWeight: '700',
  },
  locationAvailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  areaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  availChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  availDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  availText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  metricColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  metricDivider: {
    width: 1,
    height: 28,
  },
  crossRoleNote: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
    backgroundColor: '#F8FAFC',
  },
  crossRoleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  contentCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  bioText: {
    fontSize: 14,
    lineHeight: 22,
  },
  highlightBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  highlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  highlightTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  highlightContent: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  detailsGrid: {
    gap: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailKeyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailKey: {
    fontSize: 13,
    fontWeight: '500',
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
    marginLeft: 12,
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  skillChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  interestChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyNote: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  emptyReviewsBox: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  portfolioList: {
    gap: 14,
  },
  portfolioCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  portfolioTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  portfolioDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  portfolioFiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  portfolioThumb: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  reviewsList: {
    gap: 12,
  },
  reviewCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  reviewerDetails: {
    flex: 1,
  },
  reviewerDisplayName: {
    fontSize: 14,
    fontWeight: '700',
  },
  reviewDateText: {
    fontSize: 11,
    marginTop: 1,
  },
  starRatingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
  },
  reviewStarsText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reviewCommentText: {
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});

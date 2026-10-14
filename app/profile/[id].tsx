import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../theme';
import { Avatar } from '../../components/ui/Avatar';
import { ProfileCompleteBadge } from '../../components/ui/ProfileCompleteness';
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
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorTitle, { color: theme.colors.text }]}>Unable to load profile</Text>
        <Text style={[styles.errorDesc, { color: theme.colors.muted }]}>{error || 'Profile not found.'}</Text>
        {error ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => setLoadAttempt((attempt) => attempt + 1)}>
            <Text style={{ color: theme.colors.primary, fontSize: 16 }}>{strings.common.retry}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Text style={{ color: theme.colors.primary, fontSize: 16 }}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { profile, skills, portfolioItems, hiringInterests, gigsPostedCount, completeness } = data;
  const isHire = profile.active_mode === 'hire';

  const availabilityLabel = strings.profile.availabilityOptions.find(
    (o) => o.value === profile.availability
  )?.label;
  const experienceLabel = strings.profile.experienceOptions.find(
    (o) => o.value === profile.experience_years
  )?.label;
  const clientTypeLabel = strings.profile.clientTypeOptions.find(
    (o) => o.value === profile.client_type
  )?.label;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.topNav}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={{ color: theme.colors.primary, fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <View
          style={[
            styles.profileCard,
            { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
          ]}
        >
          <View style={styles.avatarRow}>
            <Avatar
              name={profile.display_name || 'User'}
              imageUri={profile.avatar_path}
              size={68}
            />

            <View style={styles.userInfo}>
              <View style={styles.nameBadgeRow}>
                <Text style={[styles.displayName, { color: theme.colors.text }]}>
                  {profile.display_name || 'Anonymous User'}
                </Text>
                {completeness?.complete ? <ProfileCompleteBadge /> : null}
              </View>

              {!isHire && profile.headline ? (
                <Text style={[styles.headlineText, { color: theme.colors.text }]}>
                  {profile.headline}
                </Text>
              ) : null}

              {isHire && profile.business_name ? (
                <Text style={[styles.headlineText, { color: theme.colors.text }]}>
                  {profile.business_name}
                </Text>
              ) : null}

              {profile.area ? (
                <Text style={[styles.areaText, { color: theme.colors.muted }]}>📍 {profile.area}</Text>
              ) : null}

              {isHire ? (
                <>
                  <View style={styles.metricsRow}>
                    <Text style={[styles.ratingText, { color: theme.colors.text }]}>
                      Client: ★ {Number(profile.client_rating_avg || 0).toFixed(1)} (
                      {profile.client_rating_count || 0})
                    </Text>
                    <Text style={[styles.divider, { color: theme.colors.muted }]}>•</Text>
                    <Text style={[styles.completedText, { color: theme.colors.muted }]}>
                      {gigsPostedCount || 0} gigs posted
                    </Text>
                  </View>
                  <View style={styles.roleRatingsRow}>
                    <Text style={[styles.roleRatingTag, { color: theme.colors.muted }]}>
                      {profile.client_completed_gigs || 0} completed as client
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.metricsRow}>
                    <Text style={[styles.ratingText, { color: theme.colors.text }]}>
                      Freelancer: ★ {Number(profile.freelancer_rating_avg || 0).toFixed(1)} (
                      {profile.freelancer_rating_count || 0})
                    </Text>
                    <Text style={[styles.divider, { color: theme.colors.muted }]}>•</Text>
                    <Text style={[styles.completedText, { color: theme.colors.muted }]}>
                      {profile.freelancer_completed_gigs || 0} gigs
                    </Text>
                  </View>

                  <View style={styles.roleRatingsRow}>
                    <Text style={[styles.roleRatingTag, { color: theme.colors.muted }]}>
                      Client: ★ {Number(profile.client_rating_avg || 0).toFixed(1)} (
                      {profile.client_rating_count || 0}) • {profile.client_completed_gigs || 0} gigs
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {profile.bio ? (
            <View style={[styles.bioSection, { borderTopColor: theme.colors.border }]}>
              <Text style={[styles.bioTitle, { color: theme.colors.muted }]}>About</Text>
              <Text style={[styles.bioText, { color: theme.colors.text }]}>{profile.bio}</Text>
            </View>
          ) : null}

          {/* Additional Public Details */}
          <View style={[styles.detailsList, { borderTopColor: theme.colors.border }]}>
            {profile.languages && profile.languages.length > 0 ? (
              <Text style={[styles.detailItem, { color: theme.colors.muted }]}>
                Languages: <Text style={{ color: theme.colors.text }}>{profile.languages.join(', ')}</Text>
              </Text>
            ) : null}

            {profile.preferred_contact ? (
              <Text style={[styles.detailItem, { color: theme.colors.muted }]}>
                Preferred contact: <Text style={{ color: theme.colors.text }}>{profile.preferred_contact}</Text>
              </Text>
            ) : null}

            {!isHire && availabilityLabel ? (
              <Text style={[styles.detailItem, { color: theme.colors.muted }]}>
                Availability: <Text style={{ color: theme.colors.text }}>{availabilityLabel}</Text>
              </Text>
            ) : null}

            {!isHire && profile.work_types && profile.work_types.length > 0 ? (
              <Text style={[styles.detailItem, { color: theme.colors.muted }]}>
                Work types:{' '}
                <Text style={{ color: theme.colors.text }}>
                  {profile.work_types
                    .map(
                      (wt) =>
                        strings.profile.workTypeOptions.find((o) => o.value === wt)?.label || wt
                    )
                    .join(', ')}
                </Text>
              </Text>
            ) : null}

            {!isHire && experienceLabel ? (
              <Text style={[styles.detailItem, { color: theme.colors.muted }]}>
                Experience: <Text style={{ color: theme.colors.text }}>{experienceLabel}</Text>
              </Text>
            ) : null}

            {!isHire && profile.starting_rate_note ? (
              <Text style={[styles.detailItem, { color: theme.colors.muted }]}>
                Starting rate note:{' '}
                <Text style={{ color: theme.colors.text }}>{profile.starting_rate_note}</Text>
              </Text>
            ) : null}

            {isHire && clientTypeLabel ? (
              <Text style={[styles.detailItem, { color: theme.colors.muted }]}>
                Client type: <Text style={{ color: theme.colors.text }}>{clientTypeLabel}</Text>
              </Text>
            ) : null}

            {isHire && profile.business_name ? (
              <Text style={[styles.detailItem, { color: theme.colors.muted }]}>
                Business / Organization:{' '}
                <Text style={{ color: theme.colors.text }}>{profile.business_name}</Text>
              </Text>
            ) : null}

            {isHire ? (
              <Text style={[styles.detailItem, { color: theme.colors.muted }]}>
                Gigs posted:{' '}
                <Text style={{ color: theme.colors.text }}>{gigsPostedCount || 0}</Text>
              </Text>
            ) : null}

            {isHire && profile.about_hiring ? (
              <Text style={[styles.detailItem, { color: theme.colors.muted }]}>
                What we usually hire for:{' '}
                <Text style={{ color: theme.colors.text }}>{profile.about_hiring}</Text>
              </Text>
            ) : null}
          </View>
        </View>

        {/* Hiring Interests Section (shown for clients) */}
        {isHire ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Hiring Interests
            </Text>
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
                      styles.skillChip,
                      { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                    ]}
                  >
                    <Text style={[styles.skillChipText, { color: theme.colors.text }]}>
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
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Skills</Text>
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
                      { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                    ]}
                  >
                    <Text style={[styles.skillChipText, { color: theme.colors.text }]}>
                      {skill.name}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {/* Portfolio Section */}
        {!isHire ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Portfolio</Text>
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
                      { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
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
                          <Image key={idx} source={{ uri: f }} style={styles.portfolioThumb} />
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
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Reviews ({reviews.length})
          </Text>
          {reviews.length === 0 ? (
            <Text style={[styles.emptyNote, { color: theme.colors.muted }]}>
              No reviews received yet.
            </Text>
          ) : (
            <View style={styles.reviewsList}>
              {reviews.map((rev) => (
                <View
                  key={rev.id}
                  style={[
                    styles.reviewCard,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                  ]}
                >
                  <View style={styles.reviewCardHeader}>
                    <Text style={[styles.reviewerDisplayName, { color: theme.colors.text }]}>
                      {rev.reviewer?.display_name || 'Anonymous User'}
                    </Text>
                    <Text style={[styles.reviewStarsText, { color: theme.colors.accent }]}>
                      {'★'.repeat(rev.rating)}
                      {'☆'.repeat(5 - rev.rating)}
                    </Text>
                  </View>
                  <Text style={[styles.reviewCommentText, { color: theme.colors.text }]}>
                    {rev.comment}
                  </Text>
                  <Text style={[styles.reviewDateText, { color: theme.colors.muted }]}>
                    {new Date(rev.created_at).toLocaleDateString()} • As {rev.role}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
  },
  topNav: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  errorDesc: {
    fontSize: 14,
    marginBottom: 16,
  },
  backBtn: {
    padding: 8,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  profileCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  userInfo: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '700',
  },
  headlineText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  areaText: {
    fontSize: 13,
    marginBottom: 6,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleRatingsRow: {
    gap: 2,
    marginTop: 4,
  },
  roleRatingTag: {
    fontSize: 12,
    fontWeight: '500',
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    fontSize: 13,
  },
  completedText: {
    fontSize: 13,
  },
  bioSection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bioTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailsList: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  detailItem: {
    fontSize: 13,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyNote: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  skillChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  portfolioList: {
    gap: 12,
  },
  portfolioCard: {
    borderWidth: 1,
    borderRadius: 12,
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
    marginBottom: 6,
  },
  portfolioFiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  portfolioThumb: {
    width: 84,
    height: 84,
    borderRadius: 10,
  },
  reviewsList: {
    gap: 12,
  },
  reviewCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewerDisplayName: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewStarsText: {
    fontSize: 14,
  },
  reviewCommentText: {
    fontSize: 13,
    lineHeight: 18,
  },
  reviewDateText: {
    fontSize: 11,
  },
});

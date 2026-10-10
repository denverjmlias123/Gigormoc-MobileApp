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
import { profileService, PublicProfileData } from '../../services/profile';
import { reviewsService, ReviewItem } from '../../services/reviews';

export default function PublicProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [data, setData] = useState<PublicProfileData | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const [res, revList] = await Promise.all([
          profileService.getPublicProfile(id),
          reviewsService.getUserReviews(id).catch(() => []),
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
  }, [id]);

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
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={{ color: theme.colors.primary, fontSize: 16 }}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { profile, skills, portfolioItems } = data;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.topNav}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: theme.colors.primary, fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <View style={[styles.profileCard, { borderColor: theme.colors.border }]}>
          <View style={styles.avatarRow}>
            {profile.avatar_path ? (
              <Image source={{ uri: profile.avatar_path }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.avatarLetter}>
                  {(profile.display_name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.userInfo}>
              <Text style={[styles.displayName, { color: theme.colors.text }]}>
                {profile.display_name || 'Anonymous User'}
              </Text>
              {profile.area ? (
                <Text style={[styles.areaText, { color: theme.colors.muted }]}>📍 {profile.area}</Text>
              ) : null}
              <View style={styles.metricsRow}>
                <Text style={[styles.ratingText, { color: theme.colors.text }]}>
                  Freelancer: ★ {Number(profile.freelancer_rating_avg || 0).toFixed(1)} ({profile.freelancer_rating_count || 0})
                </Text>
                <Text style={[styles.divider, { color: theme.colors.muted }]}>•</Text>
                <Text style={[styles.completedText, { color: theme.colors.muted }]}>
                  {profile.freelancer_completed_gigs || 0} gigs
                </Text>
              </View>

              <View style={styles.roleRatingsRow}>
                <Text style={[styles.roleRatingTag, { color: theme.colors.muted }]}>
                  Client: ★ {Number(profile.client_rating_avg || 0).toFixed(1)} ({profile.client_rating_count || 0}) • {profile.client_completed_gigs || 0} gigs
                </Text>
              </View>
            </View>
          </View>

          {profile.bio ? (
            <View style={styles.bioSection}>
              <Text style={[styles.bioTitle, { color: theme.colors.muted }]}>About</Text>
              <Text style={[styles.bioText, { color: theme.colors.text }]}>{profile.bio}</Text>
            </View>
          ) : null}
        </View>

        {/* Skills Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Skills</Text>
          {skills.length === 0 ? (
            <Text style={[styles.emptyNote, { color: theme.colors.muted }]}>
              No skills specified yet.
            </Text>
          ) : (
            <View style={styles.skillsGrid}>
              {skills.map((skill) => (
                <View key={skill.id} style={[styles.skillChip, { borderColor: theme.colors.border }]}>
                  <Text style={[styles.skillChipText, { color: theme.colors.text }]}>{skill.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Portfolio Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Portfolio</Text>
          {portfolioItems.length === 0 ? (
            <Text style={[styles.emptyNote, { color: theme.colors.muted }]}>
              No portfolio items published yet.
            </Text>
          ) : (
            <View style={styles.portfolioList}>
              {portfolioItems.map((item) => (
                <View key={item.id} style={[styles.portfolioCard, { borderColor: theme.colors.border }]}>
                  <Text style={[styles.portfolioTitle, { color: theme.colors.text }]}>{item.title}</Text>
                  {item.description ? (
                    <Text style={[styles.portfolioDesc, { color: theme.colors.muted }]}>{item.description}</Text>
                  ) : null}
                  {item.file_paths && item.file_paths.length > 0 ? (
                    <View style={styles.portfolioFiles}>
                      {item.file_paths.map((f, idx) => (
                        <Text key={idx} style={[styles.fileLink, { color: theme.colors.primary }]}>
                          🔗 {f}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>

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
                <View key={rev.id} style={[styles.reviewCard, { borderColor: theme.colors.border }]}>
                  <View style={styles.reviewCardHeader}>
                    <Text style={[styles.reviewerDisplayName, { color: theme.colors.text }]}>
                      {rev.reviewer?.display_name || 'Anonymous User'}
                    </Text>
                    <Text style={styles.reviewStarsText}>
                      {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
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
    backgroundColor: '#fafafa',
    marginBottom: 24,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  avatarPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
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
    color: '#f59e0b',
  },
  reviewCommentText: {
    fontSize: 13,
    lineHeight: 18,
  },
  reviewDateText: {
    fontSize: 11,
  },
  bioSection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
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
    backgroundColor: '#ffffff',
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
    backgroundColor: '#ffffff',
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
    marginTop: 4,
  },
  fileLink: {
    fontSize: 12,
  },
});

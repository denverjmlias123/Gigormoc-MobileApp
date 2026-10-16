import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../../app/theme';
import { AgreementItem } from '../../services/applications';
import { ReviewItem } from '../../services/reviews';
import { Button } from '../ui/Button';

interface AgreementReviewsCardProps {
  agreement: AgreementItem;
  reviews: ReviewItem[];
  currentUserId?: string;
  isClient: boolean;
  isFreelancer: boolean;
  onViewClientProfile: () => void;
  onViewFreelancerProfile: () => void;
  onLeaveReview: () => void;
}

export const AgreementReviewsCard: React.FC<AgreementReviewsCardProps> = ({
  agreement,
  reviews,
  currentUserId,
  isClient,
  isFreelancer,
  onViewClientProfile,
  onViewFreelancerProfile,
  onLeaveReview,
}) => {
  const theme = useAppTheme();

  return (
    <>
      {/* Counterparty Information */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Participants</Text>

        {/* Client */}
        <View style={styles.partyRow}>
          <View>
            <Text style={[styles.partyRole, { color: theme.colors.muted }]}>Client</Text>
            <Text style={[styles.partyName, { color: theme.colors.text }]}>
              {agreement.client?.display_name || 'Client'}
              {isClient ? ' (You)' : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={onViewClientProfile}>
            <Text style={[styles.linkText, { color: theme.colors.primary }]}>Profile ›</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

        {/* Freelancer */}
        <View style={styles.partyRow}>
          <View>
            <Text style={[styles.partyRole, { color: theme.colors.muted }]}>Freelancer</Text>
            <Text style={[styles.partyName, { color: theme.colors.text }]}>
              {agreement.freelancer?.display_name || 'Freelancer'}
              {isFreelancer ? ' (You)' : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={onViewFreelancerProfile}>
            <Text style={[styles.linkText, { color: theme.colors.primary }]}>Profile ›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Reviews Section (Only for completed agreements) */}
      {agreement.status === 'completed' && (
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Reviews & Feedback
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.muted }]}>
                {reviews.length > 0
                  ? `${reviews.length} review(s) published`
                  : 'No reviews submitted yet'}
              </Text>
            </View>

            {!reviews.some((r) => r.reviewer_id === currentUserId) && (
              <Button title="Leave Review" variant="primary" onPress={onLeaveReview} />
            )}
          </View>

          {reviews.length === 0 ? (
            <View style={styles.emptyMilestonesBox}>
              <Text style={[styles.emptyMilestonesText, { color: theme.colors.muted }]}>
                Both parties have 14 days following completion to leave honest, uneditable feedback.
              </Text>
            </View>
          ) : (
            <View style={styles.milestonesList}>
              {reviews.map((r) => (
                <View
                  key={r.id}
                  style={[styles.reviewItemCard, { borderColor: theme.colors.border }]}
                >
                  <View style={styles.reviewHeader}>
                    <Text style={[styles.reviewerName, { color: theme.colors.text }]}>
                      {r.reviewer?.display_name || 'Participant'} ({r.role})
                    </Text>
                    <Text style={styles.reviewStars}>
                      {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                    </Text>
                  </View>
                  <Text style={[styles.reviewComment, { color: theme.colors.text }]}>
                    {r.comment}
                  </Text>
                  <Text style={[styles.reviewDate, { color: theme.colors.muted }]}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Safety Notice */}
      <View style={[styles.noticeCard, { backgroundColor: '#DDF5EA', borderColor: '#9BD9BE' }]}>
        <Text style={styles.noticeTitle}>🛡️ Direct Payment & Record Integrity</Text>
        <Text style={styles.noticeText}>
          Payments are made directly outside the platform. Statuses indicate external reports and confirmations between parties; Gigormoc never holds or guarantees escrow funds.
        </Text>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  partyRole: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  partyName: {
    fontSize: 15,
    fontWeight: '600',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  emptyMilestonesBox: {
    paddingVertical: 12,
  },
  emptyMilestonesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  milestonesList: {
    gap: 10,
    marginTop: 4,
  },
  reviewItemCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewStars: {
    fontSize: 14,
    color: '#F59E0B',
  },
  reviewComment: {
    fontSize: 14,
    lineHeight: 20,
  },
  reviewDate: {
    fontSize: 12,
  },
  noticeCard: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#166534',
  },
});

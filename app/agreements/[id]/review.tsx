import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme, useResponsiveLayout } from '../../theme';
import { reviewsService } from '../../../services/reviews';
import { Button } from '../../../components/ui/Button';
import { Card, AlertBox, PageHeaderBox } from '../../../components/ui/Card';
import { TextInput } from '../../../components/ui/TextInput';
import { Avatar } from '../../../components/ui/Avatar';
import { showToast } from '../../../components/ui/Toast';
import { mapSqlErrorToFriendlyMessage, strings } from '../../../constants/strings';

export default function SubmitReviewScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { insets } = useResponsiveLayout();
  const { id, targetName, targetRole } = useLocalSearchParams<{
    id: string;
    targetName: string;
    targetRole: string;
  }>();

  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = React.useRef(false);

  const safeNavigateBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (id) {
      router.replace({ pathname: '/agreements/[id]', params: { id } });
    } else {
      router.replace('/(tabs)/activity');
    }
  };

  const navigateAfterSuccess = () => {
    if (id) {
      router.replace({ pathname: '/agreements/[id]', params: { id } });
    } else {
      router.replace('/(tabs)/activity');
    }
  };

  const handleSubmit = async () => {
    if (!id || inFlightRef.current || submitting || submitted) return;
    if (comment.trim().length < 10) {
      setError('Please write at least 10 characters of honest feedback about your working experience.');
      showToast('Please write at least 10 characters of honest feedback.', 'error');
      return;
    }

    inFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await reviewsService.submitReview({
        agreementId: id,
        rating,
        comment: comment.trim(),
      });
      setSubmitted(true);
      showToast(strings.toasts.reviewPosted);
      navigateAfterSuccess();
    } catch (err: any) {
      const friendlyMsg = mapSqlErrorToFriendlyMessage(err, 'Failed to submit review.');
      setError(friendlyMsg);
      showToast(friendlyMsg, 'error');
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <PageHeaderBox
        title="Leave a Review"
        subtitle={`Share your experience working with ${targetName || 'Participant'}`}
        onBack={safeNavigateBack}
        maxWidth={600}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 32, 40) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.centeredBlock, { gap: 16 }]}>
          {/* Reviewee Header */}
          <Card tone="neo-glass" padding="md" style={styles.cardGap}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={targetName || 'Participant'} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: theme.colors.muted }]}>Reviewing</Text>
                <Text style={[styles.title, { color: theme.colors.text }]}>
                  {targetName || 'Participant'}
                </Text>
                <Text style={[styles.subLabel, { color: theme.colors.muted }]}>
                  Role: {targetRole || 'Partner'}
                </Text>
              </View>
            </View>
          </Card>

          {/* Notice */}
          <AlertBox
            tone="success"
            title="Honest & Immutable Feedback"
            message="Reviews can only be submitted once per agreement and cannot be edited after publication. Reviews must be submitted within 14 days of project completion."
          />

          {error && <AlertBox tone="danger" message={error} />}

          {/* Star Rating Selector */}
          <Card tone="neo-glass" padding="md" style={styles.cardGap}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Rating *</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  style={styles.starTouch}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.starIcon,
                      {
                        color:
                          star <= rating ? theme.colors.warning : theme.colors.borderStrong,
                      },
                    ]}
                  >
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
              <Text style={[styles.ratingCountText, { color: theme.colors.text }]}>
                {rating} of 5 Stars
              </Text>
            </View>
          </Card>

          {/* Review Comment */}
          <Card tone="neo-glass" padding="md" style={styles.cardGap}>
            <TextInput
              label="Feedback Comment *"
              placeholder="Share details of your experience: communication, quality of work, punctuality, and professionalism..."
              multiline
              numberOfLines={5}
              value={comment}
              onChangeText={setComment}
              maxLength={1000}
              helperText={`${comment.length}/1000 characters (min 10)`}
              containerStyle={{ marginBottom: 0 }}
            />
          </Card>

          {/* Submit */}
          <View style={styles.submitContainer}>
            <Button
              title={submitting ? 'Submitting Review...' : 'Publish Review'}
              variant="primary"
              icon="star-outline"
              onPress={handleSubmit}
              disabled={comment.trim().length < 10 || submitting}
              loading={submitting}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centeredBlock: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  cardGap: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  subLabel: {
    fontSize: 13,
    textTransform: 'capitalize',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  starTouch: {
    padding: 4,
  },
  starIcon: {
    fontSize: 34,
  },
  ratingCountText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  submitContainer: {
    marginTop: 8,
  },
});

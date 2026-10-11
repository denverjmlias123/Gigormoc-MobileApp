import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../../theme';
import { reviewsService } from '../../../services/reviews';
import { Button } from '../../../components/ui/Button';
import { mapSqlErrorToFriendlyMessage } from '../../../constants/strings';

export default function SubmitReviewScreen() {
  const router = useRouter();
  const theme = useAppTheme();
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
      Alert.alert(
        'Comment Too Short',
        'Please write at least 10 characters of honest feedback about your working experience.'
      );
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

      Alert.alert(
        'Review Submitted',
        'Thank you! Your feedback has been published and will help Ormoc clients and freelancers.',
        [
          {
            text: 'OK',
            onPress: navigateAfterSuccess,
          },
        ]
      );
    } catch (err: any) {
      setError(mapSqlErrorToFriendlyMessage(err, 'Failed to submit review.'));
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={safeNavigateBack} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>‹ Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: theme.colors.text }]}>Leave a Review</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Reviewee Header */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.muted }]}>Reviewing</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {targetName || 'Participant'}
          </Text>
          <Text style={[styles.subLabel, { color: theme.colors.muted }]}>
            Role: {targetRole || 'Partner'}
          </Text>
        </View>

        {/* Notice */}
        <View style={[styles.infoCard, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
          <Text style={styles.infoTitle}>⚖️ Honest & Immutable Feedback</Text>
          <Text style={styles.infoText}>
            Reviews can only be submitted once per agreement and cannot be edited after publication. Reviews must be submitted within 14 days of project completion.
          </Text>
        </View>

        {error && (
          <View style={[styles.errorCard, { backgroundColor: '#FDE8EA', borderColor: '#F3A6AE' }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Star Rating Selector */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
                    { color: star <= rating ? '#B45309' : '#cbd5e1' },
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
        </View>

        {/* Review Comment */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Feedback Comment *</Text>
          <TextInput
            style={[
              styles.textArea,
              { borderColor: theme.colors.border, color: theme.colors.text },
            ]}
            placeholder="Share details of your experience: communication, quality of work, punctuality, and professionalism..."
            placeholderTextColor={theme.colors.muted}
            multiline
            numberOfLines={5}
            value={comment}
            onChangeText={setComment}
            maxLength={1000}
          />
          <Text style={[styles.charCount, { color: theme.colors.muted }]}>
            {comment.length}/1000 characters (min 10)
          </Text>
        </View>

        {/* Submit */}
        <View style={styles.submitContainer}>
          <Button
            title={submitting ? 'Submitting Review...' : 'Publish Review'}
            variant="primary"
            onPress={handleSubmit}
            disabled={comment.trim().length < 10 || submitting}
            loading={submitting}
          />
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 6,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
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
  infoCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#15803d',
  },
  infoText: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 18,
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
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
  },
  errorCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#A31F2D',
  },
  submitContainer: {
    marginTop: 8,
  },
});

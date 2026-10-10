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
import { useAppTheme } from '../theme';
import {
  reportsService,
  ReportTargetType,
  ReportReasonCategory,
} from '../../services/reports';
import { Button } from '../../components/ui/Button';

const REASON_CATEGORIES: { label: string; value: ReportReasonCategory }[] = [
  { label: 'Spam or Scam', value: 'spam_scam' },
  { label: 'Harassment / Abusive Behavior', value: 'harassment' },
  { label: 'Unresponsive or Abandoned', value: 'unresponsive' },
  { label: 'Payment Problem', value: 'payment_issue' },
  { label: 'Work Quality Issue', value: 'work_quality' },
  { label: 'Cancellation Request', value: 'cancellation_request' },
  { label: 'Other Concern', value: 'other' },
];

export default function NewReportScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { targetType, targetId, targetTitle } = useLocalSearchParams<{
    targetType: ReportTargetType;
    targetId: string;
    targetTitle: string;
  }>();

  const [category, setCategory] = useState<ReportReasonCategory>('other');
  const [details, setDetails] = useState('');
  const [evidencePath, setEvidencePath] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!targetId || !targetType) return;
    if (details.trim().length < 10) {
      Alert.alert(
        'Details Required',
        'Please describe the issue in detail (at least 10 characters) to help the moderation team investigate.'
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await reportsService.submitReport({
        targetType,
        targetId,
        reasonCategory: category,
        details: details.trim(),
        evidencePath: evidencePath.trim() || undefined,
      });

      Alert.alert(
        'Report Submitted',
        'Thank you for reporting. Our moderation team reviews reports manually to protect the Ormoc community.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>‹ Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: theme.colors.text }]}>Submit a Report</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Target Header */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.muted }]}>Reporting Target</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {targetTitle || `${targetType?.toUpperCase()} (${targetId?.slice(0, 8)})`}
          </Text>
        </View>

        {error && (
          <View style={[styles.errorCard, { backgroundColor: '#FDE8EA', borderColor: '#F3A6AE' }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Reason Category */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Reason Category *</Text>
          <View style={styles.categoryGrid}>
            {REASON_CATEGORIES.map((c) => {
              const isSelected = category === c.value;
              return (
                <TouchableOpacity
                  key={c.value}
                  style={[
                    styles.chip,
                    {
                      borderColor: isSelected ? theme.colors.danger : theme.colors.border,
                      backgroundColor: isSelected ? '#FDE8EA' : theme.colors.surface,
                    },
                  ]}
                  onPress={() => setCategory(c.value)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: isSelected ? '#b91c1c' : theme.colors.text },
                    ]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Details Textarea */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Explanation & Evidence *
          </Text>
          <TextInput
            style={[
              styles.textArea,
              { borderColor: theme.colors.border, color: theme.colors.text },
            ]}
            placeholder="Explain what happened, what went wrong, and any relevant dates or communication context..."
            placeholderTextColor={theme.colors.muted}
            multiline
            numberOfLines={5}
            value={details}
            onChangeText={setDetails}
            maxLength={2000}
          />
          <Text style={[styles.charCount, { color: theme.colors.muted }]}>
            {details.length}/2000 characters (min 10)
          </Text>
        </View>

        {/* Evidence Link */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Evidence Link / Storage Path (Optional)
          </Text>
          <TextInput
            style={[
              styles.textInput,
              { borderColor: theme.colors.border, color: theme.colors.text },
            ]}
            placeholder="e.g. Screenshot link, cloud folder URL, or chat reference"
            placeholderTextColor={theme.colors.muted}
            value={evidencePath}
            onChangeText={setEvidencePath}
          />
        </View>

        {/* Submit */}
        <View style={styles.submitContainer}>
          <Button
            title={submitting ? 'Submitting Report...' : 'Submit Report for Moderation'}
            variant="danger"
            onPress={handleSubmit}
            disabled={details.trim().length < 10 || submitting}
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
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
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
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
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

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../../../../theme';
import { milestonesService } from '../../../../../services/milestones';
import { Button } from '../../../../../components/ui/Button';

export default function SubmitMilestoneScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { id, milestoneId, title, revisionCount } = useLocalSearchParams<{
    id: string;
    milestoneId: string;
    title: string;
    revisionCount: string;
  }>();

  const revCount = parseInt(revisionCount || '0', 10);

  const [message, setMessage] = useState('');
  const [fileUrlInput, setFileUrlInput] = useState('');
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddFile = () => {
    if (!fileUrlInput.trim()) return;
    setFilePaths([...filePaths, fileUrlInput.trim()]);
    setFileUrlInput('');
  };

  const handleRemoveFile = (index: number) => {
    setFilePaths(filePaths.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async () => {
    if (!milestoneId) return;
    if (message.trim().length < 10) {
      Alert.alert('Too Short', 'Please provide a clear description of your submitted work (at least 10 characters).');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await milestonesService.submitMilestone(milestoneId, message.trim(), filePaths);
      Alert.alert(
        'Work Submitted',
        'Your milestone submission has been sent to the client for review.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to submit milestone work.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: theme.colors.text }]}>Submit Work</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Milestone Context */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.muted }]}>Milestone Deliverable</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>{title || 'Deliverable'}</Text>
          <Text style={[styles.meta, { color: theme.colors.muted }]}>
            Submission Attempt: #{revCount + 1} (Max 3 total submissions)
          </Text>
        </View>

        {error && (
          <View style={[styles.errorCard, { backgroundColor: '#ffebee', borderColor: '#ef9a9a' }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Message Input */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Submission Notes & Summary *
          </Text>
          <TextInput
            style={[
              styles.textArea,
              { borderColor: theme.colors.border, color: theme.colors.text },
            ]}
            placeholder="Describe the deliverables completed, summarize outcomes, and provide access links..."
            placeholderTextColor={theme.colors.muted}
            multiline
            numberOfLines={5}
            value={message}
            onChangeText={setMessage}
            maxLength={2000}
          />
          <Text style={[styles.charCount, { color: theme.colors.muted }]}>
            {message.length}/2000 characters (min 10)
          </Text>
        </View>

        {/* File / Deliverable Links */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Deliverable Links & Files</Text>
          <Text style={[styles.subLabel, { color: theme.colors.muted }]}>
            Add shareable drive links, repository URLs, or storage paths for client review.
          </Text>

          <View style={styles.fileInputRow}>
            <TextInput
              style={[
                styles.fileInput,
                { borderColor: theme.colors.border, color: theme.colors.text },
              ]}
              placeholder="e.g. https://drive.google.com/... or deliverables.zip"
              placeholderTextColor={theme.colors.muted}
              value={fileUrlInput}
              onChangeText={setFileUrlInput}
            />
            <TouchableOpacity
              style={[styles.addFileBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handleAddFile}
            >
              <Text style={{ color: '#ffffff', fontWeight: '600' }}>Add</Text>
            </TouchableOpacity>
          </View>

          {filePaths.length > 0 && (
            <View style={styles.filesList}>
              {filePaths.map((f, idx) => (
                <View key={idx} style={[styles.fileItem, { borderColor: theme.colors.border }]}>
                  <Text style={[styles.filePathText, { color: theme.colors.text }]} numberOfLines={1}>
                    📎 {f}
                  </Text>
                  <TouchableOpacity onPress={() => handleRemoveFile(idx)}>
                    <Text style={{ color: theme.colors.danger, fontWeight: '600' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          <Button
            title={submitting ? 'Submitting Deliverable...' : 'Submit Deliverable for Client Review'}
            variant="primary"
            onPress={handleSubmit}
            disabled={message.trim().length < 10 || submitting}
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
    fontSize: 12,
    lineHeight: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  meta: {
    fontSize: 13,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
  },
  fileInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  fileInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  addFileBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filesList: {
    gap: 6,
    marginTop: 6,
  },
  fileItem: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filePathText: {
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  errorCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#c62828',
  },
  submitContainer: {
    marginTop: 8,
  },
});

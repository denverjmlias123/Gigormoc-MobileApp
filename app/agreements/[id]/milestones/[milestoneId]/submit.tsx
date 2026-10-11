import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../../../../theme';
import { milestonesService } from '../../../../../services/milestones';
import { Button } from '../../../../../components/ui/Button';
import { showToast } from '../../../../../components/ui/Toast';
import { mapSqlErrorToFriendlyMessage, strings } from '../../../../../constants/strings';

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
  const [uploadingFile, setUploadingFile] = useState(false);
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

  const handleAddFile = () => {
    if (!fileUrlInput.trim() || submitted) return;
    setFilePaths([...filePaths, fileUrlInput.trim()]);
    setFileUrlInput('');
  };

  const handleUploadFromDevice = async () => {
    if (!id || !milestoneId || uploadingFile || submitted) return;
    setUploadingFile(true);
    setError(null);
    try {
      const storagePath = await milestonesService.pickAndUploadSubmissionFile(id, milestoneId);
      if (storagePath) {
        setFilePaths((prev) => [...prev, storagePath]);
      }
    } catch (err: any) {
      setError(mapSqlErrorToFriendlyMessage(err, 'Could not upload deliverable file.'));
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    if (submitted) return;
    setFilePaths(filePaths.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async () => {
    if (!milestoneId || inFlightRef.current || submitting || submitted) return;
    if (message.trim().length < 10) {
      setError('Please provide a clear description of your submitted work (at least 10 characters).');
      showToast('Please provide a clear description of your submitted work (at least 10 characters).', 'error');
      return;
    }

    inFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await milestonesService.submitMilestone(milestoneId, message.trim(), filePaths);
      setSubmitted(true);
      showToast(strings.toasts.workSubmitted);
      navigateAfterSuccess();
    } catch (err: any) {
      const friendlyMsg = mapSqlErrorToFriendlyMessage(err, 'Failed to submit milestone work.');
      setError(friendlyMsg);
      showToast(friendlyMsg, 'error');
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
          <View style={[styles.errorCard, { backgroundColor: '#FDE8EA', borderColor: '#F3A6AE' }]}>
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

        {/* File / Deliverable Links & Private Bucket Upload */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Deliverable Links & Files</Text>
          <Text style={[styles.subLabel, { color: theme.colors.muted }]}>
            Upload a deliverable screenshot/file to secure private storage or add a shareable drive/repo link.
          </Text>

          <Button
            title={uploadingFile ? 'Uploading Attachment...' : '📎 Upload Deliverable File / Screenshot'}
            variant="secondary"
            onPress={handleUploadFromDevice}
            disabled={uploadingFile || submitting}
            loading={uploadingFile}
          />

          <View style={styles.fileInputRow}>
            <TextInput
              style={[
                styles.fileInput,
                { borderColor: theme.colors.border, color: theme.colors.text },
              ]}
              placeholder="Or paste link: https://drive.google.com/..."
              placeholderTextColor={theme.colors.muted}
              value={fileUrlInput}
              onChangeText={setFileUrlInput}
            />
            <TouchableOpacity
              style={[styles.addFileBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handleAddFile}
              disabled={!fileUrlInput.trim()}
            >
              <Text style={{ color: '#ffffff', fontWeight: '600' }}>Add Link</Text>
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
            disabled={message.trim().length < 10 || submitting || uploadingFile}
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
    color: '#A31F2D',
  },
  submitContainer: {
    marginTop: 8,
  },
});

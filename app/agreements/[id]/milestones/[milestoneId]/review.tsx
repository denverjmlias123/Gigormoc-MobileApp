import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../../../../theme';
import { milestonesService, SubmissionItem } from '../../../../../services/milestones';
import { Button } from '../../../../../components/ui/Button';
import { mapSqlErrorToFriendlyMessage } from '../../../../../constants/strings';

export default function ReviewMilestoneScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { id, milestoneId, title, revisionCount } = useLocalSearchParams<{
    id: string;
    milestoneId: string;
    title: string;
    revisionCount: string;
  }>();

  const currentRevisions = parseInt(revisionCount || '0', 10);
  const revisionsLeft = 2 - currentRevisions;

  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safeNavigateBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (id) {
      router.replace({ pathname: '/agreements/[id]', params: { id } });
    } else {
      router.replace('/(tabs)/activity');
    }
  };

  useEffect(() => {
    if (!milestoneId) return;
    const fetchSubmissions = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await milestonesService.getMilestoneSubmissions(milestoneId);
        setSubmissions(data);

        // Resolve signed URLs for private 'submissions' bucket paths
        const allPaths = Array.from(
          new Set(data.flatMap((s) => s.file_paths || []).filter(Boolean))
        );
        const urlEntries = await Promise.all(
          allPaths.map(async (p) => {
            const url = await milestonesService.createSignedUrl(p).catch(() => null);
            return [p, url || p] as const;
          })
        );
        setSignedUrls(Object.fromEntries(urlEntries));
      } catch (err: any) {
        setError(mapSqlErrorToFriendlyMessage(err, 'Failed to load milestone submissions.'));
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [milestoneId]);

  const handleOpenAttachment = async (filePath: string) => {
    try {
      const resolved = signedUrls[filePath] || (await milestonesService.createSignedUrl(filePath));
      const targetUrl = resolved || filePath;
      if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
        await Linking.openURL(targetUrl);
      } else {
        Alert.alert('Attachment Path', targetUrl);
      }
    } catch {
      Alert.alert('Cannot Open Link', 'Could not open this deliverable attachment.');
    }
  };

  const handleApprove = () => {
    if (!milestoneId) return;

    Alert.alert(
      'Approve Milestone',
      'Are you sure you want to approve this milestone deliverable? Once approved, the milestone is marked complete.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve Deliverable',
          onPress: async () => {
            setActionBusy(true);
            try {
              await milestonesService.reviewMilestone(milestoneId, 'approve');
              Alert.alert('Milestone Approved', 'The milestone has been approved successfully.', [
                { text: 'OK', onPress: safeNavigateBack },
              ]);
            } catch (err: any) {
              Alert.alert(
                'Approval Error',
                mapSqlErrorToFriendlyMessage(err, 'Could not approve milestone.')
              );
            } finally {
              setActionBusy(false);
            }
          },
        },
      ]
    );
  };

  const handleRequestRevision = async () => {
    if (!milestoneId) return;
    if (revisionFeedback.trim().length < 5) {
      Alert.alert('Feedback Required', 'Please provide clear feedback explaining what changes are required.');
      return;
    }

    setActionBusy(true);
    try {
      await milestonesService.reviewMilestone(
        milestoneId,
        'request_revision',
        revisionFeedback.trim()
      );
      Alert.alert(
        'Revision Requested',
        `Revision request submitted. (${revisionsLeft - 1} revision(s) remaining for this milestone).`,
        [{ text: 'OK', onPress: safeNavigateBack }]
      );
    } catch (err: any) {
      Alert.alert(
        'Revision Error',
        mapSqlErrorToFriendlyMessage(err, 'Could not request revision.')
      );
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={safeNavigateBack} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: theme.colors.text }]}>Review Deliverable</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.label, { color: theme.colors.muted }]}>Milestone</Text>
            <Text style={[styles.title, { color: theme.colors.text }]}>{title || 'Deliverable'}</Text>
            <Text style={[styles.meta, { color: theme.colors.muted }]}>
              Revisions used: {currentRevisions}/2 ({revisionsLeft} remaining)
            </Text>
          </View>

          {error && (
            <View style={[styles.errorCard, { backgroundColor: '#FDE8EA', borderColor: '#F3A6AE' }]}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Submissions History */}
          <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
            Submission History ({submissions.length})
          </Text>

          {submissions.length === 0 ? (
            <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.noSubmissionsText, { color: theme.colors.muted }]}>
                No submissions recorded yet for this milestone.
              </Text>
            </View>
          ) : (
            submissions.map((sub) => (
              <View
                key={sub.id}
                style={[
                  styles.card,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <View style={styles.submissionHeader}>
                  <Text style={[styles.submissionBadge, { color: theme.colors.primary }]}>
                    Submission #{sub.submission_number}
                  </Text>
                  <Text style={[styles.dateText, { color: theme.colors.muted }]}>
                    {new Date(sub.created_at).toLocaleDateString()}
                  </Text>
                </View>

                <Text style={[styles.submissionMessage, { color: theme.colors.text }]}>
                  {sub.message}
                </Text>

                {sub.file_paths && sub.file_paths.length > 0 && (
                  <View style={styles.filesSection}>
                    <Text style={[styles.fileSectionTitle, { color: theme.colors.muted }]}>
                      Deliverables / Attachments (Tap to open signed URL):
                    </Text>
                    {sub.file_paths.map((f, fIdx) => (
                      <TouchableOpacity
                        key={fIdx}
                        style={[styles.fileRow, { borderColor: theme.colors.border }]}
                        onPress={() => handleOpenAttachment(f)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.fileText, { color: theme.colors.primary }]} numberOfLines={1}>
                          📎 {f}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}

          {/* Actions */}
          <View style={styles.actionsContainer}>
            <Button
              title="✓ Approve Milestone Deliverable"
              variant="primary"
              onPress={handleApprove}
              disabled={actionBusy}
              loading={actionBusy}
            />

            {revisionsLeft > 0 ? (
              !showRevisionInput ? (
                <Button
                  title={`Request Revision (${revisionsLeft} remaining)`}
                  variant="secondary"
                  onPress={() => setShowRevisionInput(true)}
                  disabled={actionBusy}
                />
              ) : (
                <View
                  style={[
                    styles.revisionBox,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  ]}
                >
                  <Text style={[styles.label, { color: theme.colors.text }]}>
                    Revision Instructions *
                  </Text>
                  <TextInput
                    style={[
                      styles.textArea,
                      { borderColor: theme.colors.border, color: theme.colors.text },
                    ]}
                    placeholder="Specify exact revisions needed..."
                    placeholderTextColor={theme.colors.muted}
                    multiline
                    numberOfLines={4}
                    value={revisionFeedback}
                    onChangeText={setRevisionFeedback}
                    maxLength={1000}
                  />
                  <View style={styles.revisionActionsRow}>
                    <Button
                      title="Send Revision Request"
                      variant="danger"
                      onPress={handleRequestRevision}
                      disabled={revisionFeedback.trim().length < 5 || actionBusy}
                      loading={actionBusy}
                    />
                    <TouchableOpacity
                      style={styles.cancelLink}
                      onPress={() => setShowRevisionInput(false)}
                    >
                      <Text style={{ color: theme.colors.muted, textAlign: 'center' }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            ) : (
              <View style={[styles.infoBanner, { backgroundColor: '#FEF1D6', borderColor: '#F6D58B' }]}>
                <Text style={styles.infoBannerText}>
                  ⚠️ Maximum revisions (2/2) have been used. You must either approve the deliverable or contact support for dispute resolution.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  meta: {
    fontSize: 13,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  noSubmissionsText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  submissionBadge: {
    fontSize: 14,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 12,
  },
  submissionMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  filesSection: {
    marginTop: 8,
    gap: 6,
  },
  fileSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  fileRow: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  fileText: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionsContainer: {
    marginTop: 8,
    gap: 12,
  },
  revisionBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  revisionActionsRow: {
    gap: 8,
  },
  cancelLink: {
    paddingVertical: 8,
  },
  infoBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  infoBannerText: {
    fontSize: 13,
    color: '#e65100',
    lineHeight: 18,
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
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { gigsService, GigDetail } from '../../services/gigs';
import {
  applicationsService,
  ApplicationItem,
  AgreementItem,
} from '../../services/applications';
import { milestonesService } from '../../services/milestones';
import { paymentsService } from '../../services/payments';
import { reviewsService } from '../../services/reviews';
import { chatService } from '../../services/chat';
import { notificationsService } from '../../services/notifications';
import { Badge } from '../../components/ui/Badge';
import { showToast } from '../../components/ui/Toast';
import { confirmDialog } from '../../lib/dialog';
import { Button } from '../../components/ui/Button';
import { ScreenBackground } from '../../components/ui/ScreenBackground';
import {
  Timeline,
  NextStepBanner,
  LoopStageState,
  computeAgreementLoopState,
  computePreAgreementLoopState,
} from '../../components/ui/Timeline';
import { GigDetailInfo } from '../../components/gigs/GigDetailInfo';
import { ManageGigModal } from '../../components/gigs/ManageGigModal';
import { mapSqlErrorToFriendlyMessage, strings } from '../../constants/strings';

export default function GigDetailScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuth();

  const [gig, setGig] = useState<GigDetail | null>(null);
  const [myApplication, setMyApplication] = useState<ApplicationItem | null>(null);
  const [gigAgreement, setGigAgreement] = useState<AgreementItem | null>(null);
  const [loopState, setLoopState] = useState<LoopStageState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [manageSheetVisible, setManageSheetVisible] = useState(false);

  const loadGigAndLoop = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await gigsService.getGig(id);
      if (!data) {
        // Closed gigs are intentionally hidden from the public gigs query. Keep
        // participant history reachable through the agreement row instead.
        const myAgreements = user ? await applicationsService.getMyAgreements() : [];
        const matchingAgr = myAgreements.find((agreement) => agreement.gig_id === id) || null;
        setGigAgreement(matchingAgr);
        return;
      }
      setGig(data);

      const isOwner = user?.id === data.client_id;
      const viewerRole: 'client' | 'freelancer' = isOwner
        ? 'client'
        : profile?.active_mode === 'hire'
        ? 'client'
        : 'freelancer';

      // Check if an agreement exists for this gig where caller is a participant
      const myAgreements = user ? await applicationsService.getMyAgreements() : [];
      const matchingAgr = myAgreements.find((a) => a.gig_id === data.id) || null;
      setGigAgreement(matchingAgr);

      if (matchingAgr && user) {
        const [mls, pays, revs] = await Promise.all([
          milestonesService.getAgreementMilestones(matchingAgr.id),
          paymentsService.getAgreementPayments(matchingAgr.id),
          reviewsService.getAgreementReviews(matchingAgr.id),
        ]);
        const agrViewerRole: 'client' | 'freelancer' =
          user.id === matchingAgr.client_id ? 'client' : 'freelancer';
        setLoopState(
          computeAgreementLoopState({
            viewerRole: agrViewerRole,
            agreementStatus: matchingAgr.status,
            agreedPriceCentavos: matchingAgr.agreed_price,
            clientName: matchingAgr.client?.display_name || data.client.display_name || 'Client',
            freelancerName: matchingAgr.freelancer?.display_name || 'Freelancer',
            milestones: mls,
            payments: pays,
            reviews: revs,
            viewerUserId: user.id,
          })
        );
        return;
      }

      if (isOwner) {
        const apps = await applicationsService.getGigApplicants(data.id);
        const pendingCount = apps.filter(
          (a) => a.status === 'applied' || a.status === 'countered'
        ).length;
        setLoopState(
          computePreAgreementLoopState({
            viewerRole: 'client',
            gigStatus: data.status,
            applicantCount: pendingCount,
            clientName: data.client.display_name,
          })
        );
      } else if (user) {
        const myApps = await applicationsService.getMyApplications();
        const foundApp = myApps.find((a) => a.gig_id === data.id) || null;
        setMyApplication(foundApp);
        setLoopState(
          computePreAgreementLoopState({
            viewerRole,
            gigStatus: data.status,
            applicationStatus: foundApp?.status || null,
            clientName: data.client.display_name,
            counterPriceCentavos: foundApp?.counter_price,
          })
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load gig details.');
    } finally {
      setLoading(false);
    }
  }, [id, user?.id, profile?.active_mode]);

  useFocusEffect(
    useCallback(() => {
      void loadGigAndLoop();
      if (!user?.id) return;
      return notificationsService.subscribeToNotifications(user.id, () => {
        void loadGigAndLoop();
      });
    }, [loadGigAndLoop, user?.id])
  );

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !gig) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
          {error ? strings.common.errorTitle : strings.gigs.gigUnavailableTitle}
        </Text>
        <Text style={[styles.errorDesc, { color: theme.colors.muted }]}>
          {error || strings.gigs.gigUnavailable}
        </Text>
        {gigAgreement ? (
          <>
            <Text style={[styles.errorDesc, { color: theme.colors.muted }]}>
              {strings.gigs.unavailableAgreementDesc}
            </Text>
            <Button
              title={strings.gigs.openAgreement}
              onPress={() => router.push({ pathname: '/agreements/[id]', params: { id: gigAgreement.id } })}
            />
          </>
        ) : null}
        {error ? (
          <Button title={strings.common.retry} onPress={loadGigAndLoop} variant="secondary" />
        ) : null}
        <Button
          title={strings.common.back}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/gigs');
            }
          }}
          variant="secondary"
        />
      </View>
    );
  }

  const isOwner = user?.id === gig.client_id;
  const isFreelancerMode = profile?.active_mode === 'find_work';
  const viewerRole: 'client' | 'freelancer' = isOwner
    ? 'client'
    : isFreelancerMode
    ? 'freelancer'
    : 'client';

  const handleApplyPress = () => {
    if (gigAgreement) {
      router.push({ pathname: '/agreements/[id]', params: { id: gigAgreement.id } });
      return;
    }
    if (isOwner) {
      if (gig.status !== 'open') return;
      router.push({ pathname: '/gigs/[id]/applicants', params: { id: gig.id } });
      return;
    }
    if (gig.status !== 'open') return;
    if (!isFreelancerMode) {
      showToast(
        'You are currently in Hire Someone mode. To apply for gigs, you must switch to Find Work mode.',
        'info'
      );
      return;
    }
    router.push({ pathname: '/gigs/[id]/apply', params: { id: gig.id } });
  };

  const handleOpenChat = async () => {
    try {
      if (gigAgreement) {
        const convId = await chatService.getOrCreateConversation({
          agreementId: gigAgreement.id,
        });
        router.push({
          pathname: '/chat/[conversationId]',
          params: {
            conversationId: convId,
            partnerName: isOwner
              ? gigAgreement.freelancer?.display_name || 'Freelancer'
              : gig.client.display_name || 'Client',
          },
        });
      } else if (myApplication) {
        const convId = await chatService.getOrCreateConversation({
          applicationId: myApplication.id,
        });
        router.push({
          pathname: '/chat/[conversationId]',
          params: {
            conversationId: convId,
            partnerName: gig.client.display_name || 'Client',
          },
        });
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not open conversation.', 'error');
    }
  };

  const handleCancelGig = async () => {
    const confirmed = await confirmDialog({
      title: 'Cancel Gig',
      message: 'Are you sure you want to cancel this gig? Pending applicants will be notified.',
      confirmText: 'Cancel Gig',
      cancelText: 'Keep Gig',
      destructive: true,
    });

    if (!confirmed) return;

    setCancelling(true);
    try {
      await gigsService.cancelGig(gig.id, 'Cancelled by client from gig details');
      await loadGigAndLoop();
      showToast(strings.toasts.gigCancelled);
    } catch (err: any) {
      showToast(err?.message || 'Failed to cancel gig.', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleDeleteGig = async () => {
    try {
      const apps = await applicationsService.getGigApplicants(gig.id);
      const pending = apps.filter((app) => app.status === 'applied' || app.status === 'countered').length;
      const confirmed = await confirmDialog({
        title: strings.gigs.deleteGigTitle,
        message: pending > 0
          ? pending === 1 ? strings.gigs.deleteGigApplicantsOneMessage : strings.gigs.deleteGigApplicantsManyMessage.replace('{count}', String(pending))
          : strings.gigs.deleteGigNoApplicantsMessage,
        confirmText: strings.gigs.deleteGigConfirm,
        cancelText: strings.gigs.keepGig,
        destructive: true,
      });
      if (!confirmed) return;
      setDeleting(true);
      const notified = await gigsService.deleteGig(gig.id, 'Deleted by client');
      showToast(notified === 1 ? strings.toasts.gigDeletedOneApplicant : notified > 1 ? strings.toasts.gigDeletedApplicants.replace('{count}', String(notified)) : strings.toasts.gigDeleted);
      router.replace('/(tabs)/gigs');
    } catch (err: any) {
      showToast(mapSqlErrorToFriendlyMessage(err, 'Could not delete this gig.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handlePublishDraft = async () => {
    const confirmed = await confirmDialog({
      title: strings.gigs.publishDraftTitle,
      message: strings.gigs.publishDraftMessage,
      confirmText: strings.gigs.publishDraftConfirm,
      cancelText: strings.common.cancel,
    });
    if (!confirmed) return;

    setPublishing(true);
    try {
      await gigsService.publishGig(gig.id);
      await loadGigAndLoop();
      showToast(strings.toasts.gigPublished, 'success');
    } catch (err: any) {
      showToast(err?.message || strings.gigs.publishDraftFailed, 'error');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <ScreenBackground>
      <View style={styles.container}>
        {/* Top Bar */}
        <View
          style={[
            styles.topBar,
            { backgroundColor: 'rgba(255, 255, 255, 0.85)', borderBottomColor: theme.colors.border },
          ]}
        >
          <View style={styles.topBarInner}>
            <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/gigs');
                }
              }}
              style={styles.backBtn}
            >
              <Text style={{ color: theme.colors.primary, fontSize: 16 }}>← Back</Text>
            </TouchableOpacity>
            <Badge status={gig.status} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Shared Next Step Banner & Relationship Timeline (Section 1) */}
        {loopState && (
          <View style={styles.loopSection}>
            <NextStepBanner
              loopState={loopState}
              actionLabel={
                gigAgreement
                  ? 'Open Agreement ›'
                  : isOwner && gig.status === 'open'
                  ? 'View Applicants ›'
                  : isFreelancerMode && gig.status === 'open' && !myApplication
                  ? strings.gigs.applyBtn
                  : undefined
              }
              onActionPress={
                gigAgreement || (isOwner && gig.status === 'open') || (isFreelancerMode && gig.status === 'open' && !myApplication)
                  ? handleApplyPress
                  : undefined
              }
              onOpenChatPress={gigAgreement || myApplication ? handleOpenChat : undefined}
            />

            <Timeline
              currentStage={loopState.currentStage}
              viewerRole={viewerRole}
              loopState={loopState}
            />
          </View>
        )}

        {gig.status === 'completed' || gig.status === 'cancelled' || gig.status === 'expired' ? (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {gig.status === 'completed'
                ? strings.gigs.completedReadOnlyTitle
                : strings.gigs.closedReadOnlyTitle}
            </Text>
            <Text style={[styles.bodyText, { color: theme.colors.muted }]}>
              {gig.status === 'completed'
                ? strings.gigs.completedReadOnlyDesc
                : strings.gigs.closedReadOnlyDesc}
            </Text>
          </View>
        ) : null}

        {/* Modularized Main Gig Info, Description, Requirements, and Poster Profile */}
        <GigDetailInfo
          gig={gig}
          theme={theme}
          onClientPress={() => {
            if (gig.client_id) {
              router.push({ pathname: '/profile/[id]', params: { id: gig.client_id } });
            }
          }}
        />
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View
        style={[
          styles.bottomBar,
          { backgroundColor: 'rgba(255, 255, 255, 0.95)', borderTopColor: theme.colors.border },
        ]}
      >
        <View style={styles.bottomBarInner}>
          {gigAgreement ? (
          <View style={{ width: '100%', gap: 8 }}>
            <Button
              title={gig.status === 'completed' ? 'View Completed Agreement' : 'View Agreement'}
              onPress={() => router.push({ pathname: '/agreements/[id]', params: { id: gigAgreement.id } })}
              variant="primary"
            />
            {isOwner && gig.status !== 'completed' ? <Button title={deleting ? strings.gigs.deletingGig : strings.gigs.deleteGigBtn} onPress={handleDeleteGig} variant="secondary" disabled={deleting || gigAgreement.status !== 'cancelled'} loading={deleting} /> : null}
            {isOwner && gig.status !== 'completed' && gigAgreement.status !== 'cancelled' ? <Text style={[styles.reasonText, { color: theme.colors.muted }]}>{strings.gigs.alreadyHiredDeleteBlock}</Text> : null}
          </View>
        ) : isOwner && (gig.status === 'open' || gig.status === 'draft') ? (
          <View style={styles.ownerActionBar}>
            <View style={{ flex: 1 }}>
              {gig.status === 'draft' ? (
                <Button
                  title={strings.gigs.publishBtn}
                  onPress={handlePublishDraft}
                  variant="primary"
                  loading={publishing}
                  disabled={publishing || cancelling || deleting}
                />
              ) : (
                <Button title="View Applicants" onPress={handleApplyPress} variant="primary" />
              )}
            </View>
            <TouchableOpacity
              style={[
                styles.manageOptionsBtn,
                { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
              ]}
              onPress={() => setManageSheetVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Manage Gig Options"
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.text} />
              <Text style={[styles.manageBtnText, { color: theme.colors.text }]}>Options</Text>
            </TouchableOpacity>
          </View>
        ) : isOwner && gig.status !== 'completed' ? (
          <View style={{ width: '100%', gap: 8 }}>
          <Text style={[styles.reasonText, { color: theme.colors.muted }]}>{strings.gigs.closedReadOnlyDesc}</Text>
            <Button title={deleting ? strings.gigs.deletingGig : strings.gigs.deleteGigBtn} onPress={handleDeleteGig} variant="secondary" loading={deleting} disabled={deleting} />
          </View>
        ) : isOwner ? (
          <Text style={[styles.reasonText, { color: theme.colors.muted }]}>
            {gig.status === 'completed'
              ? strings.gigs.completedReadOnlyDesc
              : strings.gigs.closedReadOnlyDesc}
          </Text>
        ) : isFreelancerMode ? (
          <View style={{ width: '100%' }}>
            {myApplication ? (
              <>
                <Text style={[styles.reasonText, { color: theme.colors.muted }]}>
                  You have already submitted a proposal ({myApplication.status}).
                </Text>
                <Button
                  title="View My Proposal in Activity"
                  onPress={() => router.push('/(tabs)/activity')}
                  variant="secondary"
                />
              </>
            ) : (
              <>
                {gig.status !== 'open' && (
                  <Text style={[styles.reasonText, { color: theme.colors.muted }]}>
                    {gig.status === 'in_progress'
                      ? 'This gig is already in progress.'
                      : gig.status === 'completed'
                      ? 'This gig has been completed.'
                      : 'This gig is not open for applications.'}
                  </Text>
                )}
                {gig.status === 'open' ? (
                  <Button
                    title={strings.gigs.applyBtn}
                    onPress={handleApplyPress}
                    variant="primary"
                  />
                ) : null}
              </>
            )}
          </View>
        ) : (
          <View style={{ width: '100%' }}>
            {gig.status === 'open' ? (
              <>
                <Text style={[styles.reasonText, { color: theme.colors.muted }]}>
                  Switch to Find Work mode in your Profile settings to apply.
                </Text>
                <Button
                  title="Apply for this Gig"
                  onPress={handleApplyPress}
                  variant="secondary"
                  disabled={true}
                />
              </>
            ) : (
              <Text style={[styles.reasonText, { color: theme.colors.muted }]}>
                {gig.status === 'completed'
                  ? strings.gigs.completedReadOnlyDesc
                  : strings.gigs.closedReadOnlyDesc}
              </Text>
            )}
          </View>
        )}
        </View>
      </View>

      {/* Modularized Manage Gig Bottom Sheet Modal */}
      <ManageGigModal
        visible={manageSheetVisible}
        onClose={() => setManageSheetVisible(false)}
        gig={gig}
        theme={theme}
        editTitle={strings.gigs.editGig}
        cancelTitle={strings.gigs.cancelGigBtn}
        deleteTitle={strings.gigs.deleteGigBtn}
        onEdit={() => {
          setManageSheetVisible(false);
          router.push({ pathname: '/gigs/post', params: { editGigId: gig?.id } });
        }}
        onCancel={async () => {
          setManageSheetVisible(false);
          await handleCancelGig();
        }}
        onDelete={async () => {
          setManageSheetVisible(false);
          await handleDeleteGig();
        }}
        publishing={publishing}
        cancelling={cancelling}
        deleting={deleting}
      />
    </View>
  </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarInner: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    paddingVertical: 6,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorDesc: {
    fontSize: 14,
    marginBottom: 20,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 140,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  loopSection: {
    gap: 12,
    marginBottom: 14,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bottomBarInner: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  ownerActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  manageOptionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 54,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
  },
  manageBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  reasonText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
});

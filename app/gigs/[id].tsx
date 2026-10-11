import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
import { formatPrice, getWorkTypeIcon } from '../../components/ui/GigCard';
import { Badge } from '../../components/ui/Badge';
import { showToast } from '../../components/ui/Toast';
import { confirmDialog } from '../../lib/dialog';
import { Button } from '../../components/ui/Button';
import {
  Timeline,
  NextStepBanner,
  LoopStageState,
  computeAgreementLoopState,
  computePreAgreementLoopState,
} from '../../components/ui/Timeline';
import { strings } from '../../constants/strings';

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

  const loadGigAndLoop = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await gigsService.getGig(id);
      if (!data) {
        setError('Gig not found or has been removed.');
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
      const myAgreements = user ? await applicationsService.getMyAgreements().catch(() => []) : [];
      const matchingAgr = myAgreements.find((a) => a.gig_id === data.id) || null;
      setGigAgreement(matchingAgr);

      if (matchingAgr && user) {
        const [mls, pays, revs] = await Promise.all([
          milestonesService.getAgreementMilestones(matchingAgr.id).catch(() => []),
          paymentsService.getAgreementPayments(matchingAgr.id).catch(() => []),
          reviewsService.getAgreementReviews(matchingAgr.id).catch(() => []),
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
        const apps = await applicationsService.getGigApplicants(data.id).catch(() => []);
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
        const myApps = await applicationsService.getMyApplications().catch(() => []);
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

  useEffect(() => {
    loadGigAndLoop();
  }, [loadGigAndLoop]);

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
        <Text style={[styles.errorTitle, { color: theme.colors.text }]}>Gig not found</Text>
        <Text style={[styles.errorDesc, { color: theme.colors.muted }]}>
          {error || 'This gig does not exist.'}
        </Text>
        <Button
          title="← Go Back"
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

  const priceDisplay =
    gig.price_min === gig.price_max
      ? formatPrice(gig.price_min)
      : `${formatPrice(gig.price_min)} - ${formatPrice(gig.price_max)}`;

  const appDeadline = new Date(gig.application_deadline).toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const completionDeadline = new Date(gig.deadline).toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handleApplyPress = () => {
    if (gigAgreement) {
      router.push({ pathname: '/agreements/[id]', params: { id: gigAgreement.id } });
      return;
    }
    if (isOwner) {
      router.push({ pathname: '/gigs/[id]/applicants', params: { id: gig.id } });
      return;
    }
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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Bar */}
      <View
        style={[
          styles.topBar,
          { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border },
        ]}
      >
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Shared Next Step Banner & Relationship Timeline (Section 1) */}
        {loopState && (
          <View style={styles.loopSection}>
            <NextStepBanner
              loopState={loopState}
              actionLabel={
                gigAgreement
                  ? 'Open Agreement ›'
                  : isOwner
                  ? 'View Applicants ›'
                  : isFreelancerMode && gig.status === 'open' && !myApplication
                  ? strings.gigs.applyBtn
                  : undefined
              }
              onActionPress={
                gigAgreement || isOwner || (isFreelancerMode && gig.status === 'open' && !myApplication)
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

        {/* Main Info */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.categoryBadge, { color: theme.colors.primary }]}>
            {gig.category_name || 'General Category'}
          </Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>{gig.title}</Text>
          <Text style={[styles.price, { color: theme.colors.text }]}>{priceDisplay}</Text>

          <View style={styles.gridMeta}>
            <View style={styles.metaCol}>
              <Text style={[styles.metaLabel, { color: theme.colors.muted }]}>Work Type</Text>
              <Text style={[styles.metaVal, { color: theme.colors.text }]}>
                {getWorkTypeIcon(gig.work_type)}
              </Text>
            </View>
            {gig.area ? (
              <View style={styles.metaCol}>
                <Text style={[styles.metaLabel, { color: theme.colors.muted }]}>Location</Text>
                <Text style={[styles.metaVal, { color: theme.colors.text }]}>📍 {gig.area}</Text>
              </View>
            ) : null}
            <View style={styles.metaCol}>
              <Text style={[styles.metaLabel, { color: theme.colors.muted }]}>Apply Deadline</Text>
              <Text style={[styles.metaVal, { color: theme.colors.text }]}>{appDeadline}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={[styles.metaLabel, { color: theme.colors.muted }]}>Project Deadline</Text>
              <Text style={[styles.metaVal, { color: theme.colors.text }]}>{completionDeadline}</Text>
            </View>
          </View>
        </View>

        {/* Description */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Description</Text>
          <Text style={[styles.bodyText, { color: theme.colors.text }]}>{gig.description}</Text>
        </View>

        {/* Requirements */}
        {gig.requirements ? (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Requirements</Text>
            <Text style={[styles.bodyText, { color: theme.colors.text }]}>{gig.requirements}</Text>
          </View>
        ) : null}

        {/* Client Profile Summary */}
        <TouchableOpacity
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
          onPress={() => {
            if (gig.client_id) {
              router.push({ pathname: '/profile/[id]', params: { id: gig.client_id } });
            }
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Posted By</Text>
          <View style={styles.clientRow}>
            <View style={[styles.clientAvatar, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.clientLetter}>
                {(gig.client.display_name || 'C').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.clientInfo}>
              <Text style={[styles.clientName, { color: theme.colors.text }]}>
                {gig.client.display_name}
              </Text>
              <Text style={[styles.clientStats, { color: theme.colors.muted }]}>
                ★ {Number(gig.client.client_rating_avg || 0).toFixed(1)} (
                {gig.client.client_rating_count || 0} reviews) •{' '}
                {gig.client.client_completed_gigs || 0} completed gigs
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View
        style={[
          styles.bottomBar,
          { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        ]}
      >
        {gigAgreement ? (
          <Button
            title="View Active Agreement"
            onPress={() =>
              router.push({ pathname: '/agreements/[id]', params: { id: gigAgreement.id } })
            }
            variant="primary"
          />
        ) : isOwner ? (
          <View style={{ width: '100%', gap: 8 }}>
            <Button title="View Applicants" onPress={handleApplyPress} variant="primary" />
            {(gig.status === 'open' || gig.status === 'draft') && (
              <Button
                title={strings.gigs.cancelGigBtn}
                onPress={handleCancelGig}
                variant="secondary"
                loading={cancelling}
                disabled={cancelling}
              />
            )}
          </View>
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
                <Button
                  title={strings.gigs.applyBtn}
                  onPress={handleApplyPress}
                  variant="primary"
                  disabled={gig.status !== 'open'}
                />
              </>
            )}
          </View>
        ) : (
          <View style={{ width: '100%' }}>
            <Text style={[styles.reasonText, { color: theme.colors.muted }]}>
              Switch to Find Work mode in your Profile settings to apply.
            </Text>
            <Button
              title="Apply for this Gig"
              onPress={handleApplyPress}
              variant="secondary"
              disabled={true}
            />
          </View>
        )}
      </View>
    </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    paddingBottom: 120,
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
  },
  categoryBadge: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 8,
  },
  price: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
  },
  gridMeta: {
    gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  metaCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 13,
  },
  metaVal: {
    fontSize: 13,
    fontWeight: '600',
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
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientLetter: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  clientStats: {
    fontSize: 13,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reasonText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
});

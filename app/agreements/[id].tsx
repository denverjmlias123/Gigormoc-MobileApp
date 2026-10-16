import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { applicationsService, AgreementItem } from '../../services/applications';
import { milestonesService, MilestoneItem } from '../../services/milestones';
import { paymentsService, PaymentItem } from '../../services/payments';
import { reviewsService, ReviewItem } from '../../services/reviews';
import { chatService } from '../../services/chat';
import { reportsService } from '../../services/reports';
import { notificationsService } from '../../services/notifications';
import { formatPrice } from '../../components/ui/GigCard';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
  Timeline,
  NextStepBanner,
  computeAgreementLoopState,
} from '../../components/ui/Timeline';
import { showToast } from '../../components/ui/Toast';
import { confirmDialog } from '../../lib/dialog';
import { mapSqlErrorToFriendlyMessage, strings } from '../../constants/strings';
import { AgreementTermsCard } from '../../components/agreements/AgreementTermsCard';
import { PaymentsEvidenceCard } from '../../components/agreements/PaymentsEvidenceCard';
import { AgreementReviewsCard } from '../../components/agreements/AgreementReviewsCard';

export default function AgreementDetailScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [agreement, setAgreement] = useState<AgreementItem | null>(null);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const safeNavigateBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/activity');
    }
  };

  const handleOpenReceipt = async (receiptPath: string) => {
    try {
      const signedUrl = await paymentsService.createSignedReceiptUrl(receiptPath);
      const targetUrl = signedUrl || receiptPath;
      if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
        await Linking.openURL(targetUrl);
      } else {
        showToast('Receipt Proof Path: ' + targetUrl, 'info');
      }
    } catch {
      showToast('Could not open this payment receipt attachment.', 'error');
    }
  };

  const loadData = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [agrData, mlsData, payData, revData] = await Promise.all([
        applicationsService.getAgreementDetail(id),
        milestonesService.getAgreementMilestones(id),
        paymentsService.getAgreementPayments(id),
        reviewsService.getAgreementReviews(id),
      ]);
      if (!agrData) {
        setError('Agreement not found.');
      } else {
        setAgreement(agrData);
        setMilestones(mlsData);
        setPayments(payData);
        setReviews(revData);
      }
    } catch (err: any) {
      setError(mapSqlErrorToFriendlyMessage(err, 'Failed to load agreement details.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      if (!user?.id) return;
      return notificationsService.subscribeToNotifications(user.id, (notification) => {
        if (notification.entity_id === id || notification.data?.agreement_id === id) {
          void loadData();
        }
      });
    }, [id, loadData, user?.id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOpenChat = async () => {
    if (!id) return;
    try {
      const convId = await chatService.getOrCreateConversation({ agreementId: id });
      const partnerName = isClient
        ? agreement?.freelancer?.display_name || 'Freelancer'
        : agreement?.client?.display_name || 'Client';

      router.push({
        pathname: '/chat/[conversationId]',
        params: { conversationId: convId, partnerName },
      });
    } catch (err: any) {
      showToast(mapSqlErrorToFriendlyMessage(err, 'Could not open conversation.'), 'error');
    }
  };

  const handleCancelAgreement = async () => {
    if (!id || cancelling) return;

    const hasWorkStarted = milestones.some(
      (m) => m.status === 'submitted' || m.status === 'approved' || m.status === 'revision_requested'
    );

    const promptMessage = hasWorkStarted
      ? 'Deliverables have already been submitted for this agreement. Initiating cancellation will flag this agreement as Disputed and create a report for moderator review.\n\nAre you sure you want to proceed?'
      : 'No deliverables have been submitted yet. Cancelling now will terminate the agreement freely and return the gig to cancelled status.\n\nAre you sure you want to cancel?';

    const confirmed = await confirmDialog({
      title: 'Cancel Agreement',
      message: promptMessage,
      confirmText: 'Confirm Cancellation',
      cancelText: 'Keep Agreement',
      destructive: true,
    });

    if (!confirmed) return;

    setCancelling(true);
    try {
      await reportsService.cancelAgreement(id, 'Mutual or early agreement cancellation.');
      showToast(strings.toasts.agreementCancelled);
      await loadData();
    } catch (err: any) {
      showToast(mapSqlErrorToFriendlyMessage(err, 'Failed to cancel agreement.'), 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleConfirmPayment = async (paymentId: string) => {
    if (confirmingPaymentId) return;

    const confirmed = await confirmDialog({
      title: 'Confirm External Payment',
      message:
        'Have you confirmed receipt of these funds outside the app (GCash, Maya, Bank or Cash)? This action cannot be undone.',
      confirmText: 'Yes, Confirm Received',
      cancelText: 'Cancel',
    });

    if (!confirmed) return;

    setConfirmingPaymentId(paymentId);
    try {
      await paymentsService.confirmPayment(paymentId);
      showToast(strings.toasts.paymentConfirmed);
      await loadData();
    } catch (err: any) {
      showToast(mapSqlErrorToFriendlyMessage(err, 'Failed to confirm payment.'), 'error');
    } finally {
      setConfirmingPaymentId(null);
    }
  };

  const handleCompleteAgreement = async () => {
    if (!id || completing) return;

    const confirmed = await confirmDialog({
      title: 'Complete Agreement',
      message:
        'Are you sure all agreed deliverables are approved and all external payments have been confirmed? This concludes the active contract.',
      confirmText: 'Complete Contract',
      cancelText: 'Cancel',
    });

    if (!confirmed) return;

    setCompleting(true);
    try {
      await paymentsService.completeAgreement(id);
      showToast(strings.toasts.agreementCompleted);
      await loadData();
    } catch (err: any) {
      showToast(mapSqlErrorToFriendlyMessage(err, 'Could not complete agreement.'), 'error');
    } finally {
      setCompleting(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !agreement) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.dangerText }]}>
          {error || 'Agreement not found.'}
        </Text>
        <Button title="Back to Activity" variant="secondary" onPress={safeNavigateBack} />
      </View>
    );
  }

  const isClient = user?.id === agreement.client_id;
  const isFreelancer = user?.id === agreement.freelancer_id;
  const viewerRole: 'client' | 'freelancer' = isClient ? 'client' : 'freelancer';

  const confirmedPaymentsCentavos = payments
    .filter((p) => p.status === 'confirmed_received')
    .reduce((sum, p) => sum + p.amount, 0);

  const approvedMilestonesCount = milestones.filter((m) => m.status === 'approved').length;
  const allMilestonesApproved =
    milestones.length > 0 && milestones.every((m) => m.status === 'approved');
  const isFullyPaid = confirmedPaymentsCentavos >= agreement.agreed_price;
  const hasPaymentDisputes = payments.some((p) => p.status === 'disputed');
  const hasPendingPaymentReports = payments.some((p) => p.status === 'reported_sent');

  const canCompleteAgreement =
    agreement.status === 'active' &&
    allMilestonesApproved &&
    isFullyPaid &&
    !hasPaymentDisputes &&
    !hasPendingPaymentReports;

  const loopState = computeAgreementLoopState({
    viewerRole,
    agreementStatus: agreement.status,
    agreedPriceCentavos: agreement.agreed_price,
    clientName: agreement.client?.display_name || 'Client',
    freelancerName: agreement.freelancer?.display_name || 'Freelancer',
    milestones,
    payments,
    reviews,
    viewerUserId: user?.id,
  });

  // Determine optional primary shortcut button inside the Next step banner
  let bannerActionLabel: string | undefined;
  let bannerActionPress: (() => void) | undefined;

  if (loopState.isViewerTurn) {
    if (loopState.currentStage === 'accepted' && isClient) {
      bannerActionLabel = 'Setup Milestones';
      bannerActionPress = () => {
        router.push({
          pathname: '/agreements/[id]/milestones/setup',
          params: { id: agreement.id, agreedPrice: agreement.agreed_price.toString() },
        });
      };
    } else if (loopState.currentStage === 'milestones_set' && isFreelancer) {
      const nextPending = milestones.find((m) => m.status === 'pending');
      if (nextPending) {
        bannerActionLabel = 'Submit Work';
        bannerActionPress = () => {
          router.push({
            pathname: '/agreements/[id]/milestones/[milestoneId]/submit',
            params: {
              id: agreement.id,
              milestoneId: nextPending.id,
              title: nextPending.title,
              revisionCount: nextPending.revision_count.toString(),
              revisionFeedback: nextPending.revision_feedback || '',
            },
          });
        };
      }
    } else if (loopState.currentStage === 'work_submitted' && isClient) {
      const submittedM = milestones.find((m) => m.status === 'submitted');
      if (submittedM) {
        bannerActionLabel = 'Review Work';
        bannerActionPress = () => {
          router.push({
            pathname: '/agreements/[id]/milestones/[milestoneId]/review',
            params: {
              id: agreement.id,
              milestoneId: submittedM.id,
              title: submittedM.title,
              revisionCount: submittedM.revision_count.toString(),
            },
          });
        };
      }
    } else if (loopState.currentStage === 'approved' && isFreelancer) {
      const revM = milestones.find((m) => m.status === 'revision_requested');
      if (revM) {
        bannerActionLabel = 'Resubmit Work';
        bannerActionPress = () => {
          router.push({
            pathname: '/agreements/[id]/milestones/[milestoneId]/submit',
            params: {
              id: agreement.id,
              milestoneId: revM.id,
              title: revM.title,
              revisionCount: revM.revision_count.toString(),
              revisionFeedback: revM.revision_feedback || '',
            },
          });
        };
      }
    } else if (loopState.currentStage === 'approved' && isClient) {
      bannerActionLabel = 'Report Payment';
      bannerActionPress = () => {
        router.push({
          pathname: '/agreements/[id]/payments/report',
          params: {
            id: agreement.id,
            agreedPrice: agreement.agreed_price.toString(),
            unpaidAmount: Math.max(0, agreement.agreed_price - confirmedPaymentsCentavos).toString(),
          },
        });
      };
    } else if (loopState.currentStage === 'payment_reported' && isFreelancer) {
      const pendingPayment = payments.find((p) => p.status === 'reported_sent');
      if (pendingPayment) {
        bannerActionLabel = 'Confirm Receipt';
        bannerActionPress = () => handleConfirmPayment(pendingPayment.id);
      }
    } else if (loopState.currentStage === 'payment_confirmed' && canCompleteAgreement) {
      bannerActionLabel = 'Complete Agreement';
      bannerActionPress = handleCompleteAgreement;
    } else if (loopState.currentStage === 'done') {
      bannerActionLabel = 'Leave Review';
      bannerActionPress = () => {
        const targetName = isClient
          ? agreement.freelancer?.display_name || 'Freelancer'
          : agreement.client?.display_name || 'Client';
        const targetRole = isClient ? 'freelancer' : 'client';
        router.push({
          pathname: '/agreements/[id]/review',
          params: { id: agreement.id, targetName, targetRole },
        });
      };
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={safeNavigateBack} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: theme.colors.text }]} numberOfLines={1}>
          Agreement
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Next Step Banner */}
        <NextStepBanner
          loopState={loopState}
          actionLabel={bannerActionLabel}
          onActionPress={bannerActionPress}
          onOpenChatPress={handleOpenChat}
        />

        {/* Shared Relationship Timeline */}
        <Timeline
          currentStage={loopState.currentStage}
          viewerRole={viewerRole}
          loopState={loopState}
        />

        {/* Agreement Status & Terms */}
        <AgreementTermsCard
          agreement={agreement}
          onViewGig={() => {
            if (agreement.gig_id) {
              router.push({ pathname: '/gigs/[id]', params: { id: agreement.gig_id } });
            }
          }}
          onOpenChat={handleOpenChat}
          onReport={() => {
            router.push({
              pathname: '/reports/new',
              params: {
                targetType: 'agreement',
                targetId: agreement.id,
                targetTitle: agreement.gig?.title || 'Agreement',
              },
            });
          }}
          onCancelAgreement={handleCancelAgreement}
        />

        {/* Milestones Section */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Milestones</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.muted }]}>
                {milestones.length > 0
                  ? `${approvedMilestonesCount} of ${milestones.length} approved`
                  : 'No milestones set yet'}
              </Text>
            </View>

            {isClient && milestones.length === 0 && (
              <Button
                title="Setup Milestones"
                variant="primary"
                onPress={() => {
                  router.push({
                    pathname: '/agreements/[id]/milestones/setup',
                    params: { id: agreement.id, agreedPrice: agreement.agreed_price.toString() },
                  });
                }}
              />
            )}
            {isClient && milestones.length > 0 && milestones.every((m) => m.status === 'pending') && (
              <Button
                title="Edit Milestones"
                variant="secondary"
                onPress={() => {
                  router.push({
                    pathname: '/agreements/[id]/milestones/setup',
                    params: { id: agreement.id, agreedPrice: agreement.agreed_price.toString() },
                  });
                }}
              />
            )}
          </View>

          {milestones.length === 0 ? (
            <View style={styles.emptyMilestonesBox}>
              <Text style={[styles.emptyMilestonesText, { color: theme.colors.muted }]}>
                {isClient
                  ? 'Define 1 to 5 project milestones totaling exactly ' + formatPrice(agreement.agreed_price) + '.'
                  : 'The client will define milestones for this agreement.'}
              </Text>
            </View>
          ) : (
            <View style={styles.milestonesList}>
              {milestones.map((m) => {
                const canSubmit = isFreelancer && (m.status === 'pending' || m.status === 'revision_requested');
                const canReview = isClient && m.status === 'submitted';

                return (
                  <View
                    key={m.id}
                    style={[styles.milestoneRowCard, { borderColor: theme.colors.border }]}
                  >
                    <View style={styles.milestoneTop}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.milestoneSeqTitle, { color: theme.colors.text }]}>
                          #{m.seq} {m.title}
                        </Text>
                        {m.description ? (
                          <Text style={[styles.milestoneDesc, { color: theme.colors.muted }]} numberOfLines={2}>
                            {m.description}
                          </Text>
                        ) : null}
                      </View>
                      <Badge status={m.status} />
                    </View>

                    {m.status === 'revision_requested' && m.revision_feedback ? (
                      <View style={{ backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 8 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#B45309', marginBottom: 2 }}>
                          Revision Feedback:
                        </Text>
                        <Text style={{ fontSize: 13, color: '#92400E', lineHeight: 18 }}>
                          {m.revision_feedback}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.milestoneBottom}>
                      <Text style={[styles.milestoneAmount, { color: theme.colors.primary }]}>
                        {formatPrice(m.amount)}
                      </Text>
                      <Text style={[styles.milestoneRevisions, { color: theme.colors.muted }]}>
                        {m.revision_count > 0 ? `Revisions: ${m.revision_count}/2` : ''}
                      </Text>
                    </View>

                    {/* Action buttons */}
                    {canSubmit && (
                      <View style={styles.milestoneActionRow}>
                        <Button
                          title={m.status === 'revision_requested' ? 'Resubmit Deliverable' : 'Submit Work'}
                          variant="primary"
                          onPress={() => {
                            router.push({
                              pathname: '/agreements/[id]/milestones/[milestoneId]/submit',
                              params: {
                                id: agreement.id,
                                milestoneId: m.id,
                                title: m.title,
                                revisionCount: m.revision_count.toString(),
                                revisionFeedback: m.revision_feedback || '',
                              },
                            });
                          }}
                        />
                      </View>
                    )}

                    {canReview && (
                      <View style={styles.milestoneActionRow}>
                        <Button
                          title="Review Submitted Work"
                          variant="primary"
                          onPress={() => {
                            router.push({
                              pathname: '/agreements/[id]/milestones/[milestoneId]/review',
                              params: {
                                id: agreement.id,
                                milestoneId: m.id,
                                title: m.title,
                                revisionCount: m.revision_count.toString(),
                              },
                            });
                          }}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Complete Agreement Button */}
          {agreement.status === 'active' && (
            <View style={styles.completeAgreementContainer}>
              <Button
                title={completing ? 'Completing Agreement...' : 'Complete Agreement'}
                variant="primary"
                onPress={handleCompleteAgreement}
                disabled={!canCompleteAgreement || completing}
                loading={completing}
              />
              {!canCompleteAgreement && (
                <Text style={[styles.completeRequirementsHint, { color: theme.colors.muted }]}>
                  {!allMilestonesApproved
                    ? '• All milestones must be approved.'
                    : !isFullyPaid
                    ? '• Total confirmed payments must equal agreed price.'
                    : hasPaymentDisputes
                    ? '• All payment disputes must be resolved.'
                    : hasPendingPaymentReports
                    ? '• All payment reports must be confirmed by the freelancer.'
                    : ''}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Payments Section */}
        <PaymentsEvidenceCard
          payments={payments}
          confirmedPaymentsCentavos={confirmedPaymentsCentavos}
          agreedPrice={agreement.agreed_price}
          isClient={isClient}
          isFreelancer={isFreelancer}
          agreementStatus={agreement.status}
          confirmingPaymentId={confirmingPaymentId}
          onReportPayment={() => {
            router.push({
              pathname: '/agreements/[id]/payments/report',
              params: {
                id: agreement.id,
                agreedPrice: agreement.agreed_price.toString(),
                unpaidAmount: Math.max(0, agreement.agreed_price - confirmedPaymentsCentavos).toString(),
              },
            });
          }}
          onOpenReceipt={handleOpenReceipt}
          onConfirmPayment={handleConfirmPayment}
          onDisputePayment={(p) => {
            router.push({
              pathname: '/agreements/[id]/payments/[paymentId]/dispute',
              params: {
                id: agreement.id,
                paymentId: p.id,
                amount: p.amount.toString(),
                method: p.payment_method,
              },
            });
          }}
        />

        {/* Participants, Reviews & Notice */}
        <AgreementReviewsCard
          agreement={agreement}
          reviews={reviews}
          currentUserId={user?.id}
          isClient={isClient}
          isFreelancer={isFreelancer}
          onViewClientProfile={() => {
            if (agreement.client_id) {
              router.push({ pathname: '/profile/[id]', params: { id: agreement.client_id } });
            }
          }}
          onViewFreelancerProfile={() => {
            if (agreement.freelancer_id) {
              router.push({ pathname: '/profile/[id]', params: { id: agreement.freelancer_id } });
            }
          }}
          onLeaveReview={() => {
            const targetName = isClient
              ? agreement.freelancer?.display_name || 'Freelancer'
              : agreement.client?.display_name || 'Client';
            const targetRole = isClient ? 'freelancer' : 'client';
            router.push({
              pathname: '/agreements/[id]/review',
              params: { id: agreement.id, targetName, targetRole },
            });
          }}
        />
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
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
  milestoneRowCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  milestoneTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  milestoneSeqTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  milestoneDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  milestoneBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  milestoneAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  milestoneRevisions: {
    fontSize: 12,
  },
  milestoneActionRow: {
    marginTop: 6,
  },
  completeAgreementContainer: {
    marginTop: 12,
    gap: 8,
  },
  completeRequirementsHint: {
    fontSize: 12,
    lineHeight: 16,
  },
});

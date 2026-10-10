import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { applicationsService, AgreementItem } from '../../services/applications';
import { milestonesService, MilestoneItem } from '../../services/milestones';
import { paymentsService, PaymentItem } from '../../services/payments';
import { reviewsService, ReviewItem } from '../../services/reviews';
import { chatService } from '../../services/chat';
import { reportsService } from '../../services/reports';
import { formatPrice } from '../../components/ui/GigCard';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

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
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setError(err?.message || 'Failed to load agreement details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      Alert.alert('Chat Error', err?.message || 'Could not open conversation.');
    }
  };

  const handleCancelAgreement = () => {
    if (!id) return;

    const hasWorkStarted = milestones.some(
      (m) => m.status === 'submitted' || m.status === 'approved' || m.status === 'revision_requested'
    );

    const promptMessage = hasWorkStarted
      ? 'Deliverables have already been submitted for this agreement. Initiating cancellation will flag this agreement as Disputed and create a report for moderator review.\n\nAre you sure you want to proceed?'
      : 'No deliverables have been submitted yet. Cancelling now will terminate the agreement freely and return the gig to cancelled status.\n\nAre you sure you want to cancel?';

    Alert.alert('Cancel Agreement', promptMessage, [
      { text: 'Keep Agreement', style: 'cancel' },
      {
        text: 'Confirm Cancellation',
        style: 'destructive',
        onPress: async () => {
          try {
            const resultStatus = await reportsService.cancelAgreement(
              id,
              'Party requested cancellation via agreement detail screen'
            );
            await loadData();
            if (resultStatus === 'cancelled') {
              Alert.alert('Agreement Cancelled', 'The agreement has been cancelled.');
            } else {
              Alert.alert(
                'Dispute Flagged',
                'Because work had started, a dispute report was created for administrator review.'
              );
            }
          } catch (err: any) {
            Alert.alert('Cancellation Error', err?.message || 'Could not cancel agreement.');
          }
        },
      },
    ]);
  };

  const handleConfirmPayment = async (paymentId: string) => {
    setConfirmingPaymentId(paymentId);
    try {
      await paymentsService.confirmPayment(paymentId);
      await loadData();
      Alert.alert('Payment Confirmed', 'You have confirmed receiving this payment.');
    } catch (err: any) {
      Alert.alert('Confirmation Error', err?.message || 'Could not confirm payment.');
    } finally {
      setConfirmingPaymentId(null);
    }
  };

  const handleCompleteAgreement = () => {
    if (!id) return;

    Alert.alert(
      'Complete Agreement',
      'Are you sure you want to finalize and complete this agreement? This will record the project as completed for both parties.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete Agreement',
          onPress: async () => {
            setCompleting(true);
            try {
              await paymentsService.completeAgreement(id);
              await loadData();
              Alert.alert('Agreement Completed', 'This project is officially completed. Thank you!');
            } catch (err: any) {
              Alert.alert('Completion Error', err?.message || 'Could not complete agreement.');
            } finally {
              setCompleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !agreement) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.danger }]}>
          {error || 'Agreement not found.'}
        </Text>
        <Button title="Go Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const isClient = user?.id === agreement.client_id;
  const isFreelancer = user?.id === agreement.freelancer_id;

  const approvedMilestonesCount = milestones.filter((m) => m.status === 'approved').length;
  const allMilestonesApproved = milestones.length > 0 && approvedMilestonesCount === milestones.length;

  const confirmedPaymentsCentavos = payments
    .filter((p) => p.status === 'confirmed_received')
    .reduce((sum, p) => sum + p.amount, 0);

  const hasPaymentDisputes = payments.some((p) => p.status === 'disputed');
  const hasPendingPaymentReports = payments.some((p) => p.status === 'reported_sent');
  const isFullyPaid = confirmedPaymentsCentavos >= agreement.agreed_price;

  const canCompleteAgreement =
    agreement.status === 'active' &&
    allMilestonesApproved &&
    isFullyPaid &&
    !hasPaymentDisputes &&
    !hasPendingPaymentReports;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
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
        {/* Status & Gig Header */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.statusRow}>
            <Text style={[styles.label, { color: theme.colors.muted }]}>Status</Text>
            <Badge status={agreement.status} />
          </View>

          <Text style={[styles.gigTitle, { color: theme.colors.text }]}>
            {agreement.gig?.title || 'Gig Agreement'}
          </Text>

          <TouchableOpacity
            onPress={() => {
              if (agreement.gig_id) {
                router.push({ pathname: '/gigs/[id]', params: { id: agreement.gig_id } });
              }
            }}
          >
            <Text style={[styles.linkText, { color: theme.colors.primary }]}>View Original Gig ›</Text>
          </TouchableOpacity>

          {/* Quick Agreement Communication & Protection Actions */}
          <View style={styles.quickActionButtonsRow}>
            <TouchableOpacity
              style={[styles.chatBtn, { backgroundColor: theme.colors.primarySoft }]}
              onPress={handleOpenChat}
            >
              <Text style={[styles.chatBtnText, { color: theme.colors.primary }]}>💬 Open Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.reportBtn, { borderColor: theme.colors.border }]}
              onPress={() => {
                router.push({
                  pathname: '/reports/new',
                  params: {
                    targetType: 'agreement',
                    targetId: agreement.id,
                    targetTitle: agreement.gig?.title || 'Agreement',
                  },
                });
              }}
            >
              <Text style={[styles.reportBtnText, { color: theme.colors.muted }]}>🚩 Report</Text>
            </TouchableOpacity>

            {agreement.status === 'active' && (
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: theme.colors.danger }]}
                onPress={handleCancelAgreement}
              >
                <Text style={[styles.cancelBtnText, { color: theme.colors.danger }]}>Cancel Agreement</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Financial Terms */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Agreement Terms</Text>

          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: theme.colors.muted }]}>Agreed Amount:</Text>
            <Text style={[styles.priceValue, { color: theme.colors.primary }]}>
              {formatPrice(agreement.agreed_price)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: theme.colors.muted }]}>Completion Deadline:</Text>
            <Text style={[styles.value, { color: theme.colors.text }]}>
              {new Date(agreement.deadline).toLocaleDateString(undefined, {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: theme.colors.muted }]}>Agreement ID:</Text>
            <Text style={[styles.monoValue, { color: theme.colors.muted }]}>
              {agreement.id.slice(0, 8)}...
            </Text>
          </View>
        </View>

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
        </View>

        {/* Payments Section (External Evidence) */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Payments</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.muted }]}>
                Confirmed: {formatPrice(confirmedPaymentsCentavos)} / {formatPrice(agreement.agreed_price)}
              </Text>
            </View>

            {isClient && agreement.status === 'active' && (
              <Button
                title="Report Payment"
                variant="primary"
                onPress={() => {
                  router.push({
                    pathname: '/agreements/[id]/payments/report',
                    params: { id: agreement.id, agreedPrice: agreement.agreed_price.toString() },
                  });
                }}
              />
            )}
          </View>

          {payments.length === 0 ? (
            <View style={styles.emptyMilestonesBox}>
              <Text style={[styles.emptyMilestonesText, { color: theme.colors.muted }]}>
                {isClient
                  ? 'No external payments reported yet. After sending funds (GCash, Maya, cash), tap "Report Payment" above.'
                  : 'No payment reports recorded yet by the client.'}
              </Text>
            </View>
          ) : (
            <View style={styles.milestonesList}>
              {payments.map((p) => {
                const isReported = p.status === 'reported_sent';
                const isConfirmed = p.status === 'confirmed_received';
                const isDisputed = p.status === 'disputed';
                const canAct = isFreelancer && isReported;

                return (
                  <View
                    key={p.id}
                    style={[
                      styles.paymentRowCard,
                      {
                        borderColor: isDisputed ? '#F3A6AE' : isConfirmed ? '#9BD9BE' : theme.colors.border,
                        backgroundColor: isDisputed ? '#FDE8EA' : isConfirmed ? '#DDF5EA' : theme.colors.surface,
                      },
                    ]}
                  >
                    <View style={styles.paymentRowTop}>
                      <View>
                        <Text style={[styles.paymentAmount, { color: theme.colors.text }]}>
                          {formatPrice(p.amount)}
                        </Text>
                        <Text style={[styles.paymentMethod, { color: theme.colors.muted }]}>
                          Channel: {p.payment_method.toUpperCase()}
                          {p.reference_number ? ` • Ref: ${p.reference_number}` : ''}
                        </Text>
                      </View>

                      {isReported && <Badge status="pending" label="Reported sent" />}
                      {isConfirmed && <Badge status="active" label="Confirmed by freelancer" />}
                      {isDisputed && <Badge status="disputed" label="Disputed" />}
                    </View>

                    {p.notes ? (
                      <Text style={[styles.paymentNotes, { color: theme.colors.muted }]}>
                        Notes: {p.notes}
                      </Text>
                    ) : null}

                    {isDisputed && p.dispute_reason ? (
                      <Text style={styles.disputeReasonText}>
                        Dispute reason: {p.dispute_reason}
                      </Text>
                    ) : null}

                    {/* Freelancer Action Buttons */}
                    {canAct && (
                      <View style={styles.paymentActionButtons}>
                        <Button
                          title="Confirm Receipt"
                          variant="primary"
                          onPress={() => handleConfirmPayment(p.id)}
                          disabled={confirmingPaymentId === p.id}
                          loading={confirmingPaymentId === p.id}
                        />
                        <Button
                          title="Dispute"
                          variant="danger"
                          onPress={() => {
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

        {/* Counterparty Information */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
            <TouchableOpacity
              onPress={() => {
                if (agreement.client_id) {
                  router.push({ pathname: '/profile/[id]', params: { id: agreement.client_id } });
                }
              }}
            >
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
            <TouchableOpacity
              onPress={() => {
                if (agreement.freelancer_id) {
                  router.push({ pathname: '/profile/[id]', params: { id: agreement.freelancer_id } });
                }
              }}
            >
              <Text style={[styles.linkText, { color: theme.colors.primary }]}>Profile ›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Reviews Section (Only for completed agreements) */}
        {agreement.status === 'completed' && (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Reviews & Feedback</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.muted }]}>
                  {reviews.length > 0 ? `${reviews.length} review(s) published` : 'No reviews submitted yet'}
                </Text>
              </View>

              {!reviews.some((r) => r.reviewer_id === user?.id) && (
                <Button
                  title="Leave Review"
                  variant="primary"
                  onPress={() => {
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
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gigTitle: {
    fontSize: 20,
    fontWeight: '700',
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
    fontWeight: '600',
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
    marginTop: 4,
  },
  paymentRowCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  paymentRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  paymentMethod: {
    fontSize: 12,
    marginTop: 2,
  },
  paymentNotes: {
    fontSize: 13,
    lineHeight: 18,
  },
  disputeReasonText: {
    fontSize: 13,
    color: '#A31F2D',
    fontWeight: '500',
  },
  paymentActionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  completeAgreementContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DCE4F2',
    gap: 6,
  },
  completeRequirementsHint: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  quickActionButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DCE4F2',
  },
  chatBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  chatBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  reportBtn: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  reportBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cancelBtn: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  reviewItemCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
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
    color: '#B45309',
  },
  reviewComment: {
    fontSize: 13,
    lineHeight: 18,
  },
  reviewDate: {
    fontSize: 12,
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  monoValue: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  partyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partyRole: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  partyName: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  noticeCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B5C41',
  },
  noticeText: {
    fontSize: 13,
    color: '#12805C',
    lineHeight: 18,
  },
});

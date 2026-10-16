import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import {
  applicationsService,
  ApplicationItem,
  AgreementItem,
} from '../../services/applications';
import { gigsService } from '../../services/gigs';
import { milestonesService } from '../../services/milestones';
import { paymentsService } from '../../services/payments';
import { reviewsService } from '../../services/reviews';
import { chatService } from '../../services/chat';
import { notificationsService } from '../../services/notifications';
import { GigSummary, formatPrice } from '../../components/ui/GigCard';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { showToast } from '../../components/ui/Toast';
import { confirmDialog } from '../../lib/dialog';
import { mapSqlErrorToFriendlyMessage, strings } from '../../constants/strings';
import {
  Timeline,
  NextStepBanner,
  LoopStageState,
  computeAgreementLoopState,
  computePreAgreementLoopState,
} from '../../components/ui/Timeline';

export default function ActivityScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user, profile } = useAuth();

  const isFindWork = profile?.active_mode === 'find_work';
  const isHire = profile?.active_mode === 'hire';
  const viewerRole: 'client' | 'freelancer' = isHire ? 'client' : 'freelancer';

  const [activeTab, setActiveTab] = useState<'primary' | 'agreements'>('primary');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [counterBusyId, setCounterBusyId] = useState<string | null>(null);

  // Freelancer state
  const [myApplications, setMyApplications] = useState<ApplicationItem[]>([]);

  // Client state
  const [myGigs, setMyGigs] = useState<GigSummary[]>([]);
  const [gigApplicantCounts, setGigApplicantCounts] = useState<Record<string, number>>({});

  // Shared state
  const [myAgreements, setMyAgreements] = useState<AgreementItem[]>([]);
  const [agreementLoopMap, setAgreementLoopMap] = useState<Record<string, LoopStageState>>({});

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoadError(null);
    try {
      let agrs: AgreementItem[] = [];

      if (isFindWork) {
        const [apps, agreementsRes] = await Promise.all([
          applicationsService.getMyApplications(),
          applicationsService.getMyAgreements(),
        ]);
        setMyApplications(apps);
        agrs = agreementsRes;
      } else if (isHire) {
        const [gigs, agreementsRes] = await Promise.all([
          gigsService.getMyGigs(user.id),
          applicationsService.getMyAgreements(),
        ]);
        setMyGigs(gigs);
        agrs = agreementsRes;

        // Fetch applicant counts for each client gig from DB so the Next step banner is accurate
        const countsMap: Record<string, number> = {};
        const openGigs = gigs.filter((gig) => gig.status === 'open');
        await Promise.all(
          openGigs.map(async (g) => {
            const apps = await applicationsService.getGigApplicants(g.id);
            countsMap[g.id] = apps.filter(
              (a) => a.status === 'applied' || a.status === 'countered'
            ).length;
          })
        );
        setGigApplicantCounts(countsMap);
      } else {
        agrs = await applicationsService.getMyAgreements();
      }

      setMyAgreements(agrs);

      // Compute authoritative DB loop stage for each agreement
      const loopMap: Record<string, LoopStageState> = {};
      await Promise.all(
        agrs.map(async (agr) => {
          const [mls, pays, revs] = await Promise.all([
            milestonesService.getAgreementMilestones(agr.id),
            paymentsService.getAgreementPayments(agr.id),
            reviewsService.getAgreementReviews(agr.id),
          ]);
          const agrRole: 'client' | 'freelancer' =
            user.id === agr.client_id ? 'client' : 'freelancer';
          loopMap[agr.id] = computeAgreementLoopState({
            viewerRole: agrRole,
            agreementStatus: agr.status,
            agreedPriceCentavos: agr.agreed_price,
            clientName: agr.client?.display_name || 'Client',
            freelancerName: agr.freelancer?.display_name || 'Freelancer',
            milestones: mls,
            payments: pays,
            reviews: revs,
            viewerUserId: user.id,
          });
        })
      );
      setAgreementLoopMap(loopMap);
    } catch (err) {
      setLoadError(mapSqlErrorToFriendlyMessage(err, 'Failed to load activity data.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, isFindWork, isHire]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      if (!user?.id) return;
      return notificationsService.subscribeToNotifications(user.id, () => {
        void loadData();
      });
    }, [loadData, user?.id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOpenApplicationChat = async (applicationId: string, partnerName: string) => {
    try {
      const convId = await chatService.getOrCreateConversation({ applicationId });
      router.push({
        pathname: '/chat/[conversationId]',
        params: { conversationId: convId, partnerName },
      });
    } catch (err: any) {
      showToast(err?.message || 'Could not open conversation.', 'error');
    }
  };

  const handleRespondToCounter = async (
    app: ApplicationItem,
    action: 'accept' | 'decline' | 'withdraw'
  ) => {
    if (action === 'withdraw') {
      const confirmed = await confirmDialog({
        title: 'Withdraw Proposal',
        message: 'Are you sure you want to withdraw this application? This action cannot be undone.',
        confirmText: 'Withdraw',
        cancelText: 'Cancel',
      });
      if (!confirmed) return;
    }

    setCounterBusyId(app.id);
    try {
      const agreementId = await applicationsService.respondToCounter(app.id, action);
      showToast(
        action === 'accept'
          ? strings.toasts.counterAccepted
          : action === 'withdraw'
          ? 'Proposal withdrawn successfully.'
          : strings.toasts.counterDeclined
      );
      await loadData();
      if (action === 'accept' && agreementId) {
        router.push({ pathname: '/agreements/[id]', params: { id: agreementId } });
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not process proposal action.', 'error');
    } finally {
      setCounterBusyId(null);
    }
  };

  const renderFreelancerPrimaryTab = () => {
    if (myApplications.length === 0) {
      return (
        <EmptyState
          title="No applications yet"
          description="Browse open gigs in Ormoc and submit your first proposal."
          actionTitle="Browse Gigs"
          onAction={() => router.push('/(tabs)/gigs')}
        />
      );
    }

    return (
      <View style={styles.list}>
        {myApplications.map((app) => {
          const deleted = app.status_reason === 'gig_deleted';
          const preLoop = computePreAgreementLoopState({
            viewerRole: 'freelancer',
            gigStatus: 'open',
            applicationStatus: app.status,
            counterPriceCentavos: app.counter_price,
          });
          const isBusy = counterBusyId === app.id;

          return (
            <View
              key={app.id}
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  if (app.gig_id && !deleted) {
                    router.push({ pathname: '/gigs/[id]', params: { id: app.gig_id } });
                  }
                }}
                activeOpacity={deleted ? 1 : 0.7}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: theme.colors.text }]} numberOfLines={1}>
                    {app.gig?.title || app.gig_title_snapshot || 'Gig'}
                  </Text>
                  {deleted ? <Badge status="deleted" label={strings.gigs.deletedGigProposal} /> : <Badge status={app.status} />}
                </View>

                <View style={styles.cardRow}>
                  <Text style={[styles.cardMetaLabel, { color: theme.colors.muted }]}>
                    My Proposal:
                  </Text>
                  <Text style={[styles.cardPrice, { color: theme.colors.primary }]}>
                    {formatPrice(app.proposed_price)}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Compact Shared Timeline & Next Step Banner */}
              {deleted ? (
                <Text style={[styles.cardMetaLabel, { color: theme.colors.muted, marginVertical: 10 }]}>{strings.gigs.deletedGigProposalDesc}</Text>
              ) : (
                <>
                  <Timeline
                    currentStage={preLoop.currentStage}
                    viewerRole="freelancer"
                    loopState={preLoop}
                    compact
                  />
                  <NextStepBanner
                    loopState={preLoop}
                    compact
                    onOpenChatPress={() => handleOpenApplicationChat(app.id, app.gig?.title || 'Client')}
                  />
                </>
              )}

              {/* Counteroffer response actions if status === 'countered' */}
              {!deleted && app.status === 'countered' && app.counter_price && (
                <View style={styles.counterActionRow}>
                  <TouchableOpacity
                    style={[styles.counterAcceptBtn, { backgroundColor: theme.colors.primary }]}
                    onPress={() => handleRespondToCounter(app, 'accept')}
                    disabled={isBusy}
                  >
                    <Text style={styles.counterBtnTextWhite}>
                      {isBusy ? 'Saving...' : `Accept ${formatPrice(app.counter_price)}`}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.counterDeclineBtn, { borderColor: theme.colors.danger }]}
                    onPress={() => handleRespondToCounter(app, 'decline')}
                    disabled={isBusy}
                  >
                    <Text style={{ color: theme.colors.danger, fontWeight: '700', fontSize: 13 }}>
                      Decline
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.counterDeclineBtn, { borderColor: theme.colors.border }]}
                    onPress={() => handleRespondToCounter(app, 'withdraw')}
                    disabled={isBusy}
                  >
                    <Text style={{ color: theme.colors.muted, fontWeight: '600', fontSize: 13 }}>
                      Withdraw
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Withdraw action if proposal is pending (status === 'applied') */}
              {!deleted && app.status === 'applied' && (
                <View style={[styles.counterActionRow, { justifyContent: 'flex-end' }]}>
                  <TouchableOpacity
                    style={[styles.counterDeclineBtn, { borderColor: theme.colors.border }]}
                    onPress={() => handleRespondToCounter(app, 'withdraw')}
                    disabled={isBusy}
                  >
                    <Text style={{ color: theme.colors.muted, fontWeight: '600', fontSize: 13 }}>
                      {isBusy ? 'Processing...' : 'Withdraw Proposal'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.cardFooter}>
                <Text style={[styles.cardFooterText, { color: theme.colors.muted }]}>
                  Est. {app.estimated_days} day{app.estimated_days > 1 ? 's' : ''} • Applied{' '}
                  {new Date(app.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderClientPrimaryTab = () => {
    const openGigs = myGigs.filter((gig) => gig.status === 'open');
    if (openGigs.length === 0) {
      return (
        <EmptyState
          title={strings.gigs.noOpenClientGigsTitle}
          description={strings.gigs.noOpenClientGigsDesc}
          actionTitle={strings.gigs.viewMyGigs}
          onAction={() => router.push('/(tabs)/gigs')}
        />
      );
    }

    return (
      <View style={styles.list}>
        {openGigs.map((gig) => {
          const pendingApplicants = gigApplicantCounts[gig.id] || 0;
          const preLoop = computePreAgreementLoopState({
            viewerRole: 'client',
            gigStatus: gig.status,
            applicantCount: pendingApplicants,
          });

          return (
            <TouchableOpacity
              key={gig.id}
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
              onPress={() => {
                router.push({ pathname: '/gigs/[id]/applicants', params: { id: gig.id } });
              }}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]} numberOfLines={1}>
                  {gig.title}
                </Text>
                <Badge status={gig.status} />
              </View>

              <View style={styles.cardRow}>
                <Text style={[styles.cardMetaLabel, { color: theme.colors.muted }]}>
                  Budget Range:
                </Text>
                <Text style={[styles.cardPrice, { color: theme.colors.primary }]}>
                  {formatPrice(gig.price_min)} - {formatPrice(gig.price_max)}
                </Text>
              </View>

              {/* Compact Shared Timeline & Next Step Banner */}
              <Timeline
                currentStage={preLoop.currentStage}
                viewerRole="client"
                loopState={preLoop}
                compact
              />

              <NextStepBanner
                loopState={preLoop}
                compact
                actionLabel={pendingApplicants > 0 ? `Review Applicants (${pendingApplicants})` : undefined}
                onActionPress={
                  pendingApplicants > 0
                    ? () => router.push({ pathname: '/gigs/[id]/applicants', params: { id: gig.id } })
                    : undefined
                }
              />

              <View style={styles.cardFooter}>
                <Text style={[styles.cardFooterLink, { color: theme.colors.primary }]}>
                  👥 View Applicants {pendingApplicants > 0 ? `(${pendingApplicants})` : ''} ›
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderAgreementsTab = () => {
    if (myAgreements.length === 0) {
      return (
        <EmptyState
          title="No active agreements"
          description="When a proposal is accepted, an agreement is created here."
        />
      );
    }

    return (
      <View style={styles.list}>
        {myAgreements.map((agr) => {
          const isAgrClient = user?.id === agr.client_id;
          const counterParty = isAgrClient ? agr.freelancer : agr.client;
          const roleLabel = isAgrClient ? 'Freelancer' : 'Client';
          const agrLoop =
            agreementLoopMap[agr.id] ||
            computeAgreementLoopState({
              viewerRole: isAgrClient ? 'client' : 'freelancer',
              agreementStatus: agr.status,
              agreedPriceCentavos: agr.agreed_price,
              clientName: agr.client?.display_name || 'Client',
              freelancerName: agr.freelancer?.display_name || 'Freelancer',
              milestones: [],
              payments: [],
              reviews: [],
              viewerUserId: user?.id,
            });

          return (
            <TouchableOpacity
              key={agr.id}
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
              onPress={() => {
                router.push({ pathname: '/agreements/[id]', params: { id: agr.id } });
              }}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]} numberOfLines={1}>
                  {agr.gig?.title || 'Gig Agreement'}
                </Text>
                <Badge status={agr.status} />
              </View>

              <View style={styles.cardRow}>
                <Text style={[styles.cardMetaLabel, { color: theme.colors.muted }]}>
                  Agreed Price:
                </Text>
                <Text style={[styles.cardPrice, { color: theme.colors.primary }]}>
                  {formatPrice(agr.agreed_price)}
                </Text>
              </View>

              {counterParty && (
                <View style={styles.cardRow}>
                  <Text style={[styles.cardMetaLabel, { color: theme.colors.muted }]}>
                    {roleLabel}:
                  </Text>
                  <Text style={[styles.cardMetaValue, { color: theme.colors.text }]}>
                    {counterParty.display_name}
                  </Text>
                </View>
              )}

              {/* Compact Shared Timeline & Next Step Banner */}
              <Timeline
                currentStage={agrLoop.currentStage}
                viewerRole={isAgrClient ? 'client' : 'freelancer'}
                loopState={agrLoop}
                compact
              />

              <NextStepBanner
                loopState={agrLoop}
                compact
                actionLabel="Open Agreement ›"
                onActionPress={() =>
                  router.push({ pathname: '/agreements/[id]', params: { id: agr.id } })
                }
              />

              <View style={styles.cardFooter}>
                <Text style={[styles.cardFooterText, { color: theme.colors.muted }]}>
                  Deadline: {new Date(agr.deadline).toLocaleDateString()}
                </Text>
                <Text style={[styles.cardFooterLink, { color: theme.colors.primary }]}>
                  View Agreement ›
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Activity</Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.muted }]}>
          {isFindWork
            ? 'Track your proposals & active work'
            : 'Manage your posted gigs & agreements'}
        </Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'primary' && [
              styles.tabItemActive,
              { borderBottomColor: theme.colors.primary },
            ],
          ]}
          onPress={() => setActiveTab('primary')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'primary' ? theme.colors.primary : theme.colors.muted },
            ]}
          >
            {isFindWork ? 'Proposals' : 'Applicants'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'agreements' && [
              styles.tabItemActive,
              { borderBottomColor: theme.colors.primary },
            ],
          ]}
          onPress={() => setActiveTab('agreements')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'agreements' ? theme.colors.primary : theme.colors.muted },
            ]}
          >
            {isFindWork ? 'Jobs' : 'Hired'}{' '}
            {myAgreements.length > 0 ? `(${myAgreements.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {loadError ? (
            <ErrorState message={loadError} onRetry={loadData} />
          ) : activeTab === 'primary' ? (
            isFindWork ? (
              renderFreelancerPrimaryTab()
            ) : (
              renderClientPrimaryTab()
            )
          ) : (
            renderAgreementsTab()
          )}
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
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  tabItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {},
  tabText: {
    fontSize: 15,
    fontWeight: '600',
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
    flexGrow: 1,
  },
  list: {
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardMetaLabel: {
    fontSize: 13,
  },
  cardMetaValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '700',
  },
  counterActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  counterAcceptBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  counterDeclineBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  counterBtnTextWhite: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DCE4F2',
  },
  cardFooterText: {
    fontSize: 12,
  },
  cardFooterLink: {
    fontSize: 13,
    fontWeight: '600',
  },
});

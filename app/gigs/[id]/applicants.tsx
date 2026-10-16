import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput as RNTextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAppTheme } from '../../theme';
import { applicationsService, ApplicationItem } from '../../../services/applications';
import { chatService } from '../../../services/chat';
import { formatPrice } from '../../../components/ui/GigCard';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { showToast } from '../../../components/ui/Toast';
import { confirmDialog } from '../../../lib/dialog';
import { EmptyState } from '../../../components/ui/EmptyState';
import { NextStepBanner, computePreAgreementLoopState } from '../../../components/ui/Timeline';
import { strings } from '../../../constants/strings';

export default function GigApplicantsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [applicants, setApplicants] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [counterAppId, setCounterAppId] = useState<string | null>(null);
  const [counterPriceStr, setCounterPriceStr] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadApplicants = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const data = await applicationsService.getGigApplicants(id);
      setApplicants(data);
    } catch (err: any) {
      setError(err?.message || 'Could not load applicants.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadApplicants();
      if (!id) return;
      return applicationsService.subscribeToGigApplicants(id, () => {
        void loadApplicants();
      });
    }, [id, loadApplicants])
  );

  const handleOpenApplicantChat = async (app: ApplicationItem) => {
    try {
      const convId = await chatService.getOrCreateConversation({ applicationId: app.id });
      router.push({
        pathname: '/chat/[conversationId]',
        params: {
          conversationId: convId,
          partnerName: app.freelancer?.display_name || 'Freelancer',
        },
      });
    } catch (err: any) {
      showToast(err?.message || 'Could not open conversation.', 'error');
    }
  };

  const handleAccept = async (app: ApplicationItem) => {
    const confirmed = await confirmDialog({
      title: 'Accept Proposal',
      message: `Accept ${app.freelancer?.display_name || 'this freelancer'}'s proposal for ${formatPrice(app.proposed_price)}? This will create an active agreement and close the gig to other applicants.`,
      confirmText: 'Accept Proposal',
      cancelText: 'Cancel',
    });

    if (!confirmed) return;

    setActionBusy(app.id);
    try {
      const agreementId = await applicationsService.respondToApplication(app.id, 'accept');
      showToast(strings.toasts.applicationAccepted);
      if (agreementId) {
        router.replace({ pathname: '/agreements/[id]', params: { id: agreementId } });
      } else {
        router.replace('/(tabs)/activity');
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not accept proposal.', 'error');
    } finally {
      setActionBusy(null);
    }
  };

  const handleDecline = async (appId: string) => {
    setActionBusy(appId);
    try {
      await applicationsService.respondToApplication(appId, 'decline');
      showToast(strings.toasts.applicationDeclined);
      await loadApplicants();
    } catch (err: any) {
      showToast(err?.message || 'Could not decline proposal.', 'error');
    } finally {
      setActionBusy(null);
    }
  };

  const handleSendCounter = async (appId: string) => {
    const priceNum = parseFloat(counterPriceStr);
    if (isNaN(priceNum) || priceNum <= 0) {
      showToast('Please enter a valid counteroffer amount in PHP.', 'error');
      return;
    }

    setActionBusy(appId);
    try {
      const priceCentavos = Math.round(priceNum * 100);
      await applicationsService.respondToApplication(appId, 'counter', priceCentavos);
      setCounterAppId(null);
      setCounterPriceStr('');
      showToast(strings.toasts.counterSent);
      await loadApplicants();
    } catch (err: any) {
      showToast(err?.message || 'Could not submit counteroffer.', 'error');
    } finally {
      setActionBusy(null);
    }
  };

  const pendingApplicantsCount = applicants.filter(
    (a) => a.status === 'applied' || a.status === 'countered'
  ).length;
  const acceptedApplicant = applicants.find((a) => a.status === 'accepted');

  const topLoopState = computePreAgreementLoopState({
    viewerRole: 'client',
    gigStatus: acceptedApplicant ? 'in_progress' : 'open',
    applicationStatus: acceptedApplicant ? 'accepted' : pendingApplicantsCount > 0 ? 'applied' : null,
    applicantCount: pendingApplicantsCount,
    freelancerName: acceptedApplicant?.freelancer?.display_name || 'the freelancer',
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else if (id) {
              router.replace({ pathname: '/gigs/[id]', params: { id } });
            } else {
              router.replace('/(tabs)/gigs');
            }
          }}
          style={styles.backBtn}
        >
          <Text style={{ color: theme.colors.primary, fontSize: 16 }}>← Back to Gig</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Applicants ({applicants.length})
        </Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!loading && (
          <View style={{ marginBottom: 14 }}>
            <NextStepBanner loopState={topLoopState} />
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 32 }} />
        ) : applicants.length === 0 ? (
          <EmptyState
            title="No applicants yet"
            description="When freelancers submit proposals for this gig, their details and proposals will appear here."
            actionTitle="Refresh"
            onAction={loadApplicants}
          />
        ) : (
          applicants.map((app) => {
            const isBusy = actionBusy === app.id;
            const isCounteringThis = counterAppId === app.id;

            return (
              <View
                key={app.id}
                style={[
                  styles.card,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.freelancerCol}>
                    <Text style={[styles.freelancerName, { color: theme.colors.text }]}>
                      {app.freelancer?.display_name || 'Freelancer'}
                    </Text>
                    <Text style={[styles.freelancerStats, { color: theme.colors.muted }]}>
                      ★ {Number(app.freelancer?.freelancer_rating_avg || 0).toFixed(1)} ({app.freelancer?.freelancer_rating_count || 0}) • {app.freelancer?.freelancer_completed_gigs || 0} completed
                    </Text>
                  </View>
                  <Badge status={app.status} />
                </View>

                {/* Proposal details */}
                <View style={styles.proposalInfo}>
                  <Text style={[styles.priceTag, { color: theme.colors.text }]}>
                    Proposed: {formatPrice(app.proposed_price)}
                  </Text>
                  <Text style={[styles.daysTag, { color: theme.colors.muted }]}>
                    ⏱️ {app.estimated_days} day(s) estimated
                  </Text>
                </View>

                {app.counter_price ? (
                  <View style={[styles.counterBox, { backgroundColor: '#FEF1D6' }]}>
                    <Text style={{ color: theme.colors.warning, fontWeight: '700', fontSize: 13 }}>
                      Counteroffer: {formatPrice(app.counter_price)}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.messageBox}>
                  <Text style={[styles.messageText, { color: theme.colors.text }]}>
                    "{app.message}"
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.counterBtn,
                    { borderColor: theme.colors.primary, marginBottom: 10, paddingVertical: 8 },
                  ]}
                  onPress={() => handleOpenApplicantChat(app)}
                >
                  <Text style={[styles.btnText, { color: theme.colors.primary }]}>
                    💬 Open Chat with {app.freelancer?.display_name || 'Freelancer'}
                  </Text>
                </TouchableOpacity>

                {/* Counter Input Row */}
                {isCounteringThis && (
                  <View style={[styles.counterInputRow, { borderColor: theme.colors.border }]}>
                    <Text style={[styles.counterLabel, { color: theme.colors.text }]}>Counter Fee (₱):</Text>
                    <RNTextInput
                      style={[styles.counterInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
                      placeholder="e.g. 1200"
                      placeholderTextColor={theme.colors.muted}
                      value={counterPriceStr}
                      onChangeText={setCounterPriceStr}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={[styles.counterSubmitBtn, { backgroundColor: theme.colors.primary }]}
                      onPress={() => handleSendCounter(app.id)}
                      disabled={isBusy}
                    >
                      <Text style={{ color: '#ffffff', fontWeight: '600' }}>Send</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.counterCancelBtn}
                      onPress={() => setCounterAppId(null)}
                    >
                      <Text style={{ color: theme.colors.muted }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Action buttons (only when status is 'applied') */}
                {app.status === 'applied' && !isCounteringThis && (
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={[styles.acceptBtn, { backgroundColor: theme.colors.primary }]}
                      onPress={() => handleAccept(app)}
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.btnTextWhite}>Accept</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.counterBtn, { borderColor: theme.colors.border }]}
                      onPress={() => {
                        setCounterAppId(app.id);
                        setCounterPriceStr('');
                      }}
                      disabled={isBusy}
                    >
                      <Text style={[styles.btnText, { color: theme.colors.text }]}>Counter</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.declineBtn, { borderColor: theme.colors.border }]}
                      onPress={() => handleDecline(app.id)}
                      disabled={isBusy}
                    >
                      <Text style={[styles.btnText, { color: theme.colors.danger }]}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  errorBox: {
    backgroundColor: '#FDE8EA',
    padding: 12,
    borderRadius: 8,
    margin: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#D92D3E',
  },
  errorText: {
    color: '#D92D3E',
    fontSize: 14,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  freelancerCol: {
    flex: 1,
  },
  freelancerName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  freelancerStats: {
    fontSize: 12,
  },
  proposalInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceTag: {
    fontSize: 16,
    fontWeight: '800',
  },
  daysTag: {
    fontSize: 13,
  },
  counterBox: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  messageBox: {
    backgroundColor: '#F4F7FC',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  counterInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  counterLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  counterInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
  },
  counterSubmitBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  counterCancelBtn: {
    padding: 6,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DCE4F2',
  },
  acceptBtn: {
    flex: 1.5,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  counterBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  btnTextWhite: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

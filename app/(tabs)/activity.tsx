import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import {
  applicationsService,
  ApplicationItem,
  AgreementItem,
} from '../../services/applications';
import { gigsService } from '../../services/gigs';
import { GigSummary, formatPrice } from '../../components/ui/GigCard';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';

export default function ActivityScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user, profile } = useAuth();

  const isFindWork = profile?.active_mode === 'find_work';
  const isHire = profile?.active_mode === 'hire';

  const [activeTab, setActiveTab] = useState<'primary' | 'agreements'>('primary');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Freelancer state
  const [myApplications, setMyApplications] = useState<ApplicationItem[]>([]);

  // Client state
  const [myGigs, setMyGigs] = useState<GigSummary[]>([]);

  // Shared state
  const [myAgreements, setMyAgreements] = useState<AgreementItem[]>([]);

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      if (isFindWork) {
        const [apps, agrs] = await Promise.all([
          applicationsService.getMyApplications(),
          applicationsService.getMyAgreements(),
        ]);
        setMyApplications(apps);
        setMyAgreements(agrs);
      } else if (isHire) {
        const [gigs, agrs] = await Promise.all([
          gigsService.getMyGigs(user.id),
          applicationsService.getMyAgreements(),
        ]);
        setMyGigs(gigs);
        setMyAgreements(agrs);
      } else {
        const agrs = await applicationsService.getMyAgreements();
        setMyAgreements(agrs);
      }
    } catch (err) {
      console.error('Failed to load activity data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, isFindWork, isHire]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
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
        {myApplications.map((app) => (
          <TouchableOpacity
            key={app.id}
            style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => {
              if (app.gig_id) {
                router.push({ pathname: '/gigs/[id]', params: { id: app.gig_id } });
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]} numberOfLines={1}>
                {app.gig?.title || 'Gig'}
              </Text>
              <Badge status={app.status} />
            </View>

            <View style={styles.cardRow}>
              <Text style={[styles.cardMetaLabel, { color: theme.colors.muted }]}>My Proposal:</Text>
              <Text style={[styles.cardPrice, { color: theme.colors.primary }]}>
                {formatPrice(app.proposed_price)}
              </Text>
            </View>

            {app.status === 'countered' && app.counter_price && (
              <View style={[styles.counterBox, { backgroundColor: '#FEF1D6', borderColor: '#F6D58B' }]}>
                <Text style={styles.counterBoxLabel}>Client Counteroffer:</Text>
                <Text style={styles.counterBoxValue}>{formatPrice(app.counter_price)}</Text>
              </View>
            )}

            <View style={styles.cardFooter}>
              <Text style={[styles.cardFooterText, { color: theme.colors.muted }]}>
                Est. {app.estimated_days} day{app.estimated_days > 1 ? 's' : ''} • Applied {new Date(app.created_at).toLocaleDateString()}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderClientPrimaryTab = () => {
    if (myGigs.length === 0) {
      return (
        <EmptyState
          title="No gigs posted yet"
          description="Post your first gig to start receiving proposals from Ormoc freelancers."
          actionTitle="Post a Gig"
          onAction={() => router.push('/gigs/post')}
        />
      );
    }

    return (
      <View style={styles.list}>
        {myGigs.map((gig) => (
          <TouchableOpacity
            key={gig.id}
            style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
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
              <Text style={[styles.cardMetaLabel, { color: theme.colors.muted }]}>Budget Range:</Text>
              <Text style={[styles.cardPrice, { color: theme.colors.primary }]}>
                {formatPrice(gig.price_min)} - {formatPrice(gig.price_max)}
              </Text>
            </View>

            <View style={styles.cardFooter}>
              <Text style={[styles.cardFooterLink, { color: theme.colors.primary }]}>
                👥 View Applicants ›
              </Text>
            </View>
          </TouchableOpacity>
        ))}
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
          const counterParty = isFindWork ? agr.client : agr.freelancer;
          const roleLabel = isFindWork ? 'Client' : 'Freelancer';

          return (
            <TouchableOpacity
              key={agr.id}
              style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
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
                <Text style={[styles.cardMetaLabel, { color: theme.colors.muted }]}>Agreed Price:</Text>
                <Text style={[styles.cardPrice, { color: theme.colors.primary }]}>
                  {formatPrice(agr.agreed_price)}
                </Text>
              </View>

              {counterParty && (
                <View style={styles.cardRow}>
                  <Text style={[styles.cardMetaLabel, { color: theme.colors.muted }]}>{roleLabel}:</Text>
                  <Text style={[styles.cardMetaValue, { color: theme.colors.text }]}>
                    {counterParty.display_name}
                  </Text>
                </View>
              )}

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
          {isFindWork ? 'Track your proposals & active work' : 'Manage your posted gigs & agreements'}
        </Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'primary' && [styles.tabItemActive, { borderBottomColor: theme.colors.primary }],
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
            activeTab === 'agreements' && [styles.tabItemActive, { borderBottomColor: theme.colors.primary }],
          ]}
          onPress={() => setActiveTab('agreements')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'agreements' ? theme.colors.primary : theme.colors.muted },
            ]}
          >
            {isFindWork ? 'Jobs' : 'Hired'} {myAgreements.length > 0 ? `(${myAgreements.length})` : ''}
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
          {activeTab === 'primary'
            ? isFindWork
              ? renderFreelancerPrimaryTab()
              : renderClientPrimaryTab()
            : renderAgreementsTab()}
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
  counterBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  counterBoxLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
  counterBoxValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
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

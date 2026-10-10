import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { gigsService, GigDetail } from '../../services/gigs';
import { formatPrice, getWorkTypeIcon } from '../../components/ui/GigCard';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { strings } from '../../constants/strings';

export default function GigDetailScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuth();

  const [gig, setGig] = useState<GigDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchGig = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await gigsService.getGig(id);
        if (mounted) {
          if (!data) {
            setError('Gig not found or has been removed.');
          } else {
            setGig(data);
          }
        }
      } catch (err: any) {
        if (mounted) setError(err?.message || 'Failed to load gig details.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchGig();
    return () => {
      mounted = false;
    };
  }, [id]);

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
        <Text style={[styles.errorDesc, { color: theme.colors.muted }]}>{error || 'This gig does not exist.'}</Text>
        <Button title="← Go Back" onPress={() => router.back()} variant="secondary" />
      </View>
    );
  }

  const isOwner = user?.id === gig.client_id;
  const isFreelancerMode = profile?.active_mode === 'find_work';
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

  const [cancelling, setCancelling] = useState(false);

  const handleApplyPress = () => {
    if (isOwner) {
      router.push({ pathname: '/gigs/[id]/applicants', params: { id: gig.id } });
      return;
    }
    if (!isFreelancerMode) {
      Alert.alert(
        'Mode restriction',
        'You are currently in Hire Someone mode. To apply for gigs, you must be in Find Work mode.'
      );
      return;
    }
    router.push({ pathname: '/gigs/[id]/apply', params: { id: gig.id } });
  };

  const handleCancelGig = () => {
    Alert.alert(
      'Cancel Gig',
      'Are you sure you want to cancel this gig? Pending applicants will be notified.',
      [
        { text: 'Keep Gig', style: 'cancel' },
        {
          text: 'Cancel Gig',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await gigsService.cancelGig(gig.id, 'Cancelled by client from gig details');
              setGig({ ...gig, status: 'cancelled' });
              Alert.alert('Gig Cancelled', 'The gig has been cancelled successfully.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to cancel gig.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ color: theme.colors.primary, fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Badge status={gig.status} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Main Info */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Description</Text>
          <Text style={[styles.bodyText, { color: theme.colors.text }]}>{gig.description}</Text>
        </View>

        {/* Requirements */}
        {gig.requirements ? (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Requirements</Text>
            <Text style={[styles.bodyText, { color: theme.colors.text }]}>{gig.requirements}</Text>
          </View>
        ) : null}

        {/* Client Profile Summary */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
                ★ {Number(gig.client.client_rating_avg || 0).toFixed(1)} ({gig.client.client_rating_count || 0} reviews) • {gig.client.client_completed_gigs || 0} completed gigs
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View style={[styles.bottomBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        {isOwner ? (
          <View style={{ width: '100%', gap: 8 }}>
            <Button
              title="View Applicants"
              onPress={handleApplyPress}
              variant="primary"
            />
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
    paddingBottom: 100,
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
    marginTop: 4,
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
    fontSize: 15,
    fontWeight: '700',
  },
  clientStats: {
    fontSize: 12,
    marginTop: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ownerNotice: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  ownerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  reasonText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
});

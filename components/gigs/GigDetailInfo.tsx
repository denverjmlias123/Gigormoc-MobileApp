import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GigDetail } from '../../services/gigs';
import { AppTheme } from '../../app/theme';
import { formatPrice, getWorkTypeIcon } from '../ui/GigCard';

interface GigDetailInfoProps {
  gig: GigDetail;
  theme: AppTheme;
  onClientPress?: () => void;
}

export function GigDetailInfo({ gig, theme, onClientPress }: GigDetailInfoProps) {
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

  return (
    <>
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
        onPress={onClientPress}
        activeOpacity={0.8}
        disabled={!onClientPress}
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
    </>
  );
}

const styles = StyleSheet.create({
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
});

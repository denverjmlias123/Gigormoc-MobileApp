import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../../app/theme';
import { Badge } from './Badge';

export interface GigSummary {
  id: string;
  title: string;
  category_name?: string;
  price_min: number; // in centavos
  price_max: number; // in centavos
  work_type: 'remote' | 'face_to_face' | 'hybrid';
  area?: string;
  application_deadline: string;
  deadline: string;
  status: string;
  client?: {
    display_name?: string;
    client_rating_avg?: number;
    client_rating_count?: number;
  };
}

interface GigCardProps {
  gig: GigSummary;
  onPress: () => void;
}

export const formatPrice = (centavos: number): string => {
  const pesos = centavos / 100;
  return `₱${pesos.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export const getWorkTypeIcon = (workType: string): string => {
  switch (workType) {
    case 'remote':
      return '💻 Remote';
    case 'face_to_face':
      return '🤝 Face-to-face';
    case 'hybrid':
      return '🔄 Hybrid';
    default:
      return workType;
  }
};

export const GigCard: React.FC<GigCardProps> = ({ gig, onPress }) => {
  const theme = useAppTheme();

  const priceDisplay =
    gig.price_min === gig.price_max
      ? formatPrice(gig.price_min)
      : `${formatPrice(gig.price_min)} - ${formatPrice(gig.price_max)}`;

  const deadlineFormatted = new Date(gig.application_deadline).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.card,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <View style={styles.topRow}>
        <View style={styles.categoryBadge}>
          <Text style={[styles.categoryText, { color: theme.colors.primary }]}>
            {gig.category_name || 'General'}
          </Text>
        </View>
        <Badge status={gig.status} />
      </View>

      <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={2}>
        {gig.title}
      </Text>

      <Text style={[styles.price, { color: theme.colors.text }]}>{priceDisplay}</Text>

      <View style={styles.metaRow}>
        <Text style={[styles.metaItem, { color: theme.colors.muted }]}>
          {getWorkTypeIcon(gig.work_type)}
        </Text>
        {gig.area ? (
          <>
            <Text style={[styles.dot, { color: theme.colors.border }]}>•</Text>
            <Text style={[styles.metaItem, { color: theme.colors.muted }]}>📍 {gig.area}</Text>
          </>
        ) : null}
      </View>

      <View style={[styles.footerRow, { borderTopColor: theme.colors.border }]}>
        <Text style={[styles.deadlineText, { color: theme.colors.muted }]}>
          Apply by {deadlineFormatted}
        </Text>
        {gig.client ? (
          <Text style={[styles.clientRating, { color: theme.colors.text }]}>
            ★ {Number(gig.client.client_rating_avg || 0).toFixed(1)} ({gig.client.client_rating_count || 0})
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 6,
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  metaItem: {
    fontSize: 13,
  },
  dot: {
    fontSize: 13,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  deadlineText: {
    fontSize: 12,
  },
  clientRating: {
    fontSize: 12,
    fontWeight: '600',
  },
});

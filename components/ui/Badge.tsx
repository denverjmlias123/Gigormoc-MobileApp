import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../../app/theme';

export type StatusType =
  | 'open'
  | 'active'
  | 'in_progress'
  | 'pending'
  | 'countered'
  | 'revision_requested'
  | 'approved'
  | 'confirmed'
  | 'completed'
  | 'declined'
  | 'cancelled'
  | 'expired'
  | 'disputed'
  | 'draft'
  | 'withdrawn'
  | 'inactive';

interface BadgeProps {
  status: StatusType | string;
  label?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, label }) => {
  const theme = useAppTheme();

  const getStatusColor = () => {
    switch (status.toLowerCase()) {
      case 'open':
      case 'active':
      case 'in_progress':
        return { bg: theme.colors.primarySoft, text: theme.colors.primary };
      case 'pending':
      case 'countered':
      case 'revision_requested':
        return { bg: '#FEF3C7', text: theme.colors.warning };
      case 'approved':
      case 'confirmed':
      case 'completed':
        return { bg: '#DCFCE7', text: theme.colors.success };
      case 'declined':
      case 'cancelled':
      case 'expired':
      case 'disputed':
        return { bg: '#FEE2E2', text: theme.colors.danger };
      default:
        return { bg: '#F1F5F9', text: theme.colors.muted };
    }
  };

  const getStatusLabel = () => {
    if (label) return label;
    switch (status.toLowerCase()) {
      case 'in_progress':
        return 'In Progress';
      case 'revision_requested':
        return 'Needs Revision';
      case 'face_to_face':
        return 'Face-to-Face';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const colors = getStatusColor();

  return (
    <View style={[styles.pill, { backgroundColor: colors.bg, borderRadius: theme.radii.pill }]}>
      <Text style={[styles.label, { color: colors.text }]}>{getStatusLabel()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});

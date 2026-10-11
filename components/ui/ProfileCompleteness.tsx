import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../app/theme';
import { ProfileCompleteness, CompletenessMissingItem } from '../../services/profile';
import { strings } from '../../constants/strings';
import { Card } from './Card';

export const ProfileCompleteBadge: React.FC<{ onHero?: boolean }> = ({ onHero = false }) => {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: onHero ? theme.colors.heroChip : theme.colors.successSoft,
          borderColor: onHero ? 'transparent' : theme.colors.success,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={strings.profile.profileCompleteBadge}
    >
      <Ionicons
        name="checkmark-circle"
        size={14}
        color={onHero ? theme.colors.heroText : theme.colors.success}
      />
      <Text
        style={[
          styles.badgeText,
          { color: onHero ? theme.colors.heroText : theme.colors.success },
        ]}
      >
        {strings.profile.profileCompleteBadge}
      </Text>
    </View>
  );
};

interface ProfileCompletenessCardProps {
  completeness: ProfileCompleteness | null;
  onSelectMissingItem: (item: CompletenessMissingItem) => void;
}

export const ProfileCompletenessCard: React.FC<ProfileCompletenessCardProps> = ({
  completeness,
  onSelectMissingItem,
}) => {
  const theme = useAppTheme();

  if (!completeness) return null;

  const { percent, complete, missing_items } = completeness;
  const firstMissing = missing_items && missing_items.length > 0 ? missing_items[0] : null;

  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <View
          style={[
            styles.ring,
            {
              borderColor: complete ? theme.colors.success : theme.colors.primary,
              backgroundColor: complete ? theme.colors.successSoft : theme.colors.primarySoft,
            },
          ]}
          accessibilityLabel={`Profile completeness ${percent} percent`}
        >
          <Text
            style={[
              styles.ringText,
              { color: complete ? theme.colors.success : theme.colors.primary },
            ]}
          >
            {percent}%
          </Text>
        </View>

        <View style={styles.summaryCol}>
          {complete ? (
            <>
              <View style={styles.completeHeader}>
                <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
                <Text style={[theme.type.bodyStrong, { color: theme.colors.text }]}>
                  {strings.profile.profileCompleteBadge}
                </Text>
              </View>
              <Text style={[theme.type.small, { color: theme.colors.muted }]}>
                All profile details are filled in.
              </Text>
            </>
          ) : (
            <>
              <Text style={[theme.type.bodyStrong, { color: theme.colors.text }]}>
                {percent}% complete
                {firstMissing ? `: ${firstMissing.label.toLowerCase()}` : ''}
              </Text>
              <Text style={[theme.type.small, { color: theme.colors.muted }]}>
                {strings.profile.completenessHint}
              </Text>
            </>
          )}
        </View>
      </View>

      {!complete && missing_items.length > 0 ? (
        <View style={styles.missingList}>
          {missing_items.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => onSelectMissingItem(item)}
              style={[
                styles.missingChip,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.background,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Ionicons name="add-circle-outline" size={16} color={theme.colors.primary} />
              <Text style={[styles.missingChipText, { color: theme.colors.text }]}>
                {item.label}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={theme.colors.muted} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    marginBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ring: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: {
    fontSize: 14,
    fontWeight: '800',
  },
  summaryCol: {
    flex: 1,
    gap: 2,
  },
  completeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  missingList: {
    marginTop: 12,
    gap: 8,
  },
  missingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  missingChipText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
});

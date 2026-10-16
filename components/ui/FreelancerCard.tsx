import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../app/theme';
import { Avatar } from './Avatar';
import { FreelancerSummary } from '../../services/profile';

interface FreelancerCardProps {
  freelancer: FreelancerSummary;
  onPress: () => void;
  compact?: boolean;
}

export const FreelancerCard: React.FC<FreelancerCardProps> = React.memo(function FreelancerCard({
  freelancer,
  onPress,
  compact = false,
}) {
  const theme = useAppTheme();

  const ratingText =
    freelancer.freelancer_rating_avg > 0
      ? freelancer.freelancer_rating_avg.toFixed(1)
      : 'New';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        compact ? styles.compactCard : styles.fullCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.card,
          opacity: pressed ? 0.92 : 1,
        },
        theme.shadow.card,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${freelancer.display_name}, ${freelancer.headline || 'Freelancer in Ormoc'}`}
    >
      <View style={styles.topRow}>
        <Avatar
          name={freelancer.display_name}
          imageUri={freelancer.avatar_path}
          size={compact ? 42 : 48}
        />
        <View style={styles.nameCol}>
          <Text
            style={[styles.name, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {freelancer.display_name}
          </Text>
          {freelancer.headline ? (
            <Text
              style={[styles.headline, { color: theme.colors.muted }]}
              numberOfLines={compact ? 1 : 2}
            >
              {freelancer.headline}
            </Text>
          ) : null}
          <View style={styles.areaRow}>
            <Ionicons name="location-outline" size={12} color={theme.colors.muted} />
            <Text style={[styles.areaText, { color: theme.colors.muted }]} numberOfLines={1}>
              {freelancer.area || 'Ormoc City'}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats row: Rating & Completed */}
      <View style={styles.statsRow}>
        <View style={[styles.statChip, { backgroundColor: theme.colors.surfaceAlt }]}>
          <Ionicons name="star" size={12} color="#F59E0B" />
          <Text style={[styles.statText, { color: theme.colors.text }]}>
            {ratingText}
            {freelancer.freelancer_rating_count > 0 && (
              <Text style={{ color: theme.colors.muted }}> ({freelancer.freelancer_rating_count})</Text>
            )}
          </Text>
        </View>

        <View style={[styles.statChip, { backgroundColor: theme.colors.surfaceAlt }]}>
          <Ionicons name="checkmark-circle-outline" size={12} color={theme.colors.success} />
          <Text style={[styles.statText, { color: theme.colors.text }]}>
            {freelancer.freelancer_completed_gigs}{' '}
            {freelancer.freelancer_completed_gigs === 1 ? 'gig' : 'gigs'}
          </Text>
        </View>
      </View>

      {/* Skills row */}
      {freelancer.skills && freelancer.skills.length > 0 && (
        <View style={styles.skillsRow}>
          {freelancer.skills.slice(0, compact ? 2 : 4).map((skill, idx) => (
            <View
              key={`${skill}-${idx}`}
              style={[styles.skillChip, { backgroundColor: theme.colors.primarySoft }]}
            >
              <Text
                style={[styles.skillChipText, { color: theme.colors.primaryDark }]}
                numberOfLines={1}
              >
                {skill}
              </Text>
            </View>
          ))}
          {freelancer.skills.length > (compact ? 2 : 4) && (
            <Text style={[styles.moreSkillsText, { color: theme.colors.muted }]}>
              +{freelancer.skills.length - (compact ? 2 : 4)}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderWidth: 1,
  },
  fullCard: {
    marginBottom: 12,
  },
  compactCard: {
    width: 220,
    marginRight: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nameCol: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headline: {
    fontSize: 12,
    marginTop: 1,
    lineHeight: 16,
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  areaText: {
    fontSize: 11,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statText: {
    fontSize: 11,
    fontWeight: '600',
  },
  skillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  skillChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: 120,
  },
  skillChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  moreSkillsText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

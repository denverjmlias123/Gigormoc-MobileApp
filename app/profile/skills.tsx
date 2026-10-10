import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { profileService, Skill } from '../../services/profile';

export default function SkillsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user } = useAuth();

  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [userSkills, setUserSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [skills, mySkills] = await Promise.all([
        profileService.getSkills(),
        profileService.getUserSkills(user.id),
      ]);
      setAvailableSkills(skills);
      setUserSkills(mySkills);
    } catch (err: any) {
      setError(err?.message || 'Failed to load skills.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const toggleSkill = async (skill: Skill) => {
    if (!user) return;
    const isOwned = userSkills.some((s) => s.id === skill.id);
    setActionLoading(skill.id);
    setError(null);

    try {
      if (isOwned) {
        await profileService.removeUserSkill(user.id, skill.id);
        setUserSkills((prev) => prev.filter((s) => s.id !== skill.id));
      } else {
        await profileService.addUserSkill(user.id, skill.id);
        setUserSkills((prev) => [...prev, skill]);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not update skill.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ color: theme.colors.primary, fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Manage Skills</Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
          Select skills from our verified catalog to display on your profile.
        </Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : availableSkills.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            No catalog skills added yet
          </Text>
          <Text style={[styles.emptyDesc, { color: theme.colors.muted }]}>
            The administrator has not added skills to the database yet. When skills are created in Supabase, they will be listed here for selection.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.skillsContent}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            My Active Skills ({userSkills.length})
          </Text>

          <View style={styles.chipGrid}>
            {availableSkills.map((skill) => {
              const selected = userSkills.some((s) => s.id === skill.id);
              const isBusy = actionLoading === skill.id;

              return (
                <TouchableOpacity
                  key={skill.id}
                  style={[
                    styles.chip,
                    { borderColor: theme.colors.border },
                    selected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                  ]}
                  onPress={() => toggleSkill(skill)}
                  disabled={isBusy}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, selected && { color: '#ffffff' }]}>
                    {selected ? '✓ ' : '+ '}
                    {skill.name}
                  </Text>
                  {isBusy && <ActivityIndicator size="small" color={selected ? '#ffffff' : theme.colors.primary} style={{ marginLeft: 6 }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 48,
  },
  header: {
    marginBottom: 20,
  },
  backBtn: {
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: '#FDE8EA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#D92D3E',
  },
  errorText: {
    color: '#D92D3E',
    fontSize: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: '#F4F7FC',
    borderWidth: 1,
    borderColor: '#DCE4F2',
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  skillsContent: {
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

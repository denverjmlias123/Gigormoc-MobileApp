import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { profileService, Skill } from '../../services/profile';

export default function SkillsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user, profile } = useAuth();

  const isHire = profile?.active_mode === 'hire';

  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [userSkills, setUserSkills] = useState<Skill[]>([]);
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!user || isHire) {
      setLoading(false);
      return;
    }
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
  }, [user, isHire]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  };

  if (isHire) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Text style={{ color: theme.colors.primary, fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Freelancer Mode Only
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
            You are currently in Hire Someone (Client) mode. Clients set their hiring details and interests in Edit Profile instead.
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}
          onPress={() => router.replace('/profile/edit')}
        >
          <Text style={styles.primaryBtnText}>Edit Client Hiring Details</Text>
        </TouchableOpacity>
      </View>
    );
  }

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

  const handleAddCustomSkill = async () => {
    if (!user || addingCustom) return;
    const trimmed = customSkillInput.trim();
    if (!trimmed) return;
    if (trimmed.length < 2 || trimmed.length > 40) {
      setError('Skill name must be between 2 and 40 characters.');
      return;
    }

    setAddingCustom(true);
    setError(null);
    try {
      const updated = await profileService.addProfileSkills([], [trimmed]);
      setUserSkills(updated);
      setCustomSkillInput('');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Could not add custom skill.');
    } finally {
      setAddingCustom(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Text style={{ color: theme.colors.primary, fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Manage Skills</Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
          Select skills from the catalog or add custom skills to display on your freelancer profile (up to 15).
        </Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.customRow}>
        <TextInput
          style={[
            styles.customInput,
            { borderColor: theme.colors.border, color: theme.colors.text },
          ]}
          placeholder="Add a custom skill (2–40 chars)..."
          placeholderTextColor={theme.colors.muted}
          value={customSkillInput}
          onChangeText={setCustomSkillInput}
          maxLength={40}
        />
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
          onPress={handleAddCustomSkill}
          disabled={addingCustom}
        >
          {addingCustom ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.addBtnText}>Add</Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.skillsContent}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            My Active Skills ({userSkills.length}/15)
          </Text>

          {userSkills.length > 0 ? (
            <View style={[styles.chipGrid, { marginBottom: 20 }]}>
              {userSkills.map((skill) => {
                const isBusy = actionLoading === skill.id;
                return (
                  <TouchableOpacity
                    key={skill.id}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: theme.colors.primary,
                        borderColor: theme.colors.primary,
                      },
                    ]}
                    onPress={() => toggleSkill(skill)}
                    disabled={isBusy}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, { color: '#ffffff' }]}>
                      ✓ {skill.name} ×
                    </Text>
                    {isBusy && (
                      <ActivityIndicator
                        size="small"
                        color="#ffffff"
                        style={{ marginLeft: 6 }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.subtitle, { color: theme.colors.muted, marginBottom: 16 }]}>
              No skills added yet. Add a custom skill above or select from the catalog below.
            </Text>
          )}

          {availableSkills.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Skills Catalog
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
                        selected && {
                          backgroundColor: theme.colors.primary,
                          borderColor: theme.colors.primary,
                        },
                      ]}
                      onPress={() => toggleSkill(skill)}
                      disabled={isBusy}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, selected && { color: '#ffffff' }]}>
                        {selected ? '✓ ' : '+ '}
                        {skill.name}
                      </Text>
                      {isBusy && (
                        <ActivityIndicator
                          size="small"
                          color={selected ? '#ffffff' : theme.colors.primary}
                          style={{ marginLeft: 6 }}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : null}
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
    marginBottom: 16,
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
  primaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  customRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
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
  skillsContent: {
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
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

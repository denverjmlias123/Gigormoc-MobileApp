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
import { aiService } from '../../services/ai';
import { strings } from '../../constants/strings';

const MAX_PROFILE_SKILLS = 15;

export default function SkillsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user, profile, refreshProfile } = useAuth();

  const isHire = profile?.active_mode === 'hire';

  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [userSkills, setUserSkills] = useState<Skill[]>([]);
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skillsSaved, setSkillsSaved] = useState(false);
  const [zeroSkillsWarning, setZeroSkillsWarning] = useState(false);

  // AI skill suggestion state
  const [workDescription, setWorkDescription] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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
    setSkillsSaved(false);

    try {
      if (isOwned) {
        await profileService.removeUserSkill(user.id, skill.id);
        const refreshed = await profileService.getUserSkills(user.id);
        setUserSkills(refreshed);
        setZeroSkillsWarning(refreshed.length === 0);
        await refreshProfile();
      } else {
        if (userSkills.length >= MAX_PROFILE_SKILLS) {
          setError(`Maximum limit of ${MAX_PROFILE_SKILLS} skills per profile reached.`);
          return;
        }
        await profileService.addUserSkill(user.id, skill.id);
        const refreshed = await profileService.getUserSkills(user.id);
        setUserSkills(refreshed);
        setZeroSkillsWarning(false);
        setSkillsSaved(true);
        await refreshProfile();
      }
    } catch (err: any) {
      setError(err?.message || 'Could not update skill.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddCustomSkill = async () => {
    if (!user || addingCustom) return;
    setError(null);
    setSkillsSaved(false);

    const validation = profileService.validateSkillName(customSkillInput);
    if (!validation.valid) {
      setError(validation.error || 'Invalid skill name.');
      return;
    }

    const normalized = validation.normalized;
    const lower = normalized.toLowerCase();

    if (userSkills.some((s) => s.name.trim().toLowerCase() === lower)) {
      setCustomSkillInput('');
      setSkillsSaved(true);
      return;
    }

    if (userSkills.length >= MAX_PROFILE_SKILLS) {
      setError(`Maximum limit of ${MAX_PROFILE_SKILLS} skills per profile reached.`);
      return;
    }

    setAddingCustom(true);
    try {
      await profileService.addProfileSkills([], [normalized]);
      // Re-fetch authoritative saved skills from the database
      const [skills, refreshed] = await Promise.all([
        profileService.getSkills(),
        profileService.getUserSkills(user.id),
      ]);
      setAvailableSkills(skills);
      setUserSkills(refreshed);
      setCustomSkillInput('');
      setZeroSkillsWarning(false);
      setSkillsSaved(true);
      await refreshProfile();
    } catch (err: any) {
      setError(err?.message || 'Could not add custom skill.');
    } finally {
      setAddingCustom(false);
    }
  };

  const handleSuggestSkills = async () => {
    if (!workDescription.trim()) {
      setAiError('Please enter a short description of the work you do.');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    try {
      const suggestions = await aiService.suggestSkills(workDescription);
      setAiSuggestions(suggestions);
    } catch (err: any) {
      setAiError(err?.message || 'Could not fetch suggestions. You can add skills manually below.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleToggleAiSkill = async (skillName: string) => {
    if (!user) return;
    const lower = skillName.trim().toLowerCase();
    const existingOwned = userSkills.find((s) => s.name.trim().toLowerCase() === lower);

    if (existingOwned) {
      await toggleSkill(existingOwned);
      return;
    }

    if (userSkills.length >= MAX_PROFILE_SKILLS) {
      setError(`Maximum limit of ${MAX_PROFILE_SKILLS} skills per profile reached.`);
      return;
    }

    setActionLoading(`ai-${lower}`);
    setError(null);
    setSkillsSaved(false);
    try {
      await profileService.addProfileSkills([], [skillName.trim()]);
      const [skills, refreshed] = await Promise.all([
        profileService.getSkills(),
        profileService.getUserSkills(user.id),
      ]);
      setAvailableSkills(skills);
      setUserSkills(refreshed);
      setZeroSkillsWarning(false);
      setSkillsSaved(true);
      await refreshProfile();
    } catch (err: any) {
      setError(err?.message || 'Could not add suggested skill.');
    } finally {
      setActionLoading(null);
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
          Select skills from the catalog, use AI suggestions, or add custom skills to display on your freelancer profile (up to 15).
        </Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {(zeroSkillsWarning || (!loading && userSkills.length === 0)) && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>{strings.onboarding.zeroSkillsWarning}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.skillsContent} keyboardShouldPersistTaps="handled">
          {/* Top "Your skills (n/15)" Tray */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.trayHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 0 }]}>
                {strings.onboarding.yourSkillsTrayLabel} ({userSkills.length}/{MAX_PROFILE_SKILLS})
              </Text>
              {skillsSaved && (
                <View style={[styles.savedBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={styles.savedBadgeText}>✓ {strings.onboarding.skillsSavedText}</Text>
                </View>
              )}
            </View>

            {userSkills.length > 0 ? (
              <View style={[styles.chipGrid, { marginTop: 12 }]}>
                {userSkills.map((skill) => {
                  const isBusy = actionLoading === skill.id;
                  const isPendingReview = skill.source === 'user' && skill.is_active === false;

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
                      <Text style={[styles.chipText, { color: '#ffffff', marginRight: 6 }]}>
                        {skill.name}
                      </Text>
                      {isPendingReview && (
                        <View style={styles.pendingPill}>
                          <Text style={styles.pendingPillText}>
                            {strings.onboarding.pendingReviewBadge}
                          </Text>
                        </View>
                      )}
                      <Text style={{ color: '#ffffff', fontWeight: '700' }}>×</Text>
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
              <Text style={[styles.subtitle, { color: theme.colors.muted, marginTop: 8 }]}>
                {strings.onboarding.yourSkillsEmptyHint}
              </Text>
            )}
          </View>

          {/* Add Custom Skill Input */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              ✍️ Add Custom Skill
            </Text>
            <View style={styles.customRow}>
              <TextInput
                style={[
                  styles.customInput,
                  { borderColor: theme.colors.border, color: theme.colors.text },
                ]}
                placeholder={strings.onboarding.addCustomSkillPlaceholder}
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
          </View>

          {/* AI Skill Suggestions */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 4 }]}>
              🤖 Suggest Skills with AI
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.muted, marginBottom: 10 }]}>
              Describe what you do in plain words to get skill suggestions.
            </Text>
            <TextInput
              style={[
                styles.customInput,
                { borderColor: theme.colors.border, color: theme.colors.text, marginBottom: 10 },
              ]}
              placeholder={strings.onboarding.aiSkillsPlaceholder}
              placeholderTextColor={theme.colors.muted}
              value={workDescription}
              onChangeText={setWorkDescription}
            />
            {aiError && (
              <Text style={[styles.errorText, { marginBottom: 8 }]}>{aiError}</Text>
            )}
            <TouchableOpacity
              style={[
                styles.aiBtn,
                { backgroundColor: theme.colors.primarySoft },
                aiLoading && { opacity: 0.7 },
              ]}
              onPress={handleSuggestSkills}
              disabled={aiLoading}
            >
              <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 14 }}>
                {aiLoading ? strings.onboarding.suggestingSkills : strings.onboarding.suggestSkillsBtn}
              </Text>
            </TouchableOpacity>

            {aiSuggestions.length > 0 && (
              <View style={[styles.chipGrid, { marginTop: 12 }]}>
                {aiSuggestions.map((sug) => {
                  const lower = sug.trim().toLowerCase();
                  const selected = userSkills.some((s) => s.name.trim().toLowerCase() === lower);
                  const isBusy = actionLoading === `ai-${lower}`;
                  return (
                    <TouchableOpacity
                      key={sug}
                      style={[
                        styles.chip,
                        { borderColor: theme.colors.border },
                        selected && {
                          backgroundColor: theme.colors.primary,
                          borderColor: theme.colors.primary,
                        },
                      ]}
                      onPress={() => handleToggleAiSkill(sug)}
                      disabled={isBusy}
                    >
                      <Text style={[styles.chipText, selected && { color: '#ffffff' }]}>
                        {selected ? '✓ ' : '+ '}
                        {sug}
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
            )}
          </View>

          {/* Skills Catalog */}
          {availableSkills.length > 0 ? (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                📋 Skills Catalog
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
            </View>
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
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  trayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  savedBadgeText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
  },
  pendingPill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 6,
  },
  pendingPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
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
  aiBtn: {
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    backgroundColor: '#FDE8EA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#D92D3E',
  },
  errorText: {
    color: '#D92D3E',
    fontSize: 14,
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  warningText: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillsContent: {
    paddingVertical: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
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

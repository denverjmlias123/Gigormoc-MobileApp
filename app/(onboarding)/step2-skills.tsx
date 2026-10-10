import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { profileService, Skill } from '../../services/profile';
import { aiService } from '../../services/ai';
import { strings } from '../../constants/strings';

export default function OnboardingStep2SkillsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { signOut } = useAuth();

  // Catalog skills
  const [catalogSkills, setCatalogSkills] = useState<Skill[]>([]);
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // AI skills
  const [workDescription, setWorkDescription] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [selectedAiSkills, setSelectedAiSkills] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Manual custom skill input
  const [customInput, setCustomInput] = useState('');
  const [customSkills, setCustomSkills] = useState<string[]>([]);

  // Submitting state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchCatalog = async () => {
      try {
        const data = await profileService.getSkills();
        if (mounted) {
          setCatalogSkills(data || []);
        }
      } catch {
        // Empty catalog is normal until admin adds rows
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchCatalog();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleCatalogSkill = (id: string) => {
    setSelectedCatalogIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleAiSkill = (skill: string) => {
    setSelectedAiSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleAddCustomSkill = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (trimmed.length < 2 || trimmed.length > 40) {
      Alert.alert('Invalid skill', 'Skill name must be between 2 and 40 characters.');
      return;
    }
    if (!customSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setCustomSkills((prev) => [...prev, trimmed]);
    }
    setCustomInput('');
  };

  const removeCustomSkill = (skill: string) => {
    setCustomSkills((prev) => prev.filter((s) => s !== skill));
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
      // Auto-select all suggestions by default so user can untick
      setSelectedAiSkills(suggestions);
    } catch (err: any) {
      setAiError(err?.message || 'Could not fetch suggestions. You can add skills manually below.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleContinue = async () => {
    setSaveError(null);
    // Combine custom skills entered manually and selected AI suggestions
    const customNamesToSave = Array.from(
      new Set([...selectedAiSkills, ...customSkills])
    );

    if (selectedCatalogIds.length === 0 && customNamesToSave.length === 0) {
      // Nothing chosen, proceed directly
      router.push('/(onboarding)/step3-profile');
      return;
    }

    setSaving(true);
    try {
      await profileService.addProfileSkills(selectedCatalogIds, customNamesToSave);
      router.push('/(onboarding)/step3-profile');
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save skills. Please retry or skip for now.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    router.push('/(onboarding)/step3-profile');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Text style={[styles.stepIndicator, { color: theme.colors.muted }]}>Onboarding 2 of 3</Text>
          <TouchableOpacity onPress={() => signOut().then(() => router.replace('/(auth)/login'))}>
            <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '600' }}>Log Out</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.title, { color: theme.colors.text }]}>{strings.onboarding.skillsTitle}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
          {strings.onboarding.skillsSubtitle}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {saveError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{saveError}</Text>
          </View>
        )}

        {/* AI Skill Suggestion Box (Always available, even when catalog is empty) */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            🤖 Suggest Skills with AI
          </Text>
          <Text style={[styles.cardDesc, { color: theme.colors.muted }]}>
            Describe the work you do in plain words, and our assistant will suggest relevant skills.
          </Text>

          <TextInput
            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
            placeholder={strings.onboarding.aiSkillsPlaceholder}
            placeholderTextColor={theme.colors.muted}
            value={workDescription}
            onChangeText={setWorkDescription}
            multiline
            numberOfLines={2}
          />

          {aiError && (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{aiError}</Text>
              <TouchableOpacity onPress={handleSuggestSkills} style={{ marginTop: 4 }}>
                <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.aiBtn,
              { backgroundColor: theme.colors.primarySoft },
              aiLoading && { opacity: 0.7 },
            ]}
            onPress={handleSuggestSkills}
            disabled={aiLoading}
            activeOpacity={0.8}
          >
            {aiLoading ? (
              <View style={styles.btnRow}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={[styles.aiBtnText, { color: theme.colors.primary, marginLeft: 8 }]}>
                  {strings.onboarding.suggestingSkills}
                </Text>
              </View>
            ) : (
              <Text style={[styles.aiBtnText, { color: theme.colors.primary }]}>
                {strings.onboarding.suggestSkillsBtn}
              </Text>
            )}
          </TouchableOpacity>

          {/* AI Suggestions List */}
          {aiSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={[styles.subLabel, { color: theme.colors.text }]}>
                Suggested Skills (tap to toggle):
              </Text>
              <View style={styles.chipsWrap}>
                {aiSuggestions.map((skill) => {
                  const selected = selectedAiSkills.includes(skill);
                  return (
                    <TouchableOpacity
                      key={skill}
                      style={[
                        styles.chip,
                        { borderColor: theme.colors.border },
                        selected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                      ]}
                      onPress={() => toggleAiSkill(skill)}
                    >
                      <Text style={[styles.chipText, selected && { color: '#ffffff' }]}>
                        {selected ? '✓ ' : '+ '}{skill}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Catalog Skills */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : catalogSkills.length > 0 ? (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              📋 Skills Catalog
            </Text>
            <View style={styles.chipsWrap}>
              {catalogSkills.map((skill) => {
                const selected = selectedCatalogIds.includes(skill.id);
                return (
                  <TouchableOpacity
                    key={skill.id}
                    style={[
                      styles.chip,
                      { borderColor: theme.colors.border },
                      selected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                    ]}
                    onPress={() => toggleCatalogSkill(skill.id)}
                  >
                    <Text style={[styles.chipText, selected && { color: '#ffffff' }]}>
                      {skill.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Manual Custom Skill Input */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            ✍️ Add Custom Skill
          </Text>
          <View style={styles.customInputRow}>
            <TextInput
              style={[
                styles.input,
                { flex: 1, borderColor: theme.colors.border, color: theme.colors.text, marginBottom: 0 },
              ]}
              placeholder={strings.onboarding.addCustomSkillPlaceholder}
              placeholderTextColor={theme.colors.muted}
              value={customInput}
              onChangeText={setCustomInput}
            />
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handleAddCustomSkill}
            >
              <Text style={{ color: '#ffffff', fontWeight: '600' }}>Add</Text>
            </TouchableOpacity>
          </View>

          {customSkills.length > 0 && (
            <View style={[styles.chipsWrap, { marginTop: 12 }]}>
              {customSkills.map((cSkill) => (
                <View
                  key={cSkill}
                  style={[styles.chip, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center' }]}
                >
                  <Text style={{ color: theme.colors.primary, marginRight: 6 }}>{cSkill}</Text>
                  <TouchableOpacity onPress={() => removeCustomSkill(cSkill)}>
                    <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer Navigation */}
      <View style={[styles.footer, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }, saving && { opacity: 0.7 }]}
          onPress={handleContinue}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip} disabled={saving}>
          <Text style={{ color: theme.colors.muted, textAlign: 'center' }}>{strings.onboarding.skipForNow}</Text>
        </TouchableOpacity>
      </View>
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
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepIndicator: {
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  aiBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineError: {
    backgroundColor: '#FDE8EA',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  inlineErrorText: {
    color: '#D92D3E',
    fontSize: 13,
  },
  suggestionsContainer: {
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
  },
  subLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorBanner: {
    backgroundColor: '#FDE8EA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#D92D3E',
    fontSize: 14,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  footer: {
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 12,
    padding: 8,
  },
});

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useAppTheme } from '../../app/theme';
import { Skill } from '../../services/profile';
import { strings } from '../../constants/strings';

interface FreelancerSkillSectionsProps {
  workDescription: string;
  setWorkDescription: (desc: string) => void;
  aiSuggestions: string[];
  selectedAiSkills: string[];
  toggleAiSkill: (skill: string) => void;
  savedSkills: Skill[];
  aiLoading: boolean;
  aiError: string | null;
  onSuggestSkills: () => void;
  catalogSkills: Skill[];
  catalogLoading: boolean;
  selectedCatalogIds: string[];
  toggleCatalogSkill: (id: string) => void;
  customInput: string;
  setCustomInput: (input: string) => void;
  onAddCustomSkill: () => void;
}

export const FreelancerSkillSections: React.FC<FreelancerSkillSectionsProps> = ({
  workDescription,
  setWorkDescription,
  aiSuggestions,
  selectedAiSkills,
  toggleAiSkill,
  savedSkills,
  aiLoading,
  aiError,
  onSuggestSkills,
  catalogSkills,
  catalogLoading,
  selectedCatalogIds,
  toggleCatalogSkill,
  customInput,
  setCustomInput,
  onAddCustomSkill,
}) => {
  const theme = useAppTheme();

  return (
    <>
      {/* AI Skill Suggestion Box (Freelancer only) */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
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
            <TouchableOpacity onPress={onSuggestSkills} style={{ marginTop: 4 }}>
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
          onPress={onSuggestSkills}
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

        {aiSuggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <Text style={[styles.subLabel, { color: theme.colors.text }]}>
              Suggested Skills (tap to toggle):
            </Text>
            <View style={styles.chipsWrap}>
              {aiSuggestions.map((skill) => {
                const lower = skill.trim().toLowerCase();
                const selected =
                  selectedAiSkills.some((s) => s.trim().toLowerCase() === lower) ||
                  savedSkills.some((s) => s.name.trim().toLowerCase() === lower);
                return (
                  <TouchableOpacity
                    key={skill}
                    style={[
                      styles.chip,
                      { borderColor: theme.colors.border },
                      selected && {
                        backgroundColor: theme.colors.primary,
                        borderColor: theme.colors.primary,
                      },
                    ]}
                    onPress={() => toggleAiSkill(skill)}
                  >
                    <Text style={[styles.chipText, selected && { color: '#ffffff' }]}>
                      {selected ? '✓ ' : '+ '}
                      {skill}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* Catalog Skills */}
      {catalogLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : catalogSkills.length > 0 ? (
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            📋 Skills Catalog
          </Text>
          <View style={styles.chipsWrap}>
            {catalogSkills.map((skill) => {
              const selected =
                selectedCatalogIds.includes(skill.id) ||
                savedSkills.some((s) => s.id === skill.id);
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
                  onPress={() => toggleCatalogSkill(skill.id)}
                >
                  <Text style={[styles.chipText, selected && { color: '#ffffff' }]}>
                    {selected ? '✓ ' : ''}
                    {skill.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Manual Custom Skill Input */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
          ✏️ Add a Custom Skill
        </Text>
        <Text style={[styles.cardDesc, { color: theme.colors.muted }]}>
          Cannot find your skill in the catalog or suggestions? Type it in below.
        </Text>

        <View style={styles.customInputRow}>
          <TextInput
            style={[
              styles.input,
              {
                flex: 1,
                borderColor: theme.colors.border,
                color: theme.colors.text,
                marginBottom: 0,
              },
            ]}
            placeholder={strings.onboarding.addCustomSkillPlaceholder}
            placeholderTextColor={theme.colors.muted}
            value={customInput}
            onChangeText={setCustomInput}
            maxLength={40}
          />
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
            onPress={onAddCustomSkill}
          >
            <Text style={{ color: '#ffffff', fontWeight: '600' }}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
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
  subLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
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
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});

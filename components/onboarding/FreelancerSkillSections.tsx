import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAppTheme } from '../../app/theme';
import { Skill } from '../../services/profile';
import { strings } from '../../constants/strings';
import { Card, AlertBox } from '../ui/Card';
import { TextInput } from '../ui/TextInput';
import { Chip } from '../ui/Chip';
import { Button } from '../ui/Button';

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
  const [catalogSearch, setCatalogSearch] = React.useState('');

  const filteredCatalog = React.useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return catalogSkills;
    return catalogSkills.filter((s) => s.name.toLowerCase().includes(q));
  }, [catalogSkills, catalogSearch]);

  return (
    <>
      {/* AI Skill Suggestion Box (Freelancer only) */}
      <Card
        headerTitle="Suggest Skills with AI"
        headerSubtitle="Describe the work you do in plain words, and our assistant will suggest relevant skills."
        headerIcon="sparkles-outline"
        style={styles.card}
      >
        <TextInput
          placeholder={strings.onboarding.aiSkillsPlaceholder}
          value={workDescription}
          onChangeText={setWorkDescription}
          multiline
          numberOfLines={2}
          containerStyle={{ marginBottom: 12 }}
        />

        {aiError && (
          <AlertBox
            tone="danger"
            message={aiError}
            actionLabel="Retry"
            onAction={onSuggestSkills}
            style={{ marginBottom: 12 }}
          />
        )}

        <Button
          title={aiLoading ? strings.onboarding.suggestingSkills : strings.onboarding.suggestSkillsBtn}
          onPress={onSuggestSkills}
          variant="ai"
          size="md"
          icon="sparkles"
          loading={aiLoading}
          disabled={aiLoading}
          fullWidth
        />

        {aiSuggestions.length > 0 && (
          <Card tone="inset" padding="sm" style={styles.suggestionsContainer}>
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
                  <Chip
                    key={skill}
                    label={`${selected ? '' : '+ '}${skill}`}
                    selected={selected}
                    size="sm"
                    onPress={() => toggleAiSkill(skill)}
                  />
                );
              })}
            </View>
          </Card>
        )}
      </Card>

      {/* Catalog Skills */}
      {catalogLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : catalogSkills.length > 0 ? (
        <Card
          headerTitle="Skills Catalog"
          headerIcon="list-outline"
          style={styles.card}
        >
          {catalogSkills.length > 8 && (
            <TextInput
              placeholder="Filter catalog skills..."
              value={catalogSearch}
              onChangeText={setCatalogSearch}
              leftIcon="search-outline"
              onClear={catalogSearch ? () => setCatalogSearch('') : undefined}
              containerStyle={{ marginBottom: 12 }}
            />
          )}
          <View style={styles.chipsWrap}>
            {filteredCatalog.map((skill) => {
              const selected =
                selectedCatalogIds.includes(skill.id) ||
                savedSkills.some((s) => s.id === skill.id);
              return (
                <Chip
                  key={skill.id}
                  label={skill.name}
                  selected={selected}
                  size="sm"
                  onPress={() => toggleCatalogSkill(skill.id)}
                />
              );
            })}
          </View>
        </Card>
      ) : null}

      {/* Manual Custom Skill Input */}
      <Card
        headerTitle="Add a Custom Skill"
        headerSubtitle="Cannot find your skill in the catalog or suggestions? Type it in below."
        headerIcon="create-outline"
        style={styles.card}
      >
        <View style={styles.customInputRow}>
          <TextInput
            placeholder={strings.onboarding.addCustomSkillPlaceholder}
            value={customInput}
            onChangeText={setCustomInput}
            maxLength={40}
            containerStyle={styles.customInputWrap}
          />
          <Button
            title="Add"
            onPress={onAddCustomSkill}
            variant="primary"
            size="sm"
            icon="add"
          />
        </View>
      </Card>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  suggestionsContainer: {
    marginTop: 14,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customInputWrap: {
    flex: 1,
    marginBottom: 0,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});

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
import { Category } from '../../services/profile';
import { strings } from '../../constants/strings';

interface ClientHiringDetailsCardProps {
  clientType: 'individual' | 'business' | 'organization' | 'other' | '';
  setClientType: (type: 'individual' | 'business' | 'organization' | 'other' | '') => void;
  businessName: string;
  setBusinessName: (name: string) => void;
  aboutHiring: string;
  setAboutHiring: (note: string) => void;
  catalogCategories: Category[];
  catalogLoading: boolean;
  selectedCategoryIds: string[];
  toggleCatalogCategory: (id: string) => void;
  helpDescription: string;
  setHelpDescription: (desc: string) => void;
  aiCategorySuggestions: string[];
  onSuggestCategories: () => void;
  aiLoading: boolean;
  aiError: string | null;
  selectedCustomCategories: string[];
  toggleCustomCategory: (name: string) => void;
  customCategoryInput: string;
  setCustomCategoryInput: (input: string) => void;
  onAddCustomCategory: () => void;
  totalSelectedInterests: number;
  maxHiringInterests: number;
}

export const ClientHiringDetailsCard: React.FC<ClientHiringDetailsCardProps> = ({
  clientType,
  setClientType,
  businessName,
  setBusinessName,
  aboutHiring,
  setAboutHiring,
  catalogCategories,
  catalogLoading,
  selectedCategoryIds,
  toggleCatalogCategory,
  helpDescription,
  setHelpDescription,
  aiCategorySuggestions,
  onSuggestCategories,
  aiLoading,
  aiError,
  selectedCustomCategories,
  toggleCustomCategory,
  customCategoryInput,
  setCustomCategoryInput,
  onAddCustomCategory,
  totalSelectedInterests,
  maxHiringInterests,
}) => {
  const theme = useAppTheme();

  return (
    <>
      {/* Client Type */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
          Who are you hiring as?
        </Text>
        <Text style={[styles.cardDesc, { color: theme.colors.muted }]}>
          Let freelancers know if you are hiring for yourself, a small business, or an organization.
        </Text>
        <View style={styles.chipsWrap}>
          {strings.profile.clientTypeOptions.map((opt) => {
            const selected = clientType === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.chip,
                  { borderColor: theme.colors.border },
                  selected && {
                    backgroundColor: theme.colors.primary,
                    borderColor: theme.colors.primary,
                  },
                ]}
                onPress={() => setClientType(selected ? '' : opt.value)}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? '#ffffff' : theme.colors.text },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.subLabel, { color: theme.colors.text, marginTop: 14 }]}>
          Business or Organization Name (Optional, 2–60 characters)
        </Text>
        <TextInput
          style={[
            styles.input,
            { borderColor: theme.colors.border, color: theme.colors.text, marginBottom: 0 },
          ]}
          placeholder="e.g. Ormoc Print Shop"
          placeholderTextColor={theme.colors.muted}
          value={businessName}
          onChangeText={setBusinessName}
          maxLength={60}
        />
      </View>

      {/* AI Category Suggestions for Clients */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
          🤖 Suggest Categories with AI
        </Text>
        <Text style={[styles.cardDesc, { color: theme.colors.muted }]}>
          Describe what you usually need help with, and our assistant will suggest relevant categories.
        </Text>

        <TextInput
          style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
          placeholder={strings.onboarding.aiCategoriesPlaceholder}
          placeholderTextColor={theme.colors.muted}
          value={helpDescription}
          onChangeText={setHelpDescription}
          multiline
          numberOfLines={2}
        />

        {aiError && (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{aiError}</Text>
            <TouchableOpacity onPress={onSuggestCategories} style={{ marginTop: 4 }}>
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
          onPress={onSuggestCategories}
          disabled={aiLoading}
          activeOpacity={0.8}
        >
          {aiLoading ? (
            <View style={styles.btnRow}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={[styles.aiBtnText, { color: theme.colors.primary, marginLeft: 8 }]}>
                {strings.onboarding.suggestingCategories}
              </Text>
            </View>
          ) : (
            <Text style={[styles.aiBtnText, { color: theme.colors.primary }]}>
              {strings.onboarding.suggestCategoriesBtn}
            </Text>
          )}
        </TouchableOpacity>

        {aiCategorySuggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <Text style={[styles.subLabel, { color: theme.colors.text }]}>
              Suggested Categories (tap to toggle):
            </Text>
            <View style={styles.chipsWrap}>
              {aiCategorySuggestions.map((catName) => {
                const catalogMatch = catalogCategories.find(
                  (c) => c.name.toLowerCase() === catName.toLowerCase()
                );
                const selected = catalogMatch
                  ? selectedCategoryIds.includes(catalogMatch.id)
                  : selectedCustomCategories.some(
                      (c) => c.toLowerCase() === catName.toLowerCase()
                    );
                return (
                  <TouchableOpacity
                    key={catName}
                    style={[
                      styles.chip,
                      { borderColor: theme.colors.border },
                      selected && {
                        backgroundColor: theme.colors.primary,
                        borderColor: theme.colors.primary,
                      },
                    ]}
                    onPress={() =>
                      catalogMatch
                        ? toggleCatalogCategory(catalogMatch.id)
                        : toggleCustomCategory(catName)
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: selected ? '#ffffff' : theme.colors.text },
                      ]}
                    >
                      {selected ? '✓ ' : '+ '}
                      {catName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* Hiring Interests Catalog & Custom Category Input */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
          Hiring Interests ({totalSelectedInterests}/{maxHiringInterests})
        </Text>
        <Text style={[styles.cardDesc, { color: theme.colors.muted }]}>
          Pick up to {maxHiringInterests} categories of work you usually hire for.
        </Text>

        {catalogLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 12 }} />
        ) : catalogCategories.length > 0 ? (
          <View style={[styles.chipsWrap, { marginBottom: 12 }]}>
            {catalogCategories.map((cat) => {
              const selected = selectedCategoryIds.includes(cat.id);
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.chip,
                    { borderColor: theme.colors.border },
                    selected && {
                      backgroundColor: theme.colors.primary,
                      borderColor: theme.colors.primary,
                    },
                  ]}
                  onPress={() => toggleCatalogCategory(cat.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: selected ? '#ffffff' : theme.colors.text },
                    ]}
                  >
                    {selected ? '✓ ' : ''}
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

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
            placeholder={strings.onboarding.addCustomCategoryPlaceholder}
            placeholderTextColor={theme.colors.muted}
            value={customCategoryInput}
            onChangeText={setCustomCategoryInput}
            maxLength={50}
          />
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
            onPress={onAddCustomCategory}
          >
            <Text style={{ color: '#ffffff', fontWeight: '600' }}>Add</Text>
          </TouchableOpacity>
        </View>

        {selectedCustomCategories.length > 0 && (
          <View style={[styles.chipsWrap, { marginTop: 12 }]}>
            {selectedCustomCategories.map((catName) => (
              <View
                key={catName}
                style={[
                  styles.chip,
                  {
                    backgroundColor: theme.colors.primarySoft,
                    borderColor: theme.colors.primary,
                    flexDirection: 'row',
                    alignItems: 'center',
                  },
                ]}
              >
                <Text style={{ color: theme.colors.primary, marginRight: 6 }}>{catName}</Text>
                <TouchableOpacity onPress={() => toggleCustomCategory(catName)}>
                  <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* About Hiring */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
          What kind of work do you usually need? (Optional)
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: theme.colors.border,
              color: theme.colors.text,
              minHeight: 80,
              marginBottom: 4,
            },
          ]}
          placeholder="e.g. Weekly store errands, graphic design for promotions, aircon maintenance..."
          placeholderTextColor={theme.colors.muted}
          value={aboutHiring}
          onChangeText={setAboutHiring}
          multiline
          numberOfLines={3}
          maxLength={300}
          textAlignVertical="top"
        />
        <Text style={{ fontSize: 12, color: theme.colors.muted }}>
          {aboutHiring.trim().length}/300 characters
        </Text>
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
});

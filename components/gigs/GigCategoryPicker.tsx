import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useAppTheme } from '../../app/theme';
import { Category } from '../../services/profile';
import { SuggestedGigCategory, SimilarCategory } from '../../services/gigs';
import { TextInput } from '../ui/TextInput';
import { strings } from '../../constants/strings';

interface GigCategoryPickerProps {
  categories: Category[];
  catsLoading: boolean;
  selectedCategoryId: string;
  customCategoryName: string;
  setCustomCategoryName: (name: string) => void;
  categoryQuery: string;
  setCategoryQuery: (query: string) => void;
  suggestedCategories: SuggestedGigCategory[];
  aiProposedCategory: string | null;
  similarCategories: SimilarCategory[];
  suggestLoading: boolean;
  onAiSuggestCategory: () => void;
  onSelectExistingCategory: (id: string) => void;
  onSelectCustomCategory: (name: string) => void;
}

export const GigCategoryPicker: React.FC<GigCategoryPickerProps> = ({
  categories,
  catsLoading,
  selectedCategoryId,
  customCategoryName,
  setCustomCategoryName,
  categoryQuery,
  setCategoryQuery,
  suggestedCategories,
  aiProposedCategory,
  similarCategories,
  suggestLoading,
  onAiSuggestCategory,
  onSelectExistingCategory,
  onSelectCustomCategory,
}) => {
  const theme = useAppTheme();

  const normalizedQuery = categoryQuery.replace(/\s+/g, ' ').trim();
  const filteredExistingCategories = normalizedQuery
    ? categories.filter((c) => c.name.toLowerCase().includes(normalizedQuery.toLowerCase()))
    : categories;
  const exactExistingMatch = categories.find(
    (c) => c.name.trim().toLowerCase() === normalizedQuery.toLowerCase()
  );
  const canProposeTypedCategory =
    normalizedQuery.length >= 3 && normalizedQuery.length <= 40 && !exactExistingMatch;

  return (
    <View style={styles.fieldGroup}>
      <View style={styles.categoryHeaderRow}>
        <Text style={[styles.fieldLabel, { color: theme.colors.text, marginBottom: 0 }]}>
          {strings.gigs.categoryLabel}
        </Text>
        <TouchableOpacity
          onPress={onAiSuggestCategory}
          disabled={suggestLoading}
          style={[
            styles.aiSuggestBtn,
            { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
          ]}
        >
          <Text style={[styles.aiSuggestBtnText, { color: theme.colors.primary }]}>
            {suggestLoading
              ? strings.gigs.aiSuggestingCategory
              : strings.gigs.aiSuggestCategoryBtn}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.helperSubtext, { color: theme.colors.muted }]}>
        {strings.gigs.categoryHelper}
      </Text>

      {/* Selected custom category pill */}
      {customCategoryName ? (
        <View
          style={[
            styles.selectedCustomBanner,
            { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
          ]}
        >
          <Text style={[styles.selectedCustomText, { color: theme.colors.primary }]}>
            New category selected: <Text style={{ fontWeight: '800' }}>{customCategoryName}</Text>
          </Text>
          <TouchableOpacity onPress={() => setCustomCategoryName('')}>
            <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 12 }}>
              Change
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Suggested Categories */}
      {suggestedCategories.length > 0 && (
        <View style={styles.suggestedSection}>
          <Text style={[styles.subSectionLabel, { color: theme.colors.muted }]}>
            {strings.gigs.suggestedCategoriesLabel}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
            {suggestedCategories.map((sug) => {
              const isSelected = selectedCategoryId === sug.id && !customCategoryName;
              return (
                <TouchableOpacity
                  key={`sug-${sug.id}`}
                  style={[
                    styles.catChip,
                    { borderColor: theme.colors.primary },
                    isSelected && {
                      backgroundColor: theme.colors.primary,
                      borderColor: theme.colors.primary,
                    },
                  ]}
                  onPress={() => onSelectExistingCategory(sug.id)}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      { color: isSelected ? '#ffffff' : theme.colors.primary },
                    ]}
                  >
                    ✨ {sug.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Optional AI-proposed new category */}
      {aiProposedCategory && (
        <View style={styles.suggestedSection}>
          <Text style={[styles.subSectionLabel, { color: theme.colors.muted }]}>
            {strings.gigs.aiProposedCategoryLabel}
          </Text>
          <TouchableOpacity
            style={[
              styles.catChip,
              { alignSelf: 'flex-start', borderColor: theme.colors.primary },
              customCategoryName.toLowerCase() === aiProposedCategory.toLowerCase() && {
                backgroundColor: theme.colors.primary,
              },
            ]}
            onPress={() => onSelectCustomCategory(aiProposedCategory)}
          >
            <Text
              style={[
                styles.catChipText,
                {
                  color:
                    customCategoryName.toLowerCase() === aiProposedCategory.toLowerCase()
                      ? '#ffffff'
                      : theme.colors.primary,
                },
              ]}
            >
              + {aiProposedCategory}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search or create category input */}
      <TextInput
        label="Search or Create Category"
        placeholder={strings.gigs.searchOrCreateCategoryPlaceholder}
        value={categoryQuery}
        onChangeText={setCategoryQuery}
      />

      {/* Existing categories list */}
      {catsLoading ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : filteredExistingCategories.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
          {filteredExistingCategories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id && !customCategoryName;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.catChip,
                  { borderColor: theme.colors.border },
                  isSelected && {
                    backgroundColor: theme.colors.primary,
                    borderColor: theme.colors.primary,
                  },
                ]}
                onPress={() => onSelectExistingCategory(cat.id)}
              >
                <Text
                  style={[
                    styles.catChipText,
                    { color: isSelected ? '#ffffff' : theme.colors.text },
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      {/* Did you mean? Box */}
      {canProposeTypedCategory && (
        <View
          style={[
            styles.didYouMeanBox,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          {similarCategories.length > 0 ? (
            <>
              <Text style={[styles.didYouMeanTitle, { color: theme.colors.text }]}>
                {strings.gigs.didYouMeanLabel}
              </Text>
              <View style={styles.similarChipsWrap}>
                {similarCategories.map((sim) => {
                  const isSelected = selectedCategoryId === sim.id && !customCategoryName;
                  return (
                    <TouchableOpacity
                      key={`sim-${sim.id}`}
                      style={[
                        styles.catChip,
                        { borderColor: theme.colors.primary, marginBottom: 6 },
                        isSelected && { backgroundColor: theme.colors.primary },
                      ]}
                      onPress={() => {
                        onSelectExistingCategory(sim.id);
                        setCategoryQuery('');
                      }}
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          { color: isSelected ? '#ffffff' : theme.colors.primary },
                        ]}
                      >
                        {sim.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[styles.createNewConfirmBtn, { borderColor: theme.colors.border }]}
                onPress={() => onSelectCustomCategory(normalizedQuery)}
              >
                <Text style={[styles.createNewConfirmText, { color: theme.colors.text }]}>
                  {strings.gigs.confirmCreateNewCategoryPrefix} &ldquo;{normalizedQuery}&rdquo;{' '}
                  {strings.gigs.confirmCreateNewCategorySuffix}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[
                styles.createNewConfirmBtn,
                {
                  borderColor: theme.colors.primary,
                  backgroundColor: theme.colors.primarySoft,
                },
              ]}
              onPress={() => onSelectCustomCategory(normalizedQuery)}
            >
              <Text
                style={[
                  styles.createNewConfirmText,
                  { color: theme.colors.primary, fontWeight: '700' },
                ]}
              >
                + {strings.gigs.addNewCategoryPrefix} &ldquo;{normalizedQuery}&rdquo;{' '}
                {strings.gigs.addNewCategorySuffix}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fieldGroup: {
    marginBottom: 16,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  helperSubtext: {
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 16,
  },
  aiSuggestBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  aiSuggestBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectedCustomBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  selectedCustomText: {
    fontSize: 13,
  },
  suggestedSection: {
    marginBottom: 10,
  },
  subSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  catRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  catChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  didYouMeanBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  didYouMeanTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  similarChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  createNewConfirmBtn: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  createNewConfirmText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

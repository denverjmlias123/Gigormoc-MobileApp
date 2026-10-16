import React, { RefObject } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useAppTheme } from '../../app/theme';
import { Category } from '../../services/profile';
import { strings } from '../../constants/strings';

interface ClientHiringProfileSectionProps {
  clientType: 'individual' | 'business' | 'organization' | 'other' | '';
  setClientType: (val: 'individual' | 'business' | 'organization' | 'other' | '') => void;
  businessName: string;
  setBusinessName: (val: string) => void;
  aboutHiring: string;
  setAboutHiring: (val: string) => void;
  categoriesList: Category[];
  selectedCategoryIds: string[];
  toggleHiringCategory: (id: string) => void;
  customCategories: string[];
  removeCustomCategory: (name: string) => void;
  customCategoryInput: string;
  setCustomCategoryInput: (val: string) => void;
  onAddCustomCategory: () => void;
  customCategoryInputRef: RefObject<TextInput | null>;
  totalSelectedInterests: number;
  maxHiringInterests: number;
  fieldErrors: Record<string, string>;
}

export const ClientHiringProfileSection: React.FC<ClientHiringProfileSectionProps> = ({
  clientType,
  setClientType,
  businessName,
  setBusinessName,
  aboutHiring,
  setAboutHiring,
  categoriesList,
  selectedCategoryIds,
  toggleHiringCategory,
  customCategories,
  removeCustomCategory,
  customCategoryInput,
  setCustomCategoryInput,
  onAddCustomCategory,
  customCategoryInputRef,
  totalSelectedInterests,
  maxHiringInterests,
  fieldErrors,
}) => {
  const theme = useAppTheme();

  return (
    <View style={[styles.roleSection, { borderColor: theme.colors.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Client Hiring Details
      </Text>

      {/* Client Type */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>Client Type</Text>
        <View style={styles.chipsWrap}>
          {strings.profile.clientTypeOptions.map((opt) => {
            const selected = clientType === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                    backgroundColor: selected
                      ? theme.colors.primarySoft
                      : theme.colors.surface,
                  },
                ]}
                onPress={() => setClientType(selected ? '' : opt.value)}
              >
                <Text
                  style={{
                    color: selected ? theme.colors.primary : theme.colors.text,
                    fontWeight: selected ? '700' : '500',
                    fontSize: 13,
                  }}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Business Name */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>
          Business or Organization Name (Optional, 2–60 characters)
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: fieldErrors.businessName
                ? theme.colors.danger
                : theme.colors.border,
              color: theme.colors.text,
            },
          ]}
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="e.g. Ormoc Print Shop"
          placeholderTextColor={theme.colors.muted}
          maxLength={60}
        />
        {fieldErrors.businessName ? (
          <Text style={[styles.fieldError, { color: theme.colors.dangerText }]}>
            {fieldErrors.businessName}
          </Text>
        ) : null}
      </View>

      {/* Hiring Interests (up to 8 categories) */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>
          Hiring Interests ({totalSelectedInterests}/{maxHiringInterests})
        </Text>
        <Text style={[styles.helperText, { color: theme.colors.muted, marginBottom: 8 }]}>
          Select up to {maxHiringInterests} categories of work you usually hire for.
        </Text>

        {categoriesList.length > 0 ? (
          <View style={styles.chipsWrap}>
            {categoriesList.map((cat) => {
              const selected = selectedCategoryIds.includes(cat.id);
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.chip,
                    {
                      borderColor: selected ? theme.colors.primary : theme.colors.border,
                      backgroundColor: selected
                        ? theme.colors.primarySoft
                        : theme.colors.surface,
                    },
                  ]}
                  onPress={() => toggleHiringCategory(cat.id)}
                >
                  <Text
                    style={{
                      color: selected ? theme.colors.primary : theme.colors.text,
                      fontWeight: selected ? '700' : '500',
                      fontSize: 13,
                    }}
                  >
                    {selected ? '✓ ' : ''}
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <TextInput
            ref={customCategoryInputRef as any}
            style={[
              styles.input,
              {
                flex: 1,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            value={customCategoryInput}
            onChangeText={setCustomCategoryInput}
            placeholder={strings.onboarding.addCustomCategoryPlaceholder}
            placeholderTextColor={theme.colors.muted}
            maxLength={50}
          />
          <TouchableOpacity
            style={[
              styles.addBtn,
              { backgroundColor: theme.colors.primary },
            ]}
            onPress={onAddCustomCategory}
          >
            <Text style={{ color: '#ffffff', fontWeight: '600' }}>Add</Text>
          </TouchableOpacity>
        </View>

        {customCategories.length > 0 ? (
          <View style={[styles.chipsWrap, { marginTop: 10 }]}>
            {customCategories.map((catName) => (
              <View
                key={catName}
                style={[
                  styles.chip,
                  {
                    borderColor: theme.colors.primary,
                    backgroundColor: theme.colors.primarySoft,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  },
                ]}
              >
                <Text
                  style={{
                    color: theme.colors.primary,
                    fontWeight: '700',
                    fontSize: 13,
                  }}
                >
                  {catName}
                </Text>
                <TouchableOpacity onPress={() => removeCustomCategory(catName)}>
                  <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        {fieldErrors.hiringInterests ? (
          <Text style={[styles.fieldError, { color: theme.colors.dangerText }]}>
            {fieldErrors.hiringInterests}
          </Text>
        ) : null}
      </View>

      {/* About Hiring */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>
          What kind of help do you usually hire for? (Optional)
        </Text>
        <TextInput
          style={[
            styles.input,
            styles.textArea,
            {
              borderColor: fieldErrors.aboutHiring
                ? theme.colors.danger
                : theme.colors.border,
              color: theme.colors.text,
            },
          ]}
          value={aboutHiring}
          onChangeText={setAboutHiring}
          placeholder="e.g. Graphic design, store errands, equipment maintenance..."
          placeholderTextColor={theme.colors.muted}
          multiline
          numberOfLines={3}
          maxLength={300}
          textAlignVertical="top"
        />
        {fieldErrors.aboutHiring ? (
          <Text style={[styles.fieldError, { color: theme.colors.dangerText }]}>
            {fieldErrors.aboutHiring}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  roleSection: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
  },
  fieldError: {
    fontSize: 12,
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
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
  addBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 8,
  },
});

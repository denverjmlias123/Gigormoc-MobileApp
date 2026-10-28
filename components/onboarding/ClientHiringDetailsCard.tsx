import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAppTheme } from '../../app/theme';
import { Category } from '../../services/profile';
import { strings } from '../../constants/strings';
import { Card, AlertBox } from '../ui/Card';
import { TextInput } from '../ui/TextInput';
import { Chip } from '../ui/Chip';
import { Button } from '../ui/Button';

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
      <Card
        headerTitle="Who are you hiring as?"
        headerSubtitle="Let freelancers know if you are hiring for yourself, a small business, or an organization."
        headerIcon="business-outline"
        style={styles.card}
      >
        <View style={styles.chipsWrap}>
          {strings.profile.clientTypeOptions.map((opt) => {
            const selected = clientType === opt.value;
            return (
              <Chip
                key={opt.value}
                label={opt.label}
                selected={selected}
                onPress={() => {
                  const next = selected ? '' : opt.value;
                  setClientType(next);
                  if (next === 'individual') {
                    setBusinessName('');
                  }
                }}
              />
            );
          })}
        </View>

        {clientType !== 'individual' && (
          <TextInput
            label="Business or Organization Name (Optional, 2–60 characters)"
            placeholder="e.g. Ormoc Print Shop"
            value={businessName}
            onChangeText={setBusinessName}
            maxLength={60}
            containerStyle={{ marginTop: 14, marginBottom: 0 }}
          />
        )}
      </Card>

      {/* AI Category Suggestions for Clients */}
      <Card
        headerTitle="Suggest Categories with AI"
        headerSubtitle="Describe what you usually need help with, and our assistant will suggest relevant categories."
        headerIcon="sparkles-outline"
        style={styles.card}
      >
        <TextInput
          placeholder={strings.onboarding.aiCategoriesPlaceholder}
          value={helpDescription}
          onChangeText={setHelpDescription}
          multiline
          numberOfLines={2}
          containerStyle={{ marginBottom: 12 }}
        />

        {aiError && (
          <AlertBox
            tone="danger"
            message={aiError}
            actionLabel="Retry"
            onAction={onSuggestCategories}
            style={{ marginBottom: 12 }}
          />
        )}

        <Button
          title={aiLoading ? strings.onboarding.suggestingCategories : strings.onboarding.suggestCategoriesBtn}
          onPress={onSuggestCategories}
          variant="ai"
          size="md"
          icon="sparkles"
          loading={aiLoading}
          disabled={aiLoading}
          fullWidth
        />

        {aiCategorySuggestions.length > 0 && (
          <Card tone="inset" padding="sm" style={styles.suggestionsContainer}>
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
                  <Chip
                    key={catName}
                    label={`${selected ? '' : '+ '}${catName}`}
                    selected={selected}
                    size="sm"
                    onPress={() =>
                      catalogMatch
                        ? toggleCatalogCategory(catalogMatch.id)
                        : toggleCustomCategory(catName)
                    }
                  />
                );
              })}
            </View>
          </Card>
        )}
      </Card>

      {/* Hiring Interests Catalog & Custom Category Input */}
      <Card
        headerTitle={`Hiring Interests (${totalSelectedInterests}/${maxHiringInterests})`}
        headerSubtitle={`Pick up to ${maxHiringInterests} categories of work you usually hire for.`}
        headerIcon="grid-outline"
        style={styles.card}
      >
        {catalogLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 12 }} />
        ) : catalogCategories.length > 0 ? (
          <View style={[styles.chipsWrap, { marginBottom: 12 }]}>
            {catalogCategories.map((cat) => {
              const selected = selectedCategoryIds.includes(cat.id);
              return (
                <Chip
                  key={cat.id}
                  label={cat.name}
                  selected={selected}
                  size="sm"
                  onPress={() => toggleCatalogCategory(cat.id)}
                />
              );
            })}
          </View>
        ) : null}

        <View style={styles.customInputRow}>
          <TextInput
            placeholder={strings.onboarding.addCustomCategoryPlaceholder}
            value={customCategoryInput}
            onChangeText={setCustomCategoryInput}
            maxLength={50}
            containerStyle={styles.customInputWrap}
          />
          <Button
            title="Add"
            onPress={onAddCustomCategory}
            variant="primary"
            size="sm"
            icon="add"
          />
        </View>

        {selectedCustomCategories.length > 0 && (
          <View style={[styles.chipsWrap, { marginTop: 12 }]}>
            {selectedCustomCategories.map((catName) => (
              <Chip
                key={catName}
                label={catName}
                selected
                size="sm"
                onPress={() => toggleCustomCategory(catName)}
                onRemove={() => toggleCustomCategory(catName)}
              />
            ))}
          </View>
        )}
      </Card>

      {/* About Hiring */}
      <Card
        headerTitle="What kind of work do you usually need? (Optional)"
        headerIcon="document-text-outline"
        style={styles.card}
      >
        <TextInput
          placeholder="e.g. Weekly store errands, graphic design for promotions, aircon maintenance..."
          value={aboutHiring}
          onChangeText={setAboutHiring}
          multiline
          numberOfLines={3}
          maxLength={300}
          showCharCount
          containerStyle={{ marginBottom: 0 }}
        />
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
});

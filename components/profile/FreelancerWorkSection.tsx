import React, { RefObject } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../app/theme';
import { strings } from '../../constants/strings';

interface FreelancerWorkSectionProps {
  headline: string;
  setHeadline: (val: string) => void;
  headlineInputRef: RefObject<TextInput | null>;
  startingRateNote: string;
  setStartingRateNote: (val: string) => void;
  workTypes: string[];
  toggleWorkType: (wt: string) => void;
  availability: 'available_now' | 'part_time' | 'weekends' | 'not_taking_work' | '';
  setAvailability: (val: 'available_now' | 'part_time' | 'weekends' | 'not_taking_work' | '') => void;
  experienceYears: 'lt_1' | '1_3' | '3_5' | '5_plus' | '';
  setExperienceYears: (val: 'lt_1' | '1_3' | '3_5' | '5_plus' | '') => void;
  onNavigatePortfolio: () => void;
  fieldErrors: Record<string, string>;
}

export const FreelancerWorkSection: React.FC<FreelancerWorkSectionProps> = ({
  headline,
  setHeadline,
  headlineInputRef,
  startingRateNote,
  setStartingRateNote,
  workTypes,
  toggleWorkType,
  availability,
  setAvailability,
  experienceYears,
  setExperienceYears,
  onNavigatePortfolio,
  fieldErrors,
}) => {
  const theme = useAppTheme();

  return (
    <View style={[styles.roleSection, { borderColor: theme.colors.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Freelancer Work Details
      </Text>

      {/* Headline */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>
          Headline (up to 80 characters)
        </Text>
        <TextInput
          ref={headlineInputRef as any}
          style={[
            styles.input,
            {
              borderColor: fieldErrors.headline ? theme.colors.danger : theme.colors.border,
              color: theme.colors.text,
            },
          ]}
          value={headline}
          onChangeText={setHeadline}
          placeholder="e.g. Phone repair and tutoring in Cogon"
          placeholderTextColor={theme.colors.muted}
          maxLength={80}
        />
        {fieldErrors.headline ? (
          <Text style={[styles.fieldError, { color: theme.colors.dangerText }]}>
            {fieldErrors.headline}
          </Text>
        ) : null}
      </View>

      {/* Work types offered */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>Work Types Offered</Text>
        <View style={styles.chipsWrap}>
          {strings.profile.workTypeOptions.map((opt) => {
            const selected = workTypes.includes(opt.value);
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
                onPress={() => toggleWorkType(opt.value)}
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

      {/* Availability */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>Availability</Text>
        <View style={styles.chipsWrap}>
          {strings.profile.availabilityOptions.map((opt) => {
            const selected = availability === opt.value;
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
                onPress={() => setAvailability(selected ? '' : opt.value)}
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

      {/* Years of Experience */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>Years of Experience</Text>
        <View style={styles.chipsWrap}>
          {strings.profile.experienceOptions.map((opt) => {
            const selected = experienceYears === opt.value;
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
                onPress={() => setExperienceYears(selected ? '' : opt.value)}
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

      {/* Typical Starting Rate Note */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>
          Typical Starting Rate Note (Optional)
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: fieldErrors.startingRateNote
                ? theme.colors.danger
                : theme.colors.border,
              color: theme.colors.text,
            },
          ]}
          value={startingRateNote}
          onChangeText={setStartingRateNote}
          placeholder="e.g. Starts at ₱300/session depending on scope"
          placeholderTextColor={theme.colors.muted}
          maxLength={120}
        />
        {fieldErrors.startingRateNote ? (
          <Text style={[styles.fieldError, { color: theme.colors.dangerText }]}>
            {fieldErrors.startingRateNote}
          </Text>
        ) : null}
      </View>

      {/* Portfolio Link */}
      <TouchableOpacity
        style={[styles.portfolioLinkBtn, { borderColor: theme.colors.border }]}
        onPress={onNavigatePortfolio}
      >
        <Ionicons name="folder-open-outline" size={18} color={theme.colors.primary} />
        <Text style={[styles.portfolioLinkText, { color: theme.colors.primary }]}>
          Manage Portfolio Items →
        </Text>
      </TouchableOpacity>
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
  fieldError: {
    fontSize: 12,
    marginTop: 4,
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
  portfolioLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  portfolioLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

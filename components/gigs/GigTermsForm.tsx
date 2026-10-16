import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../../app/theme';
import { TextInput } from '../ui/TextInput';
import { Button } from '../ui/Button';
import { strings } from '../../constants/strings';

export type WorkType = 'remote' | 'face_to_face' | 'hybrid';

interface GigTermsFormProps {
  requirements: string;
  setRequirements: (val: string) => void;
  priceMinStr: string;
  setPriceMinStr: (val: string) => void;
  priceMaxStr: string;
  setPriceMaxStr: (val: string) => void;
  workType: WorkType;
  setWorkType: (val: WorkType) => void;
  area: string;
  setArea: (val: string) => void;
  appDays: string;
  setAppDays: (val: string) => void;
  completionDays: string;
  setCompletionDays: (val: string) => void;
  editGigId?: string;
  existingGigStatus: 'draft' | 'open' | null;
  loading: boolean;
  onPublish: () => void;
  onSaveDraft: () => void;
}

export const GigTermsForm: React.FC<GigTermsFormProps> = ({
  requirements,
  setRequirements,
  priceMinStr,
  setPriceMinStr,
  priceMaxStr,
  setPriceMaxStr,
  workType,
  setWorkType,
  area,
  setArea,
  appDays,
  setAppDays,
  completionDays,
  setCompletionDays,
  editGigId,
  existingGigStatus,
  loading,
  onPublish,
  onSaveDraft,
}) => {
  const theme = useAppTheme();

  return (
    <>
      <TextInput
        label="Requirements (optional)"
        placeholder="Tools, experience, or specific qualifications needed..."
        value={requirements}
        onChangeText={setRequirements}
        multiline
        numberOfLines={3}
        style={{ minHeight: 70 }}
      />

      {/* Budget Row in PHP */}
      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <TextInput
            label="Min Budget (₱) *"
            placeholder="500"
            value={priceMinStr}
            onChangeText={setPriceMinStr}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <TextInput
            label="Max Budget (₱) *"
            placeholder="1000"
            value={priceMaxStr}
            onChangeText={setPriceMaxStr}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* Work Type */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Work Type *</Text>
        <View style={styles.workTypeRow}>
          {(['remote', 'face_to_face', 'hybrid'] as WorkType[]).map((wt) => (
            <TouchableOpacity
              key={wt}
              style={[
                styles.workTypeBtn,
                { borderColor: theme.colors.border },
                workType === wt && {
                  backgroundColor: theme.colors.primarySoft,
                  borderColor: theme.colors.primary,
                },
              ]}
              onPress={() => setWorkType(wt)}
            >
              <Text
                style={[
                  styles.workTypeText,
                  workType === wt && { color: theme.colors.primary, fontWeight: '700' },
                ]}
              >
                {wt === 'remote'
                  ? '💻 Remote'
                  : wt === 'face_to_face'
                  ? '🤝 Face-to-Face'
                  : '🔄 Hybrid'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TextInput
        label="Barangay / Location in Ormoc"
        placeholder="e.g. Cogon or Ormoc City proper"
        value={area}
        onChangeText={setArea}
      />

      {/* Deadlines */}
      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <TextInput
            label="Application Days"
            placeholder="7"
            value={appDays}
            onChangeText={setAppDays}
            keyboardType="numeric"
            helperText="Days to accept proposals"
          />
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <TextInput
            label="Completion Days"
            placeholder="14"
            value={completionDays}
            onChangeText={setCompletionDays}
            keyboardType="numeric"
            helperText="Days to finish gig"
          />
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        {editGigId && existingGigStatus === 'open' ? (
          <Button
            title="Save Changes"
            onPress={onSaveDraft}
            variant="primary"
            loading={loading}
            disabled={loading}
          />
        ) : (
          <>
            <Button
              title={strings.gigs.publishBtn}
              onPress={onPublish}
              variant="primary"
              loading={loading}
              disabled={loading}
              style={{ marginBottom: 12 }}
            />
            <Button
              title={editGigId ? 'Save Changes' : strings.gigs.saveDraftBtn}
              onPress={onSaveDraft}
              variant="secondary"
              disabled={loading}
            />
          </>
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  workTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  workTypeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  workTypeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionRow: {
    marginTop: 16,
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../../../theme';
import { milestonesService, DefineMilestoneParam } from '../../../../services/milestones';
import { formatPrice } from '../../../../components/ui/GigCard';
import { Button } from '../../../../components/ui/Button';
import { mapSqlErrorToFriendlyMessage } from '../../../../constants/strings';

interface MilestoneDraft {
  title: string;
  description: string;
  amountStr: string;
}

export default function SetupMilestonesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { id, agreedPrice } = useLocalSearchParams<{ id: string; agreedPrice: string }>();

  const targetPriceCentavos = parseInt(agreedPrice || '0', 10);

  const safeNavigateBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (id) {
      router.replace({ pathname: '/agreements/[id]', params: { id } });
    } else {
      router.replace('/(tabs)/activity');
    }
  };

  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    {
      title: 'Milestone 1: Project Deliverable',
      description: '',
      amountStr: targetPriceCentavos > 0 ? (targetPriceCentavos / 100).toString() : '',
    },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = React.useRef(false);

  const navigateAfterSuccess = () => {
    if (id) {
      router.replace({ pathname: '/agreements/[id]', params: { id } });
    } else {
      router.replace('/(tabs)/activity');
    }
  };

  // Calculate current sum in centavos
  const currentTotalCentavos = milestones.reduce((sum, m) => {
    const val = parseFloat(m.amountStr || '0');
    return isNaN(val) ? sum : sum + Math.round(val * 100);
  }, 0);

  const differenceCentavos = targetPriceCentavos - currentTotalCentavos;
  const isSumValid = differenceCentavos === 0 && currentTotalCentavos > 0;

  const handleAddMilestone = () => {
    if (submitted) return;
    if (milestones.length >= 5) {
      Alert.alert('Limit Reached', 'An agreement can have at most 5 milestones.');
      return;
    }
    setMilestones([
      ...milestones,
      {
        title: `Milestone ${milestones.length + 1}`,
        description: '',
        amountStr: '',
      },
    ]);
  };

  const handleRemoveMilestone = (index: number) => {
    if (submitted) return;
    if (milestones.length <= 1) {
      Alert.alert('Cannot Remove', 'You must have at least 1 milestone.');
      return;
    }
    const updated = milestones.filter((_, idx) => idx !== index);
    setMilestones(updated);
  };

  const handleUpdate = (index: number, field: keyof MilestoneDraft, value: string) => {
    if (submitted) return;
    const updated = [...milestones];
    updated[index][field] = value;
    setMilestones(updated);
  };

  const handleSubmit = async () => {
    if (!id || inFlightRef.current || submitting || submitted) return;
    setError(null);

    // Validate fields
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      if (!m.title.trim() || m.title.trim().length < 3) {
        Alert.alert('Invalid Title', `Milestone ${i + 1} title must be at least 3 characters.`);
        return;
      }
      const amt = parseFloat(m.amountStr);
      if (isNaN(amt) || amt <= 0) {
        Alert.alert('Invalid Amount', `Milestone ${i + 1} must have a valid positive amount.`);
        return;
      }
    }

    if (!isSumValid) {
      Alert.alert(
        'Amounts Do Not Match',
        `The sum of all milestones (${formatPrice(currentTotalCentavos)}) must exactly equal the agreed total price (${formatPrice(targetPriceCentavos)}).`
      );
      return;
    }

    inFlightRef.current = true;
    setSubmitting(true);
    try {
      const payload: DefineMilestoneParam[] = milestones.map((m) => ({
        title: m.title.trim(),
        description: m.description.trim(),
        amount: Math.round(parseFloat(m.amountStr) * 100),
      }));

      await milestonesService.defineMilestones(id, payload);
      setSubmitted(true);
      Alert.alert('Milestones Defined', 'Agreement milestones have been successfully set.', [
        {
          text: 'OK',
          onPress: navigateAfterSuccess,
        },
      ]);
    } catch (err: any) {
      setError(mapSqlErrorToFriendlyMessage(err, 'Failed to define milestones.'));
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={safeNavigateBack} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>‹ Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: theme.colors.text }]}>Define Milestones</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Budget Match Tracker */}
        <View
          style={[
            styles.trackerCard,
            {
              backgroundColor: isSumValid ? '#DDF5EA' : '#FEF1D6',
              borderColor: isSumValid ? '#9BD9BE' : '#F6D58B',
            },
          ]}
        >
          <View style={styles.trackerRow}>
            <Text style={styles.trackerLabel}>Agreed Total:</Text>
            <Text style={styles.trackerValue}>{formatPrice(targetPriceCentavos)}</Text>
          </View>
          <View style={styles.trackerRow}>
            <Text style={styles.trackerLabel}>Milestones Sum:</Text>
            <Text
              style={[
                styles.trackerValue,
                { color: isSumValid ? '#12805C' : '#B45309' },
              ]}
            >
              {formatPrice(currentTotalCentavos)}
            </Text>
          </View>
          <View style={styles.divider} />
          <Text
            style={[
              styles.trackerStatus,
              { color: isSumValid ? '#12805C' : '#B45309' },
            ]}
          >
            {isSumValid
              ? '✓ Total matches agreed price'
              : differenceCentavos > 0
              ? `₱${(differenceCentavos / 100).toLocaleString()} remaining to allocate`
              : `₱${(Math.abs(differenceCentavos) / 100).toLocaleString()} over agreed total`}
          </Text>
        </View>

        {error && (
          <View style={[styles.errorCard, { backgroundColor: '#FDE8EA', borderColor: '#F3A6AE' }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Milestone Rows */}
        {milestones.map((m, idx) => (
          <View
            key={idx}
            style={[
              styles.milestoneCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.milestoneCardHeader}>
              <Text style={[styles.milestoneIndex, { color: theme.colors.text }]}>
                Milestone #{idx + 1}
              </Text>
              {milestones.length > 1 && (
                <TouchableOpacity onPress={() => handleRemoveMilestone(idx)}>
                  <Text style={[styles.removeText, { color: theme.colors.danger }]}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Title *</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { borderColor: theme.colors.border, color: theme.colors.text },
                ]}
                placeholder="e.g. Design Wireframes, Backend Integration"
                placeholderTextColor={theme.colors.muted}
                value={m.title}
                onChangeText={(val) => handleUpdate(idx, 'title', val)}
                maxLength={120}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Amount (PHP ₱) *
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { borderColor: theme.colors.border, color: theme.colors.text },
                ]}
                placeholder="0.00"
                placeholderTextColor={theme.colors.muted}
                keyboardType="numeric"
                value={m.amountStr}
                onChangeText={(val) => handleUpdate(idx, 'amountStr', val)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Deliverables Description
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  { borderColor: theme.colors.border, color: theme.colors.text },
                ]}
                placeholder="Describe what must be delivered for this milestone to be approved..."
                placeholderTextColor={theme.colors.muted}
                multiline
                numberOfLines={3}
                value={m.description}
                onChangeText={(val) => handleUpdate(idx, 'description', val)}
                maxLength={1000}
              />
            </View>
          </View>
        ))}

        {/* Add Milestone Button */}
        {milestones.length < 5 && (
          <TouchableOpacity
            style={[styles.addButton, { borderColor: theme.colors.primary }]}
            onPress={handleAddMilestone}
            activeOpacity={0.7}
          >
            <Text style={[styles.addButtonText, { color: theme.colors.primary }]}>
              + Add Another Milestone ({milestones.length}/5)
            </Text>
          </TouchableOpacity>
        )}

        {/* Submit */}
        <View style={styles.submitContainer}>
          <Button
            title={submitting ? 'Saving Milestones...' : 'Save & Initialize Milestones'}
            variant="primary"
            onPress={handleSubmit}
            disabled={!isSumValid || submitting}
            loading={submitting}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 6,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  trackerCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  trackerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackerLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  trackerValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#d1d5db',
    marginVertical: 4,
  },
  trackerStatus: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#A31F2D',
  },
  milestoneCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  milestoneCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  milestoneIndex: {
    fontSize: 16,
    fontWeight: '700',
  },
  removeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  addButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  submitContainer: {
    marginTop: 8,
  },
});

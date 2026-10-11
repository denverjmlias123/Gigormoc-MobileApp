import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../../theme';
import { useAuth } from '../../../hooks/useAuth';
import { applicationsService } from '../../../services/applications';
import { TextInput } from '../../../components/ui/TextInput';
import { Button } from '../../../components/ui/Button';
import { showToast } from '../../../components/ui/Toast';
import { mapSqlErrorToFriendlyMessage, strings } from '../../../constants/strings';

export default function ApplyGigScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, user } = useAuth();

  const [priceStr, setPriceStr] = useState('');
  const [daysStr, setDaysStr] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = React.useRef(false);

  const handleSubmit = async () => {
    if (!id || inFlightRef.current || loading || submitted) return;
    setError(null);

    if (profile?.active_mode !== 'find_work') {
      setError('You must be in Find Work mode to submit proposals.');
      return;
    }

    const priceNum = parseFloat(priceStr);
    const daysNum = parseInt(daysStr, 10);

    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Please enter a valid proposed price in PHP.');
      return;
    }
    if (isNaN(daysNum) || daysNum <= 0) {
      setError('Please enter estimated days to complete.');
      return;
    }
    if (!message.trim()) {
      setError('Please write a message or proposal for the client.');
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    try {
      const priceCentavos = Math.round(priceNum * 100);
      await applicationsService.submitApplication({
        gigId: id,
        proposedPrice: priceCentavos,
        estimatedDays: daysNum,
        message: message.trim(),
      });
      setSubmitted(true);
      showToast(strings.toasts.applicationSent);
      router.replace('/(tabs)/activity');
    } catch (err: any) {
      const friendlyMsg = mapSqlErrorToFriendlyMessage(err, 'Failed to submit application.');
      setError(friendlyMsg);
      showToast(friendlyMsg, 'error');
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else if (id) {
              router.replace({ pathname: '/gigs/[id]', params: { id } });
            } else {
              router.replace('/(tabs)/gigs');
            }
          }}
          style={styles.backBtn}
        >
          <Text style={{ color: theme.colors.primary, fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Apply for Gig</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.noticeBox}>
          <Text style={[styles.noticeTitle, { color: theme.colors.text }]}>Proposal Guidelines</Text>
          <Text style={[styles.noticeText, { color: theme.colors.muted }]}>
            State your total proposed fee in PHP and estimated delivery time. You can only submit one application per gig.
          </Text>
        </View>

        <TextInput
          label="Proposed Fee (₱) *"
          placeholder="e.g. 1500"
          value={priceStr}
          onChangeText={setPriceStr}
          keyboardType="numeric"
          helperText="Total amount you expect to receive"
        />

        <TextInput
          label="Estimated Days to Complete *"
          placeholder="e.g. 5"
          value={daysStr}
          onChangeText={setDaysStr}
          keyboardType="numeric"
          helperText="Expected delivery timeframe"
        />

        <TextInput
          label="Cover Note / Message *"
          placeholder="Explain your approach, experience, and why you are the best fit for this project..."
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={5}
          style={{ minHeight: 110 }}
        />

        <Button
          title="Submit Application"
          onPress={handleSubmit}
          variant="primary"
          loading={loading}
          style={{ marginTop: 12 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  noticeBox: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#E4ECFF',
    borderWidth: 1,
    borderColor: '#E4ECFF',
    marginBottom: 20,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: '#FDE8EA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#D92D3E',
  },
  errorText: {
    color: '#D92D3E',
    fontSize: 14,
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../../../../theme';
import { paymentsService } from '../../../../../services/payments';
import { formatPrice } from '../../../../../components/ui/GigCard';
import { Button } from '../../../../../components/ui/Button';
import { showToast } from '../../../../../components/ui/Toast';
import { mapSqlErrorToFriendlyMessage, strings } from '../../../../../constants/strings';

export default function DisputePaymentScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { id, paymentId, amount, method } = useLocalSearchParams<{
    id: string;
    paymentId: string;
    amount: string;
    method: string;
  }>();

  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = React.useRef(false);

  const amountCentavos = parseInt(amount || '0', 10);

  const safeNavigateBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (id) {
      router.replace({ pathname: '/agreements/[id]', params: { id } });
    } else {
      router.replace('/(tabs)/activity');
    }
  };

  const navigateAfterSuccess = () => {
    if (id) {
      router.replace({ pathname: '/agreements/[id]', params: { id } });
    } else {
      router.replace('/(tabs)/activity');
    }
  };

  const handleSubmit = async () => {
    if (!paymentId || inFlightRef.current || submitting || submitted) return;
    if (reason.trim().length < 5) {
      setError('Please clearly describe why you are disputing this payment report (at least 5 characters).');
      showToast('Please clearly describe why you are disputing this payment report.', 'error');
      return;
    }

    inFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await paymentsService.disputePayment(paymentId, reason.trim());
      setSubmitted(true);
      showToast(strings.toasts.paymentDisputed);
      navigateAfterSuccess();
    } catch (err: any) {
      const friendlyMsg = mapSqlErrorToFriendlyMessage(err, 'Could not record payment dispute.');
      setError(friendlyMsg);
      showToast(friendlyMsg, 'error');
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
          <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: theme.colors.text }]}>Dispute Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Payment Summary */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.muted }]}>Reported Payment</Text>
          <Text style={[styles.amountText, { color: theme.colors.text }]}>
            {formatPrice(amountCentavos)}
          </Text>
          <Text style={[styles.metaText, { color: theme.colors.muted }]}>
            Channel: {method || 'External Transfer'}
          </Text>
        </View>

        {error && (
          <View style={[styles.errorCard, { backgroundColor: '#FDE8EA', borderColor: '#F3A6AE' }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Dispute Reason */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Reason for Dispute *
          </Text>
          <TextInput
            style={[
              styles.textArea,
              { borderColor: theme.colors.border, color: theme.colors.text },
            ]}
            placeholder="Explain why this payment could not be confirmed (e.g. transfer did not reflect in bank account, amount differs from invoice)..."
            placeholderTextColor={theme.colors.muted}
            multiline
            numberOfLines={5}
            value={reason}
            onChangeText={setReason}
            maxLength={1000}
          />
          <Text style={[styles.charCount, { color: theme.colors.muted }]}>
            {reason.length}/1000 characters (min 5)
          </Text>
        </View>

        {/* Action */}
        <View style={styles.submitContainer}>
          <Button
            title={submitting ? 'Recording Dispute...' : 'Submit Payment Dispute'}
            variant="danger"
            onPress={handleSubmit}
            disabled={reason.trim().length < 5 || submitting}
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
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  amountText: {
    fontSize: 22,
    fontWeight: '700',
  },
  metaText: {
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
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
  submitContainer: {
    marginTop: 8,
  },
});

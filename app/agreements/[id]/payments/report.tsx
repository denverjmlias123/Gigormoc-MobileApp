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
import { paymentsService, PaymentMethod } from '../../../../services/payments';
import { formatPrice } from '../../../../components/ui/GigCard';
import { Button } from '../../../../components/ui/Button';
import { showToast } from '../../../../components/ui/Toast';
import { mapSqlErrorToFriendlyMessage, strings } from '../../../../constants/strings';

const PAYMENT_METHODS: { label: string; value: PaymentMethod }[] = [
  { label: 'GCash', value: 'gcash' },
  { label: 'Maya', value: 'maya' },
  { label: 'Bank Transfer', value: 'bank_transfer' },
  { label: 'Cash (In-person)', value: 'cash' },
  { label: 'Other', value: 'other' },
];

export default function ReportPaymentScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { id, agreedPrice } = useLocalSearchParams<{ id: string; agreedPrice: string }>();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('gcash');
  const [amountStr, setAmountStr] = useState(
    agreedPrice ? (parseInt(agreedPrice, 10) / 100).toString() : ''
  );
  const [referenceNumber, setReferenceNumber] = useState('');
  const [receiptPath, setReceiptPath] = useState('');
  const [notes, setNotes] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = React.useRef(false);

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

  const handleUploadReceipt = async () => {
    if (!id || uploadingReceipt || submitted) return;
    setUploadingReceipt(true);
    setError(null);
    try {
      const uploadedPath = await paymentsService.pickAndUploadReceiptImage(id);
      if (uploadedPath) {
        setReceiptPath(uploadedPath);
      }
    } catch (err: any) {
      setError(mapSqlErrorToFriendlyMessage(err, 'Could not upload receipt image.'));
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSubmit = async () => {
    if (!id || inFlightRef.current || submitting || submitted) return;
    const amountNum = parseFloat(amountStr);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive payment amount.');
      return;
    }

    if (selectedMethod !== 'cash' && !referenceNumber.trim()) {
      Alert.alert(
        'Reference Number Recommended',
        'For electronic payments like GCash or Bank Transfer, entering a reference number helps the freelancer quickly confirm your transfer.'
      );
    }

    inFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const amountCentavos = Math.round(amountNum * 100);
      await paymentsService.reportPayment({
        agreementId: id,
        amount: amountCentavos,
        paymentMethod: selectedMethod,
        referenceNumber: referenceNumber.trim(),
        receiptPath: receiptPath.trim() || undefined,
        notes: notes.trim(),
      });
      setSubmitted(true);
      showToast(strings.toasts.paymentReported);

      Alert.alert(
        'Payment Reported',
        'Your payment record has been submitted. The freelancer will review and confirm receipt.',
        [
          {
            text: 'OK',
            onPress: navigateAfterSuccess,
          },
        ]
      );
    } catch (err: any) {
      setError(mapSqlErrorToFriendlyMessage(err, 'Failed to report payment.'));
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
        <Text style={[styles.topBarTitle, { color: theme.colors.text }]}>Report Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Transparency Banner */}
        <View style={[styles.warningBanner, { backgroundColor: '#FEF1D6', borderColor: '#F6D58B' }]}>
          <Text style={styles.warningTitle}>⚠️ External Payment Notice</Text>
          <Text style={styles.warningText}>
            Gigormoc does not process, hold, or guarantee money. Send funds directly to the freelancer using your preferred channel, then report the payment details here for their confirmation.
          </Text>
        </View>

        {error && (
          <View style={[styles.errorCard, { backgroundColor: '#FDE8EA', borderColor: '#F3A6AE' }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Method Picker */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Payment Channel *</Text>
          <View style={styles.methodGrid}>
            {PAYMENT_METHODS.map((m) => {
              const isSelected = selectedMethod === m.value;
              return (
                <TouchableOpacity
                  key={m.value}
                  style={[
                    styles.methodChip,
                    {
                      borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                      backgroundColor: isSelected ? theme.colors.primarySoft : theme.colors.surface,
                    },
                  ]}
                  onPress={() => setSelectedMethod(m.value)}
                >
                  <Text
                    style={[
                      styles.methodText,
                      { color: isSelected ? theme.colors.primary : theme.colors.text },
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Amount */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Amount Paid (PHP ₱) *</Text>
          <TextInput
            style={[
              styles.textInput,
              { borderColor: theme.colors.border, color: theme.colors.text },
            ]}
            placeholder="0.00"
            placeholderTextColor={theme.colors.muted}
            keyboardType="numeric"
            value={amountStr}
            onChangeText={setAmountStr}
          />
        </View>

        {/* Reference Number */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Reference / Transaction Number
          </Text>
          <TextInput
            style={[
              styles.textInput,
              { borderColor: theme.colors.border, color: theme.colors.text },
            ]}
            placeholder="e.g. 100982348571"
            placeholderTextColor={theme.colors.muted}
            value={referenceNumber}
            onChangeText={setReferenceNumber}
            maxLength={100}
          />
        </View>

        {/* Receipt / Proof Upload & Link */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Receipt Screenshot / Proof (Optional)
          </Text>
          <Button
            title={uploadingReceipt ? 'Uploading Receipt...' : '🧾 Upload Receipt Screenshot'}
            variant="secondary"
            onPress={handleUploadReceipt}
            disabled={uploadingReceipt || submitting}
            loading={uploadingReceipt}
          />
          <TextInput
            style={[
              styles.textInput,
              { borderColor: theme.colors.border, color: theme.colors.text },
            ]}
            placeholder="Uploaded storage path or external receipt URL"
            placeholderTextColor={theme.colors.muted}
            value={receiptPath}
            onChangeText={setReceiptPath}
          />
        </View>

        {/* Additional Notes */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Notes (Optional)</Text>
          <TextInput
            style={[
              styles.textArea,
              { borderColor: theme.colors.border, color: theme.colors.text },
            ]}
            placeholder="Add any message or details for the freelancer..."
            placeholderTextColor={theme.colors.muted}
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
            maxLength={1000}
          />
        </View>

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          <Button
            title={submitting ? 'Submitting Report...' : 'Record Payment Report'}
            variant="primary"
            onPress={handleSubmit}
            disabled={!amountStr || submitting || uploadingReceipt}
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
  warningBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B45309',
  },
  warningText: {
    fontSize: 13,
    color: '#8c5000',
    lineHeight: 18,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  methodChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  methodText: {
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

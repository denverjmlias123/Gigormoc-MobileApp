import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../../app/theme';
import { PaymentItem } from '../../services/payments';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { formatPrice } from '../ui/GigCard';

interface PaymentsEvidenceCardProps {
  payments: PaymentItem[];
  confirmedPaymentsCentavos: number;
  agreedPrice: number;
  isClient: boolean;
  isFreelancer: boolean;
  agreementStatus: string;
  confirmingPaymentId: string | null;
  onReportPayment: () => void;
  onOpenReceipt: (receiptPath: string) => void;
  onConfirmPayment: (paymentId: string) => void;
  onDisputePayment: (payment: PaymentItem) => void;
}

export const PaymentsEvidenceCard: React.FC<PaymentsEvidenceCardProps> = ({
  payments,
  confirmedPaymentsCentavos,
  agreedPrice,
  isClient,
  isFreelancer,
  agreementStatus,
  confirmingPaymentId,
  onReportPayment,
  onOpenReceipt,
  onConfirmPayment,
  onDisputePayment,
}) => {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Payments</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.muted }]}>
            Confirmed: {formatPrice(confirmedPaymentsCentavos)} / {formatPrice(agreedPrice)}
          </Text>
        </View>

        {isClient && agreementStatus === 'active' && (
          <Button title="Report Payment" variant="primary" onPress={onReportPayment} />
        )}
      </View>

      {payments.length === 0 ? (
        <View style={styles.emptyMilestonesBox}>
          <Text style={[styles.emptyMilestonesText, { color: theme.colors.muted }]}>
            {isClient
              ? 'No external payments reported yet. After sending funds (GCash, Maya, cash), tap "Report Payment" above.'
              : 'No payment reports recorded yet by the client.'}
          </Text>
        </View>
      ) : (
        <View style={styles.milestonesList}>
          {payments.map((p) => {
            const isReported = p.status === 'reported_sent';
            const isConfirmed = p.status === 'confirmed_received';
            const isDisputed = p.status === 'disputed';
            const canAct = isFreelancer && isReported;

            return (
              <View
                key={p.id}
                style={[
                  styles.paymentRowCard,
                  {
                    borderColor: isDisputed
                      ? '#F3A6AE'
                      : isConfirmed
                      ? '#9BD9BE'
                      : theme.colors.border,
                    backgroundColor: isDisputed
                      ? '#FDE8EA'
                      : isConfirmed
                      ? '#DDF5EA'
                      : theme.colors.surface,
                  },
                ]}
              >
                <View style={styles.paymentRowTop}>
                  <Text style={[styles.paymentAmount, { color: theme.colors.text }]}>
                    {formatPrice(p.amount)}
                  </Text>

                  <View style={styles.badgeWrapper}>
                    {isReported && <Badge status="pending" label="Reported sent" />}
                    {isConfirmed && (
                      <Badge status="active" label="Confirmed by freelancer" />
                    )}
                    {isDisputed && <Badge status="disputed" label="Disputed" />}
                  </View>
                </View>

                <Text style={[styles.paymentMethod, { color: theme.colors.muted }]}>
                  Channel: {p.payment_method.toUpperCase()}
                  {p.reference_number ? ` • Ref: ${p.reference_number}` : ''}
                </Text>

                {p.receipt_path ? (
                  <TouchableOpacity
                    onPress={() => onOpenReceipt(p.receipt_path!)}
                    style={{ marginTop: 4 }}
                  >
                    <Text style={[styles.linkText, { color: theme.colors.primary }]}>
                      🧾 View Payment Receipt ›
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {p.notes ? (
                  <Text style={[styles.paymentNotes, { color: theme.colors.muted }]}>
                    Notes: {p.notes}
                  </Text>
                ) : null}

                {isDisputed && p.dispute_reason ? (
                  <Text style={styles.disputeReasonText}>
                    Dispute reason: {p.dispute_reason}
                  </Text>
                ) : null}

                {/* Freelancer Action Buttons */}
                {canAct && (
                  <View style={styles.paymentActionButtons}>
                    <Button
                      title="Confirm Receipt"
                      variant="primary"
                      onPress={() => onConfirmPayment(p.id)}
                      disabled={confirmingPaymentId === p.id}
                      loading={confirmingPaymentId === p.id}
                    />
                    <Button
                      title="Dispute"
                      variant="danger"
                      onPress={() => onDisputePayment(p)}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
  },
  emptyMilestonesBox: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyMilestonesText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  milestonesList: {
    gap: 12,
  },
  paymentRowCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  paymentRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  badgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentMethod: {
    fontSize: 13,
    marginBottom: 2,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  paymentNotes: {
    fontSize: 12,
    marginTop: 4,
  },
  disputeReasonText: {
    color: '#D92D3E',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  paymentActionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
});

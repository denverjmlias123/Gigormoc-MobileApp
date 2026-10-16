import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../../app/theme';
import { AgreementItem } from '../../services/applications';
import { Badge } from '../ui/Badge';
import { formatPrice } from '../ui/GigCard';

interface AgreementTermsCardProps {
  agreement: AgreementItem;
  onViewGig: () => void;
  onOpenChat: () => void;
  onReport: () => void;
  onCancelAgreement: () => void;
}

export const AgreementTermsCard: React.FC<AgreementTermsCardProps> = ({
  agreement,
  onViewGig,
  onOpenChat,
  onReport,
  onCancelAgreement,
}) => {
  const theme = useAppTheme();

  return (
    <>
      {/* Status & Gig Header */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <View style={styles.statusRow}>
          <Text style={[styles.label, { color: theme.colors.muted }]}>Status</Text>
          <Badge status={agreement.status} />
        </View>

        <Text style={[styles.gigTitle, { color: theme.colors.text }]}>
          {agreement.gig?.title || 'Gig Agreement'}
        </Text>

        <TouchableOpacity onPress={onViewGig}>
          <Text style={[styles.linkText, { color: theme.colors.primary }]}>
            View Original Gig ›
          </Text>
        </TouchableOpacity>

        {/* Quick Agreement Communication & Protection Actions */}
        <View style={styles.quickActionButtonsRow}>
          <TouchableOpacity
            style={[styles.chatBtn, { backgroundColor: theme.colors.primarySoft }]}
            onPress={onOpenChat}
          >
            <Text style={[styles.chatBtnText, { color: theme.colors.primary }]}>
              💬 Open Chat
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.reportBtn, { borderColor: theme.colors.border }]}
            onPress={onReport}
          >
            <Text style={[styles.reportBtnText, { color: theme.colors.muted }]}>
              🚩 Report
            </Text>
          </TouchableOpacity>

          {agreement.status === 'active' && (
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: theme.colors.danger }]}
              onPress={onCancelAgreement}
            >
              <Text style={[styles.cancelBtnText, { color: theme.colors.danger }]}>
                Cancel Agreement
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Financial Terms */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Agreement Terms
        </Text>

        <View style={styles.detailRow}>
          <Text style={[styles.label, { color: theme.colors.muted }]}>Agreed Amount:</Text>
          <Text style={[styles.priceValue, { color: theme.colors.primary }]}>
            {formatPrice(agreement.agreed_price)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={[styles.label, { color: theme.colors.muted }]}>
            Completion Deadline:
          </Text>
          <Text style={[styles.value, { color: theme.colors.text }]}>
            {new Date(agreement.deadline).toLocaleDateString(undefined, {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={[styles.label, { color: theme.colors.muted }]}>Agreement ID:</Text>
          <Text style={[styles.monoValue, { color: theme.colors.muted }]}>
            {agreement.id.slice(0, 8)}...
          </Text>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
  },
  gigTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  quickActionButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chatBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  chatBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  reportBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  reportBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  value: {
    fontSize: 14,
  },
  monoValue: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
});

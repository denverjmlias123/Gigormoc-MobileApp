import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme, useResponsiveLayout } from '../../theme';
import { useAuth } from '../../../hooks/useAuth';
import { applicationsService } from '../../../services/applications';
import { gigsService, GigDetail } from '../../../services/gigs';
import { formatPrice } from '../../../components/ui/GigCard';
import { TextInput } from '../../../components/ui/TextInput';
import { Button } from '../../../components/ui/Button';
import { Card, AlertBox, PageHeaderBox } from '../../../components/ui/Card';
import { showToast } from '../../../components/ui/Toast';
import { mapSqlErrorToFriendlyMessage, strings } from '../../../constants/strings';

export default function ApplyGigScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { isWide, insets } = useResponsiveLayout();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();

  const [gig, setGig] = useState<GigDetail | null>(null);
  const [priceStr, setPriceStr] = useState('');
  const [daysStr, setDaysStr] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = React.useRef(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    gigsService
      .getGig(id)
      .then((data) => {
        if (active && data) setGig(data);
      })
      .catch(() => {
        // non-blocking
      });
    return () => {
      active = false;
    };
  }, [id]);

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
      <PageHeaderBox
        title="Apply for Gig"
        subtitle={gig?.title || 'Submit your proposal & fee in PHP'}
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else if (id) {
            router.replace({ pathname: '/gigs/[id]', params: { id } });
          } else {
            router.replace('/(tabs)/gigs');
          }
        }}
        maxWidth={680}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 32, 40) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContainer}>
          {error && (
            <AlertBox tone="danger" message={error} style={{ marginBottom: 16 }} />
          )}

          {gig && (
            <Card
              tone="role"
              padding="md"
              accentPosition="left"
              accentColor={theme.colors.primary}
              style={{ marginBottom: 16 }}
            >
              <Text style={[styles.gigSummaryEyebrow, { color: theme.colors.primary }]}>
                APPLYING FOR GIG
              </Text>
              <Text style={[styles.gigSummaryTitle, { color: theme.colors.text }]}>
                {gig.title}
              </Text>
              <View style={styles.gigSummaryMetaRow}>
                <View style={[styles.gigSummaryChip, { backgroundColor: theme.colors.surface }]}>
                  <Text style={[styles.gigSummaryChipLabel, { color: theme.colors.muted }]}>
                    Client Budget:
                  </Text>
                  <Text style={[styles.gigSummaryChipValue, { color: theme.colors.text }]}>
                    {formatPrice(gig.price_min)}
                    {gig.price_max && gig.price_max > gig.price_min
                      ? ` – ${formatPrice(gig.price_max)}`
                      : ''}
                  </Text>
                </View>
                {gig.category_name && (
                  <View style={[styles.gigSummaryChip, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.gigSummaryChipLabel, { color: theme.colors.muted }]}>
                      Category:
                    </Text>
                    <Text style={[styles.gigSummaryChipValue, { color: theme.colors.text }]}>
                      {gig.category_name}
                    </Text>
                  </View>
                )}
                {gig.deadline && (
                  <View style={[styles.gigSummaryChip, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.gigSummaryChipLabel, { color: theme.colors.muted }]}>
                      Target Date:
                    </Text>
                    <Text style={[styles.gigSummaryChipValue, { color: theme.colors.text }]}>
                      {new Date(gig.deadline).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          )}

          <AlertBox
            tone="info"
            title="Proposal Guidelines"
            message="State your total proposed fee in PHP and estimated delivery time. You can only submit one application per gig."
            style={{ marginBottom: 16 }}
          />

          <Card
            tone="neo-glass"
            padding="lg"
            headerTitle="Your Proposal"
            headerSubtitle="Set your rate, timeline, and cover note"
            headerIcon="paper-plane-outline"
          >
            <View style={isWide ? styles.twoColRow : undefined}>
              <View style={isWide ? styles.colHalf : undefined}>
                <TextInput
                  label="Proposed Fee (₱) *"
                  placeholder="1500"
                  prefixText="₱"
                  value={priceStr}
                  onChangeText={setPriceStr}
                  keyboardType="numeric"
                  helperText="Total amount you expect to receive"
                />
              </View>
              <View style={isWide ? styles.colHalf : undefined}>
                <TextInput
                  label="Estimated Days to Complete *"
                  placeholder="e.g. 5"
                  leftIcon="calendar-outline"
                  value={daysStr}
                  onChangeText={setDaysStr}
                  keyboardType="numeric"
                  helperText="Expected delivery timeframe"
                />
              </View>
            </View>

            <TextInput
              label="Cover Note / Message *"
              placeholder="Explain your approach, experience, and why you are the best fit for this project..."
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={5}
              style={{ minHeight: 110 }}
              maxLength={1000}
              showCharCount
            />

            <Button
              title="Submit Application"
              rightIcon="send"
              onPress={handleSubmit}
              variant="primary"
              loading={loading}
              style={{ marginTop: 12 }}
            />
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  formContainer: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  gigSummaryEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  gigSummaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  gigSummaryMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gigSummaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  gigSummaryChipLabel: {
    fontSize: 12,
  },
  gigSummaryChipValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 14,
  },
  colHalf: {
    flex: 1,
  },
});

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useResponsiveLayout } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth';
import { profileService, Area } from '../../services/profile';
import { aiService } from '../../services/ai';
import { Avatar } from '../../components/ui/Avatar';
import { Card, AlertBox, StickyFooterBox } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { Chip } from '../../components/ui/Chip';
import { strings } from '../../constants/strings';
import { confirmDialog } from '../../lib/dialog';
import { runConfirmedLogout } from '../../utils/confirmedLogout';

export default function OnboardingStep3ProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { isWide, topSpace } = useResponsiveLayout();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const isHire = profile?.active_mode === 'hire';

  // Photo
  const [photoBusy, setPhotoBusy] = useState(false);

  // Areas
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedArea, setSelectedArea] = useState('');
  const [customArea, setCustomArea] = useState('');
  const [areasLoading, setAreasLoading] = useState(true);

  // Bio
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    try {
      const confirmed = await runConfirmedLogout({
        requestConfirmation: () => confirmDialog({
          title: strings.auth.logoutConfirmTitle,
          message: strings.auth.logoutConfirmMessage,
          confirmText: strings.auth.logoutConfirmYes,
          cancelText: strings.common.cancel,
          destructive: true,
        }),
        signOut: () => signOut({ reason: 'user' }),
        onConfirmed: () => setSigningOut(true),
      });
      if (!confirmed) return;
      router.replace('/(auth)/login');
    } finally {
      setSigningOut(false);
    }
  };

  // AI Bio Drafting
  const [aiDrafts, setAiDrafts] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handlePickPhoto = async (source: 'library' | 'camera') => {
    if (!user || photoBusy) return;
    setError(null);
    setPhotoBusy(true);
    try {
      const url = await profileService.pickAndUploadAvatar(user.id, source);
      if (url) {
        await refreshProfile();
      }
    } catch (err: any) {
      setError(err?.message || 'Could not upload photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const fetchAreas = async () => {
      try {
        const data = await profileService.getAreas();
        if (mounted) {
          setAreas(data || []);
        }
      } catch {
        // Table may be empty
      } finally {
        if (mounted) setAreasLoading(false);
      }
    };

    fetchAreas();
    return () => {
      mounted = false;
    };
  }, []);

  const handleDraftBio = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const chosenArea = selectedArea || customArea;
      const drafts = await aiService.draftBio({
        mode: profile?.active_mode || undefined,
        area: chosenArea,
        roughBio: bio,
      });
      setAiDrafts(drafts);
    } catch (err: any) {
      setAiError(err?.message || 'Could not generate drafts. You can write your bio directly.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSelectDraft = (draft: string) => {
    setBio(draft);
  };

  const handleComplete = async (skip: boolean = false) => {
    setError(null);
    if (!user) {
      router.replace('/(tabs)');
      return;
    }

    const finalArea = selectedArea || customArea.trim();
    const finalBio = skip ? '' : bio.trim();

    if (!skip && finalBio && (finalBio.length < 20 || finalBio.length > 300)) {
      setError('Bio must be between 20 and 300 characters (or skip for now).');
      return;
    }

    setLoading(true);
    try {
      await authService.updateProfile(user.id, {
        bio: finalBio,
        area: skip ? '' : finalArea,
      });

      await authService.completeOnboarding();
      await refreshProfile();
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message || 'Failed to complete profile setup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { paddingTop: isWide ? 36 : topSpace + 8 }]}
    >
      <View style={styles.header}>
        <View style={styles.topRow}>
          <View style={styles.topLeftRow}>
            <IconButton
              icon="arrow-back"
              variant="secondary"
              size="sm"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(onboarding)/step2-skills'))}
              accessibilityLabel="Back to Step 2"
            />
            <Text style={[styles.stepIndicator, { color: theme.colors.muted }]}>Step 3 of 3</Text>
          </View>
          <Button
            title="Log Out"
            variant="ghost"
            size="xs"
            icon="log-out-outline"
            onPress={handleSignOut}
            disabled={signingOut}
          />
        </View>
        <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
          <View style={[styles.progressFill, { width: '100%', backgroundColor: theme.colors.primary }]} />
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>{strings.onboarding.bioTitle}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
          {strings.onboarding.bioSubtitle}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          {error && (
            <AlertBox
              tone="danger"
              message={error}
              style={{ marginBottom: 16 }}
            />
          )}

          {/* Profile Photo (Optional) */}
          <Card
            headerTitle="Profile Photo (Optional)"
            headerIcon="camera-outline"
            style={styles.card}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Avatar
                name={profile?.display_name || user?.user_metadata?.display_name}
                imageUri={profile?.avatar_path}
                size={68}
                editable
                onPress={() => handlePickPhoto('library')}
              />
              <View style={{ flex: 1, maxWidth: 240, gap: 8 }}>
                <Button
                  title={photoBusy ? 'Uploading...' : strings.profile.chooseFromLibraryBtn}
                  onPress={() => handlePickPhoto('library')}
                  variant="primary"
                  size="sm"
                  icon="images-outline"
                  loading={photoBusy}
                  disabled={photoBusy}
                />
                {Platform.OS !== 'web' ? (
                  <Button
                    title={strings.profile.takePhotoBtn}
                    onPress={() => handlePickPhoto('camera')}
                    variant="secondary"
                    size="sm"
                    icon="camera-outline"
                    disabled={photoBusy}
                  />
                ) : null}
              </View>
            </View>
          </Card>

          {/* Barangay / Area Selection */}
          <Card
            headerTitle="Barangay / Area in Ormoc"
            headerIcon="location-outline"
            style={styles.card}
          >
            {areasLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
            ) : areas.length > 0 ? (
              <View style={styles.chipsWrap}>
                {areas.map((a) => {
                  const isSelected = selectedArea === a.name;
                  return (
                    <Chip
                      key={a.id}
                      label={a.name}
                      selected={isSelected}
                      size="sm"
                      onPress={() => setSelectedArea(isSelected ? '' : a.name)}
                    />
                  );
                })}
              </View>
            ) : (
              <TextInput
                value={customArea}
                onChangeText={setCustomArea}
                placeholder="e.g. Cogon, Ormoc City"
                leftIcon="location-outline"
                maxLength={60}
                containerStyle={{ marginBottom: 0 }}
              />
            )}
          </Card>

          {/* Short Bio */}
          <Card
            headerTitle="Short Bio"
            headerIcon="document-text-outline"
            headerRight={
              <Text style={[styles.charCount, { color: theme.colors.muted }]}>
                {bio.length}/300 (min 20)
              </Text>
            }
            style={styles.card}
          >
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder={
                isHire
                  ? 'Introduce yourself or your business and what kind of local talent you hire...'
                  : "Describe your background, services, or what you're looking for..."
              }
              multiline
              numberOfLines={4}
              maxLength={300}
              containerStyle={{ marginBottom: 12 }}
            />

            {/* AI Bio Assist Button */}
            <Button
              title={aiLoading ? strings.onboarding.draftingBio : strings.onboarding.helpMeWriteBioBtn}
              onPress={handleDraftBio}
              variant="ai"
              size="md"
              icon="sparkles"
              loading={aiLoading}
              disabled={aiLoading}
              fullWidth
            />

            {aiError && (
              <AlertBox
                tone="danger"
                message={aiError}
                actionLabel="Retry"
                onAction={handleDraftBio}
                style={{ marginTop: 10 }}
              />
            )}

            {/* AI Bio Draft Options */}
            {aiDrafts.length > 0 && (
              <View style={styles.draftsContainer}>
                <Text style={[styles.draftsHeader, { color: theme.colors.text }]}>
                  {strings.onboarding.bioDraftsTitle}
                </Text>
                {aiDrafts.map((draft, idx) => (
                  <Card
                    key={idx}
                    tone={bio === draft ? 'role' : 'inset'}
                    padding="sm"
                    onPress={() => handleSelectDraft(draft)}
                    style={styles.draftCard}
                  >
                    <Text style={[styles.draftText, { color: theme.colors.text }]}>
                      "{draft}"
                    </Text>
                    <View style={styles.draftHintRow}>
                      {bio === draft ? (
                        <>
                          <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} />
                          <Text style={[styles.draftTapHint, { color: theme.colors.primary }]}>Selected draft</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="add-circle-outline" size={14} color={theme.colors.muted} />
                          <Text style={[styles.draftTapHint, { color: theme.colors.muted }]}>Tap to use this draft</Text>
                        </>
                      )}
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </Card>
        </View>
      </ScrollView>

      {/* Sticky Footer */}
      <StickyFooterBox maxWidth={520}>
        <Button
          title={strings.onboarding.finishSetupBtn}
          onPress={() => handleComplete(false)}
          loading={loading}
          disabled={loading}
          icon="checkmark-done"
          fullWidth
        />
        <Button
          title={strings.onboarding.skipForNow}
          onPress={() => handleComplete(true)}
          variant="ghost"
          size="sm"
          disabled={loading}
          fullWidth
          style={{ marginTop: 4 }}
        />
      </StickyFooterBox>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 12,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  topLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginBottom: 18,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  stepIndicator: {
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  inner: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  card: {
    marginBottom: 16,
  },
  charCount: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  draftsContainer: {
    marginTop: 14,
  },
  draftsHeader: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  draftCard: {
    marginBottom: 10,
    borderRadius: 14,
  },
  draftText: {
    fontSize: 14,
    lineHeight: 21,
    fontStyle: 'italic',
  },
  draftHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  draftTapHint: {
    fontSize: 12,
    fontWeight: '600',
  },
});

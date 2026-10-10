import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth';
import { profileService, Area } from '../../services/profile';
import { aiService } from '../../services/ai';
import { strings } from '../../constants/strings';

export default function OnboardingStep3ProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user, profile, refreshProfile, signOut } = useAuth();

  // Areas
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedArea, setSelectedArea] = useState('');
  const [customArea, setCustomArea] = useState('');
  const [areasLoading, setAreasLoading] = useState(true);

  // Bio
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI Bio Drafting
  const [aiDrafts, setAiDrafts] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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
      // 1. Update safe profile columns
      await authService.updateProfile(user.id, {
        bio: finalBio,
        area: skip ? '' : finalArea,
      });

      // 2. Complete onboarding via RPC
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
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Text style={[styles.stepIndicator, { color: theme.colors.muted }]}>Onboarding 3 of 3</Text>
          <TouchableOpacity onPress={() => signOut().then(() => router.replace('/(auth)/login'))}>
            <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '600' }}>Log Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>{strings.onboarding.bioTitle}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
          {strings.onboarding.bioSubtitle}
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Barangay / Area Selection */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Barangay / Area in Ormoc</Text>
          {areasLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : areas.length > 0 ? (
            <View style={styles.chipsWrap}>
              {areas.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[
                    styles.chip,
                    { borderColor: theme.colors.border },
                    selectedArea === a.name && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                  ]}
                  onPress={() => setSelectedArea(selectedArea === a.name ? '' : a.name)}
                >
                  <Text style={[styles.chipText, selectedArea === a.name && { color: '#ffffff' }]}>
                    {a.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TextInput
              style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
              value={customArea}
              onChangeText={setCustomArea}
              placeholder="e.g. Cogon, Ormoc City"
              placeholderTextColor={theme.colors.muted}
              maxLength={60}
            />
          )}
        </View>

        {/* Short Bio */}
        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Short Bio</Text>
            <Text style={[styles.charCount, { color: theme.colors.muted }]}>
              {bio.length}/300 (min 20)
            </Text>
          </View>

          <TextInput
            style={[
              styles.input,
              styles.textArea,
              { borderColor: theme.colors.border, color: theme.colors.text },
            ]}
            value={bio}
            onChangeText={setBio}
            placeholder="Describe your background, services, or what you're looking for..."
            placeholderTextColor={theme.colors.muted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={300}
          />

          {/* AI Bio Assist Button */}
          <TouchableOpacity
            style={[
              styles.aiBtn,
              { backgroundColor: theme.colors.primarySoft },
              aiLoading && { opacity: 0.7 },
            ]}
            onPress={handleDraftBio}
            disabled={aiLoading}
            activeOpacity={0.8}
          >
            {aiLoading ? (
              <View style={styles.btnRow}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={[styles.aiBtnText, { color: theme.colors.primary, marginLeft: 8 }]}>
                  {strings.onboarding.draftingBio}
                </Text>
              </View>
            ) : (
              <Text style={[styles.aiBtnText, { color: theme.colors.primary }]}>
                {strings.onboarding.helpMeWriteBioBtn}
              </Text>
            )}
          </TouchableOpacity>

          {aiError && (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{aiError}</Text>
              <TouchableOpacity onPress={handleDraftBio} style={{ marginTop: 4 }}>
                <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* AI Bio Draft Options */}
          {aiDrafts.length > 0 && (
            <View style={styles.draftsContainer}>
              <Text style={[styles.draftsHeader, { color: theme.colors.text }]}>
                {strings.onboarding.bioDraftsTitle}
              </Text>
              {aiDrafts.map((draft, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.draftCard,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                    bio === draft && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
                  ]}
                  onPress={() => handleSelectDraft(draft)}
                >
                  <Text style={[styles.draftText, { color: theme.colors.text }]}>
                    "{draft}"
                  </Text>
                  <Text style={[styles.draftTapHint, { color: theme.colors.primary }]}>
                    Tap to use this draft
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }, loading && { opacity: 0.7 }]}
          onPress={() => handleComplete(false)}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>{strings.onboarding.finishSetupBtn}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => handleComplete(true)}
          disabled={loading}
        >
          <Text style={{ color: theme.colors.muted, textAlign: 'center' }}>{strings.onboarding.skipForNow}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepIndicator: {
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: '#FDE8EA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#D92D3E',
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  charCount: {
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  textArea: {
    minHeight: 90,
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
  chipText: {
    fontSize: 13,
  },
  aiBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineError: {
    backgroundColor: '#FDE8EA',
    padding: 10,
    borderRadius: 6,
    marginTop: 8,
  },
  inlineErrorText: {
    color: '#D92D3E',
    fontSize: 13,
  },
  draftsContainer: {
    marginTop: 12,
  },
  draftsHeader: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  draftCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  draftText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  draftTapHint: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 14,
    padding: 8,
  },
});

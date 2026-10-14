import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { profileService, Skill, Category } from '../../services/profile';
import { aiService } from '../../services/ai';
import { strings } from '../../constants/strings';
import { confirmDialog } from '../../lib/dialog';
import { runConfirmedLogout } from '../../utils/confirmedLogout';

const MAX_HIRING_INTERESTS = 8;
const MAX_PROFILE_SKILLS = 15;

export default function OnboardingStep2SkillsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { profile, refreshProfile, signOut } = useAuth();

  const isHire = profile?.active_mode === 'hire';

  // --- FREELANCER STATE (active_mode === 'find_work') ---
  const [catalogSkills, setCatalogSkills] = useState<Skill[]>([]);
  const [savedSkills, setSavedSkills] = useState<Skill[]>([]);
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogAttempt, setCatalogAttempt] = useState(0);

  const [workDescription, setWorkDescription] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [selectedAiSkills, setSelectedAiSkills] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [customInput, setCustomInput] = useState('');
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [skillsSaved, setSkillsSaved] = useState(false);
  const [zeroSkillsWarning, setZeroSkillsWarning] = useState(false);

  // --- CLIENT STATE (active_mode === 'hire') ---
  const [clientType, setClientType] = useState<
    'individual' | 'business' | 'organization' | 'other' | ''
  >(profile?.client_type || '');
  const [businessName, setBusinessName] = useState(profile?.business_name || '');
  const [aboutHiring, setAboutHiring] = useState(profile?.about_hiring || '');
  const [catalogCategories, setCatalogCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [helpDescription, setHelpDescription] = useState('');
  const [aiCategorySuggestions, setAiCategorySuggestions] = useState<string[]>([]);
  const [selectedCustomCategories, setSelectedCustomCategories] = useState<string[]>([]);
  const [customCategoryInput, setCustomCategoryInput] = useState('');

  // Submitting state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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

  useEffect(() => {
    let mounted = true;
    const fetchCatalog = async () => {
      setLoading(true);
      setCatalogError(null);
      try {
        if (isHire) {
          const cats = await profileService.getCategories();
          if (mounted) {
            setCatalogCategories(cats || []);
          }
        } else {
          const [skillsData, mySavedSkills] = await Promise.all([
            profileService.getSkills(),
            profile?.id ? profileService.getUserSkills(profile.id) : Promise.resolve([]),
          ]);
          if (mounted) {
            setCatalogSkills(skillsData || []);
            setSavedSkills(mySavedSkills || []);
          }
        }
      } catch (err: any) {
        if (mounted) setCatalogError(err?.message || 'Could not load your skills and categories.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchCatalog();
    return () => {
      mounted = false;
    };
  }, [isHire, profile?.id, catalogAttempt]);

  // Compute unified "Your skills (n)" tray items (saved + catalog + AI + typed, case-insensitively deduplicated)
  const selectedSkillTray = React.useMemo(() => {
    const items: Array<{
      key: string;
      name: string;
      origin: 'saved' | 'catalog' | 'ai' | 'custom';
      skillId?: string;
      isPendingReview?: boolean;
    }> = [];
    const seenLower = new Set<string>();

    for (const s of savedSkills) {
      const lower = s.name.trim().toLowerCase();
      if (!seenLower.has(lower)) {
        seenLower.add(lower);
        items.push({
          key: `saved-${s.id}`,
          name: s.name,
          origin: 'saved',
          skillId: s.id,
          isPendingReview: s.source === 'user' && s.is_active === false,
        });
      }
    }

    for (const catId of selectedCatalogIds) {
      const catSkill = catalogSkills.find((c) => c.id === catId);
      if (catSkill) {
        const lower = catSkill.name.trim().toLowerCase();
        if (!seenLower.has(lower)) {
          seenLower.add(lower);
          items.push({
            key: `cat-${catSkill.id}`,
            name: catSkill.name,
            origin: 'catalog',
            skillId: catSkill.id,
          });
        }
      }
    }

    for (const aiName of selectedAiSkills) {
      const lower = aiName.trim().toLowerCase();
      if (!seenLower.has(lower)) {
        seenLower.add(lower);
        items.push({
          key: `ai-${lower}`,
          name: aiName.trim(),
          origin: 'ai',
        });
      }
    }

    for (const cName of customSkills) {
      const lower = cName.trim().toLowerCase();
      if (!seenLower.has(lower)) {
        seenLower.add(lower);
        items.push({
          key: `custom-${lower}`,
          name: cName.trim(),
          origin: 'custom',
        });
      }
    }

    return items;
  }, [savedSkills, selectedCatalogIds, catalogSkills, selectedAiSkills, customSkills]);

  // --- FREELANCER HANDLERS ---
  const toggleCatalogSkill = (id: string) => {
    setSaveError(null);
    setSkillsSaved(false);
    setZeroSkillsWarning(false);

    // If already saved in DB, remove via RPC
    const alreadySaved = savedSkills.find((s) => s.id === id);
    if (alreadySaved) {
      handleRemoveTrayItem({
        key: `saved-${id}`,
        name: alreadySaved.name,
        origin: 'saved',
        skillId: id,
      });
      return;
    }

    if (selectedCatalogIds.includes(id)) {
      setSelectedCatalogIds((prev) => prev.filter((s) => s !== id));
      return;
    }

    if (selectedSkillTray.length >= MAX_PROFILE_SKILLS) {
      setSaveError(`Maximum limit of ${MAX_PROFILE_SKILLS} skills per profile reached.`);
      return;
    }

    setSelectedCatalogIds((prev) => [...prev, id]);
  };

  const toggleAiSkill = (skill: string) => {
    setSaveError(null);
    setSkillsSaved(false);
    setZeroSkillsWarning(false);

    const lower = skill.trim().toLowerCase();
    const savedMatch = savedSkills.find((s) => s.name.trim().toLowerCase() === lower);
    if (savedMatch) {
      handleRemoveTrayItem({
        key: `saved-${savedMatch.id}`,
        name: savedMatch.name,
        origin: 'saved',
        skillId: savedMatch.id,
      });
      return;
    }

    const exists = selectedAiSkills.some((s) => s.trim().toLowerCase() === lower);
    if (exists) {
      setSelectedAiSkills((prev) => prev.filter((s) => s.trim().toLowerCase() !== lower));
      return;
    }

    if (selectedSkillTray.length >= MAX_PROFILE_SKILLS) {
      setSaveError(`Maximum limit of ${MAX_PROFILE_SKILLS} skills per profile reached.`);
      return;
    }

    setSelectedAiSkills((prev) => [...prev, skill.trim()]);
  };

  const handleAddCustomSkill = () => {
    setSaveError(null);
    setSkillsSaved(false);
    setZeroSkillsWarning(false);

    const validation = profileService.validateSkillName(customInput);
    if (!validation.valid) {
      setSaveError(validation.error || 'Invalid skill name.');
      return;
    }

    const normalized = validation.normalized;
    const lower = normalized.toLowerCase();

    // Case-insensitive dedupe against already selected or catalog skills
    if (selectedSkillTray.some((item) => item.name.trim().toLowerCase() === lower)) {
      setCustomInput('');
      return;
    }

    if (selectedSkillTray.length >= MAX_PROFILE_SKILLS) {
      setSaveError(`Maximum limit of ${MAX_PROFILE_SKILLS} skills per profile reached.`);
      return;
    }

    const catalogMatch = catalogSkills.find((c) => c.name.trim().toLowerCase() === lower);
    if (catalogMatch) {
      setSelectedCatalogIds((prev) => [...prev, catalogMatch.id]);
    } else {
      setCustomSkills((prev) => [...prev, normalized]);
    }
    setCustomInput('');
  };

  const removeCustomSkill = (skill: string) => {
    setSkillsSaved(false);
    setCustomSkills((prev) => prev.filter((s) => s.toLowerCase() !== skill.toLowerCase()));
  };

  const handleRemoveTrayItem = async (item: {
    key: string;
    name: string;
    origin: 'saved' | 'catalog' | 'ai' | 'custom';
    skillId?: string;
  }) => {
    setSaveError(null);
    setSkillsSaved(false);

    if (item.origin === 'saved' && item.skillId && profile?.id) {
      setSaving(true);
      try {
        await profileService.removeUserSkill(profile.id, item.skillId);
        const refreshed = await profileService.getUserSkills(profile.id);
        setSavedSkills(refreshed);
        const remainingTotal =
          refreshed.length +
          selectedCatalogIds.length +
          selectedAiSkills.length +
          customSkills.length;
        setZeroSkillsWarning(remainingTotal === 0);
      } catch (err: any) {
        setSaveError(err?.message || 'Could not remove skill.');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (item.origin === 'catalog' && item.skillId) {
      setSelectedCatalogIds((prev) => prev.filter((id) => id !== item.skillId));
    } else if (item.origin === 'ai') {
      setSelectedAiSkills((prev) =>
        prev.filter((s) => s.trim().toLowerCase() !== item.name.trim().toLowerCase())
      );
    } else if (item.origin === 'custom') {
      setCustomSkills((prev) =>
        prev.filter((s) => s.trim().toLowerCase() !== item.name.trim().toLowerCase())
      );
    }
  };

  const handleSuggestSkills = async () => {
    if (!workDescription.trim()) {
      setAiError('Please enter a short description of the work you do.');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setSkillsSaved(false);
    try {
      const suggestions = await aiService.suggestSkills(workDescription);
      setAiSuggestions(suggestions);

      // Select suggested skills up to MAX_PROFILE_SKILLS without duplicating existing tray items
      const existingLower = new Set(
        selectedSkillTray.map((item) => item.name.trim().toLowerCase())
      );
      const nextAi = [...selectedAiSkills];
      for (const sug of suggestions) {
        if (existingLower.size >= MAX_PROFILE_SKILLS) break;
        const clean = sug.trim();
        const lower = clean.toLowerCase();
        if (!existingLower.has(lower)) {
          existingLower.add(lower);
          nextAi.push(clean);
        }
      }
      setSelectedAiSkills(nextAi);
    } catch (err: any) {
      setAiError(err?.message || 'Could not fetch suggestions. You can add skills manually below.');
    } finally {
      setAiLoading(false);
    }
  };

  /**
   * Saves selected skills via add_profile_skills RPC, then re-fetches from the database
   * via getUserSkills(profile.id) and displays "Saved".
   */
  const handleSaveSkills = async (): Promise<boolean> => {
    if (!profile?.id) return false;
    setSaveError(null);
    setZeroSkillsWarning(false);

    const customNamesToSave = Array.from(new Set([...selectedAiSkills, ...customSkills]));
    if (selectedCatalogIds.length === 0 && customNamesToSave.length === 0) {
      if (savedSkills.length > 0) {
        setSkillsSaved(true);
        return true;
      }
      setSaveError('Please select or add at least 1 skill to save, or tap Skip for now.');
      return false;
    }

    setSaving(true);
    try {
      await profileService.addProfileSkills(selectedCatalogIds, customNamesToSave);
      // Re-fetch authoritative saved skills from the database
      const refreshedFromDb = await profileService.getUserSkills(profile.id);
      setSavedSkills(refreshedFromDb);
      setSelectedCatalogIds([]);
      setSelectedAiSkills([]);
      setCustomSkills([]);
      setSkillsSaved(true);
      await refreshProfile();
      return true;
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save skills. Please retry or skip for now.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // --- CLIENT HANDLERS ---
  const totalSelectedInterests =
    selectedCategoryIds.length + selectedCustomCategories.length;

  const toggleCatalogCategory = (id: string) => {
    setSaveError(null);
    if (selectedCategoryIds.includes(id)) {
      setSelectedCategoryIds((prev) => prev.filter((c) => c !== id));
      return;
    }
    if (totalSelectedInterests >= MAX_HIRING_INTERESTS) {
      setSaveError(`You can select at most ${MAX_HIRING_INTERESTS} hiring interests.`);
      return;
    }
    setSelectedCategoryIds((prev) => [...prev, id]);
  };

  const toggleCustomCategory = (name: string) => {
    setSaveError(null);
    const exists = selectedCustomCategories.some(
      (c) => c.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      setSelectedCustomCategories((prev) =>
        prev.filter((c) => c.toLowerCase() !== name.toLowerCase())
      );
      return;
    }
    if (totalSelectedInterests >= MAX_HIRING_INTERESTS) {
      setSaveError(`You can select at most ${MAX_HIRING_INTERESTS} hiring interests.`);
      return;
    }
    setSelectedCustomCategories((prev) => [...prev, name]);
  };

  const handleAddCustomCategory = () => {
    const trimmed = customCategoryInput.trim();
    if (!trimmed) return;
    if (trimmed.length < 2 || trimmed.length > 50) {
      setSaveError('Category name must be between 2 and 50 characters.');
      return;
    }
    if (totalSelectedInterests >= MAX_HIRING_INTERESTS) {
      setSaveError(`You can select at most ${MAX_HIRING_INTERESTS} hiring interests.`);
      return;
    }
    const matchingCatalog = catalogCategories.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (matchingCatalog) {
      if (!selectedCategoryIds.includes(matchingCatalog.id)) {
        setSelectedCategoryIds((prev) => [...prev, matchingCatalog.id]);
      }
    } else if (
      !selectedCustomCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase())
    ) {
      setSelectedCustomCategories((prev) => [...prev, trimmed]);
    }
    setCustomCategoryInput('');
    setSaveError(null);
  };

  const handleSuggestCategories = async () => {
    if (!helpDescription.trim()) {
      setAiError('Please describe what kind of help you usually look for.');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    try {
      const suggestions = await aiService.suggestCategories(helpDescription);
      setAiCategorySuggestions(suggestions);

      // Match against existing catalog categories or add to custom categories up to 8 total
      const nextCatIds = [...selectedCategoryIds];
      const nextCustom = [...selectedCustomCategories];

      for (const s of suggestions) {
        if (nextCatIds.length + nextCustom.length >= MAX_HIRING_INTERESTS) break;
        const catalogMatch = catalogCategories.find(
          (c) => c.name.toLowerCase() === s.toLowerCase()
        );
        if (catalogMatch) {
          if (!nextCatIds.includes(catalogMatch.id)) {
            nextCatIds.push(catalogMatch.id);
          }
        } else if (!nextCustom.some((c) => c.toLowerCase() === s.toLowerCase())) {
          nextCustom.push(s);
        }
      }
      setSelectedCategoryIds(nextCatIds);
      setSelectedCustomCategories(nextCustom);
    } catch (err: any) {
      setAiError(
        err?.message || 'Could not fetch category suggestions. You can pick or add categories below.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleContinue = async () => {
    setSaveError(null);

    if (isHire) {
      const trimmedBiz = businessName.trim();
      if (trimmedBiz.length > 0 && (trimmedBiz.length < 2 || trimmedBiz.length > 60)) {
        setSaveError('Business or organization name must be between 2 and 60 characters.');
        return;
      }
      const trimmedAbout = aboutHiring.trim();
      if (trimmedAbout.length > 300) {
        setSaveError('About hiring note must be 300 characters or fewer.');
        return;
      }
      if (totalSelectedInterests > MAX_HIRING_INTERESTS) {
        setSaveError(`You can select at most ${MAX_HIRING_INTERESTS} hiring interests.`);
        return;
      }

      const hasAnyInput =
        Boolean(clientType) ||
        trimmedBiz.length > 0 ||
        trimmedAbout.length > 0 ||
        selectedCategoryIds.length > 0 ||
        selectedCustomCategories.length > 0;

      if (!hasAnyInput) {
        router.push('/(onboarding)/step3-profile');
        return;
      }

      setSaving(true);
      try {
        await profileService.saveHiringDetails({
          clientType: clientType || null,
          businessName: trimmedBiz,
          aboutHiring: trimmedAbout,
          categoryIds: selectedCategoryIds,
          customCategoryNames: selectedCustomCategories,
        });
        await refreshProfile();
        router.push('/(onboarding)/step3-profile');
      } catch (err: any) {
        setSaveError(err?.message || 'Failed to save hiring details. Please retry or skip for now.');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Freelancer mode: save any unsaved skills via handleSaveSkills, then advance
    const customNamesToSave = Array.from(new Set([...selectedAiSkills, ...customSkills]));

    if (selectedCatalogIds.length === 0 && customNamesToSave.length === 0) {
      router.push('/(onboarding)/step3-profile');
      return;
    }

    const ok = await handleSaveSkills();
    if (ok) {
      router.push('/(onboarding)/step3-profile');
    }
  };

  const handleSkip = () => {
    router.push('/(onboarding)/step3-profile');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Text style={[styles.stepIndicator, { color: theme.colors.muted }]}>
            Onboarding 2 of 3
          </Text>
          <TouchableOpacity onPress={handleSignOut} disabled={signingOut}>
            <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '600' }}>
              Log Out
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {isHire ? strings.onboarding.hiringTitle : strings.onboarding.skillsTitle}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
          {isHire ? strings.onboarding.hiringSubtitle : strings.onboarding.skillsSubtitle}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {catalogError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{catalogError}</Text>
            <TouchableOpacity onPress={() => setCatalogAttempt((attempt) => attempt + 1)} accessibilityRole="button">
              <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>{strings.common.retry}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {saveError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{saveError}</Text>
          </View>
        )}

        {isHire ? (
          <>
            {/* Client Type */}
            <View
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                Who are you hiring as?
              </Text>
              <Text style={[styles.cardDesc, { color: theme.colors.muted }]}>
                Let freelancers know if you are hiring for yourself, a small business, or an organization.
              </Text>
              <View style={styles.chipsWrap}>
                {strings.profile.clientTypeOptions.map((opt) => {
                  const selected = clientType === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.chip,
                        { borderColor: theme.colors.border },
                        selected && {
                          backgroundColor: theme.colors.primary,
                          borderColor: theme.colors.primary,
                        },
                      ]}
                      onPress={() => setClientType(selected ? '' : opt.value)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: selected ? '#ffffff' : theme.colors.text },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.subLabel, { color: theme.colors.text, marginTop: 14 }]}>
                Business or Organization Name (Optional, 2–60 characters)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: theme.colors.border, color: theme.colors.text, marginBottom: 0 },
                ]}
                placeholder="e.g. Ormoc Print Shop"
                placeholderTextColor={theme.colors.muted}
                value={businessName}
                onChangeText={setBusinessName}
                maxLength={60}
              />
            </View>

            {/* AI Category Suggestions for Clients */}
            <View
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                🤖 Suggest Categories with AI
              </Text>
              <Text style={[styles.cardDesc, { color: theme.colors.muted }]}>
                Describe what you usually need help with, and our assistant will suggest relevant categories.
              </Text>

              <TextInput
                style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder={strings.onboarding.aiCategoriesPlaceholder}
                placeholderTextColor={theme.colors.muted}
                value={helpDescription}
                onChangeText={setHelpDescription}
                multiline
                numberOfLines={2}
              />

              {aiError && (
                <View style={styles.inlineError}>
                  <Text style={styles.inlineErrorText}>{aiError}</Text>
                  <TouchableOpacity onPress={handleSuggestCategories} style={{ marginTop: 4 }}>
                    <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.aiBtn,
                  { backgroundColor: theme.colors.primarySoft },
                  aiLoading && { opacity: 0.7 },
                ]}
                onPress={handleSuggestCategories}
                disabled={aiLoading}
                activeOpacity={0.8}
              >
                {aiLoading ? (
                  <View style={styles.btnRow}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={[styles.aiBtnText, { color: theme.colors.primary, marginLeft: 8 }]}>
                      {strings.onboarding.suggestingCategories}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.aiBtnText, { color: theme.colors.primary }]}>
                    {strings.onboarding.suggestCategoriesBtn}
                  </Text>
                )}
              </TouchableOpacity>

              {aiCategorySuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <Text style={[styles.subLabel, { color: theme.colors.text }]}>
                    Suggested Categories (tap to toggle):
                  </Text>
                  <View style={styles.chipsWrap}>
                    {aiCategorySuggestions.map((catName) => {
                      const catalogMatch = catalogCategories.find(
                        (c) => c.name.toLowerCase() === catName.toLowerCase()
                      );
                      const selected = catalogMatch
                        ? selectedCategoryIds.includes(catalogMatch.id)
                        : selectedCustomCategories.some(
                            (c) => c.toLowerCase() === catName.toLowerCase()
                          );
                      return (
                        <TouchableOpacity
                          key={catName}
                          style={[
                            styles.chip,
                            { borderColor: theme.colors.border },
                            selected && {
                              backgroundColor: theme.colors.primary,
                              borderColor: theme.colors.primary,
                            },
                          ]}
                          onPress={() =>
                            catalogMatch
                              ? toggleCatalogCategory(catalogMatch.id)
                              : toggleCustomCategory(catName)
                          }
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: selected ? '#ffffff' : theme.colors.text },
                            ]}
                          >
                            {selected ? '✓ ' : '+ '}
                            {catName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

            {/* Hiring Interests Catalog & Custom Category Input */}
            <View
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                Hiring Interests ({totalSelectedInterests}/{MAX_HIRING_INTERESTS})
              </Text>
              <Text style={[styles.cardDesc, { color: theme.colors.muted }]}>
                Pick up to {MAX_HIRING_INTERESTS} categories of work you usually hire for.
              </Text>

              {loading ? (
                <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 12 }} />
              ) : catalogCategories.length > 0 ? (
                <View style={[styles.chipsWrap, { marginBottom: 12 }]}>
                  {catalogCategories.map((cat) => {
                    const selected = selectedCategoryIds.includes(cat.id);
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.chip,
                          { borderColor: theme.colors.border },
                          selected && {
                            backgroundColor: theme.colors.primary,
                            borderColor: theme.colors.primary,
                          },
                        ]}
                        onPress={() => toggleCatalogCategory(cat.id)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: selected ? '#ffffff' : theme.colors.text },
                          ]}
                        >
                          {selected ? '✓ ' : ''}
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              <View style={styles.customInputRow}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      flex: 1,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                      marginBottom: 0,
                    },
                  ]}
                  placeholder={strings.onboarding.addCustomCategoryPlaceholder}
                  placeholderTextColor={theme.colors.muted}
                  value={customCategoryInput}
                  onChangeText={setCustomCategoryInput}
                  maxLength={50}
                />
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={handleAddCustomCategory}
                >
                  <Text style={{ color: '#ffffff', fontWeight: '600' }}>Add</Text>
                </TouchableOpacity>
              </View>

              {selectedCustomCategories.length > 0 && (
                <View style={[styles.chipsWrap, { marginTop: 12 }]}>
                  {selectedCustomCategories.map((catName) => (
                    <View
                      key={catName}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: theme.colors.primarySoft,
                          borderColor: theme.colors.primary,
                          flexDirection: 'row',
                          alignItems: 'center',
                        },
                      ]}
                    >
                      <Text style={{ color: theme.colors.primary, marginRight: 6 }}>{catName}</Text>
                      <TouchableOpacity onPress={() => toggleCustomCategory(catName)}>
                        <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* About Hiring */}
            <View
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                What kind of work do you usually need? (Optional)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                    minHeight: 80,
                    marginBottom: 4,
                  },
                ]}
                placeholder="e.g. Weekly store errands, graphic design for promotions, aircon maintenance..."
                placeholderTextColor={theme.colors.muted}
                value={aboutHiring}
                onChangeText={setAboutHiring}
                multiline
                numberOfLines={3}
                maxLength={300}
                textAlignVertical="top"
              />
              <Text style={{ fontSize: 12, color: theme.colors.muted }}>
                {aboutHiring.trim().length}/300 characters
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* Section 4 Rule 1 & 2: "Your skills (n)" Tray at the top of the screen */}
            <View
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <View style={styles.trayHeaderRow}>
                <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 0 }]}>
                  {strings.onboarding.yourSkillsTrayLabel} ({selectedSkillTray.length}/{MAX_PROFILE_SKILLS})
                </Text>
                {skillsSaved && (
                  <View style={[styles.savedBadge, { backgroundColor: '#DCFCE7' }]}>
                    <Text style={styles.savedBadgeText}>✓ {strings.onboarding.skillsSavedText}</Text>
                  </View>
                )}
              </View>

              {zeroSkillsWarning && (
                <View style={styles.warningBanner}>
                  <Text style={styles.warningText}>{strings.onboarding.zeroSkillsWarning}</Text>
                </View>
              )}

              {selectedSkillTray.length === 0 ? (
                <Text style={[styles.cardDesc, { color: theme.colors.muted, marginTop: 6, marginBottom: 0 }]}>
                  {strings.onboarding.yourSkillsEmptyHint}
                </Text>
              ) : (
                <>
                  <View style={[styles.chipsWrap, { marginTop: 10, marginBottom: 12 }]}>
                    {selectedSkillTray.map((item) => (
                      <TouchableOpacity
                        key={item.key}
                        style={[
                          styles.chip,
                          {
                            backgroundColor:
                              item.origin === 'saved'
                                ? theme.colors.primary
                                : theme.colors.primarySoft,
                            borderColor: theme.colors.primary,
                            flexDirection: 'row',
                            alignItems: 'center',
                          },
                        ]}
                        onPress={() => handleRemoveTrayItem(item)}
                        disabled={saving}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color: item.origin === 'saved' ? '#ffffff' : theme.colors.primary,
                              fontWeight: '600',
                              marginRight: 6,
                            },
                          ]}
                        >
                          {item.name}
                        </Text>
                        {item.isPendingReview && (
                          <View style={styles.pendingPill}>
                            <Text style={styles.pendingPillText}>
                              {strings.onboarding.pendingReviewBadge}
                            </Text>
                          </View>
                        )}
                        <Text
                          style={{
                            color: item.origin === 'saved' ? '#ffffff' : theme.colors.primary,
                            fontWeight: '700',
                            marginLeft: 2,
                          }}
                        >
                          ×
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.saveTrayBtn,
                      { backgroundColor: theme.colors.primary },
                      saving && { opacity: 0.7 },
                    ]}
                    onPress={handleSaveSkills}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.saveTrayBtnText}>
                      {saving ? strings.onboarding.savingSkillsText : strings.onboarding.saveSkillsBtn}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* AI Skill Suggestion Box (Freelancer only) */}
            <View
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                🤖 Suggest Skills with AI
              </Text>
              <Text style={[styles.cardDesc, { color: theme.colors.muted }]}>
                Describe the work you do in plain words, and our assistant will suggest relevant skills.
              </Text>

              <TextInput
                style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder={strings.onboarding.aiSkillsPlaceholder}
                placeholderTextColor={theme.colors.muted}
                value={workDescription}
                onChangeText={setWorkDescription}
                multiline
                numberOfLines={2}
              />

              {aiError && (
                <View style={styles.inlineError}>
                  <Text style={styles.inlineErrorText}>{aiError}</Text>
                  <TouchableOpacity onPress={handleSuggestSkills} style={{ marginTop: 4 }}>
                    <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.aiBtn,
                  { backgroundColor: theme.colors.primarySoft },
                  aiLoading && { opacity: 0.7 },
                ]}
                onPress={handleSuggestSkills}
                disabled={aiLoading}
                activeOpacity={0.8}
              >
                {aiLoading ? (
                  <View style={styles.btnRow}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={[styles.aiBtnText, { color: theme.colors.primary, marginLeft: 8 }]}>
                      {strings.onboarding.suggestingSkills}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.aiBtnText, { color: theme.colors.primary }]}>
                    {strings.onboarding.suggestSkillsBtn}
                  </Text>
                )}
              </TouchableOpacity>

              {aiSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <Text style={[styles.subLabel, { color: theme.colors.text }]}>
                    Suggested Skills (tap to toggle):
                  </Text>
                  <View style={styles.chipsWrap}>
                    {aiSuggestions.map((skill) => {
                      const lower = skill.trim().toLowerCase();
                      const selected =
                        selectedAiSkills.some((s) => s.trim().toLowerCase() === lower) ||
                        savedSkills.some((s) => s.name.trim().toLowerCase() === lower);
                      return (
                        <TouchableOpacity
                          key={skill}
                          style={[
                            styles.chip,
                            { borderColor: theme.colors.border },
                            selected && {
                              backgroundColor: theme.colors.primary,
                              borderColor: theme.colors.primary,
                            },
                          ]}
                          onPress={() => toggleAiSkill(skill)}
                        >
                          <Text style={[styles.chipText, selected && { color: '#ffffff' }]}>
                            {selected ? '✓ ' : '+ '}
                            {skill}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

            {/* Catalog Skills */}
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={theme.colors.primary} />
              </View>
            ) : catalogSkills.length > 0 ? (
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                  📋 Skills Catalog
                </Text>
                <View style={styles.chipsWrap}>
                  {catalogSkills.map((skill) => {
                    const selected =
                      selectedCatalogIds.includes(skill.id) ||
                      savedSkills.some((s) => s.id === skill.id);
                    return (
                      <TouchableOpacity
                        key={skill.id}
                        style={[
                          styles.chip,
                          { borderColor: theme.colors.border },
                          selected && {
                            backgroundColor: theme.colors.primary,
                            borderColor: theme.colors.primary,
                          },
                        ]}
                        onPress={() => toggleCatalogSkill(skill.id)}
                      >
                        <Text style={[styles.chipText, selected && { color: '#ffffff' }]}>
                          {selected ? '✓ ' : ''}
                          {skill.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Manual Custom Skill Input */}
            <View
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                ✍️ Add Custom Skill
              </Text>
              <View style={styles.customInputRow}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      flex: 1,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                      marginBottom: 0,
                    },
                  ]}
                  placeholder={strings.onboarding.addCustomSkillPlaceholder}
                  placeholderTextColor={theme.colors.muted}
                  value={customInput}
                  onChangeText={setCustomInput}
                  maxLength={40}
                />
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={handleAddCustomSkill}
                >
                  <Text style={{ color: '#ffffff', fontWeight: '600' }}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Footer Navigation */}
      <View
        style={[
          styles.footer,
          { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.colors.primary },
            saving && { opacity: 0.7 },
          ]}
          onPress={handleContinue}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip} disabled={saving}>
          <Text style={{ color: theme.colors.muted, textAlign: 'center' }}>
            {strings.onboarding.skipForNow}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 12,
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
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  trayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  savedBadgeText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
  },
  warningBanner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  warningText: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '600',
  },
  pendingPill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 4,
  },
  pendingPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  saveTrayBtn: {
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveTrayBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  aiBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiBtnText: {
    fontSize: 14,
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
    marginBottom: 10,
  },
  inlineErrorText: {
    color: '#D92D3E',
    fontSize: 13,
  },
  suggestionsContainer: {
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
  },
  subLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
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
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorBanner: {
    backgroundColor: '#FDE8EA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#D92D3E',
    fontSize: 14,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  footer: {
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 12,
    padding: 8,
  },
});

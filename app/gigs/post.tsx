import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { profileService, Category } from '../../services/profile';
import {
  gigsService,
  SuggestedGigCategory,
  SimilarCategory,
} from '../../services/gigs';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../components/ui/Toast';
import { strings } from '../../constants/strings';

type WorkType = 'remote' | 'face_to_face' | 'hybrid';

export default function PostGigScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { profile } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [customCategoryName, setCustomCategoryName] = useState<string>('');
  const [categoryQuery, setCategoryQuery] = useState<string>('');

  // Suggestions & "Did you mean...?" state
  const [suggestedCategories, setSuggestedCategories] = useState<SuggestedGigCategory[]>([]);
  const [aiProposedCategory, setAiProposedCategory] = useState<string | null>(null);
  const [similarCategories, setSimilarCategories] = useState<SimilarCategory[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [priceMinStr, setPriceMinStr] = useState('');
  const [priceMaxStr, setPriceMaxStr] = useState('');
  const [workType, setWorkType] = useState<WorkType>('remote');
  const [area, setArea] = useState('');
  const [appDays, setAppDays] = useState('7');
  const [completionDays, setCompletionDays] = useState('14');

  const [loading, setLoading] = useState(false);
  const [catsLoading, setCatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isHireMode = profile?.active_mode === 'hire';

  useEffect(() => {
    let mounted = true;
    profileService
      .getCategories()
      .then((data) => {
        if (mounted) {
          setCategories(data);
          if (data.length > 0) {
            setSelectedCategoryId(data[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setCatsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Source 1 (DB fuzzy match): Auto-suggest existing categories when title/description change
  useEffect(() => {
    const cleanTitle = title.trim();
    const cleanDesc = description.trim();
    if (cleanTitle.length < 3 && cleanDesc.length < 10) {
      return;
    }

    let cancelled = false;
    gigsService
      .suggestCategoriesForGig(cleanTitle, cleanDesc)
      .then((rows) => {
        if (!cancelled && rows.length > 0) {
          setSuggestedCategories(rows);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [title, description]);

  // "Did you mean...?" fuzzy search while typing in the category box
  useEffect(() => {
    const trimmed = categoryQuery.trim();
    if (trimmed.length < 2) {
      setSimilarCategories([]);
      return;
    }

    let cancelled = false;
    gigsService
      .findSimilarCategories(trimmed)
      .then((rows) => {
        if (!cancelled) {
          setSimilarCategories(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Local fallback filter if RPC is unavailable
          const lower = trimmed.toLowerCase();
          const localMatches = categories
            .filter((c) => c.name.toLowerCase().includes(lower))
            .slice(0, 5)
            .map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              similarity_score: 0.7,
            }));
          setSimilarCategories(localMatches);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [categoryQuery, categories]);

  const handleSelectExistingCategory = (catId: string) => {
    setSelectedCategoryId(catId);
    setCustomCategoryName('');
    setError(null);
  };

  const handleSelectCustomCategory = (rawName: string) => {
    const normalized = rawName.replace(/\s+/g, ' ').trim();
    if (normalized.length < 3 || normalized.length > 40) {
      setError('Category name must be between 3 and 40 characters.');
      return;
    }
    // Check if an exact case-insensitive match already exists locally
    const exactMatch = categories.find(
      (c) => c.name.trim().toLowerCase() === normalized.toLowerCase()
    );
    if (exactMatch) {
      setSelectedCategoryId(exactMatch.id);
      setCustomCategoryName('');
      setCategoryQuery('');
      setError(null);
      return;
    }

    setSelectedCategoryId('');
    setCustomCategoryName(normalized);
    setError(null);
  };

  const handleAiSuggestCategory = async () => {
    const cleanTitle = title.trim();
    const cleanDesc = description.trim();
    if (cleanTitle.length < 3 && cleanDesc.length < 3) {
      setError('Please enter a gig title or description first so we can suggest a category.');
      return;
    }

    setSuggestLoading(true);
    setError(null);
    try {
      const result = await gigsService.suggestCategoriesWithAiFallback(cleanTitle, cleanDesc);
      setSuggestedCategories(result.suggestions);
      setAiProposedCategory(result.proposed_new_category);

      if (result.suggestions.length > 0) {
        handleSelectExistingCategory(result.suggestions[0].id);
      } else if (result.proposed_new_category) {
        handleSelectCustomCategory(result.proposed_new_category);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not suggest categories right now.');
    } finally {
      setSuggestLoading(false);
    }
  };

  const validateAndBuildParams = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) throw new Error('Gig title is required.');
    if (trimmedTitle.length < 5 || trimmedTitle.length > 80) {
      throw new Error('Gig title must be between 5 and 80 characters.');
    }

    const trimmedCustomCat = customCategoryName.trim();
    if (!selectedCategoryId && !trimmedCustomCat) {
      throw new Error('Please select an existing category or enter a new category name (3–40 characters).');
    }

    if (!selectedCategoryId && (trimmedCustomCat.length < 3 || trimmedCustomCat.length > 40)) {
      throw new Error('New category name must be between 3 and 40 characters.');
    }

    const trimmedDesc = description.trim();
    if (!trimmedDesc) throw new Error('Gig description is required.');
    if (trimmedDesc.length < 30 || trimmedDesc.length > 2000) {
      throw new Error('Gig description must be between 30 and 2000 characters.');
    }

    const pMin = parseFloat(priceMinStr);
    const pMax = parseFloat(priceMaxStr || priceMinStr);

    if (isNaN(pMin) || pMin < 100) {
      throw new Error('Minimum budget must be at least ₱100.00 PHP.');
    }
    if (isNaN(pMax) || pMax < pMin) {
      throw new Error('Maximum budget cannot be less than minimum budget.');
    }

    const appD = parseInt(appDays, 10);
    const compD = parseInt(completionDays, 10);
    if (isNaN(appD) || appD < 1) throw new Error('Application deadline must be at least 1 day in the future.');
    if (isNaN(compD) || compD < appD) throw new Error('Completion deadline must be greater than or equal to the application deadline.');

    const now = new Date();
    const appDate = new Date(now.getTime() + appD * 24 * 60 * 60 * 1000);
    const compDate = new Date(now.getTime() + compD * 24 * 60 * 60 * 1000);

    return {
      title: trimmedTitle,
      description: trimmedDesc,
      requirements: requirements.trim(),
      category_id: selectedCategoryId || null,
      category_name: selectedCategoryId ? null : trimmedCustomCat,
      price_min: Math.round(pMin * 100), // convert PHP to integer centavos
      price_max: Math.round(pMax * 100), // convert PHP to integer centavos
      work_type: workType,
      area: area.trim(),
      application_deadline: appDate.toISOString(),
      deadline: compDate.toISOString(),
    };
  };

  const inFlightRef = React.useRef(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSaveDraft = async () => {
    if (inFlightRef.current || loading || submitted) return;
    setError(null);
    try {
      const params = validateAndBuildParams();
      inFlightRef.current = true;
      setLoading(true);
      await gigsService.createDraftGig(params);
      setSubmitted(true);
      showToast(strings.toasts.gigDraftSaved);
      Alert.alert('Draft Saved', 'Your gig draft has been saved successfully.', [
        {
          text: 'OK',
          onPress: () => {
            router.replace('/(tabs)/gigs');
          },
        },
      ]);
    } catch (err: any) {
      setError(err?.message || 'Could not save draft.');
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (inFlightRef.current || loading || submitted) return;
    setError(null);
    try {
      const params = validateAndBuildParams();
      inFlightRef.current = true;
      setLoading(true);
      const { id: draftId } = await gigsService.createDraftGig(params);
      await gigsService.publishGig(draftId);
      setSubmitted(true);
      showToast(strings.toasts.gigPublished);
      Alert.alert('Gig Published!', 'Your gig is now open for local applicants in Ormoc City.', [
        { text: 'View Gigs', onPress: () => router.replace('/(tabs)/gigs') },
      ]);
    } catch (err: any) {
      setError(err?.message || 'Could not publish gig.');
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  if (!isHireMode) {
    return (
      <View style={[styles.container, styles.blockedContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={styles.blockedIcon}>🚫</Text>
        <Text style={[styles.blockedTitle, { color: theme.colors.text }]}>
          {strings.gigs.hireModeRequiredTitle}
        </Text>
        <Text style={[styles.blockedDesc, { color: theme.colors.muted }]}>
          {strings.gigs.hireModeRequiredDesc}
        </Text>
        <Button
          title="Go to Account Settings"
          onPress={() => router.push('/(tabs)/profile')}
          variant="primary"
          style={{ marginTop: 16, marginBottom: 8 }}
        />
        <Button
          title="← Go Back"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/gigs');
            }
          }}
          variant="secondary"
        />
      </View>
    );
  }

  const normalizedQuery = categoryQuery.replace(/\s+/g, ' ').trim();
  const filteredExistingCategories = normalizedQuery
    ? categories.filter((c) => c.name.toLowerCase().includes(normalizedQuery.toLowerCase()))
    : categories;
  const exactExistingMatch = categories.find(
    (c) => c.name.trim().toLowerCase() === normalizedQuery.toLowerCase()
  );
  const canProposeTypedCategory =
    normalizedQuery.length >= 3 && normalizedQuery.length <= 40 && !exactExistingMatch;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/gigs');
            }
          }}
          style={styles.backBtn}
        >
          <Text style={{ color: theme.colors.primary, fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{strings.gigs.postGigTitle}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TextInput
          label="Gig Title *"
          placeholder="e.g. Need experienced tutor for Grade 10 Math"
          value={title}
          onChangeText={setTitle}
        />

        <TextInput
          label="Description *"
          placeholder="Detailed explanation of the project or task..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={{ minHeight: 90 }}
        />

        {/* Unlocked Category Picker (Suggest First, Create Last) */}
        <View style={styles.fieldGroup}>
          <View style={styles.categoryHeaderRow}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text, marginBottom: 0 }]}>
              {strings.gigs.categoryLabel}
            </Text>
            <TouchableOpacity
              onPress={handleAiSuggestCategory}
              disabled={suggestLoading}
              style={[styles.aiSuggestBtn, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary }]}
            >
              <Text style={[styles.aiSuggestBtnText, { color: theme.colors.primary }]}>
                {suggestLoading ? strings.gigs.aiSuggestingCategory : strings.gigs.aiSuggestCategoryBtn}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.helperSubtext, { color: theme.colors.muted }]}>
            {strings.gigs.categoryHelper}
          </Text>

          {/* Selected custom category pill */}
          {customCategoryName ? (
            <View style={[styles.selectedCustomBanner, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary }]}>
              <Text style={[styles.selectedCustomText, { color: theme.colors.primary }]}>
                New category selected: <Text style={{ fontWeight: '800' }}>{customCategoryName}</Text>
              </Text>
              <TouchableOpacity onPress={() => setCustomCategoryName('')}>
                <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 12 }}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Suggested Categories (from DB pg_trgm or AI) */}
          {suggestedCategories.length > 0 && (
            <View style={styles.suggestedSection}>
              <Text style={[styles.subSectionLabel, { color: theme.colors.muted }]}>
                {strings.gigs.suggestedCategoriesLabel}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
                {suggestedCategories.map((sug) => {
                  const isSelected = selectedCategoryId === sug.id && !customCategoryName;
                  return (
                    <TouchableOpacity
                      key={`sug-${sug.id}`}
                      style={[
                        styles.catChip,
                        { borderColor: theme.colors.primary },
                        isSelected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                      ]}
                      onPress={() => handleSelectExistingCategory(sug.id)}
                    >
                      <Text style={[styles.catChipText, { color: isSelected ? '#ffffff' : theme.colors.primary }]}>
                        ✨ {sug.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Optional AI-proposed new general category when no existing category fit */}
          {aiProposedCategory && (
            <View style={styles.suggestedSection}>
              <Text style={[styles.subSectionLabel, { color: theme.colors.muted }]}>
                {strings.gigs.aiProposedCategoryLabel}
              </Text>
              <TouchableOpacity
                style={[
                  styles.catChip,
                  { alignSelf: 'flex-start', borderColor: theme.colors.primary },
                  customCategoryName.toLowerCase() === aiProposedCategory.toLowerCase() && {
                    backgroundColor: theme.colors.primary,
                  },
                ]}
                onPress={() => handleSelectCustomCategory(aiProposedCategory)}
              >
                <Text
                  style={[
                    styles.catChipText,
                    {
                      color:
                        customCategoryName.toLowerCase() === aiProposedCategory.toLowerCase()
                          ? '#ffffff'
                          : theme.colors.primary,
                    },
                  ]}
                >
                  + {aiProposedCategory}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Search or create category input */}
          <TextInput
            label="Search or Create Category"
            placeholder={strings.gigs.searchOrCreateCategoryPlaceholder}
            value={categoryQuery}
            onChangeText={setCategoryQuery}
          />

          {/* Existing categories list */}
          {catsLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : filteredExistingCategories.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
              {filteredExistingCategories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id && !customCategoryName;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.catChip,
                      { borderColor: theme.colors.border },
                      isSelected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                    ]}
                    onPress={() => handleSelectExistingCategory(cat.id)}
                  >
                    <Text style={[styles.catChipText, { color: isSelected ? '#ffffff' : theme.colors.text }]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}

          {/* "Did you mean...?" + Explicit "No, create '<text>' as a new category" confirmation */}
          {canProposeTypedCategory && (
            <View style={[styles.didYouMeanBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              {similarCategories.length > 0 ? (
                <>
                  <Text style={[styles.didYouMeanTitle, { color: theme.colors.text }]}>
                    {strings.gigs.didYouMeanLabel}
                  </Text>
                  <View style={styles.similarChipsWrap}>
                    {similarCategories.map((sim) => {
                      const isSelected = selectedCategoryId === sim.id && !customCategoryName;
                      return (
                        <TouchableOpacity
                          key={`sim-${sim.id}`}
                          style={[
                            styles.catChip,
                            { borderColor: theme.colors.primary, marginBottom: 6 },
                            isSelected && { backgroundColor: theme.colors.primary },
                          ]}
                          onPress={() => {
                            handleSelectExistingCategory(sim.id);
                            setCategoryQuery('');
                          }}
                        >
                          <Text style={[styles.catChipText, { color: isSelected ? '#ffffff' : theme.colors.primary }]}>
                            {sim.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TouchableOpacity
                    style={[styles.createNewConfirmBtn, { borderColor: theme.colors.border }]}
                    onPress={() => handleSelectCustomCategory(normalizedQuery)}
                  >
                    <Text style={[styles.createNewConfirmText, { color: theme.colors.text }]}>
                      {strings.gigs.confirmCreateNewCategoryPrefix} &ldquo;{normalizedQuery}&rdquo; {strings.gigs.confirmCreateNewCategorySuffix}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.createNewConfirmBtn, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft }]}
                  onPress={() => handleSelectCustomCategory(normalizedQuery)}
                >
                  <Text style={[styles.createNewConfirmText, { color: theme.colors.primary, fontWeight: '700' }]}>
                    + {strings.gigs.addNewCategoryPrefix} &ldquo;{normalizedQuery}&rdquo; {strings.gigs.addNewCategorySuffix}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <TextInput
          label="Requirements (optional)"
          placeholder="Tools, experience, or specific qualifications needed..."
          value={requirements}
          onChangeText={setRequirements}
          multiline
          numberOfLines={3}
          style={{ minHeight: 70 }}
        />

        {/* Budget Row in PHP */}
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <TextInput
              label="Min Budget (₱) *"
              placeholder="500"
              value={priceMinStr}
              onChangeText={setPriceMinStr}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <TextInput
              label="Max Budget (₱) *"
              placeholder="1000"
              value={priceMaxStr}
              onChangeText={setPriceMaxStr}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Work Type */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Work Type *</Text>
          <View style={styles.workTypeRow}>
            {(['remote', 'face_to_face', 'hybrid'] as WorkType[]).map((wt) => (
              <TouchableOpacity
                key={wt}
                style={[
                  styles.workTypeBtn,
                  { borderColor: theme.colors.border },
                  workType === wt && { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
                ]}
                onPress={() => setWorkType(wt)}
              >
                <Text style={[styles.workTypeText, workType === wt && { color: theme.colors.primary, fontWeight: '700' }]}>
                  {wt === 'remote' ? '💻 Remote' : wt === 'face_to_face' ? '🤝 Face-to-Face' : '🔄 Hybrid'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TextInput
          label="Barangay / Location in Ormoc"
          placeholder="e.g. Cogon or Ormoc City proper"
          value={area}
          onChangeText={setArea}
        />

        {/* Deadlines */}
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <TextInput
              label="Application Days"
              placeholder="7"
              value={appDays}
              onChangeText={setAppDays}
              keyboardType="numeric"
              helperText="Days to accept proposals"
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <TextInput
              label="Completion Days"
              placeholder="14"
              value={completionDays}
              onChangeText={setCompletionDays}
              keyboardType="numeric"
              helperText="Days to finish gig"
            />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <Button
            title={strings.gigs.publishBtn}
            onPress={handlePublish}
            variant="primary"
            loading={loading}
            disabled={loading}
            style={{ marginBottom: 12 }}
          />
          <Button
            title={strings.gigs.saveDraftBtn}
            onPress={handleSaveDraft}
            variant="secondary"
            disabled={loading}
          />
        </View>
      </ScrollView>
    </View>
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
    paddingBottom: 60,
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
  fieldGroup: {
    marginBottom: 16,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  helperSubtext: {
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 16,
  },
  aiSuggestBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  aiSuggestBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectedCustomBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  selectedCustomText: {
    fontSize: 13,
  },
  suggestedSection: {
    marginBottom: 10,
  },
  subSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  catRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  catChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  didYouMeanBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  didYouMeanTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  similarChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  createNewConfirmBtn: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  createNewConfirmText: {
    fontSize: 13,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
  },
  workTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  workTypeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  workTypeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionRow: {
    marginTop: 16,
  },
  blockedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  blockedIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  blockedTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  blockedDesc: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});


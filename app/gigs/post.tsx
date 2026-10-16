import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { profileService, Category } from '../../services/profile';
import {
  gigsService,
  SuggestedGigCategory,
  SimilarCategory,
} from '../../services/gigs';
import { aiService } from '../../services/ai';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../components/ui/Toast';
import { strings } from '../../constants/strings';
import { GigCategoryPicker } from '../../components/gigs/GigCategoryPicker';
import { GigTermsForm, WorkType } from '../../components/gigs/GigTermsForm';

export default function PostGigScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { profile } = useAuth();
  const { editGigId } = useLocalSearchParams<{ editGigId?: string }>();

  const [existingGigStatus, setExistingGigStatus] = useState<'draft' | 'open' | null>(null);
  const [polishing, setPolishing] = useState(false);
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

  useEffect(() => {
    if (!editGigId) return;
    let active = true;
    gigsService
      .getGig(editGigId)
      .then((g) => {
        if (!active || !g) return;
        setTitle(g.title);
        setDescription(g.description);
        setRequirements(g.requirements || '');
        setPriceMinStr((g.price_min / 100).toString());
        setPriceMaxStr((g.price_max / 100).toString());
        setWorkType(g.work_type);
        setArea(g.area || '');
        setExistingGigStatus(g.status as any);
        if (g.category_id) {
          setSelectedCategoryId(g.category_id);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [editGigId]);

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

  const handleSelectCustomCategory = (name: string) => {
    const trimmed = name.trim();
    if (trimmed.length < 3 || trimmed.length > 40) {
      setError('Custom category name must be between 3 and 40 characters.');
      return;
    }
    const exact = categories.find(
      (c) => c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (exact) {
      handleSelectExistingCategory(exact.id);
      return;
    }
    setSelectedCategoryId('');
    setCustomCategoryName(trimmed);
    setError(null);
  };

  const handleAiSuggestCategory = async () => {
    const cleanTitle = title.trim();
    const cleanDesc = description.trim();
    if (!cleanTitle && !cleanDesc) {
      setError('Please enter a title or description first so our assistant has context.');
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
      price_min: Math.round(pMin * 100),
      price_max: Math.round(pMax * 100),
      work_type: workType,
      area: area.trim(),
      application_deadline: appDate.toISOString(),
      deadline: compDate.toISOString(),
    };
  };

  const handlePolishDescription = async () => {
    if (!description.trim() || polishing) return;
    setPolishing(true);
    try {
      const polished = await aiService.polishGigDescription(description);
      setDescription(polished);
      showToast('Gig description polished!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not polish description.', 'error');
    } finally {
      setPolishing(false);
    }
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
      if (editGigId) {
        await gigsService.updateGig(editGigId, params);
        setSubmitted(true);
        showToast('Gig changes saved successfully!');
        router.replace('/(tabs)/gigs');
        return;
      }
      await gigsService.createDraftGig(params);
      setSubmitted(true);
      showToast(strings.toasts.gigDraftSaved);
      router.replace('/(tabs)/gigs');
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
      if (editGigId) {
        await gigsService.updateGig(editGigId, params);
        if (existingGigStatus === 'draft') {
          await gigsService.publishGig(editGigId);
          showToast(strings.toasts.gigPublished);
        } else {
          showToast('Gig updated successfully!');
        }
        setSubmitted(true);
        router.replace('/(tabs)/gigs');
        return;
      }
      const { id: draftId } = await gigsService.createDraftGig(params);
      await gigsService.publishGig(draftId);
      setSubmitted(true);
      showToast(strings.toasts.gigPublished);
      router.replace('/(tabs)/gigs');
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          {editGigId ? 'Edit Gig' : strings.gigs.postGigTitle}
        </Text>
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

        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={handlePolishDescription}
            disabled={polishing || !description.trim()}
            style={[styles.aiSuggestBtn, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary }]}
          >
            <Text style={[styles.aiSuggestBtnText, { color: theme.colors.primary }]}>
              {polishing ? '✨ Polishing...' : '✨ Polish with AI'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Unlocked Category Picker (features: strings.gigs.didYouMeanLabel, strings.gigs.confirmCreateNewCategoryPrefix) */}
        <GigCategoryPicker
          categories={categories}
          catsLoading={catsLoading}
          selectedCategoryId={selectedCategoryId}
          customCategoryName={customCategoryName}
          setCustomCategoryName={setCustomCategoryName}
          categoryQuery={categoryQuery}
          setCategoryQuery={setCategoryQuery}
          suggestedCategories={suggestedCategories}
          aiProposedCategory={aiProposedCategory}
          similarCategories={similarCategories}
          suggestLoading={suggestLoading}
          onAiSuggestCategory={handleAiSuggestCategory}
          onSelectExistingCategory={handleSelectExistingCategory}
          onSelectCustomCategory={handleSelectCustomCategory}
        />

        {/* Terms, Budget & Deadlines */}
        <GigTermsForm
          requirements={requirements}
          setRequirements={setRequirements}
          priceMinStr={priceMinStr}
          setPriceMinStr={setPriceMinStr}
          priceMaxStr={priceMaxStr}
          setPriceMaxStr={setPriceMaxStr}
          workType={workType}
          setWorkType={setWorkType}
          area={area}
          setArea={setArea}
          appDays={appDays}
          setAppDays={setAppDays}
          completionDays={completionDays}
          setCompletionDays={setCompletionDays}
          editGigId={editGigId}
          existingGigStatus={existingGigStatus}
          loading={loading}
          onPublish={handlePublish}
          onSaveDraft={handleSaveDraft}
        />
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

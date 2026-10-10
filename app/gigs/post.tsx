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
import { gigsService } from '../../services/gigs';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { strings } from '../../constants/strings';

type WorkType = 'remote' | 'face_to_face' | 'hybrid';

export default function PostGigScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user, profile } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
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
    profileService.getCategories()
      .then((data) => {
        if (mounted) {
          setCategories(data);
          if (data.length > 0) setSelectedCategory(data[0].id);
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

  const validateAndBuildParams = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) throw new Error('Gig title is required.');
    if (trimmedTitle.length < 5 || trimmedTitle.length > 80) {
      throw new Error('Gig title must be between 5 and 80 characters.');
    }

    if (!selectedCategory) {
      throw new Error('Please select a category for this gig.');
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
      category_id: selectedCategory,
      price_min: Math.round(pMin * 100), // convert PHP to integer centavos
      price_max: Math.round(pMax * 100), // convert PHP to integer centavos
      work_type: workType,
      area: area.trim(),
      application_deadline: appDate.toISOString(),
      deadline: compDate.toISOString(),
    };
  };

  const handleSaveDraft = async () => {
    setError(null);
    try {
      const params = validateAndBuildParams();
      setLoading(true);
      await gigsService.createDraftGig(params);
      Alert.alert('Draft Saved', 'Your gig draft has been saved successfully.', [
        {
          text: 'OK',
          onPress: () => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/gigs');
            }
          },
        },
      ]);
    } catch (err: any) {
      setError(err?.message || 'Could not save draft.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    setError(null);
    try {
      const params = validateAndBuildParams();
      setLoading(true);
      const { id: draftId } = await gigsService.createDraftGig(params);
      await gigsService.publishGig(draftId);
      Alert.alert('Gig Published!', 'Your gig is now open for local applicants in Ormoc City.', [
        { text: 'View Gigs', onPress: () => router.replace('/(tabs)/gigs') },
      ]);
    } catch (err: any) {
      setError(err?.message || 'Could not publish gig.');
    } finally {
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

        {/* Category Picker */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Category *</Text>
          {catsLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : categories.length === 0 ? (
            <View style={[styles.emptyBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.emptyNoticeTitle, { color: theme.colors.text }]}>
                {strings.gigs.noCategoriesTitle}
              </Text>
              <Text style={[styles.emptyNotice, { color: theme.colors.muted }]}>
                {strings.gigs.noCategoriesDesc}
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.catChip,
                    { borderColor: theme.colors.border },
                    selectedCategory === cat.id && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <Text style={[styles.catChipText, selectedCategory === cat.id && { color: '#ffffff' }]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <TextInput
          label="Description *"
          placeholder="Detailed explanation of the project or task..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={{ minHeight: 90 }}
        />

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
            disabled={loading || categories.length === 0}
            style={{ marginBottom: 12 }}
          />
          <Button
            title={strings.gigs.saveDraftBtn}
            onPress={handleSaveDraft}
            variant="secondary"
            disabled={loading || categories.length === 0}
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
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  catRow: {
    flexDirection: 'row',
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
  emptyBox: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  emptyNoticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyNotice: {
    fontSize: 13,
    lineHeight: 18,
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


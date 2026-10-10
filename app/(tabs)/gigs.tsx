import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput as RNTextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { gigsService } from '../../services/gigs';
import { profileService, Category } from '../../services/profile';
import { GigCard, GigSummary } from '../../components/ui/GigCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Chip } from '../../components/ui/Chip';
import { strings } from '../../constants/strings';

type WorkTypeFilter = 'all' | 'remote' | 'face_to_face' | 'hybrid';

export default function GigsScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  const [gigs, setGigs] = useState<GigSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [workTypeFilter, setWorkTypeFilter] = useState<WorkTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoriesData, gigsData] = await Promise.all([
        profileService.getCategories().catch(() => []),
        gigsService.getGigs({
          categoryId: selectedCategory || undefined,
          workType: workTypeFilter === 'all' ? undefined : workTypeFilter,
          searchQuery: searchQuery.trim() || undefined,
        }),
      ]);
      setCategories(categoriesData);
      setGigs(gigsData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load gigs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory, workTypeFilter]);

  const handleSearchSubmit = () => {
    loadData();
  };

  const filters: { id: WorkTypeFilter; label: string; icon?: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { id: 'all', label: strings.gigs.filterAll },
    { id: 'remote', label: strings.gigs.filterRemote, icon: 'laptop-outline' },
    { id: 'face_to_face', label: strings.gigs.filterFaceToFace, icon: 'people-outline' },
    { id: 'hybrid', label: strings.gigs.filterHybrid, icon: 'swap-horizontal-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={styles.titleRow}>
          <Text style={[theme.type.title, { color: theme.colors.text }]}>{strings.gigs.title}</Text>
          <Text style={[theme.type.small, { color: theme.colors.muted }]}>
            {loading ? '' : `${gigs.length} ${gigs.length === 1 ? 'gig' : 'gigs'}`}
          </Text>
        </View>

        <View style={[styles.searchBox, { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radii.input }]}>
          <Ionicons name="search" size={18} color={theme.colors.muted} />
          <RNTextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder={strings.gigs.searchPlaceholder}
            placeholderTextColor={theme.colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          {searchQuery ? (
            <Pressable
              onPress={() => {
                setSearchQuery('');
                loadData();
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color={theme.colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((f) => (
            <Chip
              key={f.id}
              label={f.label}
              icon={f.icon}
              selected={workTypeFilter === f.id}
              onPress={() => setWorkTypeFilter(f.id)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {error ? (
          <ErrorState message={error} onRetry={loadData} />
        ) : loading ? (
          <View style={styles.skeletonContainer}>
            <Skeleton height={150} borderRadius={20} style={{ marginBottom: 12 }} />
            <Skeleton height={150} borderRadius={20} style={{ marginBottom: 12 }} />
            <Skeleton height={150} borderRadius={20} style={{ marginBottom: 12 }} />
          </View>
        ) : gigs.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title={strings.gigs.noGigsTitle}
            description={strings.gigs.noGigsDesc}
            actionTitle="Refresh"
            onAction={loadData}
          />
        ) : (
          gigs.map((gig) => (
            <GigCard
              key={gig.id}
              gig={gig}
              onPress={() => router.push({ pathname: '/gigs/[id]', params: { id: gig.id } })}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 46, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  filterRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  listContent: { padding: 16, paddingBottom: 40 },
  skeletonContainer: { paddingTop: 8 },
});

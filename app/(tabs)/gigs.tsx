import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput as RNTextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { gigsService } from '../../services/gigs';
import { profileService, Category } from '../../services/profile';
import { GigCard, GigSummary } from '../../components/ui/GigCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{strings.gigs.title}</Text>

        {/* Search input */}
        <View style={[styles.searchBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.bg }]}>
          <Text style={styles.searchIcon}>🔍</Text>
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
            <TouchableOpacity onPress={() => { setSearchQuery(''); loadData(); }}>
              <Text style={{ color: theme.colors.muted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Work type filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterPill,
              { borderColor: theme.colors.border },
              workTypeFilter === 'all' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
            ]}
            onPress={() => setWorkTypeFilter('all')}
          >
            <Text style={[styles.filterText, workTypeFilter === 'all' && { color: '#ffffff' }]}>
              {strings.gigs.filterAll}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              { borderColor: theme.colors.border },
              workTypeFilter === 'remote' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
            ]}
            onPress={() => setWorkTypeFilter('remote')}
          >
            <Text style={[styles.filterText, workTypeFilter === 'remote' && { color: '#ffffff' }]}>
              💻 {strings.gigs.filterRemote}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              { borderColor: theme.colors.border },
              workTypeFilter === 'face_to_face' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
            ]}
            onPress={() => setWorkTypeFilter('face_to_face')}
          >
            <Text style={[styles.filterText, workTypeFilter === 'face_to_face' && { color: '#ffffff' }]}>
              🤝 {strings.gigs.filterFaceToFace}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              { borderColor: theme.colors.border },
              workTypeFilter === 'hybrid' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
            ]}
            onPress={() => setWorkTypeFilter('hybrid')}
          >
            <Text style={[styles.filterText, workTypeFilter === 'hybrid' && { color: '#ffffff' }]}>
              🔄 {strings.gigs.filterHybrid}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Gigs List */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {error ? (
          <ErrorState message={error} onRetry={loadData} />
        ) : loading ? (
          <View style={styles.skeletonContainer}>
            <Skeleton height={140} style={{ marginBottom: 12 }} />
            <Skeleton height={140} style={{ marginBottom: 12 }} />
            <Skeleton height={140} style={{ marginBottom: 12 }} />
          </View>
        ) : gigs.length === 0 ? (
          <EmptyState
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
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  skeletonContainer: {
    paddingTop: 8,
  },
});

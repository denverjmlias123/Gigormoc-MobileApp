import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput as RNTextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { gigsService } from '../../services/gigs';
import { applicationsService } from '../../services/applications';
import { profileService, Category } from '../../services/profile';
import { GigCard, GigSummary } from '../../components/ui/GigCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Chip } from '../../components/ui/Chip';
import { Button } from '../../components/ui/Button';
import { mapSqlErrorToFriendlyMessage, strings } from '../../constants/strings';
import { confirmDialog } from '../../lib/dialog';
import { showToast } from '../../components/ui/Toast';

type WorkTypeFilter = 'all' | 'remote' | 'face_to_face' | 'hybrid';
type ClientSegment = 'my_gigs' | 'marketplace';
type ClientStatusFilter = 'all' | 'open' | 'draft' | 'in_progress' | 'closed';

export default function GigsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user } = useAuth();

  const isClient = theme.isClient;

  // Freelancer / Shared Browse State
  const [gigs, setGigs] = useState<GigSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [workTypeFilter, setWorkTypeFilter] = useState<WorkTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Client Specific State
  const [clientSegment, setClientSegment] = useState<ClientSegment>('my_gigs');
  const [myGigs, setMyGigs] = useState<GigSummary[]>([]);
  const [clientStatusFilter, setClientStatusFilter] = useState<ClientStatusFilter>('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingGigId, setDeletingGigId] = useState<string | null>(null);

  const loadData = async (searchOverride = searchQuery) => {
    setLoading(true);
    setError(null);
    try {
      if (isClient && clientSegment === 'my_gigs') {
        if (user) {
          const myGigsData = await gigsService.getMyGigs(user.id);
          setMyGigs(myGigsData);
        }
      } else {
        const [categoriesData, gigsData] = await Promise.all([
          gigsService.getBrowseCategories(),
          gigsService.getGigs({
            categoryId: selectedCategory || undefined,
            workType: workTypeFilter === 'all' ? undefined : workTypeFilter,
            searchQuery: searchOverride.trim() || undefined,
          }),
        ]);
        setCategories(categoriesData);
        setGigs(gigsData);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load gigs.');
    } finally {
      setLoading(false);
    }
  };

  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  useFocusEffect(
    useCallback(() => {
      void loadDataRef.current();
      return gigsService.subscribeToGigChanges(
        () => void loadDataRef.current(),
        isClient && clientSegment === 'my_gigs' ? user?.id : undefined
      );
    }, [isClient, clientSegment, selectedCategory, workTypeFilter, user?.id])
  );

  const handleGigPress = useCallback((gigId: string) => {
    router.push({ pathname: '/gigs/[id]', params: { id: gigId } });
  }, [router]);

  const handleSearchSubmit = () => {
    loadData();
  };

  const handleDeleteGig = async (gig: GigSummary) => {
    try {
      const applications = await applicationsService.getGigApplicants(gig.id);
      const pending = applications.filter((app) => app.status === 'applied' || app.status === 'countered').length;
      const confirmed = await confirmDialog({
        title: strings.gigs.deleteGigTitle,
        message: pending > 0
          ? pending === 1 ? strings.gigs.deleteGigApplicantsOneMessage : strings.gigs.deleteGigApplicantsManyMessage.replace('{count}', String(pending))
          : strings.gigs.deleteGigNoApplicantsMessage,
        confirmText: strings.gigs.deleteGigConfirm,
        cancelText: strings.gigs.keepGig,
        destructive: true,
      });
      if (!confirmed) return;
      setDeletingGigId(gig.id);
      const notified = await gigsService.deleteGig(gig.id, 'Deleted by client');
      await loadData();
      showToast(notified === 1 ? strings.toasts.gigDeletedOneApplicant : notified > 1 ? strings.toasts.gigDeletedApplicants.replace('{count}', String(notified)) : strings.toasts.gigDeleted);
    } catch (err: any) {
      showToast(mapSqlErrorToFriendlyMessage(err, 'Could not delete this gig.'), 'error');
    } finally {
      setDeletingGigId(null);
    }
  };

  const workFilters: { id: WorkTypeFilter; label: string; icon?: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { id: 'all', label: strings.gigs.filterAll },
    { id: 'remote', label: strings.gigs.filterRemote, icon: 'laptop-outline' },
    { id: 'face_to_face', label: strings.gigs.filterFaceToFace, icon: 'people-outline' },
    { id: 'hybrid', label: strings.gigs.filterHybrid, icon: 'swap-horizontal-outline' },
  ];

  const clientStatusFilters: { id: ClientStatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'Open' },
    { id: 'draft', label: 'Drafts' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'closed', label: 'Closed' },
  ];

  const filteredMyGigs = myGigs.filter((g) => {
    if (clientStatusFilter === 'all') return true;
    if (clientStatusFilter === 'closed') {
      return ['completed', 'cancelled', 'expired'].includes(g.status);
    }
    return g.status === clientStatusFilter;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={styles.titleRow}>
          <Text style={[theme.type.title, { color: theme.colors.text }]}>
            {isClient ? 'My Gigs' : 'Browse Gigs'}
          </Text>
          {isClient && (
            <TouchableOpacity
              style={[styles.postButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => router.push('/gigs/post')}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.postButtonText}>Post Gig</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Client Segmented Control: My Gigs vs Marketplace */}
        {isClient && (
          <View style={[styles.segmentContainer, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
            <TouchableOpacity
              style={[
                styles.segmentItem,
                clientSegment === 'my_gigs' && [styles.segmentActive, { backgroundColor: theme.colors.surface }],
              ]}
              onPress={() => setClientSegment('my_gigs')}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: clientSegment === 'my_gigs' ? theme.colors.primary : theme.colors.muted },
                ]}
              >
                My Gigs ({myGigs.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentItem,
                clientSegment === 'marketplace' && [styles.segmentActive, { backgroundColor: theme.colors.surface }],
              ]}
              onPress={() => setClientSegment('marketplace')}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: clientSegment === 'marketplace' ? theme.colors.primary : theme.colors.muted },
                ]}
              >
                Marketplace (Read-only)
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Search Input for Browse / Marketplace */}
        {(!isClient || clientSegment === 'marketplace') && (
          <>
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
                    void loadData('');
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
              {workFilters.map((f) => (
                <Chip
                  key={f.id}
                  label={f.label}
                  icon={f.icon}
                  selected={workTypeFilter === f.id}
                  onPress={() => setWorkTypeFilter(f.id)}
                />
              ))}
            </ScrollView>

            {categories.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.filterRow, { marginTop: 6 }]}
              >
                <Chip
                  key="cat-all"
                  label={strings.gigs.filterAllCategories}
                  selected={selectedCategory === null}
                  onPress={() => setSelectedCategory(null)}
                />
                {categories.map((cat) => (
                  <Chip
                    key={`cat-${cat.id}`}
                    label={cat.name}
                    selected={selectedCategory === cat.id}
                    onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  />
                ))}
              </ScrollView>
            )}
          </>
        )}

        {/* Status Filters for Client My Gigs */}
        {isClient && clientSegment === 'my_gigs' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {clientStatusFilters.map((f) => (
              <Chip
                key={f.id}
                label={f.label}
                selected={clientStatusFilter === f.id}
                onPress={() => setClientStatusFilter(f.id)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* List Body */}
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {error ? (
          <ErrorState message={error} onRetry={loadData} />
        ) : loading ? (
          <View style={styles.skeletonContainer}>
            <Skeleton height={150} borderRadius={20} style={{ marginBottom: 12 }} />
            <Skeleton height={150} borderRadius={20} style={{ marginBottom: 12 }} />
            <Skeleton height={150} borderRadius={20} style={{ marginBottom: 12 }} />
          </View>
        ) : isClient && clientSegment === 'my_gigs' ? (
          filteredMyGigs.length === 0 ? (
            <EmptyState
              icon="briefcase-outline"
              title="No posted gigs found"
              description="You have not created any gigs matching this filter."
              actionTitle="Post a Gig"
              onAction={() => router.push('/gigs/post')}
            />
          ) : (
            filteredMyGigs.map((gig) => (
              <GigCard
                key={gig.id}
                gig={gig}
                onPress={() => handleGigPress(gig.id)}
                onDelete={['open', 'draft', 'cancelled', 'expired'].includes(gig.status) ? () => handleDeleteGig(gig) : undefined}
                deleting={deletingGigId === gig.id}
              />
            ))
          )
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
              onPress={() => handleGigPress(gig.id)}
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  postButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginBottom: 12,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 9,
  },
  segmentActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 46, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  filterRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  listContent: { padding: 16, paddingBottom: 40 },
  skeletonContainer: { paddingTop: 8 },
});

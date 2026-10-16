import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  TextInput as RNTextInput,
  Pressable,
  ScrollView,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { chatService, ConversationSummary } from '../../services/chat';
import { notificationsService } from '../../services/notifications';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Chip } from '../../components/ui/Chip';

function formatMessageTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}

export default function MessagesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGigId, setSelectedGigId] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    setError(null);
    try {
      const data = await chatService.getUserConversations();
      setConversations(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load conversations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadConversations();
      if (!user?.id) return;
      return notificationsService.subscribeToNotifications(user.id, () => {
        void loadConversations();
      });
    }, [loadConversations, user?.id])
  );

  const handleConversationPress = useCallback(
    (item: ConversationSummary) => {
      if (item.is_unread) {
        setConversations((prev) =>
          prev.map((c) => (c.id === item.id ? { ...c, is_unread: false } : c))
        );
        chatService.markConversationRead(item.id).catch(() => {});
      }

      router.push({
        pathname: '/chat/[conversationId]',
        params: {
          conversationId: item.id,
          partnerName: item.partner_name || 'Ormoc User',
        },
      });
    },
    [router]
  );

  // Distinct gigs for the filter chip bar
  const gigFilterList = useMemo(() => {
    const map = new Map<string, { id: string; title: string; count: number }>();
    for (const c of conversations) {
      const existing = map.get(c.gig_id);
      if (!existing) {
        map.set(c.gig_id, {
          id: c.gig_id,
          title: c.gig_title || 'Project Conversation',
          count: 1,
        });
      } else {
        existing.count += 1;
      }
    }
    return Array.from(map.values());
  }, [conversations]);

  // Grouped sections for SectionList
  const sections = useMemo(() => {
    let list = conversations;

    if (selectedGigId) {
      list = list.filter((c) => c.gig_id === selectedGigId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.partner_name.toLowerCase().includes(q) ||
          c.gig_title.toLowerCase().includes(q) ||
          (c.last_message_content && c.last_message_content.toLowerCase().includes(q))
      );
    }

    const groupsMap = new Map<
      string,
      { title: string; gigId: string; data: ConversationSummary[] }
    >();

    for (const c of list) {
      let group = groupsMap.get(c.gig_id);
      if (!group) {
        group = {
          title: c.gig_title || 'Project Conversation',
          gigId: c.gig_id,
          data: [],
        };
        groupsMap.set(c.gig_id, group);
      }
      group.data.push(c);
    }

    return Array.from(groupsMap.values());
  }, [conversations, selectedGigId, searchQuery]);

  const keyExtractor = useCallback((item: ConversationSummary) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: ConversationSummary }) => (
      <ConversationCard item={item} theme={theme} onPress={handleConversationPress} />
    ),
    [theme, handleConversationPress]
  );

  const renderSectionHeader = useCallback(
    ({ section: { title, data } }: { section: { title: string; data: ConversationSummary[] } }) => (
      <View
        style={[
          styles.sectionHeaderContainer,
          { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
        ]}
      >
        <View style={styles.sectionHeaderLeft}>
          <Ionicons name="briefcase-outline" size={15} color={theme.colors.primary} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={[styles.sectionBadge, { backgroundColor: theme.colors.surfaceAlt }]}>
          <Text style={[styles.sectionBadgeText, { color: theme.colors.muted }]}>
            {data.length} {data.length === 1 ? 'applicant' : 'applicants'}
          </Text>
        </View>
      </View>
    ),
    [theme]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border },
        ]}
      >
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Messages</Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.muted }]}>
          Conversations with clients and freelancers
        </Text>

        {/* Search bar */}
        {conversations.length > 0 && (
          <View
            style={[
              styles.searchBox,
              { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radii.input },
            ]}
          >
            <Ionicons name="search" size={18} color={theme.colors.muted} />
            <RNTextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Search by name, gig, or message..."
              placeholderTextColor={theme.colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery ? (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={theme.colors.muted} />
              </Pressable>
            ) : null}
          </View>
        )}

        {/* Project / Gig Filter Chips */}
        {gigFilterList.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipsRow}
          >
            <Chip
              key="all"
              label={`All Gigs (${conversations.length})`}
              selected={selectedGigId === null}
              onPress={() => setSelectedGigId(null)}
            />
            {gigFilterList.map((g) => (
              <Chip
                key={g.id}
                label={`${g.title} (${g.count})`}
                selected={selectedGigId === g.id}
                onPress={() => setSelectedGigId(selectedGigId === g.id ? null : g.id)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={loadConversations} />
      ) : conversations.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title="No conversations yet"
          description="When you apply for a gig or receive proposals, real-time messaging starts here."
        />
      ) : sections.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No conversations found"
          description="Try clearing your search or selecting a different project."
          actionTitle="Reset filters"
          onAction={() => {
            setSearchQuery('');
            setSelectedGigId(null);
          }}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadConversations();
              }}
              tintColor={theme.colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const ConversationCard = React.memo(function ConversationCard({
  item,
  theme,
  onPress,
}: {
  item: ConversationSummary;
  theme: any;
  onPress: (item: ConversationSummary) => void;
}) {
  const formattedTime = formatMessageTime(item.last_message_created_at);

  return (
    <TouchableOpacity
      style={[
        styles.convCard,
        {
          backgroundColor: item.is_unread ? theme.colors.surfaceAlt : theme.colors.surface,
          borderColor: theme.colors.border,
        },
        theme.shadow.card,
      ]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${item.partner_name}, regarding ${item.gig_title}`}
    >
      <Avatar
        name={item.partner_name || 'U'}
        imageUri={item.partner_avatar}
        size={48}
      />

      <View style={styles.convDetails}>
        <View style={styles.nameRow}>
          <Text style={[styles.partnerName, { color: theme.colors.text }]} numberOfLines={1}>
            {item.partner_name || 'Anonymous User'}
          </Text>
          {formattedTime ? (
            <Text style={[styles.timeText, { color: theme.colors.muted }]}>
              {formattedTime}
            </Text>
          ) : null}
        </View>

        <View style={styles.messageRow}>
          <Text
            style={[
              styles.previewText,
              {
                color: item.is_unread ? theme.colors.text : theme.colors.muted,
                fontWeight: item.is_unread ? '700' : '400',
              },
            ]}
            numberOfLines={1}
          >
            {item.last_message_content || 'No messages yet.'}
          </Text>
          {item.is_unread && (
            <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 12,
    marginBottom: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    paddingRight: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    marginBottom: 8,
  },
  convDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  partnerName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  timeText: {
    fontSize: 11,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewText: {
    fontSize: 13,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
});

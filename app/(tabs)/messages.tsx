import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
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

export default function MessagesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleConversationPress = useCallback((item: ConversationSummary) => {
    // Optimistic unread removal
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
  }, [router]);

  const keyExtractor = useCallback((item: ConversationSummary) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: ConversationSummary }) => (
      <ConversationCard item={item} theme={theme} onPress={handleConversationPress} />
    ),
    [theme, handleConversationPress]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Messages</Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.muted }]}>
          Conversations with clients and freelancers
        </Text>
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
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
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
  return (
    <TouchableOpacity
      style={[
        styles.convCard,
        {
          backgroundColor: item.is_unread ? theme.colors.surfaceAlt : theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <Avatar name={item.partner_name || 'U'} size={48} />

      <View style={styles.convDetails}>
        <View style={styles.nameRow}>
          <Text style={[styles.partnerName, { color: theme.colors.text }]} numberOfLines={1}>
            {item.partner_name || 'Anonymous User'}
          </Text>
          {item.last_message_created_at && (
            <Text style={[styles.timeText, { color: theme.colors.muted }]}>
              {new Date(item.last_message_created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          )}
        </View>

        <Text style={[styles.gigBadge, { color: theme.colors.primary }]} numberOfLines={1}>
          📁 {item.gig_title}
        </Text>

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
    paddingBottom: 16,
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
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 10,
  },
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
  },
  convDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  timeText: {
    fontSize: 12,
  },
  gigBadge: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
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

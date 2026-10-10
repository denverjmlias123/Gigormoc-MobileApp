import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from './theme';
import { useAuth } from '../hooks/useAuth';
import { notificationsService, NotificationItem } from '../services/notifications';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';

export default function NotificationsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setError(null);
    try {
      const data = await notificationsService.getNotifications();
      setNotifications(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    if (user?.id) {
      const unsubscribe = notificationsService.subscribeToNotifications(user.id, (newNotif) => {
        setNotifications((prev) => [newNotif, ...prev]);
      });
      return unsubscribe;
    }
  }, [user?.id, loadNotifications]);

  const handleNotificationPress = async (item: NotificationItem) => {
    if (!item.read_at) {
      // Optimistic mark read
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      notificationsService.markAsRead(item.id).catch(() => {});
    }

    // Deep link routing based on entity_type
    if (item.entity_type === 'agreement' && item.entity_id) {
      router.push({ pathname: '/agreements/[id]', params: { id: item.entity_id } });
    } else if (item.entity_type === 'application') {
      const gigId = item.data?.gig_id;
      if (gigId) {
        router.push({ pathname: '/gigs/[id]/applicants', params: { id: gigId } });
      } else {
        router.push('/(tabs)/activity');
      }
    } else if (item.entity_type === 'gig' && item.entity_id) {
      router.push({ pathname: '/gigs/[id]', params: { id: item.entity_id } });
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
    );
    try {
      await notificationsService.markAllAsRead();
    } catch {
      loadNotifications();
    }
  };

  const getNotificationIcon = (type: string): React.ComponentProps<typeof Ionicons>['name'] => {
    switch (type) {
      case 'application_received':
      case 'application_accepted':
      case 'application_countered':
        return 'document-text-outline';
      case 'agreement_created':
      case 'agreement_completed':
        return 'shield-checkmark-outline';
      case 'milestones_defined':
      case 'milestone_submitted':
      case 'milestone_approved':
      case 'milestone_revision_requested':
        return 'flag-outline';
      case 'payment_reported':
      case 'payment_confirmed':
      case 'payment_disputed':
        return 'cash-outline';
      case 'review_received':
        return 'star-outline';
      default:
        return 'notifications-outline';
    }
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)');
              }
            }}
            style={styles.backBtn}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Notifications</Text>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={[styles.markAllText, { color: theme.colors.primary }]}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={loadNotifications} />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="notifications-off-outline"
          title="You're all caught up"
          description="When clients or freelancers respond to your gigs and milestones, you'll see notifications here."
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadNotifications();
              }}
              tintColor={theme.colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isUnread = !item.read_at;
            return (
              <TouchableOpacity
                style={[
                  styles.notificationCard,
                  {
                    backgroundColor: isUnread ? theme.colors.surfaceAlt : theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => handleNotificationPress(item)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconCircle,
                    {
                      backgroundColor: isUnread ? theme.colors.primarySoft : theme.colors.surfaceAlt,
                    },
                  ]}
                >
                  <Ionicons
                    name={getNotificationIcon(item.type)}
                    size={20}
                    color={isUnread ? theme.colors.primary : theme.colors.muted}
                  />
                </View>

                <View style={styles.contentCol}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.itemTitle, { color: theme.colors.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {isUnread && <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />}
                  </View>
                  <Text style={[styles.itemBody, { color: theme.colors.muted }]}>{item.body}</Text>
                  <Text style={[styles.itemDate, { color: theme.colors.muted }]}>
                    {new Date(item.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  markAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
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
  notificationCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
  },
  itemBody: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  itemDate: {
    fontSize: 11,
  },
});

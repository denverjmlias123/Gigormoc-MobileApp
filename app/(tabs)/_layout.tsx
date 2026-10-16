import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet } from 'react-native';
import { useAppTheme } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { chatService } from '../../services/chat';
import { notificationsService } from '../../services/notifications';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tabIcon =
  (active: IconName, inactive: IconName) =>
  ({ color, focused }: { color: any; focused: boolean }) =>
    <Ionicons name={focused ? active : inactive} size={24} color={color} />;

export default function TabLayout() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }
    let active = true;
    const fetchUnread = async () => {
      try {
        const convs = await chatService.getUserConversations();
        if (active) {
          const unread = convs.filter((c) => c.is_unread).length;
          setUnreadCount(unread);
        }
      } catch {}
    };
    void fetchUnread();
    const unsub = notificationsService.subscribeToNotifications(user.id, () => {
      void fetchUnread();
    });
    return () => {
      active = false;
      unsub();
    };
  }, [user?.id]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        sceneStyle: {
          backgroundColor: theme.colors.background,
        },
        tabBarStyle: {
          backgroundColor: theme.glass.surface,
          borderTopColor: theme.glass.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 90 : 68,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          ...(Platform.OS === 'web'
            ? ({
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 -8px 24px rgba(12, 18, 51, 0.05)',
              } as any)
            : null),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: theme.isClient ? 'Dashboard' : 'Discover',
          tabBarIcon: tabIcon(theme.isClient ? 'grid' : 'sparkles', theme.isClient ? 'grid-outline' : 'sparkles-outline'),
        }}
      />
      <Tabs.Screen
        name="gigs"
        options={{
          title: theme.isClient ? 'My Gigs' : 'Browse',
          tabBarIcon: tabIcon('briefcase', 'briefcase-outline'),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: theme.isClient ? 'Hires' : 'My Work',
          tabBarIcon: tabIcon('layers', 'layers-outline'),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: tabIcon('chatbubbles', 'chatbubbles-outline'),
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.primary,
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '700',
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: tabIcon('person-circle', 'person-circle-outline'),
        }}
      />
    </Tabs>
  );
}

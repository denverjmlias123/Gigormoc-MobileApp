import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet } from 'react-native';
import { useAppTheme } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tabIcon =
  (active: IconName, inactive: IconName) =>
  ({ color, focused }: { color: any; focused: boolean }) =>
    <Ionicons name={focused ? active : inactive} size={24} color={color} />;

export default function TabLayout() {
  const theme = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === 'ios' ? 88 : 66,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
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

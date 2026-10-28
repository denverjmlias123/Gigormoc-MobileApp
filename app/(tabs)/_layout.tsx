import React, { useEffect, useState } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme, useResponsiveLayout } from '../theme';
import { useAuth } from '../../hooks/useAuth';
import { chatService } from '../../services/chat';
import { notificationsService } from '../../services/notifications';
import { Avatar } from '../../components/ui/Avatar';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tabIcon =
  (active: IconName, inactive: IconName) =>
  ({ color, focused }: { color: any; focused: boolean }) =>
    <Ionicons name={focused ? active : inactive} size={24} color={color} />;

export default function TabLayout() {
  const theme = useAppTheme();
  const { isWide } = useResponsiveLayout();
  const { user, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      setUnreadNotifications(0);
      return;
    }
    let active = true;
    const fetchUnread = async () => {
      try {
        const [convs, notifCount] = await Promise.all([
          chatService.getUserConversations(),
          notificationsService.getUnreadCount().catch(() => 0),
        ]);
        if (active) {
          const unread = convs.filter((c) => c.is_unread).length;
          setUnreadCount(unread);
          setUnreadNotifications(notifCount);
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

  const navItems: {
    name: string;
    href: string;
    label: string;
    activeIcon: IconName;
    inactiveIcon: IconName;
    badge?: number;
  }[] = [
    {
      name: 'index',
      href: '/(tabs)',
      label: theme.isClient ? 'Dashboard' : 'Discover',
      activeIcon: theme.isClient ? 'grid' : 'sparkles',
      inactiveIcon: theme.isClient ? 'grid-outline' : 'sparkles-outline',
    },
    {
      name: 'gigs',
      href: '/(tabs)/gigs',
      label: theme.isClient ? 'My Gigs & Talent' : 'Browse Gigs',
      activeIcon: 'briefcase',
      inactiveIcon: 'briefcase-outline',
    },
    {
      name: 'activity',
      href: '/(tabs)/activity',
      label: theme.isClient ? 'Hires & Proposals' : 'My Work',
      activeIcon: 'layers',
      inactiveIcon: 'layers-outline',
    },
    {
      name: 'messages',
      href: '/(tabs)/messages',
      label: 'Messages',
      activeIcon: 'chatbubbles',
      inactiveIcon: 'chatbubbles-outline',
      badge: unreadCount,
    },
    {
      name: 'profile',
      href: '/(tabs)/profile',
      label: 'Profile',
      activeIcon: 'person-circle',
      inactiveIcon: 'person-circle-outline',
    },
  ];

  const isNavActive = (name: string) => {
    if (name === 'index') return pathname === '/' || pathname === '/index' || pathname === '/(tabs)';
    return pathname.includes(`/${name}`);
  };

  return (
    <View style={[styles.shellRoot, isWide && styles.shellRootWide]}>
      {isWide ? (
        <View
          style={[
            styles.sidebar,
            {
              backgroundColor: theme.colors.surface,
              borderRightColor: theme.colors.border,
            },
          ]}
        >
          {/* Brand Header */}
          <View style={styles.sidebarTop}>
            <Pressable
              onPress={() => router.push('/(tabs)')}
              style={styles.brandRow}
              accessibilityRole="button"
              accessibilityLabel="Gigormoc Home"
            >
              <Image source={require('../../assets/logo.png')} style={styles.brandLogo} />
              <View>
                <Text style={[styles.brandName, { color: theme.colors.text }]}>Gigormoc</Text>
                <Text style={[styles.brandCity, { color: theme.colors.muted }]}>Ormoc Marketplace</Text>
              </View>
            </Pressable>

            {/* Role Mode Badge & Switcher Link */}
            <Pressable
              onPress={() => router.push('/settings/mode')}
              style={[
                styles.roleBadgeCard,
                {
                  backgroundColor: theme.colors.primarySoft,
                  borderColor: theme.colors.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Active mode: ${theme.modeLabel}. Tap to manage account mode.`}
            >
              <View style={[styles.roleDot, { backgroundColor: theme.colors.roleAccent }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.roleBadgeLabel, { color: theme.colors.primaryDark }]}>
                  {theme.isClient ? '🤝 Client Mode (Hiring)' : '💼 Freelancer Mode'}
                </Text>
                <Text style={[styles.roleBadgeSub, { color: theme.colors.muted }]}>
                  Tap to view role settings ›
                </Text>
              </View>
            </Pressable>

            {/* Primary Role CTA */}
            <Pressable
              onPress={() =>
                router.push(theme.isClient ? '/gigs/post' : '/(tabs)/gigs')
              }
              style={({ pressed }) => [
                styles.primarySidebarCta,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
              accessibilityRole="button"
            >
              <Ionicons
                name={theme.isClient ? 'add-circle-outline' : 'compass-outline'}
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.primarySidebarCtaText}>
                {theme.isClient ? 'Post a New Gig' : 'Explore Open Gigs'}
              </Text>
            </Pressable>

            {/* Navigation Links */}
            <View style={styles.navList}>
              {navItems.map((item) => {
                const active = isNavActive(item.name);
                return (
                  <Pressable
                    key={item.name}
                    onPress={() => router.push(item.href as any)}
                    style={(state: any) => [
                      styles.navItem,
                      {
                        backgroundColor: active
                          ? theme.colors.primarySoft
                          : state.hovered
                          ? theme.colors.surfaceAlt
                          : 'transparent',
                        ...({ cursor: 'pointer' } as any),
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons
                      name={active ? item.activeIcon : item.inactiveIcon}
                      size={20}
                      color={active ? theme.colors.primary : theme.colors.muted}
                    />
                    <Text
                      style={[
                        styles.navItemLabel,
                        {
                          color: active ? theme.colors.primary : theme.colors.text,
                          fontWeight: active ? '800' : '600',
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.badge && item.badge > 0 ? (
                      <View style={[styles.navBadge, { backgroundColor: theme.colors.primary }]}>
                        <Text style={styles.navBadgeText}>
                          {item.badge > 99 ? '99+' : item.badge}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}

              {/* Persistent Notifications Link on Desktop Web */}
              <Pressable
                onPress={() => router.push('/notifications')}
                style={(state: any) => [
                  styles.navItem,
                  {
                    backgroundColor: state.hovered ? theme.colors.surfaceAlt : 'transparent',
                    ...({ cursor: 'pointer' } as any),
                  },
                ]}
                accessibilityRole="button"
              >
                <Ionicons name="notifications-outline" size={20} color={theme.colors.muted} />
                <Text style={[styles.navItemLabel, { color: theme.colors.text, fontWeight: '600' }]}>
                  Notifications
                </Text>
                {unreadNotifications > 0 ? (
                  <View style={[styles.navBadge, { backgroundColor: theme.colors.danger }]}>
                    <Text style={styles.navBadgeText}>
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
          </View>

          {/* User Footer Card */}
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={[
              styles.sidebarUserFooter,
              { borderTopColor: theme.colors.border },
            ]}
            accessibilityRole="button"
          >
            <Avatar
              name={profile?.display_name || user?.email || 'U'}
              imageUri={profile?.avatar_path}
              size={38}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.footerUserName, { color: theme.colors.text }]}
                numberOfLines={1}
              >
                {profile?.display_name || 'Ormoc Member'}
              </Text>
              <Text
                style={[styles.footerUserSub, { color: theme.colors.muted }]}
                numberOfLines={1}
              >
                {profile?.area || 'Ormoc City'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.muted} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.mainContent}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: theme.colors.primary,
            tabBarInactiveTintColor: theme.colors.muted,
            tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
            sceneStyle: {
              backgroundColor: theme.colors.background,
            },
            tabBarStyle: isWide
              ? { display: 'none' }
              : {
                  backgroundColor: theme.colors.surface,
                  borderTopColor: theme.colors.border,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  height: Platform.OS === 'ios' ? 88 : 66,
                  paddingTop: 6,
                  paddingBottom: Platform.OS === 'ios' ? 26 : 8,
                  ...(Platform.OS === 'web'
                    ? ({ boxShadow: '0 -8px 24px rgba(12, 18, 51, 0.05)' } as any)
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shellRoot: {
    flex: 1,
  },
  shellRootWide: {
    flexDirection: 'row',
  },
  sidebar: {
    width: 256,
    borderRightWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  sidebarTop: {
    gap: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 6,
  },
  brandLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  brandName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  brandCity: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  roleBadgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  roleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  roleBadgeLabel: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  roleBadgeSub: {
    fontSize: 11,
    marginTop: 1,
  },
  primarySidebarCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  primarySidebarCtaText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  navList: {
    gap: 4,
    marginTop: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  navItemLabel: {
    flex: 1,
    fontSize: 14,
  },
  navBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 22,
    alignItems: 'center',
  },
  navBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  sidebarUserFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 14,
    paddingHorizontal: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerUserName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  footerUserSub: {
    fontSize: 11.5,
  },
  mainContent: {
    flex: 1,
  },
});

